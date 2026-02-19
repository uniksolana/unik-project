'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { showTransactionToast, showSimpleToast } from '../../components/CustomToast';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../../utils/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';
import Image from 'next/image';
import { saveSharedNote } from '../../../utils/sharedNotes';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import MobileWalletPrompt from '../../components/MobileWalletPrompt';

const TOKEN_OPTIONS_MAP: any = {
    'SOL': { label: 'SOL', symbol: 'SOL', mint: null, decimals: 9 },
    'USDC': { label: 'USDC (Circle)', symbol: 'USDC', mint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), decimals: 6 },
    'USDC-FAUCET': { label: 'USDC (Faucet)', symbol: 'USDC-F', mint: new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'), decimals: 6 },
    'EURC': { label: 'EURC (Devnet)', symbol: 'EURC', mint: new PublicKey('HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'), decimals: 6 }
};

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
    const [solPrice, setSolPrice] = useState<number | null>(null);
    const [selectedToken, setSelectedToken] = useState<any>(TOKEN_OPTIONS_MAP['SOL']);
    const [tokenLocked, setTokenLocked] = useState(false);
    const [isDirectAddress, setIsDirectAddress] = useState(false);
    const [linkVerification, setLinkVerification] = useState<'checking' | 'valid' | 'invalid' | 'unsigned'>('checking');

    useEffect(() => {
        // Fetch SOL price from CoinGecko... (omitted for brevity, assume keeps existing)
        const fetchPrice = async () => {
            // ... existing fetch logic
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
                const data = await response.json();
                if (data.solana && data.solana.usd) {
                    setSolPrice(data.solana.usd);
                }
            } catch (error) {
                console.error("Failed to fetch SOL price", error);
            }
        };
        fetchPrice();
        const interval = setInterval(fetchPrice, 60000);
        return () => clearInterval(interval);
    }, []);

    const [routeAccount, setRouteAccount] = useState<any>(null);
    const [aliasOwner, setAliasOwner] = useState<PublicKey | null>(null);
    const [recipientAddress, setRecipientAddress] = useState<PublicKey | null>(null);
    const [lastSignature, setLastSignature] = useState<string | null>(null);

    useEffect(() => {
        const queryAmount = searchParams.get('amount');
        if (queryAmount && !isNaN(parseFloat(queryAmount))) {
            setAmount(queryAmount);
            setIsLocked(true);
            setTokenLocked(true);
        }

        const queryConcept = searchParams.get('concept');
        if (queryConcept) {
            setConcept(decodeURIComponent(queryConcept));
        }

        const orderId = searchParams.get('order_id');
        if (orderId) {
            // Fetch secure details (concept, amount, token) from backend
            fetch('/api/orders/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.concept) setConcept(data.concept);
                    if (data.expected_amount) {
                        setAmount(String(data.expected_amount));
                        setIsLocked(true);
                    }
                    if (data.expected_token) {
                        const token = TOKEN_OPTIONS_MAP[data.expected_token.toUpperCase()];
                        if (token) {
                            setSelectedToken(token);
                            setTokenLocked(true);
                        }
                    }
                })
                .catch(e => console.error("Failed to fetch order details:", e));
        }

        const queryToken = searchParams.get('token');
        if (queryToken && TOKEN_OPTIONS_MAP[queryToken.toUpperCase()]) {
            setSelectedToken(TOKEN_OPTIONS_MAP[queryToken.toUpperCase()]);
            setTokenLocked(true);
        }
    }, [searchParams]);

    // Verify HMAC signature of payment link
    useEffect(() => {
        const sig = searchParams.get('sig');
        // Use URL param OR fetched state (for clean URLs)
        const queryAmount = searchParams.get('amount') || amount;
        const queryToken = searchParams.get('token') || selectedToken.symbol || 'SOL';

        if (!sig || !queryAmount || !alias) {
            setLinkVerification(sig ? 'checking' : 'unsigned');
            return;
        }

        const verify = async () => {
            const { verifyPaymentSignature } = await import('../../../utils/paymentSecurity');
            const result = await verifyPaymentSignature(
                String(alias).toLowerCase().trim(),
                queryAmount,
                queryToken.toUpperCase(),
                sig,
                searchParams.get('order_id')
            );
            setLinkVerification(result);
        };
        verify();
    }, [alias, searchParams, amount, selectedToken]);

    // ... (keep useEffect for balance/alias check same)

    useEffect(() => {
        setIsMounted(true);
        if (connected && publicKey) {
            // ... (keep existing balance logic)
            if (selectedToken.symbol === 'SOL') {
                connection.getBalance(publicKey).then(b => setBalance(b / 1e9));
            } else {
                const fetchSplBalance = async () => {
                    try {
                        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: selectedToken.mint });
                        if (accounts.value.length > 0) {
                            setBalance(accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount);
                        } else { setBalance(0); }
                    } catch (e) { setBalance(0); }
                };
                fetchSplBalance();
            }
        }
        if (alias) {
            checkAlias();
        }
    }, [alias, connected, publicKey, connection]);


    const checkAlias = async () => {
        if (!alias) return;

        const normalizedAlias = (alias as string).trim();

        // 0. Check if it's a direct PublicKey (Anonymous Request)
        try {
            const potentialPubkey = new PublicKey(normalizedAlias);
            if (PublicKey.isOnCurve(potentialPubkey.toBytes())) {
                setRecipientAddress(potentialPubkey);
                setAliasOwner(potentialPubkey);
                setRouteAccount(null);
                setIsDirectAddress(true); // Flag as direct address
                console.log("Direct PublicKey detected");
                return;
            }
        } catch (e) {
            // Not a public key
        }

        try {
            const provider = new AnchorProvider(connection, { publicKey: PublicKey.default } as any, {});
            const program = new Program(IDL as any, provider);
            const lowerAlias = normalizedAlias.toLowerCase(); // Aliases are lowercase

            // 1. Check for Route Account
            const [routePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("route"), Buffer.from(lowerAlias)],
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
                [Buffer.from("alias"), Buffer.from(lowerAlias)],
                PROGRAM_ID
            );

            try {
                const aliasAcc = await (program.account as any).aliasAccount.fetch(aliasPDA);
                setAliasOwner(aliasAcc.owner);
                if (!recipientAddress) setRecipientAddress(aliasAcc.owner);
                console.log("Alias owner found:", aliasAcc.owner.toBase58());
            } catch (e) {
                console.error("Alias does not exist");
                // Don't verify owner if we already found a route account (rare edge case but possible)
                if (!routeAccount) setAliasOwner(null);
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
            const amountBN = new BN(Math.floor(parseFloat(amount) * Math.pow(10, selectedToken.decimals)));

            let txSignature = '';

            // Scenario A: Route Config Exists -> Use Smart Contract
            if (routeAccount) {
                const [routePDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("route"), Buffer.from(normalizedAlias)],
                    PROGRAM_ID
                );

                if (selectedToken.symbol === 'SOL') {
                    // SOL Routing
                    const remainingAccounts = (routeAccount.splits as any[]).map(split => ({
                        pubkey: split.recipient, isWritable: true, isSigner: false,
                    }));
                    const tx = await program.methods
                        .executeTransfer(normalizedAlias, amountBN)
                        .accounts({
                            routeAccount: routePDA, user: publicKey, systemProgram: SystemProgram.programId,
                        })
                        .remainingAccounts(remainingAccounts)
                        .rpc();
                    txSignature = tx;
                } else {
                    // SPL Token Routing
                    const userATA = await getAssociatedTokenAddress(selectedToken.mint, publicKey);
                    const remainingAccounts = [];
                    const preInstructions = [];

                    for (const split of routeAccount.splits) {
                        const destATA = await getAssociatedTokenAddress(selectedToken.mint, split.recipient);
                        remainingAccounts.push({ pubkey: destATA, isSigner: false, isWritable: true });

                        // Check if ATA exists, create if not
                        const info = await connection.getAccountInfo(destATA);
                        if (!info) {
                            preInstructions.push(
                                createAssociatedTokenAccountInstruction(
                                    publicKey, // payer
                                    destATA, // ata
                                    split.recipient, // owner
                                    selectedToken.mint // mint
                                )
                            );
                        }
                    }

                    const ix = await program.methods
                        .executeTokenTransfer(normalizedAlias, amountBN)
                        .accounts({
                            routeAccount: routePDA,
                            user: publicKey,
                            mint: selectedToken.mint,
                            userTokenAccount: userATA,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            systemProgram: SystemProgram.programId
                        })
                        .remainingAccounts(remainingAccounts)
                        .instruction();

                    const transaction = new Transaction();
                    if (preInstructions.length > 0) transaction.add(...preInstructions);
                    transaction.add(ix);

                    const signature = await wallet.sendTransaction(transaction, connection);
                    await connection.confirmTransaction(signature, 'confirmed');
                    txSignature = signature;
                }
            }
            // Scenario B: No Route Config -> Direct Transfer to Owner
            else if (aliasOwner) {
                if (selectedToken.symbol === 'SOL') {
                    const transaction = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: publicKey,
                            toPubkey: aliasOwner,
                            lamports: BigInt(amountBN.toNumber()),
                        })
                    );
                    const signature = await wallet.sendTransaction(transaction, connection);
                    await connection.confirmTransaction(signature, 'confirmed');
                    txSignature = signature;
                } else {
                    // Direct SPL Transfer
                    const sourceATA = await getAssociatedTokenAddress(selectedToken.mint, publicKey);
                    const destATA = await getAssociatedTokenAddress(selectedToken.mint, aliasOwner);

                    const transaction = new Transaction();

                    // Check ATA existence
                    const info = await connection.getAccountInfo(destATA);
                    if (!info) {
                        transaction.add(
                            createAssociatedTokenAccountInstruction(publicKey, destATA, aliasOwner, selectedToken.mint)
                        );
                    }

                    transaction.add(
                        createTransferInstruction(sourceATA, destATA, publicKey, BigInt(amountBN.toString()))
                    );

                    const signature = await wallet.sendTransaction(transaction, connection);
                    await connection.confirmTransaction(signature, 'confirmed');
                    txSignature = signature;
                }
            } else {
                throw new Error("Alias not found or invalid.");
            }

            setLastSignature(txSignature);

            if (concept && txSignature && publicKey && aliasOwner) {
                // Save Private Note using Transaction Verification (No backend auth required for sender)
                saveSharedNote(
                    txSignature,
                    concept,
                    publicKey.toBase58(),
                    aliasOwner.toBase58()
                ).catch((e: any) => console.warn("Note save failed", e));
            }

            // Backend verification: verify on-chain TX matches expected order
            // If this is a simple payment (no pre-existing order), create one now to track history
            let orderId = searchParams.get('order_id');

            if (!orderId && aliasOwner && txSignature) {
                try {
                    const createRes = await fetch('/api/orders/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            alias: String(alias),
                            amount: amount,
                            token: selectedToken.symbol,
                            merchant_wallet: aliasOwner.toBase58(),
                            concept: concept || 'Quick Payment',
                            payer_wallet: publicKey?.toBase58()
                        }),
                    });
                    const createData = await createRes.json();
                    if (createData.order_id) {
                        orderId = createData.order_id;
                    }
                } catch (e) {
                    console.warn("Background order creation failed, payment tracking skipped:", e);
                }
            }

            if (orderId && txSignature) {
                try {
                    const verifyRes = await fetch('/api/orders/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            order_id: orderId,
                            tx_signature: txSignature,
                            payer_wallet: publicKey?.toBase58(),
                        }),
                    });
                    const verifyData = await verifyRes.json();

                    if (verifyData.verified) {
                        showTransactionToast({
                            signature: txSignature,
                            message: `✅ Payment verified: ${amount} ${selectedToken.symbol} to @${alias}`,
                            type: 'success'
                        });
                    } else {
                        showTransactionToast({
                            signature: txSignature,
                            message: `⚠️ Payment sent but verification issue: ${verifyData.message}`,
                            type: 'info'
                        });
                    }
                } catch (e) {
                    // Verification failed but payment was sent
                    showTransactionToast({
                        signature: txSignature,
                        message: `Sent ${amount} ${selectedToken.symbol} to @${alias} (verification pending)`,
                        type: 'success'
                    });
                }
            } else {
                showTransactionToast({
                    signature: txSignature,
                    message: `Successfully sent ${amount} ${selectedToken.symbol} to @${alias}`,
                    type: 'success'
                });
            }

            setStatus('success');
            setAmount('');
        } catch (error) {
            console.error("Payment failed:", error);
            toast.error("Payment failed: " + (error instanceof Error ? error.message : "Unknown error"));
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
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {(alias as string).length > 30 ?
                            `Pay ${(alias as string).slice(0, 4)}...${(alias as string).slice(-4)}`
                            : `Pay @${alias}`}
                    </h1>
                    <div className="flex justify-center gap-2 mt-3 flex-wrap">
                        {/* Status Badge */}
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${aliasOwner || routeAccount ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${aliasOwner || routeAccount ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                            <p className={`text-xs font-bold tracking-wide uppercase ${aliasOwner || routeAccount ? 'text-green-400' : 'text-red-400'}`}>
                                {isDirectAddress ? 'Valid Address' : (aliasOwner || routeAccount ? 'Valid Alias' : 'Alias Not Found')}
                            </p>
                        </div>

                        {/* Link Verification Badge */}
                        {linkVerification === 'valid' && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                <span className="text-xs font-bold text-green-400">Verified Link</span>
                            </div>
                        )}
                        {linkVerification === 'invalid' && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 animate-pulse">
                                <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                                <span className="text-xs font-bold text-red-400">Link Manipulated</span>
                            </div>
                        )}
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

                            {lastSignature && (
                                <div className="bg-black/20 rounded-xl p-4 mb-6 border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Transaction Hash</p>
                                    <code className="text-xs font-mono text-gray-400 block mb-3 bg-black/40 px-3 py-2 rounded-lg border border-white/5">
                                        {lastSignature.substring(0, 12)}...{lastSignature.substring(lastSignature.length - 12)}
                                    </code>
                                    <a
                                        href={`https://solscan.io/tx/${lastSignature}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-sm font-bold transition-all"
                                    >
                                        View on Solscan
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </div>
                            )}

                            {senderNote && <div className="bg-white/5 rounded-xl p-4 mb-8 border border-white/5"><p className="text-white italic text-sm">"{senderNote}"</p></div>}
                            <button
                                onClick={() => {
                                    setStatus('idle');
                                    setLastSignature(null);
                                }}
                                className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/5"
                            >
                                Send another payment
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Tamper Warning */}
                            {linkVerification === 'invalid' && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                                    <span className="text-red-400 text-lg mt-0.5">🚨</span>
                                    <div>
                                        <p className="text-red-400 font-bold text-sm">Warning: This link has been modified</p>
                                        <p className="text-red-400/70 text-xs mt-1">The payment parameters do not match the original link. The amount or token may have been tampered with. Proceed with caution.</p>
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    Amount ({selectedToken.symbol}) {isLocked && <span className="text-yellow-500 ml-2">🔒 Locked</span>}
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
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg group-focus-within:text-cyan-400 transition-colors">
                                        {selectedToken.symbol}
                                    </span>
                                </div>
                                {amount && solPrice && selectedToken.symbol === 'SOL' && (
                                    <p className="text-right text-gray-400 text-sm mt-2 font-mono">
                                        ≈ ${(parseFloat(amount) * solPrice).toFixed(2)} USD
                                    </p>
                                )}
                                {!tokenLocked && (
                                    <div className="flex gap-2 mt-3 justify-end">
                                        {Object.values(TOKEN_OPTIONS_MAP).map((t: any) => (
                                            <button
                                                key={t.symbol}
                                                onClick={() => setSelectedToken(t)}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${selectedToken.symbol === t.symbol ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-500'}`}
                                            >
                                                {t.symbol}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Concept: Read-only if locked, Editable if simple */}
                            {(isLocked && concept) ? (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
                                    <div className="mt-0.5 text-yellow-500">ℹ️</div>
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider text-yellow-500/80 mb-1 font-bold">Request Concept</label>
                                        <p className="text-white italic text-sm">"{concept}"</p>
                                    </div>
                                </div>
                            ) : !isLocked && (
                                <div className="mt-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        Payment Concept (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={concept || ''}
                                        onChange={(e) => setConcept(e.target.value)}
                                        placeholder="e.g. Donation, Gift, Service..."
                                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:bg-black/40 transition-all font-medium"
                                        maxLength={60}
                                    />
                                </div>
                            )}



                            {/* Summary Box */}
                            <div className="bg-white/5 rounded-xl p-5 text-sm border border-white/5">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-400">Recipient</span>
                                    <span className="text-white font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-xs truncate max-w-[150px]">
                                        {isDirectAddress && typeof alias === 'string' ? `${alias.slice(0, 4)}...${alias.slice(-4)}` : `@${alias}`}
                                    </span>
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
                                disabled={loading || !amount || linkVerification === 'invalid'}
                                className="w-full py-5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl shadow-xl shadow-purple-900/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Processing...
                                    </span>
                                ) : `Swipe to Pay ${amount ? amount : '0'} ${selectedToken.symbol}`}
                            </button>

                            {balance !== null && balance < parseFloat(amount || '0') && (
                                <p className="text-red-400 text-xs text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                                    Insufficient balance: {balance.toFixed(4)} {selectedToken.symbol}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 text-center">
                <p className="text-xs text-gray-600 font-medium">Powered by <span className="text-gray-500 font-bold">UNIK Protocol</span></p>
            </div>

            <MobileWalletPrompt />
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
