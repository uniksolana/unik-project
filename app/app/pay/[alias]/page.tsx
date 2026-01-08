'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../../utils/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';

function PaymentContent() {
    const { alias } = useParams();
    const searchParams = useSearchParams();
    const { connection } = useConnection();
    const wallet = useWallet();
    const { publicKey, connected } = useWallet();
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [isMounted, setIsMounted] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);

    // Mock data for V1 display
    const [aliasDetails, setAliasDetails] = useState<{ owner: string, splits: number } | null>(null);

    useEffect(() => {
        const queryAmount = searchParams.get('amount');
        if (queryAmount && !isNaN(parseFloat(queryAmount))) {
            setAmount(queryAmount);
        }
    }, [searchParams]);

    useEffect(() => {
        setIsMounted(true);
        if (connected && publicKey) {
            connection.getBalance(publicKey).then(b => setBalance(b / 1e9));
        }
        // Simulate fetching alias details from chain
        if (alias) {
            setTimeout(() => {
                setAliasDetails({
                    owner: '8kR7...LuXr',
                    splits: 2
                });
            }, 500);
        }
    }, [alias, connected, publicKey, connection]);

    const handlePayment = async () => {
        if (!amount || !publicKey) return;
        setLoading(true);
        setStatus('processing');

        try {
            if (!alias || typeof alias !== 'string') throw new Error("Invalid alias");

            const provider = new AnchorProvider(connection, wallet as any, {});
            const program = new Program(IDL as any, provider);

            const normalizedAlias = alias.toLowerCase().trim();

            const [routePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("route"), Buffer.from(normalizedAlias)],
                PROGRAM_ID
            );

            console.log(`Sending ${amount} SOL to ${normalizedAlias} (Route: ${routePDA.toBase58()})`);

            // 1. Fetch the Route Account to get recipients
            const routeAccount = await program.account.routeAccount.fetch(routePDA);

            // 2. Map recipients to Remaining Accounts
            const remainingAccounts = (routeAccount.splits as any[]).map(split => ({
                pubkey: split.recipient,
                isWritable: true,
                isSigner: false,
            }));

            // 3. Convert SOL to Lamports
            const lamports = parseFloat(amount) * 1e9;

            // 4. Execute Transfer
            const tx = await program.methods
                .executeTransfer(normalizedAlias, new BN(lamports))
                .accounts({
                    routeAccount: routePDA,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts(remainingAccounts)
                .rpc();

            console.log("Transfer successful. Signature:", tx);
            setStatus('success');
            setAmount('');
        } catch (error) {
            console.error("Payment failed:", error);
            alert("Payment failed: " + (error instanceof Error ? error.message : "Unknown error"));
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted) return null;

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
            <nav className="absolute top-0 w-full p-6 flex justify-between items-center">
                <div className="text-2xl font-bold text-white">🧠 UNIK</div>
                <WalletMultiButton />
            </nav>

            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
                <div className="p-8 text-center bg-blue-600">
                    <div className="w-20 h-20 bg-white/10 rounded-full mx-auto flex items-center justify-center backdrop-blur-sm mb-4">
                        <span className="text-3xl">👋</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">Pay @{alias}</h1>
                    <p className="text-blue-100 text-sm">Valid UNIK Alias</p>
                </div>

                <div className="p-8">
                    {!connected ? (
                        <div className="text-center">
                            <p className="text-gray-400 mb-6">Connect your wallet to perform the payment securely on Solana.</p>
                            <div className="flex justify-center">
                                <WalletMultiButton />
                            </div>
                        </div>
                    ) : status === 'success' ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Payment Sent!</h3>
                            <p className="text-gray-400 mb-6">Funds have been routed successfully.</p>
                            <button onClick={() => setStatus('idle')} className="text-blue-400 hover:text-blue-300">Send another payment</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Amount (SOL)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-4 pr-12 py-4 text-2xl font-bold bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">SOL</span>
                                </div>
                            </div>

                            <div className="bg-slate-700/30 rounded-lg p-4 text-sm text-gray-400">
                                <div className="flex justify-between mb-2">
                                    <span>Recipient</span>
                                    <span className="text-white font-mono">@{alias}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Routing</span>
                                    <span className="text-green-400">Auto-Split Active ✨</span>
                                </div>
                            </div>

                            <button
                                onClick={handlePayment}
                                disabled={loading || !amount}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all transform active:scale-95"
                            >
                                {loading ? 'Processing...' : `Pay ${amount || '0'} SOL`}
                            </button>
                            {balance !== null && balance < parseFloat(amount || '0') && (
                                <p className="text-red-400 text-xs text-center mt-2">
                                    Insufficient balance ({balance.toFixed(4)} SOL)
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 text-center text-gray-500 text-sm">
                Powered by <span className="font-bold text-gray-400">UNIK Protocol</span>
            </div>
        </div>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading payment interface...</div>}>
            <PaymentContent />
        </Suspense>
    );
}
