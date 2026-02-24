
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

import { showSimpleToast } from './CustomToast';
import { deriveKeyFromSignature } from '../../utils/crypto';

import { getSessionKey, setSessionKey } from '../../utils/sessionState';
import { setAuthToken, getAuthToken, getAuthMessage, AuthToken } from '../../utils/authState';

export default function RiskModal() {
    const pathname = usePathname();
    const { publicKey, signMessage, connected } = useWallet();
    const [isOpen, setIsOpen] = useState(false);
    const [checking, setChecking] = useState(false);
    const [signing, setSigning] = useState(false);
    const [isReturningUser, setIsReturningUser] = useState(false);

    // Terms version - increment this when you update your terms to force re-acceptance
    const TERMS_VERSION = "v1.0-beta";

    // Session Persistence Config
    const SESSION_DURATION = 15 * 60 * 1000; // 15 Minutes
    const KEY_DERIVATION_MESSAGE = `UNIK Protocol - Authenticate and Decrypt
Version: ${TERMS_VERSION}
Sign this message to unlock your encrypted data.
This signature is free and does not authorize any transaction.`;

    const [errorChecking, setErrorChecking] = useState<string | null>(null);

    // --- Session Management Helpers ---
    const loadSession = async (walletAddr: string): Promise<boolean> => {
        try {
            const storedTs = sessionStorage.getItem(`unik_ts_${walletAddr}`);
            if (!storedTs) return false;

            const now = Date.now();
            if (now - parseInt(storedTs) > SESSION_DURATION) {
                console.log("Session expired");
                clearSession(walletAddr);
                return false;
            }

            const storedAuth = sessionStorage.getItem(`unik_auth_${walletAddr}`);
            const storedKeyJwk = sessionStorage.getItem(`unik_key_${walletAddr}`); // Encrypted key stored as JWK string

            if (storedAuth && storedKeyJwk) {
                // Restore Auth Token
                const authToken = JSON.parse(storedAuth) as AuthToken;
                setAuthToken(authToken);

                // Restore Crypto Key
                const jwk = JSON.parse(storedKeyJwk);
                const key = await window.crypto.subtle.importKey(
                    "jwk",
                    jwk,
                    { name: "AES-GCM" },
                    true,
                    ["encrypt", "decrypt"]
                );
                setSessionKey(key);
                console.log("Session restored from session storage");
                return true;
            }
        } catch (e) {
            console.error("Failed to restore session", e);
            clearSession(walletAddr);
        }
        return false;
    };

    const saveSession = async (walletAddr: string, auth: AuthToken, key: CryptoKey) => {
        try {
            sessionStorage.setItem(`unik_ts_${walletAddr}`, Date.now().toString());
            sessionStorage.setItem(`unik_auth_${walletAddr}`, JSON.stringify(auth));

            const jwk = await window.crypto.subtle.exportKey("jwk", key);
            sessionStorage.setItem(`unik_key_${walletAddr}`, JSON.stringify(jwk));
            console.log("Session saved to sessionStorage for 15 min");
        } catch (e) {
            console.error("Failed to save session", e);
        }
    };

    const clearSession = (walletAddr: string | null) => {
        if (!walletAddr) return;
        sessionStorage.removeItem(`unik_ts_${walletAddr}`);
        sessionStorage.removeItem(`unik_auth_${walletAddr}`);
        sessionStorage.removeItem(`unik_key_${walletAddr}`);
    };
    // ----------------------------------

    const checkConsent = async () => {
        // Skip check on public pages (Landing, Terms, Privacy)
        if (pathname === '/' || pathname === '/terms' || pathname === '/privacy') {
            return;
        }

        if (!connected || !publicKey) return;

        // 1. Check Memory State first
        if (getSessionKey()) {
            setIsOpen(false);
            return;
        }

        // 2. Check Local Storage Session
        setChecking(true);
        const restored = await loadSession(publicKey.toBase58());
        if (restored) {
            setChecking(false);
            setIsOpen(false);
            // Trigger storage load to refresh contacts with restored key
            window.dispatchEvent(new Event('unik-contacts-updated'));
            return;
        }

        // 3. If no session, check backend for consent status
        console.log("Checking consent for:", publicKey.toBase58());
        setErrorChecking(null);
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_consent',
                    wallet_address: publicKey.toBase58(),
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Server Error: ${res.status}`);
            }

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
        } catch (err: any) {
            console.error("Consent check failed:", err);
            setErrorChecking(err.message || "Failed to check status. Please try again.");
            setIsOpen(true);
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
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
            const key = await deriveKeyFromSignature(signatureBase64, publicKey.toBase58());
            // Don't set session key yet to avoid race condition with auth token

            // Small delay to prevent wallet from rejecting rapid requests (Fix: increased to 2000ms)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generate auth token for API authentication (proves wallet ownership)
            let authToken: AuthToken;
            try {
                const walletAddr = publicKey.toBase58();
                const authMsg = getAuthMessage(walletAddr);
                const authMsgBytes = new TextEncoder().encode(authMsg);
                const authSigBytes = await signMessage(authMsgBytes);
                const authSigBase64 = Buffer.from(authSigBytes).toString('base64');
                authToken = { wallet: walletAddr, signature: authSigBase64, message: authMsg };

                // Set both tokens atomically (virtually) to enable app access
                setAuthToken(authToken);
                setSessionKey(key);
            } catch (err) {
                console.error("Auth signing failed:", err);
                throw new Error("Failed to sign authentication message");
            }

            // Save Session for 15 min
            await saveSession(publicKey.toBase58(), authToken, key);

            // 2. Only save to Supabase if NEW user
            if (!isReturningUser) {
                try {
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
                } catch (e) {
                    console.error("Save consent failed:", e);
                    // We continue even if saving consent fails, as the user has signed locally
                }
            }

            // Success
            showSimpleToast(isReturningUser ? 'Unlocked & Decrypted' : 'Terms accepted & Encryption enabled', 'success');
            setIsOpen(false);

            // Trigger storage load to refresh contacts with new key
            window.dispatchEvent(new Event('unik-contacts-updated'));

        } catch (err: any) {
            console.error("Signing flowchart failed:", err);
            showSimpleToast(err.message || 'Signing failed. Please try again.', 'error');
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
                    {errorChecking ? (
                        <button
                            onClick={checkConsent}
                            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            🔄 Retry Connection
                        </button>
                    ) : (
                        <button
                            onClick={handleAcceptAndSign}
                            disabled={signing || checking}
                            className={`w-full py-4 bg-gradient-to-r ${isReturningUser ? 'from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500' : 'from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500'} text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {signing || checking ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    {checking ? "Checking..." : (
                                        getSessionKey() ? "Preparing Auth..." : (isReturningUser ? "Decrypting..." : "Signing Agreement...")
                                    )}
                                </>
                            ) : (
                                <>
                                    {isReturningUser ? "🔓 Sign to Unlock" : "✍️ Accept Risks & Sign"}
                                </>
                            )}
                        </button>
                    )}

                    {errorChecking && (
                        <p className="text-center text-xs text-red-400 mt-2">{errorChecking}</p>
                    )}

                    {!errorChecking && (
                        <p className="text-center text-xs text-gray-500">
                            This signature is free (off-chain) and is used to generate your encryption key.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
