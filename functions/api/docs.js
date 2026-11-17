import { verifySession } from './_session.js';

async function ensureDocsTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS pending_docs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            az TEXT NOT NULL,
            docType TEXT NOT NULL,
            datum TEXT NOT NULL,
            target TEXT NOT NULL,
            laws TEXT,
            extra TEXT,
            signer TEXT,
            body TEXT NOT NULL,
            legal TEXT,
            assignedTo TEXT,
            createdBy TEXT,
            status TEXT NOT NULL DEFAULT 'Zur Prüfung'
        )
    `).run();
}

export async function onRequestGet(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDocsTable(context.env.DB);
    const { results } = await context.env.DB.prepare(
        'SELECT * FROM pending_docs ORDER BY id DESC LIMIT 50'
    ).all();
    return Response.json(results);
}

export async function onRequestPost(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDocsTable(context.env.DB);
    const b = await context.request.json();

    const res = await context.env.DB.prepare(
        `INSERT INTO pending_docs (az, docType, datum, target, laws, extra, signer, body, legal, assignedTo, createdBy, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        b.az, b.docType, b.datum, b.target, b.laws || '', b.extra || '',
        b.signer || '', b.body, b.legal || '', b.assignedTo || 'Richterschaft',
        session.user || 'Dienststelle', 'Zur Prüfung'
    ).run();

    return Response.json({ id: res.meta.last_row_id, ok: true }, { status: 201 });
}

export async function onRequestPatch(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDocsTable(context.env.DB);
    const b = await context.request.json();
    await context.env.DB.prepare(
        'UPDATE pending_docs SET status = ?, signer = ? WHERE id = ?'
    ).bind(b.status, b.signer || session.user || '', Number(b.id)).run();

    return Response.json({ ok: true });
}

export async function onRequestDelete(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDocsTable(context.env.DB);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    await context.env.DB.prepare('DELETE FROM pending_docs WHERE id = ?').bind(Number(id)).run();
    return Response.json({ deleted: Number(id) });
}
