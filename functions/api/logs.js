import { verifySession } from './_session.js';

async function ensureLogsTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            user TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT
        )
    `).run();
}

export async function onRequestGet(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureLogsTable(context.env.DB);
    const { results } = await context.env.DB.prepare(
        'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100'
    ).all();
    return Response.json(results);
}

export async function onRequestPost(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureLogsTable(context.env.DB);
    const body = await context.request.json();
    const timestamp = body.timestamp || new Date().toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + ' Uhr';

    await context.env.DB.prepare(
        'INSERT INTO audit_logs (timestamp, user, action, details) VALUES (?, ?, ?, ?)'
    ).bind(timestamp, session.user || body.user || 'System', body.action, body.details || '').run();

    return Response.json({ ok: true }, { status: 201 });
}
