export const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isInAppBrowser = () => {
    if (typeof window === 'undefined') return false;
    const isPhantom = (window as any).phantom?.solana?.isPhantom;
    // Removing Solflare per user request
    return isPhantom;
};

export const getDeepLink = (url: string) => {
    // STRATEGY: Base64-encode the full target URL and route through our /api/r redirect endpoint.
    //
    // WHY: Telegram's webview aggressively URL-decodes Universal Links before handing them to iOS.
    // This turns encoded "&" (%26) back into literal "&", splitting the query string.
    // Phantom then only reads the "url" value up to the first unescaped "&", losing order_id, sig, etc.
    //
    // Base64 alphabet (A-Z, a-z, 0-9, +, /, =) contains NO "&" or "?" characters.
    // So even after Telegram decodes the outer Universal Link, the Base64 payload remains intact.
    //
    // Flow:
    // 1. Base64-encode original URL → "aHR0cHM6Ly91bmlrcGF5Lnh5e..."
    // 2. Build redirect URL → unikpay.xyz/api/r?u=aHR0cHM6...
    // 3. Encode redirect URL into Phantom deep link
    // 4. Even if Telegram decodes the deep link, Base64 has no & → payload survives
    // 5. Phantom opens /api/r?u=<base64>, which 302-redirects to the original URL
    // 6. Phantom follows the redirect → page loads with ALL parameters intact

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.unikpay.xyz';

    // Base64 encode the full URL (btoa is available in all modern browsers)
    const base64Url = btoa(url);

    // Build the redirect URL on our domain
    const redirectUrl = `${origin}/api/r?u=${encodeURIComponent(base64Url)}`;

    // Encode the redirect URL for the Phantom deep link
    const encodedRedirectUrl = encodeURIComponent(redirectUrl);
    const encodedRef = encodeURIComponent(origin);

    return `https://phantom.app/ul/v1/browse?url=${encodedRedirectUrl}&ref=${encodedRef}`;
};
