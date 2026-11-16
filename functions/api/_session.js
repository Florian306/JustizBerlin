async function signToken(payload, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${payload}.${hex}`;
}

export async function verifySession(context) {
    const secret = context.env.SESSION_SECRET || 'justiz-berlin-dev-secret-2026';
    const cookieHeader = context.request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)justiz_session=([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;
    if (!token || !token.includes('.')) return null;

    const [payload] = token.split('.');
    const expected = await signToken(payload, secret);
    if (token !== expected) return null;

    try {
        const data = JSON.parse(atob(payload));
        if (data.exp && Date.now() > data.exp) return null;
        return data;
    } catch {
        return null;
    }
}
