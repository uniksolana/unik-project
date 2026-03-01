'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isMobile, isInAppBrowser, getDeepLink } from '../../utils/mobileWallet';

const PhantomFullLogo = () => (
    <div className="flex items-center gap-3">
        <svg className="w-8 h-8 text-white" viewBox="0 0 128 128" fill="currentColor">
            <path d="M121.733 80.893c0-3.136-.92-5.46-2.618-7.228-3.058-2.5-6.577.625-7.95 2.502-1.928 2.383-2.185 3.518-3.51 3.518-2.091 0-3.218-1.59-4.346-6.471-.806-3.86-1.528-7.38-2.253-11.465C99.25 51.527 94.024 37.001 81 22.128 70.93 10.605 57.067 5.155 35.845 5.155c-15.676 0-25.083 4.882-31.517 7.721-3.699 1.589-4.26 2.045-4.26 3.18 0 1.25.722 2.61 2.247 2.61.482 0 1.528 0 3.774-.91 8.843-3.065 19.375-6.015 30.54-6.015 28.536 0 54.336 15.666 61.168 51.187 2.01 10.103 4.26 24.52 4.26 26.677 0 5.45-1.93 8.06-4.502 9.2-2.17.8-4.58 0-6.75-2.045-1.768-1.59-3.295-4.542-5.706-4.542-2.33 0-3.616 2.043-4.982 4.426-1.85 3.066-4.339 6.812-7.876 6.812-3.055 0-5.143-2.157-6.993-5.223-1.606-2.61-3.132-5.676-5.463-5.676-2.25 0-3.777 2.838-5.706 6.13-1.927 3.52-4.178 7.38-7.955 7.38-3.778 0-5.867-2.61-7.795-6.357-1.447-2.724-3.536-6.47-6.108-6.47-2.17 0-3.535 2.157-5.142 4.996-2.33 4.086-4.903 8.398-9.081 8.398-4.34 0-7.394-5.221-12.778-14.757-.48-.68-1.284-1.93-2.167-1.93-.966 0-1.77.68-2.653 2.158-12.62 18.049-16.719 36.44-8.761 46.089C5.466 123.694 15.11 128.01 27.65 128.01c6.59 0 17.521-2.952 23.95-6.47 2.008-1.022 3.856-1.93 5.3-1.93 1.93 0 3.214 1.474 3.214 2.837 0 .454-.24.795-.4 1.135-2.492 4.086-5.867 4.314-11.412 4.314h-1.93c.481.114.964.114 1.528.114 9 0 22.34-11.58 37.042-32.014a51.782 51.782 0 003.535-5.336c1.286 1.817 3.295 4.087 6.43 4.087 4.26 0 7.393-4.313 9.482-7.605 1.526-2.383 2.571-3.972 3.696-3.972.723 0 1.285.567 1.928 1.475 2.812 3.633 6.911 8.855 11.251 8.855h1.286c4.66.113 9.08-3.519 9.08-12.6Z" />
        </svg>
        <span className="text-3xl font-bold tracking-tight lowercase mt-1">phantom</span>
    </div>
);

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
                        <PhantomFullLogo />
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
