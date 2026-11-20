export async function sendBekanntmachungWebhook(env, { title, description, az, datum }) {
    const webhookUrl = env.DISCORD_BEKANNTMACHUNGEN_WEBHOOK;
    if (!webhookUrl) return;

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Senatsverwaltung für Justiz – Land Berlin',
                embeds: [{
                    title: `⚖️ Amtliche Bekanntmachung: ${title}`,
                    description,
                    color: 0xCC0000,
                    fields: [
                        { name: 'Aktenzeichen / Kürzel', value: az || '–', inline: true },
                        { name: 'Datum', value: datum || new Date().toLocaleDateString('de-DE'), inline: true }
                    ],
                    footer: { text: 'Senatsverwaltung für Justiz und Verbraucherschutz · Land Berlin (RP)' }
                }]
            })
        });
    } catch {}
}
