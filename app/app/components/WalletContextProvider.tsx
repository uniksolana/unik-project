'use client';

import { FC, ReactNode, useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // STAGE: DEVNET (Hardened for V1 Launch)
    const network = WalletAdapterNetwork.Devnet;

    // Fix hydration error
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [],
        [network]
    );

    if (!isMounted) return null;

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
