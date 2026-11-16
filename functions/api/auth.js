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

async function verifyToken(token, secret) {
    if (!token || !token.includes('.')) return null;
    const [payload, hex] = token.split('.');
    const expected = await signToken(payload, secret);
    if (token !== expected) return null;
    try {
        const data = JSON.parse(atob(payload));
        if (data.exp && Date.now() > data.exp) return null;
        return data;
    } catch {
        return null;
    }
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export async function onRequestGet(context) {
    const secret = context.env.SESSION_SECRET || 'justiz-berlin-dev-secret-2026';
    const token = getCookie(context.request, 'justiz_session');
    const data = await verifyToken(token, secret);
    if (!data) {
        return Response.json({ authenticated: false }, { status: 401 });
    }
    return Response.json({ authenticated: true, user: data.user });
}

export async function onRequestPost(context) {
    const body = await context.request.json();
    const expectedUser = context.env.ADMIN_USER || 'justiz-berlin';
    const expectedPass = context.env.ADMIN_PASS || 'SenJust2026!';
    const secret = context.env.SESSION_SECRET || 'justiz-berlin-dev-secret-2026';

    if (body.user !== expectedUser || body.pass !== expectedPass) {
        return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const payload = btoa(JSON.stringify({
        user: body.user,
        exp: Date.now() + 1000 * 60 * 60 * 12 // 12 Stunden gültig
    }));
    const token = await signToken(payload, secret);

    return new Response(JSON.stringify({ authenticated: true, user: body.user }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `justiz_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
        }
    });
}

export async function onRequestDelete() {
    return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'justiz_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
        }
    });
}
