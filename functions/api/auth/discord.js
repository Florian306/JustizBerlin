export async function onRequestGet(context) {
    const clientId = context.env.DISCORD_CLIENT_ID;
    if (!clientId) {
        return new Response('DISCORD_CLIENT_ID ist in Cloudflare Environment Variables nicht gesetzt.', { status: 500 });
    }

    const origin = new URL(context.request.url).origin;
    const redirectUri = `${origin}/api/auth/discord/callback`;

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify'
    });

    return Response.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`, 302);
}
