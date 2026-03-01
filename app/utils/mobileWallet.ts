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
    // Double-encode the URL to prevent mobile wallet deep-link parsers (Phantom)
    // from inadvertently splitting the target URL's own query parameters (&)
    const encodedUrl = encodeURIComponent(encodeURIComponent(url));
    const encodedRef = encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://www.unikpay.xyz');

    return `https://phantom.app/ul/v1/browse?url=${encodedUrl}&ref=${encodedRef}`;
};
