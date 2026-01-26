
'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '../../utils/supabaseClient';
import { showSimpleToast } from './CustomToast';
import { deriveKeyFromSignature } from '../../utils/crypto';

// Global state to hold the encryption key (in memory only, never saved to disk)
export let sessionEncryptionKey: CryptoKey | null = null;

export default function RiskModal() {
    const { publicKey, signMessage, connected } = useWallet();
    const [isOpen, setIsOpen] = useState(false);
    const [checking, setChecking] = useState(false);
    const [signing, setSigning] = useState(false);

    // Terms version - increment this when you update your terms to force re-acceptance
    const TERMS_VERSION = "v1.0-beta";

    const TERMS_TEXT = `
UNIK PROTOCOL - BETA SOFTWARE RISK ACKNOWLEDGMENT

By signing this message, I acknowledge and agree that:
1. I am using UNIK Protocol "AS IS", without warranty of any kind.
2. This is BETA software running on Solana Devnet.
3. I understand the risks associated with cryptographic software.
4. I have read and agree to the Terms of Service and Privacy Policy.
5. I am solely responsible for the security of my keys and funds.

Version: ${TERMS_VERSION}
Timestamp: ${Date.now()}
`;

    useEffect(() => {
        const checkConsent = async () => {
            if (!connected || !publicKey) return;

            setChecking(true);
            try {
                // 1. Check if user already signed for this specific version
                const { data, error } = await supabase
                    .from('legal_consents')
                    .select('signature')
                    .eq('wallet_address', publicKey.toBase58())
                    .eq('terms_version', TERMS_VERSION)
                    .single();

                if (error || !data) {
                    // Not found or error -> Need to sign
                    setIsOpen(true);
                } else {
                    // 2. Found! But we still need to derive the encryption key for privacy.
                    // Ideally, we would ask for a "decrypt" signature here if it's a new session,
                    // but for this MVP, we will only derive if they just signed.
                    // TODO: For full persistence of encrypted data across sessions without re-signing consent,
                    // we would need a separate "Login" signature request.
                    // For now, if they accepted, we let them in. 
                    // (Note: Encrypted notes won't be decryptable unless we regenerate the key.
                    // We will handle key regeneration on-demand in the dashboard if needed).
                    setIsOpen(false);
                }
            } catch (err) {
                console.error("Consent check failed:", err);
                // Fail safe: If we can't check, assume not signed to be safe
                setIsOpen(true);
            } finally {
                setChecking(false);
            }
        };

        checkConsent();
    }, [connected, publicKey]);

    const handleAcceptAndSign = async () => {
        if (!signMessage || !publicKey) return;

        setSigning(true);
        try {
            const message = new TextEncoder().encode(TERMS_TEXT);
            const signatureBytes = await signMessage(message);
            const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

            // 1. Generar clave de cifrado (Privacy)
            sessionEncryptionKey = await deriveKeyFromSignature(signatureBase64);

            // 2. Guardar en Supabase (Legal)
            const { error } = await supabase
                .from('legal_consents')
                .insert([
                    {
                        wallet_address: publicKey.toBase58(),
                        signature: signatureBase64,
                        terms_version: TERMS_VERSION
                    }
                ]);

            if (error) {
                // If specific error (e.g. duplicate because race condition), it's fine
                if (!error.message.includes('unique constraint')) {
                    throw error;
                }
            }

            // Success
            showSimpleToast('Terms accepted & Encryption enabled', 'success');
            setIsOpen(false);

        } catch (err) {
            console.error("Signing failed:", err);
            showSimpleToast('User rejected terms or signing failed', 'error');
        } finally {
            setSigning(false);
        }
    };

    if (!isOpen || !connected) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#13131f] border border-red-500/30 rounded-2xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden">
                {/* Decoration */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>

                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <span className="text-red-500">⚠️</span> Legal Acknowledgment
                </h2>
                <p className="text-gray-400 text-sm mb-6">Required before using UNIK Protocol</p>

                <div className="bg-white/5 rounded-lg p-4 mb-6 max-h-60 overflow-y-auto text-sm text-gray-300 font-mono border border-white/5">
                    <p className="mb-2.5 font-bold text-white">Please read carefully:</p>
                    <ul className="list-disc pl-4 space-y-2">
                        <li>This software is in <strong>BETA</strong> and provided "AS IS".</li>
                        <li>UNIK Protocol is currently on <strong>DEVNET</strong>.</li>
                        <li>We are <strong>NOT RESPONSIBLE</strong> for any loss of funds, protocol exploits, or user errors.</li>
                        <li>You maintain full custody of your assets at all times.</li>
                        <li>By signing, you agree to our Terms of Service and Privacy Policy.</li>
                    </ul>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleAcceptAndSign}
                        disabled={signing}
                        className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {signing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Signing Agreement...
                            </>
                        ) : (
                            <>
                                ✍️ Accept Risks & Sign
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-gray-500">
                        This signature is free (off-chain) and is used to verify your consent and encrypt your local data.
                    </p>
                </div>
            </div>
        </div>
    );
}
