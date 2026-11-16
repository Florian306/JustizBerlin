export async function onRequestGet(context) {
    const { results } = await context.env.DB.prepare(
        'SELECT * FROM akten ORDER BY rowid DESC'
    ).all();
    return Response.json(results);
}

export async function onRequestPost(context) {
    const body = await context.request.json();
    await context.env.DB.prepare(
        `INSERT INTO akten (az, datum, typ, vorname, nachname, behoerde, beteiligter, sachverhalt, status, vermerk)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        body.vermerk || ''
    ).run();

    return Response.json(body, { status: 201 });
}
