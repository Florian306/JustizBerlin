export async function sendBekanntmachungWebhook(env, { title, description, az, datum, link }) {
    const webhookUrl = env.DISCORD_BEKANNTMACHUNGEN_WEBHOOK;
    if (!webhookUrl) return;

    const portalLink = link || 'https://justizberlin.pages.dev/#start';

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Senatsverwaltung für Justiz und Verbraucherschutz',
                embeds: [{
                    title: `⚖️ Amtliche Bekanntmachung – ${title}`,
                    description: `${description}\n\n👉 **Direkt im Justiz-Portal ansehen:** ${portalLink}`,
                    color: 0xCC0000,
                    fields: [
                        { name: 'Aktenzeichen / Kürzel', value: az || '–', inline: true },
                        { name: 'Datum', value: datum || new Date().toLocaleDateString('de-DE'), inline: true }
                    ],
                    footer: { text: 'ℹ️ Fiktives Roleplay-Projekt · Senatsverwaltung für Justiz und Verbraucherschutz – Land Berlin' }
                }]
            })
        });
    } catch {}
}
