import { verifySession } from './_session.js';
import { sendBekanntmachungWebhook } from './_webhook.js';

async function ensureBekanntmachungenTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS bekanntmachungen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            datum TEXT NOT NULL,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            az TEXT,
            author TEXT
        )
    `).run();
}

export async function onRequestGet(context) {
    await ensureBekanntmachungenTable(context.env.DB);
    const { results } = await context.env.DB.prepare(
        'SELECT * FROM bekanntmachungen ORDER BY id DESC LIMIT 20'
    ).all();
    return Response.json(results);
}

export async function onRequestPost(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureBekanntmachungenTable(context.env.DB);
    const body = await context.request.json();
    const datum = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const title = (body.title || '').trim();
    const text = (body.text || '').trim();
    const az = (body.az || '').trim() || 'SenJustV';
    const author = session.user || 'Senatsverwaltung';

    if (!title || !text) {
        return Response.json({ error: 'Missing title or text' }, { status: 400 });
    }

    const res = await context.env.DB.prepare(
        'INSERT INTO bekanntmachungen (datum, title, text, az, author) VALUES (?, ?, ?, ?, ?)'
    ).bind(datum, title, text, az, author).run();

    await sendBekanntmachungWebhook(context.env, {
        title,
        description: text,
        az,
        datum,
        link: 'https://justizberlin.pages.dev/#start'
    });

    return Response.json({ id: res.meta.last_row_id, datum, title, text, az, author }, { status: 201 });
}
