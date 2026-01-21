'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../../utils/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';
import Image from 'next/image';

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

    const [isLocked, setIsLocked] = useState(false);
    const [concept, setConcept] = useState<string | null>(null);
    const [senderNote, setSenderNote] = useState('');
    const [routeAccount, setRouteAccount] = useState<any>(null);
    const [aliasOwner, setAliasOwner] = useState<PublicKey | null>(null);
    const [recipientAddress, setRecipientAddress] = useState<PublicKey | null>(null);

    useEffect(() => {
        const queryAmount = searchParams.get('amount');
        if (queryAmount && !isNaN(parseFloat(queryAmount))) {
            setAmount(queryAmount);
            setIsLocked(true);
        }
        const queryConcept = searchParams.get('concept');
        if (queryConcept) {
            setConcept(decodeURIComponent(queryConcept));
        }
    }, [searchParams]);

    useEffect(() => {
        setIsMounted(true);
        if (connected && publicKey) {
            connection.getBalance(publicKey).then(b => setBalance(b / 1e9));
        }
        if (alias) {
            checkAlias();
        }
    }, [alias, connected, publicKey, connection]);

    const checkAlias = async () => {
        if (!alias) return;
        try {
            const provider = new AnchorProvider(connection, { publicKey: PublicKey.default } as any, {});
            const program = new Program(IDL as any, provider);
            const normalizedAlias = (alias as string).toLowerCase().trim();

            // 1. Check for Route Account
            const [routePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("route"), Buffer.from(normalizedAlias)],
                PROGRAM_ID
            );

            try {
                const routeAcc = await (program.account as any).routeAccount.fetch(routePDA);
                setRouteAccount(routeAcc);
                setRecipientAddress(routePDA); // Just for reference, payment goes via CPI
                console.log("Route account found active");
            } catch (e) {
                console.log("No route account found, checking alias owner...");
                setRouteAccount(null);
            }

            // 2. Check for Alias Account (Owner)
            const [aliasPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("alias"), Buffer.from(normalizedAlias)],
                PROGRAM_ID
            );

            try {
                const aliasAcc = await (program.account as any).aliasAccount.fetch(aliasPDA);
                setAliasOwner(aliasAcc.owner);
                if (!recipientAddress) setRecipientAddress(aliasAcc.owner);
                console.log("Alias owner found:", aliasAcc.owner.toBase58());
            } catch (e) {
                console.error("Alias does not exist");
                setAliasOwner(null);
            }

        } catch (error) {
            console.error("Error checking alias:", error);
        }
    };

    const handlePayment = async () => {
        if (!amount || !publicKey) return;
        setLoading(true);
        setStatus('processing');

        try {
            if (!alias || typeof alias !== 'string') throw new Error("Invalid alias");

            const provider = new AnchorProvider(connection, wallet as any, {});
            const program = new Program(IDL as any, provider);
            const normalizedAlias = alias.toLowerCase().trim();
            const lamports = parseFloat(amount) * 1e9;

            // Scenario A: Route Config Exists -> Use Smart Contract
            if (routeAccount) {
                const [routePDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("route"), Buffer.from(normalizedAlias)],
                    PROGRAM_ID
                );

                // Map recipients
                const remainingAccounts = (routeAccount.splits as any[]).map(split => ({
                    pubkey: split.recipient,
                    isWritable: true,
                    isSigner: false,
                }));

                const tx = await program.methods
                    .executeTransfer(normalizedAlias, new BN(lamports))
                    .accounts({
                        routeAccount: routePDA,
                        user: publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .remainingAccounts(remainingAccounts)
                    .rpc();

                console.log("Smart Transfer successful:", tx);
            }
            // Scenario B: No Route Config -> Direct Transfer to Owner
            else if (aliasOwner) {
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: aliasOwner,
                        lamports: BigInt(lamports),
                    })
                );

                // Note: Standard wallet adapter might need sendTransaction
                const signature = await wallet.sendTransaction(transaction, connection);
                await connection.confirmTransaction(signature, 'confirmed');
                console.log("Direct Transfer successful:", signature);
            } else {
                throw new Error("Alias not found or invalid.");
            }

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

    return (
        <div className="min-h-screen bg-[#0d0d12] flex flex-col items-center justify-center p-4 relative overflow-hidden text-white font-sans">
            {/* Ambient Background */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px]"></div>

            <nav className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <Image src="/logo-icon.png" alt="UNIK" width={32} height={32} className="w-8 h-8" />
                    <Image src="/logo-text.png" alt="UNIK" width={80} height={24} className="h-6 w-auto" />
                </div>
                <div className="scale-90 origin-right">
                    <WalletMultiButton />
                </div>
            </nav>

            <div className="w-full max-w-md bg-[#13131f]/80 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden border border-white/5 z-10 relative">
                {/* Header Section */}
                <div className="p-10 text-center bg-gradient-to-b from-cyan-500/10 to-transparent pt-12">
                    <div className="w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-purple-600/20 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-cyan-500/10 mb-6 border border-white/10 backdrop-blur-md">
                        <Image src="/logo-icon.png" alt="UNIK" width={64} height={64} className="w-16 h-16 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Pay @{alias}</h1>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${aliasOwner || routeAccount ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${aliasOwner || routeAccount ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                        <p className={`text-xs font-bold tracking-wide uppercase ${aliasOwner || routeAccount ? 'text-green-400' : 'text-red-400'}`}>
                            {aliasOwner || routeAccount ? 'Valid Alias' : 'Alias Not Found'}
                        </p>
                    </div>
                </div>

                <div className="p-8 pt-2">
                    {!connected ? (
                        <div className="text-center">
                            <p className="text-gray-400 mb-8 font-medium leading-relaxed">Connect your wallet to perform the payment securely via the Solana blockchain.</p>
                            <div className="flex justify-center mb-8 scale-110">
                                <WalletMultiButton />
                            </div>

                            {/* Mobile Fallback Options */}
                            <div className="border-t border-white/5 pt-6">
                                <p className="text-gray-600 text-xs mb-4 uppercase tracking-wider font-bold">Mobile Deep Links</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            const url = encodeURIComponent(window.location.href);
                                            window.location.href = `https://phantom.app/ul/browse/${url}?ref=${encodeURIComponent(window.location.origin)}`;
                                        }}
                                        className="py-3 px-3 bg-[#AB9FF2]/10 hover:bg-[#AB9FF2]/20 text-[#AB9FF2] border border-[#AB9FF2]/30 rounded-xl text-sm font-bold transition-all"
                                    >
                                        Phantom
                                    </button>
                                    <button
                                        onClick={() => {
                                            const url = encodeURIComponent(window.location.href);
                                            window.location.href = `https://solflare.com/ul/v1/browse/${url}?ref=${encodeURIComponent(window.location.origin)}`;
                                        }}
                                        className="py-3 px-3 bg-[#FC742F]/10 hover:bg-[#FC742F]/20 text-[#FC742F] border border-[#FC742F]/30 rounded-xl text-sm font-bold transition-all"
                                    >
                                        Solflare
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : status === 'success' ? (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Payment Sent!</h3>
                            <p className="text-gray-400 mb-6">Funds have been routed successfully.</p>
                            {senderNote && <div className="bg-white/5 rounded-xl p-4 mb-8 border border-white/5"><p className="text-white italic text-sm">"{senderNote}"</p></div>}
                            <button
                                onClick={() => setStatus('idle')}
                                className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/5"
                            >
                                Send another payment
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    Amount (SOL) {isLocked && <span className="text-yellow-500 ml-2">🔒 Locked</span>}
                                </label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => !isLocked && setAmount(e.target.value)}
                                        readOnly={isLocked}
                                        placeholder="0.00"
                                        className={`w-full pl-6 pr-16 py-5 text-3xl font-bold bg-black/30 border rounded-2xl text-white outline-none transition-all ${isLocked ? 'border-yellow-500/30 text-gray-400 cursor-not-allowed' : 'border-white/10 focus:border-cyan-500/50 focus:bg-black/40 focus:shadow-[0_0_20px_rgba(6,182,212,0.1)]'}`}
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg group-focus-within:text-cyan-400 transition-colors">SOL</span>
                                </div>
                            </div>

                            {concept && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
                                    <div className="mt-0.5 text-yellow-500">ℹ️</div>
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider text-yellow-500/80 mb-1 font-bold">Request Concept</label>
                                        <p className="text-white italic text-sm">"{concept}"</p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    Payment Note (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Add a note to the receiver..."
                                    value={senderNote}
                                    onChange={(e) => setSenderNote(e.target.value)}
                                    className="w-full px-5 py-4 bg-black/20 border border-white/10 rounded-xl text-white outline-none focus:border-purple-500/50 focus:bg-black/30 transition-all placeholder:text-gray-600"
                                    style={{ fontSize: '16px' }} // Prevent zoom on mobile
                                />
                            </div>

                            {/* Summary Box */}
                            <div className="bg-white/5 rounded-xl p-5 text-sm border border-white/5">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400">Recipient</span>
                                    <span className="text-white font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-xs">@{alias}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Routing</span>
                                    {routeAccount ? (
                                        <span className="text-cyan-400 flex items-center gap-1 font-medium bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20 text-xs">
                                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                                            Smart Routing Active
                                        </span>
                                    ) : aliasOwner ? (
                                        <span className="text-purple-400 flex items-center gap-1 font-medium bg-purple-950/30 px-2 py-0.5 rounded border border-purple-500/20 text-xs">
                                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                                            Direct Transfer
                                        </span>
                                    ) : (
                                        <span className="text-red-400 text-xs">Invalid</span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handlePayment}
                                disabled={loading || !amount}
                                className="w-full py-5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl shadow-xl shadow-purple-900/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Processing...
                                    </span>
                                ) : `Swipe to Pay ${amount ? amount : '0'} SOL`}
                            </button>

                            {balance !== null && balance < parseFloat(amount || '0') && (
                                <p className="text-red-400 text-xs text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                                    Insufficient balance: {balance.toFixed(4)} SOL
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 text-center">
                <p className="text-xs text-gray-600 font-medium">Powered by <span className="text-gray-500 font-bold">UNIK Protocol</span></p>
            </div>
        </div>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0d0d12] flex items-center justify-center text-white font-mono animate-pulse">Initializing...</div>}>
            <PaymentContent />
        </Suspense>
    );
}
