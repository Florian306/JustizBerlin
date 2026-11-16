async function ensureGesetzeTables(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            short TEXT NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS laws (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bookId TEXT NOT NULL,
            paragraph TEXT NOT NULL,
            title TEXT NOT NULL,
            text TEXT NOT NULL
        )
    `).run();

    const existing = await db.prepare('SELECT COUNT(*) as cnt FROM books').first();
    if (!existing || existing.cnt === 0) {
        await db.prepare(`
            INSERT OR IGNORE INTO books (id, title, short) VALUES
                ('stgb', 'Strafgesetzbuch (StGB)', 'StGB'),
                ('stpo', 'Strafprozessordnung (StPO)', 'StPO'),
                ('berljg', 'Berliner Justizgesetz (BerlJG)', 'BerlJG')
        `).run();
    }
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
    await ensureGesetzeTables(context.env.DB);
    const body = await context.request.json();

    if (body.action === 'addBook') {
        const id = body.short.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString().slice(-4);
        await context.env.DB.prepare(
            'INSERT INTO books (id, title, short) VALUES (?, ?, ?)'
        ).bind(id, body.title, body.short).run();
        return Response.json({ id, title: body.title, short: body.short }, { status: 201 });
    }

    if (body.action === 'addLaw') {
        const countRes = await context.env.DB.prepare(
            'SELECT COUNT(*) as cnt FROM laws WHERE bookId = ?'
        ).bind(body.bookId).first();
        const nextNum = (countRes?.cnt || 0) + 1;
        const paragraph = `§ ${nextNum}`;

        const res = await context.env.DB.prepare(
            'INSERT INTO laws (bookId, paragraph, title, text) VALUES (?, ?, ?, ?)'
        ).bind(body.bookId, paragraph, body.title, body.text).run();

        return Response.json({
            id: res.meta.last_row_id,
            bookId: body.bookId,
            paragraph,
            title: body.title,
            text: body.text
        }, { status: 201 });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
}

export async function onRequestDelete(context) {
    await ensureGesetzeTables(context.env.DB);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    await context.env.DB.prepare('DELETE FROM laws WHERE id = ?').bind(Number(id)).run();
    return Response.json({ deleted: Number(id) });
}
