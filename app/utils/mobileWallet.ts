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
    if (wallet === 'phantom') {
        return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodeURIComponent(window.location.origin)}`;
    } else if (wallet === 'solflare') {
        return `https://solflare.com/ul/browse/${encodedUrl}?ref=${encodeURIComponent(window.location.origin)}`;
    }
    return url;
};
