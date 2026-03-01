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
    const encodedUrl = encodeURIComponent(url);
    const encodedRef = encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://www.unikpay.xyz');

    return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedRef}`;
};
