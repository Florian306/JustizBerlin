async function signToken(payload, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${payload}.${hex}`;
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const code = url.searchParams.get('code');
    if (!code) {
        return Response.redirect(`${url.origin}/#intern`, 302);
    }

    const clientId = context.env.DISCORD_CLIENT_ID;
    const clientSecret = context.env.DISCORD_CLIENT_SECRET;
    const botToken = context.env.DISCORD_BOT_TOKEN;
    const guildId = context.env.DISCORD_GUILD_ID;
    const secret = context.env.SESSION_SECRET || 'justiz-berlin-dev-secret-2026';

    if (!clientId || !clientSecret) {
        return new Response('Discord OAuth2 Environment Variables fehlen in Cloudflare.', { status: 500 });
    }

    const redirectUri = `${url.origin}/api/auth/discord/callback`;

    // 1. Code gegen Access-Token tauschen
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
        })
    });

    if (!tokenRes.ok) {
        return new Response('Discord Login fehlgeschlagen (Token-Austausch).', { status: 401 });
    }
    const tokenData = await tokenRes.json();

    // 2. Discord-Benutzer abrufen
    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userRes.ok) {
        return new Response('Discord Benutzer konnte nicht abgerufen werden.', { status: 401 });
    }
    const discordUser = await userRes.json();
    const displayName = discordUser.global_name || discordUser.username;

    // Sperrliste prüfen
    try {
        const banned = await context.env.DB.prepare('SELECT * FROM banned_users WHERE user_id = ?').bind(discordUser.id).first();
        if (banned) {
            return new Response(`Zugriff gesperrt: Dein Account wurde für das Dienstportal gesperrt (Grund: ${banned.reason || 'Keine Angabe'}).`, { status: 403 });
        }
    } catch {}

    // 3. Rollen auf dem Server prüfen (falls Bot-Token & Guild-ID gesetzt)
    let permissions = [];
    if (botToken && guildId) {
        const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUser.id}`, {
            headers: { Authorization: `Bot ${botToken}` }
        });
        if (!memberRes.ok) {
            return new Response('Du bist kein Mitglied des hinterlegten Discord-Servers.', { status: 403 });
        }
        const member = await memberRes.json();
        const roles = member.roles || [];

        // Rollen aus D1-Tabelle discord_roles laden
        let configuredRoles = [];
        try {
            const res = await context.env.DB.prepare('SELECT * FROM discord_roles').all();
            configuredRoles = res.results || [];
        } catch {}

        if (configuredRoles.length > 0) {
            const permSet = new Set();
            configuredRoles.forEach(cr => {
                if (roles.includes(cr.id)) {
                    try {
                        JSON.parse(cr.perms || '[]').forEach(p => permSet.add(p));
                    } catch {}
                }
            });
            if (!permSet.has('login')) {
                return new Response('Zugriff verweigert: Keine deiner Discord-Rollen hat die Berechtigung zum Anmelden.', { status: 403 });
            }
            permissions = Array.from(permSet);
        } else {
            // Fallback auf Environment Variables oder Vollzugriff wenn noch nichts konfiguriert
            const adminRole = context.env.ROLE_ADMIN_ID;
            const aktenRole = context.env.ROLE_AKTEN_ID;
            const gesetzeRole = context.env.ROLE_GESETZE_ID;

            if (!adminRole && !aktenRole && !gesetzeRole) {
                permissions = ['akten', 'gesetze', 'logs'];
            } else {
                if (adminRole && roles.includes(adminRole)) permissions = ['akten', 'gesetze', 'logs'];
                else {
                    if (aktenRole && roles.includes(aktenRole)) permissions.push('akten');
                    if (gesetzeRole && roles.includes(gesetzeRole)) permissions.push('gesetze');
                }
            }
        }

        if (permissions.length === 0) {
            return new Response('Zugriff verweigert: Du besitzt keine berechtigte Justiz-Rolle auf dem Discord-Server.', { status: 403 });
        }
    } else {
        // Fallback falls noch keine Guild/Rollen konfiguriert sind
        permissions = ['akten', 'gesetze', 'logs'];
    }

    const payload = btoa(JSON.stringify({
        user: displayName,
        permissions,
        exp: Date.now() + 1000 * 60 * 60 * 12
    }));
    const token = await signToken(payload, secret);

    return new Response(null, {
        status: 302,
        headers: {
            'Location': `${url.origin}/#intern`,
            'Set-Cookie': `justiz_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
        }
    });
}
