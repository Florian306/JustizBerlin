import { verifySession } from '../_session.js';

export async function onRequestPatch(context) {
    const az = decodeURIComponent(context.params.az);
    const body = await context.request.json();

    const current = await context.env.DB.prepare('SELECT * FROM akten WHERE az = ?').bind(az).first();
    if (!current) {
        return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const status = body.status !== undefined ? body.status : current.status;
    const vermerk = body.vermerk !== undefined ? body.vermerk : current.vermerk;
    const beweismittel = body.beweismittel !== undefined
        ? (typeof body.beweismittel === 'string' ? body.beweismittel : JSON.stringify(body.beweismittel))
        : current.beweismittel;
    const nachtraege = body.nachtraege !== undefined
        ? (typeof body.nachtraege === 'string' ? body.nachtraege : JSON.stringify(body.nachtraege))
        : current.nachtraege;

    await context.env.DB.prepare(
        'UPDATE akten SET status = ?, vermerk = ?, beweismittel = ?, nachtraege = ? WHERE az = ?'
    ).bind(status, vermerk || '', beweismittel || '[]', nachtraege || '[]', az).run();

    return Response.json({ az, status, vermerk, beweismittel, nachtraege });
}

export async function onRequestDelete(context) {
    const session = await verifySession(context);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const az = decodeURIComponent(context.params.az);
    await context.env.DB.prepare('DELETE FROM akten WHERE az = ?').bind(az).run();
    return Response.json({ deleted: az });
}
