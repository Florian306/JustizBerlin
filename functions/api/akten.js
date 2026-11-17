async function ensureAktenTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS akten (
            az TEXT PRIMARY KEY,
            datum TEXT NOT NULL,
            typ TEXT NOT NULL,
            vorname TEXT NOT NULL,
            nachname TEXT NOT NULL,
            behoerde TEXT,
            beteiligter TEXT,
            sachverhalt TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Eingegangen',
            vermerk TEXT,
            beweismittel TEXT,
            nachtraege TEXT,
            bearbeiter TEXT,
            paragraphen TEXT,
            kontakt TEXT
        )
    `).run();

    try { await db.prepare('ALTER TABLE akten ADD COLUMN beweismittel TEXT').run(); } catch {}
    try { await db.prepare('ALTER TABLE akten ADD COLUMN nachtraege TEXT').run(); } catch {}
    try { await db.prepare('ALTER TABLE akten ADD COLUMN bearbeiter TEXT').run(); } catch {}
    try { await db.prepare('ALTER TABLE akten ADD COLUMN paragraphen TEXT').run(); } catch {}
    try { await db.prepare('ALTER TABLE akten ADD COLUMN kontakt TEXT').run(); } catch {}
}

export async function onRequestGet(context) {
    await ensureAktenTable(context.env.DB);
    const { results } = await context.env.DB.prepare(
        'SELECT * FROM akten ORDER BY rowid DESC'
    ).all();
    return Response.json(results);
}

export async function onRequestPost(context) {
    await ensureAktenTable(context.env.DB);
    const body = await context.request.json();
    const bwmJson = typeof body.beweismittel === 'string'
        ? body.beweismittel
        : JSON.stringify(body.beweismittel || []);

    await context.env.DB.prepare(
        `INSERT INTO akten (az, datum, typ, vorname, nachname, behoerde, beteiligter, sachverhalt, status, vermerk, beweismittel, kontakt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        body.az,
        body.datum,
        body.typ,
        body.vorname,
        body.nachname,
        body.behoerde || '',
        body.beteiligter || '',
        body.sachverhalt,
        body.status || 'Eingegangen',
        body.vermerk || '',
        bwmJson,
        body.kontakt || ''
    ).run();

    return Response.json(body, { status: 201 });
}
