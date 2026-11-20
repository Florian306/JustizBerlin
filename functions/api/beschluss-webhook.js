import { getSessionFromRequest, jsonResponse } from './_session.js';
import { sendDiscordEmbed } from './_webhook.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const session = await getSessionFromRequest(request, env);
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

    await sendDiscordEmbed(webhookUrl, {
        title: `${emoji} Amtlicher ${docType} erlassen`,
        description: lines,
        color
    });

    return jsonResponse({ ok: true });
}
