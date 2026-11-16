import { verifySession } from './_session.js';

async function ensureGesetzeTables(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            short TEXT NOT NULL,
            createdAt TEXT
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS laws (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bookId TEXT NOT NULL,
            paragraph TEXT NOT NULL,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            updatedAt TEXT
        )
    `).run();

    // Migration für bestehende Tabellen
    try { await db.prepare('ALTER TABLE books ADD COLUMN createdAt TEXT').run(); } catch {}
    try { await db.prepare('ALTER TABLE laws ADD COLUMN updatedAt TEXT').run(); } catch {}
}

function getTodayDE() {
    return new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export async function onRequestGet(context) {
    await ensureGesetzeTables(context.env.DB);
    const booksRes = await context.env.DB.prepare('SELECT * FROM books ORDER BY rowid ASC').all();
    const lawsRes = await context.env.DB.prepare('SELECT * FROM laws ORDER BY id ASC').all();
    return Response.json({
        books: booksRes.results,
        laws: lawsRes.results
    });
}

export async function onRequestPost(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureGesetzeTables(context.env.DB);
    const body = await context.request.json();
    const today = getTodayDE();

    if (body.action === 'addBook') {
        const id = body.short.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString().slice(-4);
        await context.env.DB.prepare(
            'INSERT INTO books (id, title, short, createdAt) VALUES (?, ?, ?, ?)'
        ).bind(id, body.title, body.short, today).run();
        return Response.json({ id, title: body.title, short: body.short, createdAt: today }, { status: 201 });
    }

    if (body.action === 'addLaw') {
        let paragraph = (body.paragraph || '').trim();
        if (!paragraph) {
            const countRes = await context.env.DB.prepare(
                'SELECT COUNT(*) as cnt FROM laws WHERE bookId = ?'
            ).bind(body.bookId).first();
            const nextNum = (countRes?.cnt || 0) + 1;
            paragraph = `§ ${nextNum}`;
        }

        const res = await context.env.DB.prepare(
            'INSERT INTO laws (bookId, paragraph, title, text, updatedAt) VALUES (?, ?, ?, ?, ?)'
        ).bind(body.bookId, paragraph, body.title, body.text, today).run();

        return Response.json({
            id: res.meta.last_row_id,
            bookId: body.bookId,
            paragraph,
            title: body.title,
            text: body.text,
            updatedAt: today
        }, { status: 201 });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
}

export async function onRequestPatch(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureGesetzeTables(context.env.DB);
    const body = await context.request.json();
    const today = getTodayDE();

    await context.env.DB.prepare(
        'UPDATE laws SET paragraph = ?, title = ?, text = ?, updatedAt = ? WHERE id = ?'
    ).bind(body.paragraph, body.title, body.text, today, Number(body.id)).run();

    return Response.json({
        id: Number(body.id),
        paragraph: body.paragraph,
        title: body.title,
        text: body.text,
        updatedAt: today
    });
}

export async function onRequestDelete(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureGesetzeTables(context.env.DB);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const bookId = url.searchParams.get('bookId');
    const clearAll = url.searchParams.get('clearAll');

    if (clearAll === '1') {
        await context.env.DB.prepare('DELETE FROM laws').run();
        await context.env.DB.prepare('DELETE FROM books').run();
        return Response.json({ cleared: true });
    }

    if (bookId) {
        await context.env.DB.prepare('DELETE FROM laws WHERE bookId = ?').bind(bookId).run();
        await context.env.DB.prepare('DELETE FROM books WHERE id = ?').bind(bookId).run();
        return Response.json({ deletedBook: bookId });
    }

    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    await context.env.DB.prepare('DELETE FROM laws WHERE id = ?').bind(Number(id)).run();
    return Response.json({ deleted: Number(id) });
}
