import { verifySession } from './_session.js';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const session = await verifySession(context);
    if (!session) return jsonResponse({ error: 'Nicht angemeldet' }, 401);

    const webhookUrl = env.DISCORD_BESCHLUSS_WEBHOOK || env.DISCORD_BEKANNTMACHUNGEN_WEBHOOK;
    if (!webhookUrl) {
        return jsonResponse({ error: 'Kein Discord-Webhook konfiguriert.' }, 503);
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: 'Ungültige Anfrage' }, 400);
    }

    const docType = String(payload.docType || 'Beschluss').trim();
    const az = String(payload.az || 'Ohne Az.').trim();
    const target = String(payload.target || 'Unbekannt').trim();
    const extra = String(payload.extra || '').trim();
    const signer = String(payload.signer || session.name || 'Justiz Berlin').trim();
    const verifyUrl = String(payload.verifyUrl || 'https://justizberlin.pages.dev/#auskunft').trim();

    const isUrgent = docType === 'Haftbefehl' || docType === 'Durchsuchungsbeschluss';
    const emoji = isUrgent ? '🚨' : '⚖️';
    const color = isUrgent ? 0xCC0000 : 0x003366;

    const lines = [
        `**Aktenzeichen:** \`${az}\``,
        `**Betroffene Person:** ${target}`,
        extra ? `**Anordnung / Haftgrund:** ${extra}` : null,
        `**Ausgefertigt von:** ${signer}`,
        '',
        `👉 **Online-Prüfung & Vorgangsauskunft:** ${verifyUrl}`
    ].filter(Boolean).join('\n');

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'Senatsverwaltung für Justiz und Verbraucherschutz',
            embeds: [{
                title: `${emoji} Amtlicher ${docType} erlassen`,
                description: lines,
                color,
                footer: { text: 'ℹ️ Fiktives Roleplay-Projekt · Senatsverwaltung für Justiz und Verbraucherschutz – Land Berlin' }
            }]
        })
    });

    return jsonResponse({ ok: true });
}
