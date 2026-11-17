import { verifySession } from './_session.js';

async function ensureRolesTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS role_config (
            key TEXT PRIMARY KEY,
            role_ids TEXT
        )
    `).run();
}

export async function onRequestGet(context) {
    const session = await verifySession(context);
    if (!session || !(session.permissions || ['logs']).includes('logs')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureRolesTable(context.env.DB);
    const { results } = await context.env.DB.prepare('SELECT * FROM role_config').all();
    const map = { admin: '', akten: '', gesetze: '' };
    results.forEach(r => { map[r.key] = r.role_ids || ''; });
    return Response.json(map);
}

export async function onRequestPost(context) {
    const session = await verifySession(context);
    if (!session || !(session.permissions || ['logs']).includes('logs')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureRolesTable(context.env.DB);
    const body = await context.request.json();

    for (const key of ['admin', 'akten', 'gesetze']) {
        await context.env.DB.prepare(
            'INSERT INTO role_config (key, role_ids) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET role_ids = excluded.role_ids'
        ).bind(key, (body[key] || '').trim()).run();
    }

    return Response.json({ ok: true });
}
