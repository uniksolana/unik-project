export const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isInAppBrowser = () => {
    if (typeof window === 'undefined') return false;
    const isPhantom = (window as any).phantom?.solana?.isPhantom;
    const isSolflare = (window as any).solflare?.isSolflare;
    return isPhantom || isSolflare;
};

export const getDeepLink = (url: string, wallet: 'phantom' | 'solflare') => {
    const encodedUrl = encodeURIComponent(url);
    const encodedRef = encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://www.unikpay.xyz');

    if (wallet === 'phantom') {
        return `https://phantom.app/ul/v1/browse?url=${encodedUrl}&ref=${encodedRef}`;
    } else if (wallet === 'solflare') {
        return `https://solflare.com/ul/v1/browse?url=${encodedUrl}&ref=${encodedRef}`;
    }
    return url;
};
