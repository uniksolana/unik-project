'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isMobile, isInAppBrowser, getDeepLink } from '../../utils/mobileWallet';

export default function MobileWalletPrompt({ currentUrl = '' }: { currentUrl?: string }) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isMobile() && !isInAppBrowser()) {
            setShow(true);
        }
    }, []);

    if (!show) return null;

    const urlToUse = currentUrl || (typeof window !== 'undefined' ? window.location.href : '');

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800 z-[100] animate-in slide-in-from-bottom-5">
            <p className="text-center text-gray-400 text-sm mb-3">Open in mobile wallet for best experience</p>
            <div className="flex gap-3 justify-center">
                <a
                    href={getDeepLink(urlToUse, 'phantom')}
                    className="flex items-center gap-2 px-4 py-2 bg-[#5546FF] rounded-xl font-bold text-sm text-white hover:bg-[#4536EE] transition-colors"
                >
                    <div className="w-5 h-5 relative rounded-full overflow-hidden bg-white">
                        {/* Placeholder for Phantom icon, assuming user might not have it locally yet, using emoji or generic */}
                        <span className="absolute inset-0 flex items-center justify-center text-black text-[10px]">👻</span>
                    </div>
                    Phantom
                </a>
                <a
                    href={getDeepLink(urlToUse, 'solflare')}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FC763A] rounded-xl font-bold text-sm text-white hover:bg-[#EC662A] transition-colors"
                >
                    <div className="w-5 h-5 relative rounded-full overflow-hidden bg-white">
                        <span className="absolute inset-0 flex items-center justify-center text-black text-[10px]">☀️</span>
                    </div>
                    Solflare
                </a>
            </div>
        </div>
    );
}
