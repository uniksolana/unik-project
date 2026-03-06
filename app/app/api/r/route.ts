import { NextRequest, NextResponse } from 'next/server';

/**
 * Redirect endpoint for Phantom deep links.
 * 
 * Problem: Telegram's webview aggressively URL-decodes Universal Links before
 * passing them to iOS/Android. This turns encoded `&` (%26) back into literal `&`,
 * which splits query parameters and causes Phantom to lose part of the target URL.
 * 
 * Solution: We Base64-encode the full target URL (Base64 alphabet has no & or ?)
 * and pass it through this redirect endpoint. Even after Telegram decodes the outer
 * Universal Link, the Base64 payload remains intact.
 * 
 * Flow:
 * 1. MobileWalletPrompt encodes target URL as Base64
 * 2. Creates deep link: phantom.app/ul/v1/browse?url=unikpay.xyz/api/r?u=<base64>&ref=...
 * 3. Even if Telegram decodes the outer URL, `<base64>` has no & characters → survives
 * 4. Phantom opens unikpay.xyz/api/r?u=<base64>
 * 5. This endpoint decodes Base64 and 302-redirects to the full original URL
 * 6. Phantom follows the redirect → page loads with all parameters intact
 */
export async function GET(request: NextRequest) {
    const encoded = request.nextUrl.searchParams.get('u');

    if (!encoded) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

        // Security: only allow redirects to our own domain
        const url = new URL(decoded);
        const allowedHosts = ['unikpay.xyz', 'www.unikpay.xyz', 'localhost'];
        const isAllowed = allowedHosts.some(host => url.hostname === host || url.hostname.endsWith('.vercel.app'));

        if (!isAllowed) {
            return NextResponse.json({ error: 'Invalid redirect domain' }, { status: 403 });
        }

        return NextResponse.redirect(decoded, 302);
    } catch {
        return NextResponse.json({ error: 'Invalid Base64 payload' }, { status: 400 });
    }
}
