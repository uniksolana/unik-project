
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

import { showSimpleToast } from './CustomToast';
import { deriveKeyFromSignature } from '../../utils/crypto';

import { getSessionKey, setSessionKey } from '../../utils/sessionState';

export default function RiskModal() {
    const pathname = usePathname();
    const { publicKey, signMessage, connected } = useWallet();
    const [isOpen, setIsOpen] = useState(false);
    const [checking, setChecking] = useState(false);
    const [signing, setSigning] = useState(false);
    const [isReturningUser, setIsReturningUser] = useState(false);

    // Terms version - increment this when you update your terms to force re-acceptance
    const TERMS_VERSION = "v1.0-beta";

    // CRITICAL: This message MUST be constant for key derivation to work across sessions!
    // Never include timestamps or dynamic content here.
    const KEY_DERIVATION_MESSAGE = `UNIK Protocol - Authenticate and Decrypt
Version: ${TERMS_VERSION}
Sign this message to unlock your encrypted data.
This signature is free and does not authorize any transaction.`;

    // For display only (not used for key derivation)
    const TERMS_DISPLAY_TEXT = `
UNIK PROTOCOL - BETA SOFTWARE RISK ACKNOWLEDGMENT

By signing this message, I acknowledge and agree that:
1. I am using UNIK Protocol "AS IS", without warranty of any kind.
2. This is BETA software running on Solana Devnet.
3. I understand the risks associated with cryptographic software.
4. I have read and agree to the Terms of Service and Privacy Policy.
5. I am solely responsible for the security of my keys and funds.
`;

    useEffect(() => {
        const checkConsent = async () => {
            // Skip check on public pages (Landing, Terms, Privacy)
            if (pathname === '/' || pathname === '/terms' || pathname === '/privacy') {
                return;
            }

            if (!connected || !publicKey) return;

            // If we already have the session key in memory, no need to ask again
            if (getSessionKey()) {
                setIsOpen(false);
                return;
            }

            console.log("Checking consent for:", publicKey.toBase58());
            setChecking(true);
            try {
                const res = await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'get_consent',
                        wallet_address: publicKey.toBase58(),
                    }),
                });
                const { data, error } = await res.json();

                if (data && !error) {
                    console.log("User already signed. Needs to login to decrypt.");
                    setIsReturningUser(true); // Switch to login mode
                    setIsOpen(true);          // Open modal for login
                } else {
                    console.log("User needs to sign terms.");
                    setIsReturningUser(false); // Switch to terms mode
                    setIsOpen(true);
                }
            } catch (err) {
                console.error("Consent check failed:", err);
                setIsReturningUser(false); // Fail safe: show terms
                setIsOpen(true);
            } finally {
                setChecking(false);
            }
        };

        checkConsent();
    }, [connected, publicKey, pathname]);

    const handleAcceptAndSign = async () => {
        if (!signMessage || !publicKey) return;

        setSigning(true);
        try {
            // ALWAYS use the same message for key derivation - this ensures consistent decryption
            const message = new TextEncoder().encode(KEY_DERIVATION_MESSAGE);

            const signatureBytes = await signMessage(message);
            const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

            // Generate encryption key from signature (same message = same key)
            const key = await deriveKeyFromSignature(signatureBase64);
            setSessionKey(key);

            // 2. Only save to Supabase if NEW user
            if (!isReturningUser) {
                const res = await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'save_consent',
                        wallet_address: publicKey.toBase58(),
                        signature_base64: signatureBase64,
                        consent_version: TERMS_VERSION,
                    }),
                });
                const { error } = await res.json();

                if (error && !error.includes('unique constraint')) {
                    throw new Error(error);
                }
            }

            // Success
            showSimpleToast(isReturningUser ? 'Unlocked & Decrypted' : 'Terms accepted & Encryption enabled', 'success');
            setIsOpen(false);

            // Trigger storage load to refresh contacts with new key
            window.dispatchEvent(new Event('unik-contacts-updated'));

        } catch (err) {
            console.error("Signing failed:", err);
            showSimpleToast('User rejected signing', 'error');
        } finally {
            setSigning(false);
        }
    };

    if (!isOpen || !connected) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#13131f] border border-cyan-500/30 rounded-2xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden">
                {/* Decoration */}
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isReturningUser ? 'from-cyan-500 via-blue-500 to-cyan-500' : 'from-red-500 via-orange-500 to-red-500'}`}></div>

                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    {isReturningUser ? (
                        <><span>🔐</span> Unlock Data</>
                    ) : (
                        <> <span className="text-red-500">⚠️</span> Legal Acknowledgment</>
                    )}
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                    {isReturningUser ? "Welcome back! Sign to decrypt your secure data." : "Required before using UNIK Protocol"}
                </p>

                {!isReturningUser && (
                    <div className="bg-white/5 rounded-lg p-4 mb-6 max-h-60 overflow-y-auto text-sm text-gray-300 font-mono border border-white/5">
                        <p className="mb-2.5 font-bold text-white">Please read carefully:</p>
                        <ul className="list-disc pl-4 space-y-2">
                            <li>This software is in <strong>BETA</strong> and provided "AS IS".</li>
                            <li>We are <strong>NOT RESPONSIBLE</strong> for any loss of funds.</li>
                            <li>You maintain full custody of your assets at all times.</li>
                        </ul>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleAcceptAndSign}
                        disabled={signing}
                        className={`w-full py-4 bg-gradient-to-r ${isReturningUser ? 'from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500' : 'from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500'} text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {signing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                {isReturningUser ? "Decrypting..." : "Signing Agreement..."}
                            </>
                        ) : (
                            <>
                                {isReturningUser ? "🔓 Sign to Unlock" : "✍️ Accept Risks & Sign"}
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-gray-500">
                        This signature is free (off-chain) and is used to generate your encryption key.
                    </p>
                </div>
            </div>
        </div>
    );
}
