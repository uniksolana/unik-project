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
    // encode uri component to safely pass to the browse path
    const isTelegram = typeof window !== 'undefined' && /Telegram/i.test(navigator.userAgent);

    // Telegram's in-app browser has a bug/feature where it aggressively URL-decodes Universal Links 
    // before handing them off to iOS/Android. This strips all nested query parameters (like ?amount= &token=).
    // To fix this, we double encode the URL ONLY for Telegram.
    const encodedUrl = isTelegram ? encodeURIComponent(encodeURIComponent(url)) : encodeURIComponent(url);
    const encodedRef = encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://www.unikpay.xyz');

    return `https://phantom.app/ul/v1/browse?url=${encodedUrl}&ref=${encodedRef}`;
};
