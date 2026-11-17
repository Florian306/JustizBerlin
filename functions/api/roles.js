import { verifySession } from './_session.js';

async function ensureRolesTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS discord_roles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            perms TEXT NOT NULL
        )
    `).run();
}

export async function onRequestGet(context) {
    const session = await verifySession(context);
    if (!session || !(session.permissions || ['logs']).includes('logs')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureRolesTable(context.env.DB);
    const { results } = await context.env.DB.prepare('SELECT * FROM discord_roles ORDER BY rowid ASC').all();
    const savedMap = new Map();
    results.forEach(r => savedMap.set(r.id, { id: r.id, name: r.name, perms: JSON.parse(r.perms || '[]') }));

    const botToken = context.env.DISCORD_BOT_TOKEN;
    const guildId = context.env.DISCORD_GUILD_ID;

    if (botToken && guildId) {
        try {
            const dcRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                headers: { Authorization: `Bot ${botToken}` }
            });
            if (dcRes.ok) {
                const dcRoles = await dcRes.json();
                const merged = dcRoles
                    .filter(r => r.name !== '@everyone' && !r.managed)
                    .sort((a, b) => b.position - a.position)
                    .map(r => {
                        const saved = savedMap.get(r.id);
                        return {
                            id: r.id,
                            name: r.name,
                            perms: saved ? saved.perms : []
                        };
                    });
                return Response.json(merged);
            }
        } catch {}
    }

    return Response.json(Array.from(savedMap.values()));
}

export async function onRequestPost(context) {
    const session = await verifySession(context);
    if (!session || !(session.permissions || ['logs']).includes('logs')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureRolesTable(context.env.DB);
    const body = await context.request.json();
    const id = (body.id || '').trim();
    const name = (body.name || '').trim();
    const perms = JSON.stringify(body.perms || []);

    if (!id || !name) {
        return Response.json({ error: 'Missing id or name' }, { status: 400 });
    }

    await context.env.DB.prepare(
        'INSERT INTO discord_roles (id, name, perms) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, perms = excluded.perms'
    ).bind(id, name, perms).run();

    return Response.json({ id, name, perms: body.perms || [] }, { status: 201 });
}

export async function onRequestDelete(context) {
    const session = await verifySession(context);
    if (!session || !(session.permissions || ['logs']).includes('logs')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureRolesTable(context.env.DB);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    await context.env.DB.prepare('DELETE FROM discord_roles WHERE id = ?').bind(id).run();
    return Response.json({ deleted: id });
}
