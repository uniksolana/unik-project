'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isMobile, isInAppBrowser } from '../../utils/mobileWallet';

export default function LandingAuth() {
    const { connected } = useWallet();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="h-[48px] w-[160px] bg-white/5 rounded-lg animate-pulse"></div>;
    }

    // On mobile web browsers, clicking "Connect / Launch" goes straight to dashboard where the global Deep Link catches them
    if (connected || (isMobile() && !isInAppBrowser())) {
        return (
            <Link
                href="/dashboard"
                className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-lg font-bold text-white transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:-translate-y-0.5 active:translate-y-0"
            >
                Launch Dashboard
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
            </Link>
        );
    }

    return <WalletMultiButton />;
}
