import { verifySession } from './_session.js';

async function ensureBansTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS banned_users (
            user_id TEXT PRIMARY KEY,
            name TEXT,
            reason TEXT,
            bannedAt TEXT
        )
    `).run();
}

export async function onRequestGet(context) {
    const session = await verifySession(context);
    if (!session || !(session.permissions || ['logs']).includes('logs')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureBansTable(context.env.DB);
    const { results } = await context.env.DB.prepare('SELECT * FROM banned_users ORDER BY rowid DESC').all();
    return Response.json(results);
}

export async function onRequestPost(context) {
    const session = await verifySession(context);
    if (!session || !(session.permissions || ['logs']).includes('logs')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureBansTable(context.env.DB);
    const body = await context.request.json();
    const userId = (body.user_id || '').trim();
    const name = (body.name || '').trim() || userId;
    const reason = (body.reason || '').trim() || 'Durch Senator/Admin gesperrt';
    const bannedAt = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (!userId) return Response.json({ error: 'Missing user_id' }, { status: 400 });

    await context.env.DB.prepare(
        'INSERT INTO banned_users (user_id, name, reason, bannedAt) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, reason = excluded.reason'
    ).bind(userId, name, reason, bannedAt).run();

    return Response.json({ user_id: userId, name, reason, bannedAt }, { status: 201 });
}

export async function onRequestDelete(context) {
    const session = await verifySession(context);
    if (!session || !(session.permissions || ['logs']).includes('logs')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureBansTable(context.env.DB);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    await context.env.DB.prepare('DELETE FROM banned_users WHERE user_id = ?').bind(id).run();
    return Response.json({ deleted: id });
}
