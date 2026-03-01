'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isMobile, isInAppBrowser, getDeepLink } from '../../utils/mobileWallet';

export default function MobileWalletPrompt({ currentUrl = '' }: { currentUrl?: string }) {
    const [show, setShow] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (isMobile() && !isInAppBrowser() && !dismissed) {
            setShow(true);
        }
    }, [dismissed]);

    if (!show) return null;

    const urlToUse = currentUrl || (typeof window !== 'undefined' ? window.location.href : '');

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#111116] border border-white/5 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-[#5546FF]/20 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-[#5546FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2 text-center text-balance">Open or Install Phantom</h3>
                <p className="text-gray-400 text-center mb-8 text-sm leading-relaxed">
                    UNIK requires a mobile crypto wallet. Open this link directly in Phantom to connect securely.
                </p>

                <div className="flex flex-col w-full gap-4">
                    <a
                        href={getDeepLink(urlToUse)}
                        className="flex items-center justify-center gap-3 px-6 py-5 bg-[#5546FF] rounded-2xl text-white hover:bg-[#4536EE] active:scale-[0.98] transition-all w-full shadow-lg shadow-[#5546FF]/20"
                    >
                        <Image
                            src="/phantom-original.png"
                            alt="Open in Phantom"
                            width={160}
                            height={44}
                            className="object-contain h-8 w-auto filter drop-shadow-md"
                            unoptimized
                        />
                    </a>
                </div>

                <button
                    onClick={() => { setShow(false); setDismissed(true); }}
                    className="mt-8 text-sm text-gray-500 hover:text-white transition-colors underline decoration-dotted underline-offset-4"
                >
                    Continue in browser anyway
                </button>
            </div>
        </div>
    );
}
