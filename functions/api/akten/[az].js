export async function onRequestPatch(context) {
    const az = decodeURIComponent(context.params.az);
    const body = await context.request.json();

    await context.env.DB.prepare(
        'UPDATE akten SET status = ?, vermerk = ? WHERE az = ?'
    ).bind(body.status, body.vermerk || '', az).run();

    return Response.json({ az, ...body });
}
