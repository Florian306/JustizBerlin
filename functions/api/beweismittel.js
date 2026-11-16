export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const az = url.searchParams.get('az');
    const kennung = url.searchParams.get('kennung');

    if (!az || !kennung) {
        return new Response('Fehlende Parameter (az, kennung).', { status: 400 });
    }

    const akte = await context.env.DB.prepare('SELECT beweismittel FROM akten WHERE az = ?').bind(az).first();
    if (!akte || !akte.beweismittel) {
        return new Response('Akte oder Beweismittel nicht gefunden.', { status: 404 });
    }

    let list = [];
    try {
        list = JSON.parse(akte.beweismittel);
    } catch {
        return new Response('Ungültige Beweismittel-Daten.', { status: 500 });
    }

    const item = list.find(b => b.kennung === kennung);
    if (!item || !item.dataUrl) {
        return new Response('Für dieses Beweismittel ist keine Online-Vorschau hinterlegt.', { status: 404 });
    }

    const match = item.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        return new Response('Ungültiges Dateiformat.', { status: 500 });
    }

    const mimeType = match[1];
    const base64 = match[2];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    return new Response(bytes, {
        status: 200,
        headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${encodeURIComponent(item.name)}"`
        }
    });
}
