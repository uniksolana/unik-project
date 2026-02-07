'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { showTransactionToast, showSimpleToast } from '../components/CustomToast';
import { PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionMessage, ComputeBudgetProgram } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../utils/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { useConnection } from '@solana/wallet-adapter-react';
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";
import { Buffer } from 'buffer';
import Image from 'next/image';
import { contactStorage, Contact } from '../../utils/contacts';
import { supabase } from '../../utils/supabaseClient';
import { noteStorage, TransactionNote } from '../../utils/notes';
import { saveSharedNote, getSharedNotes, SharedNoteData } from '../../utils/sharedNotes';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import { deriveKeyFromSignature, encryptBlob, decryptBlob } from '../../utils/crypto';
import { getSessionKey, setSessionKey } from '../../utils/sessionState';

const TOKEN_OPTIONS = [
    { label: 'SOL', symbol: 'SOL', mint: null, decimals: 9, icon: '/sol.png' },
    { label: 'USDC (Devnet)', symbol: 'USDC', mint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), decimals: 6, icon: '/usdc.png' },
    { label: 'EURC (Devnet)', symbol: 'EURC', mint: new PublicKey('HzwqbKZw8JxJGHz3tYkXyVvV4yT9WDvF9d1t1zX5T2W'), decimals: 6, icon: '/eurc.png' } // Placeholder EURC Devnet Mint
];

type TabType = 'receive' | 'send' | 'splits' | 'alias' | 'contacts' | 'history';

export default function Dashboard() {
    const { publicKey, connected, signMessage } = useWallet();
    const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('receive');
    const [alias, setAlias] = useState('');
    const [loading, setLoading] = useState(false);
    const [registeredAlias, setRegisteredAlias] = useState<string | null>(null);
    const [myAliases, setMyAliases] = useState<string[]>([]);
    const [balances, setBalances] = useState<{ symbol: string; amount: number; valueUsd: number | null; icon: string }[]>([]);
    const [solPrice, setSolPrice] = useState<number | null>(null);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [linkAmount, setLinkAmount] = useState('');
    const [linkConcept, setLinkConcept] = useState('');
    const [requestToken, setRequestToken] = useState<any>(TOKEN_OPTIONS[0]); // Default SOL


    // Send Feature State
    const [sendRecipient, setSendRecipient] = useState('');
    const [sendAlias, setSendAlias] = useState('');
    const [sendAmount, setSendAmount] = useState('');
    const [sendNote, setSendNote] = useState('');
    const [paymentConcept, setPaymentConcept] = useState('');
    const [sendToken, setSendToken] = useState(TOKEN_OPTIONS[0]); // Default to SOL
    const [aliasDropdownOpen, setAliasDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [userCurrency, setUserCurrency] = useState('USD');
    const [userLanguage, setUserLanguage] = useState('en');
    const [network, setNetwork] = useState('devnet');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // New: Load Avatar Off-Chain based on Wallet Address
    // New: Load Avatar Off-Chain based on Wallet Address with Local Storage Fallback
    useEffect(() => {
        if (!publicKey) {
            setAvatarUrl(null);
            return;
        }

        const loadOffChainAvatar = () => {
            const fileName = `${publicKey.toBase58()}_avatar`;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

            // Check if image exists by trying to load it
            const img = new window.Image();
            img.onload = () => setAvatarUrl(`${publicUrl}?t=${Date.now()}`); // Cache bust if found on server
            img.onerror = () => {
                // Fallback: Check local storage if server image fails (e.g. RLS blocked or file not found)
                const localAvatar = localStorage.getItem(`unik_avatar_${publicKey.toBase58()}`);
                if (localAvatar) {
                    setAvatarUrl(localAvatar);
                } else {
                    setAvatarUrl(null);
                }
            };
            img.src = `${publicUrl}?t=${Date.now()}`;
        };

        loadOffChainAvatar();
    }, [publicKey]);

    useEffect(() => {
        // Load settings from localStorage
        const storedCurrency = localStorage.getItem('unik_currency');
        const storedLanguage = localStorage.getItem('unik_language');
        const storedNetwork = localStorage.getItem('unik_network');
        if (storedCurrency) setUserCurrency(storedCurrency);
        if (storedLanguage) setUserLanguage(storedLanguage);
        if (storedNetwork) setNetwork(storedNetwork);
    }, []);

    const saveSettings = (currency: string, language: string, net: string) => {
        setUserCurrency(currency);
        setUserLanguage(language);
        setNetwork(net);
        localStorage.setItem('unik_currency', currency);
        localStorage.setItem('unik_language', language);
        localStorage.setItem('unik_network', net);
        toast.success("Settings saved locally");
    };

    // Sync with global session (re-check on focus or mount)
    useEffect(() => {
        const k = getSessionKey();
        if (k && !encryptionKey) setEncryptionKey(k);

        const onFocus = () => {
            const k = getSessionKey();
            if (k && !encryptionKey) setEncryptionKey(k);
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [encryptionKey]);

    const unlockEncryption = async () => {
        if (!publicKey || !signMessage) {
            toast.error("Wallet does not support signing or not connected.");
            return null;
        }
        try {
            const toastId = toast.loading("Please sign to unlock encryption...");
            const message = new TextEncoder().encode("Sign this message to unlock your encrypted data (Notes & Avatar) on UNIK.");
            const signature = await signMessage(message);
            const signatureB58 = bs58.encode(signature);
            const key = await deriveKeyFromSignature(signatureB58);

            // Save to global session memory
            setSessionKey(key);
            setEncryptionKey(key);

            toast.success("Encryption unlocked!", { id: toastId });
            return key;
        } catch (e) {
            console.error("Unlock failed", e);
            toast.error("Unlock cancelled");
            return null;
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        if (!publicKey) {
            toast.error("Connect wallet first.");
            return;
        }

        let key = encryptionKey;
        if (!key) {
            key = await unlockEncryption();
            if (!key) return;
        }

        const file = e.target.files[0];
        // Privacy: Use fixed filename
        const fileName = `${publicKey.toBase58()}_avatar`;

        setUploadingAvatar(true);
        try {
            // 0. Encrypt File (Client-Side)
            const encryptedBlob = await encryptBlob(file, key!);

            // 1. Upload Encrypted Blob to Supabase
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, encryptedBlob, { upsert: true, contentType: 'application/octet-stream' });

            if (uploadError) throw uploadError;

            // 2. Fetch and Decrypt for immediate preview
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const res = await fetch(`${publicUrl}?t=${Date.now()}`);
            if (!res.ok) throw new Error("Failed to fetch uploaded file");

            const blob = await res.blob();
            const decrypted = await decryptBlob(blob, key!);

            setAvatarUrl(URL.createObjectURL(decrypted));
            toast.success("Profile picture encrypted & updated!");
        } catch (error: any) {
            console.error('Error uploading avatar:', error);

            // Fallback: If RLS blocks upload, save to local storage for demo purposes
            if (error.message && (error.message.includes("row-level security") || error.statusCode === '403')) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    const result = re.target?.result as string;
                    if (publicKey) {
                        localStorage.setItem(`unik_avatar_${publicKey.toBase58()}`, result);
                        setAvatarUrl(result);
                        toast.success("Profile saved locally");
                    }
                };
                reader.readAsDataURL(file);
            } else {
                toast.error(error.message || "Failed to upload avatar");
            }
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!publicKey) return;
        try {
            const fileName = `${publicKey.toBase58()}_avatar`;
            const { error } = await supabase.storage
                .from('avatars')
                .remove([fileName]);

            if (error) throw error;

            setAvatarUrl(null);
            toast.success("Profile picture removed (Off-chain).");
        } catch (error: any) {
            console.error("Error removing avatar:", error);
            toast.error(error.message || "Failed to remove avatar.");
        }
    };


    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const [noteModal, setNoteModal] = useState<{
        isOpen: boolean;
        alias: string;
        note: string;
        onSave: (newNote: string) => void;
    }>({
        isOpen: false,
        alias: '',
        note: '',
        onSave: () => { },
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setAliasDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);



    // Splits State
    const [splits, setSplits] = useState([{ recipient: 'Primary Wallet (You)', address: publicKey?.toBase58(), percent: 100 }]);
    const [isEditing, setIsEditing] = useState(false);
    const [newSplitAddress, setNewSplitAddress] = useState('');
    const [newSplitPercent, setNewSplitPercent] = useState('');

    const { connection } = useConnection();
    const wallet = useWallet();

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);

    useEffect(() => {
        const fetchAllBalances = async () => {
            if (!connected || !publicKey) return;

            try {
                // 1. SOL Balance
                const solLamports = await connection.getBalance(publicKey);
                const solAmount = solLamports / 1e9;

                // 2. SPL Token Balances
                const tokenBalancesData = [];
                for (const token of TOKEN_OPTIONS.slice(1)) { // Skip SOL (index 0)
                    try {
                        if (!token.mint) continue;
                        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: token.mint });
                        let amount = 0;
                        if (accounts.value.length > 0) {
                            amount = accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
                        }
                        tokenBalancesData.push({ ...token, amount });
                    } catch (e) {
                        console.error(`Failed to fetch ${token.symbol} balance`, e);
                        tokenBalancesData.push({ ...token, amount: 0 });
                    }
                }

                // Construct Balance State
                const newBalances = [
                    { symbol: 'SOL', amount: solAmount, valueUsd: solPrice ? solAmount * solPrice : null, icon: TOKEN_OPTIONS[0].icon },
                    ...tokenBalancesData.map(t => ({
                        symbol: t.symbol,
                        amount: t.amount,
                        valueUsd: null, // Would need price feed for USDC/EURC
                        icon: t.icon
                    }))
                ];
                setBalances(newBalances);

            } catch (e) {
                console.error("Error fetching balances", e);
            }
        };

        if (connected && publicKey) {
            fetchAllBalances();
            const timer = setInterval(fetchAllBalances, 10000);
            return () => clearInterval(timer);
        }
    }, [connected, publicKey, connection, solPrice]);

    useEffect(() => {
        const checkExistingAlias = async () => {
            if (!publicKey || !wallet || !connected) {
                setRegisteredAlias(null);
                setAlias('');
                return;
            }

            try {
                const provider = new AnchorProvider(connection, wallet as any, {});
                const program = new Program(IDL as any, provider);
                setLoading(true);

                const aliases = await (program.account as any).aliasAccount.all([
                    { memcmp: { offset: 8, bytes: publicKey.toBase58() } }
                ]);

                if (aliases.length > 0) {
                    const aliasList = aliases.map((a: any) => a.account.alias);
                    setMyAliases(aliasList);
                    if (!registeredAlias) {
                        setRegisteredAlias(aliasList[0]);
                        setAlias(aliasList[0]);
                    }
                } else {
                    setMyAliases([]);
                    setRegisteredAlias(null);
                    setShowRegisterForm(true);
                    setActiveTab('alias');
                }
            } catch (err) {
                console.error("Error fetching alias:", err);
            } finally {
                setLoading(false);
            }
        };

        checkExistingAlias();
    }, [publicKey, connected, connection, wallet]);

    useEffect(() => {
        const fetchRouteConfig = async () => {
            if (!registeredAlias || !publicKey || !wallet) return;

            try {
                const provider = new AnchorProvider(connection, wallet as any, {});
                const program = new Program(IDL as any, provider);
                const [routePDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("route"), Buffer.from(registeredAlias)],
                    PROGRAM_ID
                );

                const routeAccount = await (program.account as any).routeAccount.fetch(routePDA);
                const mappedSplits = routeAccount.splits.map((s: any) => ({
                    recipient: s.recipient.toBase58() === publicKey.toBase58() ? 'Primary Wallet (You)' : `Wallet ${s.recipient.toBase58().slice(0, 4)}...`,
                    address: s.recipient.toBase58(),
                    percent: s.percentage / 100
                }));

                if (mappedSplits.length > 0) {
                    setSplits(mappedSplits);
                } else {
                    setSplits([{ recipient: 'Primary Wallet (You)', address: publicKey.toBase58(), percent: 100 }]);
                }
            } catch (e) {
                setSplits([{ recipient: 'Primary Wallet (You)', address: publicKey.toBase58(), percent: 100 }]);
            }
        };

        fetchRouteConfig();
    }, [registeredAlias, publicKey, wallet, connection]);

    // Lifted Contacts Logic
    const [contacts, setContacts] = useState<any[]>([]);

    const loadContacts = async () => {
        try {
            const owner = publicKey?.toBase58();
            if (owner) {
                const loaded = await contactStorage.getContacts(owner);
                setContacts(loaded);
            }
        } catch (e) {
            console.error("Failed to load contacts", e);
        }
    };

    useEffect(() => {
        if (publicKey) {
            loadContacts();
        }
        const listener = () => loadContacts();
        window.addEventListener('storage', listener);
        window.addEventListener('unik-contacts-updated', listener);
        return () => {
            window.removeEventListener('storage', listener);
            window.removeEventListener('unik-contacts-updated', listener);
        };
    }, [publicKey]);

    const handleRegister = async () => {
        if (!alias || !publicKey || !wallet) return;
        setLoading(true);
        try {
            const provider = new AnchorProvider(connection, wallet as any, {});
            const program = new Program(IDL as any, provider);
            const normalizedAlias = alias.toLowerCase().trim();

            const [aliasPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("alias"), Buffer.from(normalizedAlias)],
                PROGRAM_ID
            );

            const instruction = await program.methods
                .registerAlias(normalizedAlias, "https://unik.to/metadata_placeholder")
                .accounts({
                    aliasAccount: aliasPDA,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .instruction();

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

            const messageV0 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: blockhash,
                instructions: [
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
                    instruction
                ],
            }).compileToV0Message();

            const transaction = new VersionedTransaction(messageV0);

            const signature = await wallet.sendTransaction(transaction, connection);
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

            setRegisteredAlias(normalizedAlias);
            setMyAliases([...myAliases, normalizedAlias]);
            setShowRegisterForm(false);
            toast.success(`Alias @${normalizedAlias} registered!`);
        } catch (error: any) {
            console.error("Error registering:", error);
            let message = "Transaction failed.";
            if (error.message?.includes("User rejected")) message = "Request rejected by user.";
            else if (error.message?.includes("0x1") || error.message?.includes("insufficient funds")) message = "Transaction failed (Insufficient funds?).";

            if (error.logs) {
                if (error.logs.some((l: string) => l.includes("InvalidAliasLength"))) message = "Alias must be 3-32 characters.";
                if (error.logs.some((l: string) => l.includes("InvalidAliasCharacters"))) message = "Alias only allowed a-z, 0-9 and _";
            }

            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!publicKey || !wallet || !alias) return;
        setLoading(true);
        try {
            const provider = new AnchorProvider(connection, wallet as any, {});
            const program = new Program(IDL as any, provider);
            const normalizedAlias = alias.toLowerCase().trim();

            const [aliasPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("alias"), Buffer.from(normalizedAlias)],
                PROGRAM_ID
            );

            const [routePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("route"), Buffer.from(normalizedAlias)],
                PROGRAM_ID
            );

            const idlSplits = splits.map(s => ({
                recipient: new PublicKey(s.address!),
                percentage: s.percent * 100
            }));

            const instruction = await program.methods
                .setRouteConfig(normalizedAlias, idlSplits)
                .accounts({
                    routeAccount: routePDA,
                    aliasAccount: aliasPDA,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .instruction();

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

            const messageV0 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: blockhash,
                instructions: [
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
                    instruction
                ],
            }).compileToV0Message();

            const transaction = new VersionedTransaction(messageV0);

            const signature = await wallet.sendTransaction(transaction, connection);
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

            toast.success(`Routing rules saved!`);
            setIsEditing(false);
        } catch (error: any) {
            console.error("Error saving config:", error);
            let message = "Failed to save config.";
            if (error.message?.includes("User rejected")) message = "Rejected by user.";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        // Fetch SOL price
        const fetchPrice = async () => {
            try {
                const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
                const data = await res.json();
                setSolPrice(data.solana.usd);
            } catch (e) {
                console.error("Failed to fetch price", e);
            }
        };
        fetchPrice();
    }, []);

    // ... existing alias and config effects ...

    // ... (keep handleRegister and handleSaveConfig logic same as before, they are fine)

    const totalPercent = splits.reduce((acc, curr) => acc + curr.percent, 0);

    const addSplit = () => {
        if (!newSplitAddress || !newSplitPercent) return;
        const percent = parseFloat(newSplitPercent); // Allow decimals
        if (isNaN(percent) || percent <= 0 || percent >= 100) return;

        const myPubkey = publicKey?.toBase58();

        // Filter out Primary Wallet to calculate stats of "Others"
        const otherSplits = splits.filter(s => s.address !== myPubkey && s.recipient !== 'Primary Wallet (You)');
        const currentOthersTotal = otherSplits.reduce((acc, curr) => acc + curr.percent, 0);

        // Check if adding this new split would exceed 100%
        if (currentOthersTotal + percent > 100) {
            toast.error(`Total external splits cannot exceed 100% (Current external: ${currentOthersTotal}%)`);
            return;
        }

        // Create new split
        const newSplit = {
            recipient: `Wallet ${newSplitAddress.slice(0, 4)}...`,
            address: newSplitAddress,
            percent
        };

        // Re-construct the list: others + new + recalculated primary
        const newOthers = [...otherSplits, newSplit];
        const newOthersTotal = currentOthersTotal + percent;
        // Remaining goes to Primary
        const remaining = Math.round((100 - newOthersTotal) * 100) / 100; // Handle float precision

        const primarySplit = {
            recipient: 'Primary Wallet (You)',
            address: myPubkey,
            percent: remaining
        };

        setSplits([primarySplit, ...newOthers]);
        setNewSplitAddress('');
        setNewSplitPercent('');
        setIsEditing(false);
    };

    const removeSplit = (index: number) => {
        const splitToRemove = splits[index];
        const myPubkey = publicKey?.toBase58();

        // Prevent removing primary wallet
        if (splitToRemove.address === myPubkey || splitToRemove.recipient === 'Primary Wallet (You)') {
            toast.error("Cannot remove Primary Wallet");
            return;
        }

        const newSplitsFiltered = splits.filter((_, i) => i !== index);

        // Recalculate Primary
        const otherSplits = newSplitsFiltered.filter(s => s.address !== myPubkey && s.recipient !== 'Primary Wallet (You)');
        const startOthersTotal = otherSplits.reduce((acc, curr) => acc + curr.percent, 0);
        const remaining = Math.round((100 - startOthersTotal) * 100) / 100;

        const primarySplit = {
            recipient: 'Primary Wallet (You)',
            address: myPubkey,
            percent: remaining
        };

        setSplits([primarySplit, ...otherSplits]);
    };

    if (!connected) {
        if (!isMounted) return null;
        return (
            <div className="min-h-screen bg-[#0d0d12] flex flex-col items-center justify-center text-white px-4 relative overflow-hidden">
                {/* Ambient Background */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px]"></div>

                <div className="text-center z-10 p-8 border border-white/10 bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl">
                    <Image src="/logo-icon.png" alt="UNIK" width={80} height={80} className="mx-auto mb-6 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" priority />
                    <h1 className="text-4xl font-bold mb-3 tracking-tight">Welcome to UNIK</h1>
                    <p className="text-gray-400 mb-8 max-w-xs mx-auto">The next-gen payment router for Solana.</p>
                    <WalletMultiButton />
                </div>
            </div>
        );
    }

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-[#0d0d12] text-white selection:bg-cyan-500/30">
            {/* Header / Nav */}
            <nav className="border-b border-white/5 bg-[#0d0d12]/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="w-full max-w-md md:max-w-6xl mx-auto px-2 md:px-4 py-3 md:py-4 grid grid-cols-[auto_1fr_auto] items-center gap-1 md:gap-2">
                    <div className="flex items-center gap-2 flex-shrink-0 min-w-fit">
                        <img
                            src="/logo-icon.png"
                            alt="UNIK"
                            style={{ width: '40px', height: '40px', minWidth: '40px' }}
                            className="!w-10 !h-10 md:!w-14 md:!h-14 object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                        />
                        <img
                            src="/logo-text.png"
                            alt="UNIK"
                            className="h-6 md:h-10 w-auto hidden md:inline-block opacity-90 transform translate-y-0.5 ml-2"
                        />
                    </div>

                    {/* Active Alias Capsule (Centered) */}
                    <div className="flex justify-center w-full" ref={dropdownRef}>
                        <div
                            onClick={() => myAliases.length > 1 && setAliasDropdownOpen(!aliasDropdownOpen)}
                            className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 backdrop-blur-md hover:bg-white/10 transition-colors cursor-pointer group"
                        >
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_limegreen]"></div>
                            <span className="text-xs font-mono text-gray-300 font-bold">
                                {registeredAlias ? `@${registeredAlias}` : 'No Alias'}
                            </span>
                            {myAliases.length > 1 && (
                                <svg className={`w-3 h-3 text-gray-400 group-hover:text-white transition-transform ${aliasDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            )}

                            {/* Custom Dropdown Menu */}
                            {aliasDropdownOpen && myAliases.length > 1 && (
                                <div className="absolute top-[calc(100%+8px)] left-0 right-0 min-w-[140px] bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] py-2 animate-in fade-in zoom-in-95 duration-200 origin-top">
                                    <div className="px-3 py-1 mb-1">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Switch Alias</p>
                                    </div>
                                    {myAliases.map(a => (
                                        <button
                                            key={a}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRegisteredAlias(a);
                                                setAliasDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-all flex items-center gap-2 hover:bg-white/10 group/item ${registeredAlias === a ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full transition-all ${registeredAlias === a ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-transparent group-hover/item:bg-white/20'}`}></span>
                                            @{a}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Integrated Wallet Button & Settings */}
                    <div className="flex justify-end items-center gap-1 md:gap-2">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-1.5 md:p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5 flex-shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <div className="scale-75 origin-right">
                            <WalletMultiButton />
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Container */}
            {/* Main Container */}
            <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">

                <div className="flex flex-col lg:flex-row gap-8 items-start">

                    {/* LEFT COLUMN: Sidebar (Balance & Actions) */}
                    <div className="w-full lg:w-[350px] flex-shrink-0 space-y-6">
                        {/* Balance Card */}
                        <div className="relative overflow-hidden rounded-[2rem] p-[1px] bg-gradient-to-br from-cyan-500/50 via-purple-500/50 to-pink-500/50 shadow-2xl shadow-purple-900/20">
                            <div className="bg-[#13131f] rounded-[2rem] p-6 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-cyan-500/10 blur-[50px] rounded-full"></div>
                                <p className="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase mb-4">Portfolio</p>

                                <div className="space-y-4">
                                    {balances.length > 0 ? balances.map((b) => (
                                        <div key={b.symbol} className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                {b.icon && (
                                                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ backgroundColor: b.symbol === 'SOL' ? '#000000' : 'transparent' }}>
                                                        <Image
                                                            src={b.icon}
                                                            alt={b.symbol}
                                                            width={40}
                                                            height={40}
                                                            className={`object-contain ${b.symbol === 'SOL' ? 'w-6 h-6' : b.symbol === 'EURC' ? 'w-10 h-10 scale-110' : 'w-10 h-10'}`}
                                                        />
                                                    </div>
                                                )}
                                                <div className="text-left">
                                                    <p className="font-bold text-white leading-none">{b.symbol}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-white">{b.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                                                {b.symbol === 'SOL' && b.valueUsd !== null && (
                                                    <p className="text-[10px] text-cyan-400">≈ ${b.valueUsd.toFixed(2)}</p>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-gray-500 text-sm">Loading balances...</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Grid */}
                        <div className="grid grid-cols-3 lg:grid-cols-2 gap-3">
                            <ActionButton
                                icon="receive"
                                label="Receive"
                                active={activeTab === 'receive'}
                                onClick={() => setActiveTab('receive')}
                            />
                            <ActionButton
                                icon="send"
                                label="Send"
                                active={activeTab === 'send'}
                                onClick={() => setActiveTab('send')}
                            />
                            <ActionButton
                                icon="splits"
                                label="Splits"
                                active={activeTab === 'splits'}
                                onClick={() => setActiveTab('splits')}
                            />
                            <ActionButton
                                icon="alias"
                                label="Alias"
                                active={activeTab === 'alias'}
                                onClick={() => setActiveTab('alias')}
                            />
                            <ActionButton
                                icon="contacts"
                                label="Contacts"
                                active={activeTab === 'contacts'}
                                onClick={() => setActiveTab('contacts')}
                            />
                            <ActionButton
                                icon="history"
                                label="History"
                                active={activeTab === 'history'}
                                onClick={() => setActiveTab('history')}
                            />
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Content Area */}
                    <div className="flex-1 w-full bg-[#13131f]/50 backdrop-blur-sm rounded-[2rem] border border-white/5 p-4 lg:p-8 min-h-[500px]">
                        {activeTab === 'receive' && <ReceiveTab registeredAlias={registeredAlias} linkAmount={linkAmount} setLinkAmount={setLinkAmount} linkConcept={linkConcept} setLinkConcept={setLinkConcept} requestToken={requestToken} setRequestToken={setRequestToken} />}
                        {activeTab === 'send' && <SendTab sendRecipient={sendRecipient} setSendRecipient={setSendRecipient} sendAlias={sendAlias} setSendAlias={setSendAlias} sendAmount={sendAmount} setSendAmount={setSendAmount} sendNote={sendNote} setSendNote={setSendNote} paymentConcept={paymentConcept} setPaymentConcept={setPaymentConcept} loading={loading} setLoading={setLoading} publicKey={publicKey} wallet={wallet} connection={connection} solPrice={solPrice} balance={balances.find(b => b.symbol === 'SOL')?.amount || 0} sendToken={sendToken} setSendToken={setSendToken} myAliases={myAliases} contacts={contacts} />}
                        {activeTab === 'splits' && <SplitsTab splits={splits} setSplits={setSplits} isEditing={isEditing} setIsEditing={setIsEditing} newSplitAddress={newSplitAddress} setNewSplitAddress={setNewSplitAddress} newSplitPercent={newSplitPercent} setNewSplitPercent={setNewSplitPercent} addSplit={addSplit} removeSplit={removeSplit} totalPercent={totalPercent} handleSaveConfig={handleSaveConfig} loading={loading} registeredAlias={registeredAlias} setActiveTab={setActiveTab} />}
                        {activeTab === 'alias' && <AliasTab myAliases={myAliases} showRegisterForm={showRegisterForm} setShowRegisterForm={setShowRegisterForm} alias={alias} setAlias={setAlias} handleRegister={handleRegister} loading={loading} setRegisteredAlias={setRegisteredAlias} />}
                        {activeTab === 'contacts' && <ContactsTab contacts={contacts} refreshContacts={loadContacts} setSendRecipient={setSendRecipient} setSendAlias={setSendAlias} setSendNote={setSendNote} setActiveTab={setActiveTab} loading={loading} setLoading={setLoading} connection={connection} wallet={wallet} confirmModal={confirmModal} setConfirmModal={setConfirmModal} noteModal={noteModal} setNoteModal={setNoteModal} />}
                        {activeTab === 'history' && <HistoryTab publicKey={publicKey} connection={connection} />}
                    </div>
                </div>

                {/* Settings Modal */}
                {showSettings && (
                    <SettingsModal
                        isOpen={showSettings}
                        onClose={() => setShowSettings(false)}
                        avatarUrl={avatarUrl}
                        handleAvatarUpload={handleAvatarUpload}
                        uploadingAvatar={uploadingAvatar}
                        userCurrency={userCurrency}
                        userLanguage={userLanguage}
                        network={network}
                        saveSettings={saveSettings}
                        registeredAlias={registeredAlias}
                        handleRemoveAvatar={handleRemoveAvatar}
                    />
                )}

                {/* Confirm Modal (Global) */}
                {confirmModal.isOpen && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                        ></div>
                        <div className="relative w-full max-w-sm bg-[#13131f] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center text-white">
                                <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                <h3 className="text-xl font-bold mb-2 tracking-tight">{confirmModal.title}</h3>
                                <p className="text-gray-400 text-sm mb-8 leading-relaxed">{confirmModal.message}</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                        className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/5 transition-all text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            confirmModal.onConfirm();
                                            setConfirmModal({ ...confirmModal, isOpen: false });
                                        }}
                                        className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-xl shadow-red-900/20 transition-all text-sm active:scale-95"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Note Modal (Global) */}
                <NoteModal
                    isOpen={noteModal.isOpen}
                    alias={noteModal.alias}
                    initialNote={noteModal.note}
                    onClose={() => setNoteModal({ ...noteModal, isOpen: false })}
                    onSave={(newNote: string) => {
                        noteModal.onSave(newNote);
                        setNoteModal({ ...noteModal, isOpen: false });
                    }}
                />

                {/* Footer */}
                <div className="mt-12 pt-8 border-t border-white/5 text-center text-gray-500">
                    <p className="text-sm mb-2 font-medium">Powered by <span className="text-cyan-400">UNIK Protocol</span></p>
                    <p className="text-[10px] uppercase tracking-wider max-w-md mx-auto opacity-50 px-4">
                        Beta Product • Use at your own risk • Non-Custodial
                        <br className="sm:hidden" />
                        <span className="hidden sm:inline"> • </span>
                        Not responsible for lost funds
                    </p>
                </div>
            </div>
        </div>
    );
}

function ActionButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
    const icons: Record<string, React.ReactElement> = {
        receive: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        ),
        send: (
            <svg className="w-6 h-6 md:w-7 md:h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        ),
        splits: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
        ),
        alias: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        ),
        contacts: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        ),
        history: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        )
    };

    return (
        <button
            onClick={onClick}
            className={`aspect-square rounded-[1.5rem] flex flex-col items-center justify-center gap-2 transition-all duration-300 shadow-lg ${active
                ? 'bg-gradient-to-br from-cyan-500 to-purple-600 text-white shadow-cyan-500/40 scale-105'
                : 'bg-[#13131f] text-gray-400 hover:bg-[#1a1a24] border border-white/5'
                }`}
        >
            <div className={`${active ? 'text-white' : 'text-gray-500'}`}>
                {icons[icon]}
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase">{label}</span>
        </button>
    );
}

function ReceiveTab({ registeredAlias, linkAmount, setLinkAmount, linkConcept, setLinkConcept, requestToken, setRequestToken }: any) {
    const { publicKey } = useWallet();
    const [useAddress, setUseAddress] = useState(!registeredAlias);

    // Default to Alias if available, fallback to Address
    useEffect(() => {
        if (registeredAlias) {
            setUseAddress(false);
        } else {
            setUseAddress(true);
        }
    }, [registeredAlias]);

    const [isPayShareOpen, setIsPayShareOpen] = useState(false);
    const [isContactShareOpen, setIsContactShareOpen] = useState(false);

    const shareValue = useAddress ? publicKey?.toBase58() : registeredAlias;

    const getPaymentUrl = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        let url = `${origin}/pay/${shareValue}`;
        const params = new URLSearchParams();
        if (linkAmount) params.append('amount', linkAmount);
        if (linkConcept) params.append('concept', encodeURIComponent(linkConcept));
        if (requestToken.symbol !== 'SOL') params.append('token', requestToken.symbol);

        if (params.toString()) url += `?${params.toString()}`;
        return url;
    };

    const getShareMessage = () => {
        const amount = linkAmount ? ` ${linkAmount} ${requestToken.symbol}` : '';
        return `💸 Pay me${amount} via UNIK: ${getPaymentUrl()}`;
    };

    const getContactUrl = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        return `${origin}/add-contact/${registeredAlias || publicKey?.toBase58()}`;
    };

    const getContactShareMessage = () => {
        return `👤 Add me on UNIK contacts: ${getContactUrl()}`;
    };

    return (
        <div>
            <h3 className="text-2xl font-bold mb-6">Receive Payments</h3>

            {/* Source Toggle */}
            <div className="flex justify-center mb-8">
                <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                    {registeredAlias ? (
                        <button
                            onClick={() => setUseAddress(false)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!useAddress ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            @{registeredAlias}
                        </button>
                    ) : (
                        <button disabled className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 cursor-not-allowed">
                            No Alias
                        </button>
                    )}
                    <button
                        onClick={() => setUseAddress(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${useAddress ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Wallet Address
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <label className="text-sm text-gray-400 block mb-2">Request specific amount (optional)</label>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={linkAmount}
                        className="w-32 px-4 py-3 text-lg font-bold bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                        onChange={(e) => setLinkAmount(e.target.value)}
                    />
                    <span className="text-lg font-bold text-gray-400">{requestToken.symbol}</span>
                </div>
            </div>

            <div className="mb-6">
                <label className="text-sm text-gray-400 block mb-2">Select Token</label>
                <div className="flex gap-2">
                    {TOKEN_OPTIONS.map(token => (
                        <button
                            key={token.symbol}
                            onClick={() => setRequestToken(token)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${requestToken.symbol === token.symbol ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'}`}
                        >
                            {token.symbol}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <label className="text-sm text-gray-400 block mb-2">Payment Concept (optional, off-chain)</label>
                <input
                    type="text"
                    placeholder="e.g. For dinner, Project XYZ..."
                    value={linkConcept}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                    onChange={(e) => setLinkConcept(e.target.value)}
                />
            </div>

            <div className="bg-gray-800 p-6 border border-gray-700">
                <label className="text-sm text-gray-400 block mb-3">Your Payment Link & QR Code</label>

                {/* QR Code Display */}
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-white rounded-xl shadow-lg">
                        <QRCode
                            value={getPaymentUrl()}
                            size={180}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                        />
                    </div>
                </div>

                <div className="mb-4">
                    <code className="block p-4 bg-black text-cyan-400 font-mono text-sm break-all border border-gray-700">
                        {getPaymentUrl().replace(/^https?:\/\//, '')}
                    </code>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(getPaymentUrl());
                            toast.success("Link copied to clipboard!");
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 font-semibold transition-colors rounded-xl border border-white/5"
                    >
                        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                    </button>

                    <button
                        onClick={() => setIsPayShareOpen(!isPayShareOpen)}
                        className={`flex items-center justify-center gap-2 px-4 py-3 font-semibold transition-all rounded-xl border ${isPayShareOpen ? 'bg-cyan-600 border-cyan-400' : 'bg-gray-700 hover:bg-gray-600 border-white/5'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share
                    </button>
                </div>

                {isPayShareOpen && (
                    <div className="grid grid-cols-2 gap-3 mt-3 animate-in slide-in-from-top-2 duration-200">
                        <button
                            onClick={() => {
                                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(getShareMessage())}`;
                                window.open(whatsappUrl, '_blank');
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-xl font-semibold transition-colors"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            WhatsApp
                        </button>

                        <button
                            onClick={() => {
                                const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(getPaymentUrl())}&text=${encodeURIComponent(`💸 Pay me${linkAmount ? ` ${linkAmount} ${requestToken.symbol}` : ''} via UNIK`)}`;
                                window.open(telegramUrl, '_blank');
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30 rounded-xl font-semibold transition-colors"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                            Telegram
                        </button>
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-white/5">
                    <div className="bg-gradient-to-br from-[#1c1c2b] to-[#13131f] rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[60px] rounded-full group-hover:bg-cyan-500/20 transition-all duration-700"></div>

                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-gradient-to-tr from-cyan-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-black shadow-[0_0_30px_rgba(6,182,212,0.3)] mb-4">
                                @
                            </div>
                            <h4 className="text-3xl font-black bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent tracking-tight">
                                @{registeredAlias}
                            </h4>
                            <p className="text-sm text-gray-400 mt-2 mb-8 font-medium max-w-[200px]">
                                Share your personal UNIK contact identifier
                            </p>

                            <div className="grid grid-cols-2 gap-4 w-full">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(getContactUrl());
                                        toast.success("Contact link copied!");
                                    }}
                                    className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all active:scale-95 px-4"
                                >
                                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy
                                </button>

                                <button
                                    onClick={() => setIsContactShareOpen(!isContactShareOpen)}
                                    className={`flex items-center justify-center gap-2 py-4 font-bold rounded-2xl border transition-all active:scale-95 px-4 ${isContactShareOpen ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/40' : 'bg-white/5 hover:bg-white/10 text-white border-white/10'}`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                    Share
                                </button>
                            </div>

                            {isContactShareOpen && (
                                <div className="grid grid-cols-2 gap-3 w-full mt-4 animate-in zoom-in-95 duration-200">
                                    <button
                                        onClick={() => {
                                            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(getContactShareMessage())}`;
                                            window.open(whatsappUrl, '_blank');
                                        }}
                                        className="flex items-center justify-center gap-2 py-3.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-600/30 rounded-xl font-bold transition-all text-xs"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                        WhatsApp
                                    </button>
                                    <button
                                        onClick={() => {
                                            const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(getContactUrl())}&text=${encodeURIComponent(`👤 Add me on UNIK contacts`)}`;
                                            window.open(telegramUrl, '_blank');
                                        }}
                                        className="flex items-center justify-center gap-2 py-3.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-xl font-bold transition-all text-xs"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                        </svg>
                                        Telegram
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SendTab({ sendRecipient, setSendRecipient, sendAlias, setSendAlias, sendAmount, setSendAmount, sendNote, setSendNote, paymentConcept, setPaymentConcept, loading, setLoading, publicKey, wallet, connection, solPrice, balance, sendToken, setSendToken, myAliases, contacts }: any) {
    // QR Scanner State
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Contact Picker State
    const [showContactPicker, setShowContactPicker] = useState(false);
    const [contactSearch, setContactSearch] = useState(''); // New state for dropdown search

    // Token Balance State
    const [tokenBalance, setTokenBalance] = useState<number | null>(null);

    // Smart Alias Search Logic
    const [debouncedRecipient, setDebouncedRecipient] = useState(sendRecipient);
    const [isValidRecipient, setIsValidRecipient] = useState<boolean | null>(null);
    const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedRecipient(sendRecipient), 600);
        return () => clearTimeout(timer);
    }, [sendRecipient]);

    useEffect(() => {
        const validateRecipient = async () => {
            if (!debouncedRecipient || debouncedRecipient.length < 3) {
                setIsValidRecipient(null);
                return;
            }

            setIsCheckingRecipient(true);
            try {
                // Check if it's a valid PublicKey
                try {
                    const pubkey = new PublicKey(debouncedRecipient);
                    if (PublicKey.isOnCurve(pubkey.toBytes())) {
                        setIsValidRecipient(true);
                        setIsCheckingRecipient(false);
                        return;
                    }
                } catch { }

                // Check if it's a valid Alias
                const aliasToCheck = debouncedRecipient.startsWith('@') ? debouncedRecipient.slice(1).toLowerCase() : debouncedRecipient.toLowerCase();
                const [aliasPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("alias"), Buffer.from(aliasToCheck)],
                    PROGRAM_ID
                );

                const info = await connection.getAccountInfo(aliasPDA);
                setIsValidRecipient(!!info);

            } catch (error) {
                console.error("Validation error:", error);
                setIsValidRecipient(false);
            } finally {
                setIsCheckingRecipient(false);
            }
        };

        validateRecipient();
    }, [debouncedRecipient, connection]);
    useEffect(() => {
        if (!publicKey || !sendToken.mint) {
            setTokenBalance(null);
            return;
        }
        const fetchTokenBalance = async () => {
            try {
                const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: sendToken.mint });
                if (accounts.value.length > 0) {
                    const amount = accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
                    setTokenBalance(amount);
                } else {
                    setTokenBalance(0);
                }
            } catch (error) {
                console.error("Error fetching token balance", error);
                setTokenBalance(0);
            }
        };
        fetchTokenBalance();
    }, [sendToken, publicKey, connection]);

    const activeBalance = sendToken.symbol === 'SOL' ? balance : tokenBalance;

    const handleQrResult = (decodedText: string) => {
        if (!decodedText) return;
        try {
            if (decodedText.includes('/pay/')) {
                try {
                    const url = new URL(decodedText);
                    const pathParts = url.pathname.split('/');
                    const aliasIndex = pathParts.indexOf('pay') + 1;
                    if (aliasIndex < pathParts.length) {
                        setSendRecipient(`@${pathParts[aliasIndex]}`);
                        setSendAlias(pathParts[aliasIndex]);
                        const amount = url.searchParams.get('amount');
                        if (amount) setSendAmount(amount);
                        const concept = url.searchParams.get('concept');
                        if (concept) setSendNote(concept);
                    }
                } catch (e) { setSendRecipient(decodedText); }
            } else { setSendRecipient(decodedText); setSendAlias(''); }

            if (scannerRef.current) {
                scannerRef.current.stop().then(() => { scannerRef.current?.clear(); scannerRef.current = null; setScanning(false); }).catch(console.error);
            } else { setScanning(false); }
        } catch (e) { console.error("QR Parse Error", e); }
    };

    // Detect if running in Solflare mobile WebView
    const isSolflareMobile = () => {
        if (typeof window === 'undefined') return false;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const hasSolflare = !!(window as any).solflare;
        const isPhantom = !!(window as any).phantom;
        // Solflare mobile but NOT Phantom (Phantom works fine)
        return isMobile && hasSolflare && !isPhantom;
    };

    const handleScanClick = () => {
        if (isSolflareMobile()) {
            toast('🔒 Por seguridad, Solflare móvil no permite escanear QR desde dApps.\n\nUsa el campo de alias o selecciona un contacto.', {
                duration: 5000,
                style: {
                    background: '#1f2937',
                    color: '#fff',
                    border: '1px solid #374151',
                    padding: '16px',
                    borderRadius: '12px',
                },
                icon: '📱',
            });
            return;
        }
        setScanning(true);
    };

    useEffect(() => {
        let isActive = true;
        if (scanning) {
            const timer = setTimeout(() => {
                if (!isActive || !document.getElementById("reader")) return;

                if (!scannerRef.current) {
                    const html5QrCode = new Html5Qrcode("reader");
                    scannerRef.current = html5QrCode;

                    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

                    const onScanSuccess = (decodedText: string) => {
                        if (!isActive) return;
                        handleQrResult(decodedText);
                    };

                    // Robust start sequence: Back Camera -> Any Camera
                    html5QrCode.start(
                        { facingMode: "environment" },
                        config,
                        onScanSuccess,
                        () => { } // Ignore frame errors
                    ).catch(err => {
                        console.warn("Back camera init failed, retrying with user/any camera...", err);
                        return html5QrCode.start(
                            { facingMode: "user" },
                            config,
                            onScanSuccess,
                            () => { }
                        );
                    }).catch(finalErr => {
                        console.error("Critical camera error:", finalErr);
                        // Do not auto-close so user can use file upload fallback
                        if (isActive) toast.error("Camera failed, try uploading an image.");
                        scannerRef.current = null;
                    });
                }
            }, 300);

            return () => {
                isActive = false;
                clearTimeout(timer);
                if (scannerRef.current) {
                    try {
                        scannerRef.current.stop().then(() => {
                            scannerRef.current?.clear();
                            scannerRef.current = null;
                        }).catch(() => { });
                    } catch (e) { }
                }
            };
        }
    }, [scanning]);

    const handleSend = async () => {
        if (!sendRecipient || !sendAmount || !publicKey || !wallet) return;
        setLoading(true);
        try {
            const amountBN = new BN(Math.floor(parseFloat(sendAmount) * Math.pow(10, sendToken.decimals)));

            const provider = new AnchorProvider(connection, wallet as any, {});
            const program = new Program(IDL as any, provider);

            let targetAlias = sendAlias;
            if (!targetAlias && sendRecipient.startsWith('@')) targetAlias = sendRecipient.substring(1);
            else if (!targetAlias && !sendRecipient.startsWith('@') && sendRecipient.length < 32) targetAlias = sendRecipient;
            targetAlias = targetAlias ? targetAlias.toLowerCase().trim() : null;

            if (targetAlias) {
                // ROUTED TRANSFER (Token or SOL)
                try {
                    const [routePDA] = PublicKey.findProgramAddressSync([Buffer.from("route"), Buffer.from(targetAlias)], PROGRAM_ID);
                    const routeAccount: any = await (program.account as any).routeAccount.fetch(routePDA);

                    if (routeAccount && routeAccount.splits && routeAccount.splits.length > 0) {
                        if (sendToken.symbol === 'SOL') {
                            // --- SOL ROUTING ---
                            const remainingAccounts = routeAccount.splits.map((s: any) => ({
                                pubkey: s.recipient, isSigner: false, isWritable: true
                            }));
                            const ix = await (program.methods as any).executeTransfer(targetAlias, amountBN).accounts({
                                routeAccount: routePDA, user: publicKey, systemProgram: SystemProgram.programId
                            }).remainingAccounts(remainingAccounts).instruction();

                            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
                            const messageV0 = new TransactionMessage({
                                payerKey: publicKey, recentBlockhash: blockhash,
                                instructions: [
                                    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
                                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
                                    ix
                                ]
                            }).compileToV0Message();
                            const transaction = new VersionedTransaction(messageV0);
                            const signature = await wallet.sendTransaction(transaction, connection);
                            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
                            showTransactionToast({ signature, message: `Sent ${sendAmount} SOL via @${targetAlias}`, type: 'success' });
                            if (paymentConcept) {
                                try {
                                    await noteStorage.saveNote({ signature, note: paymentConcept, recipient: `@${targetAlias}`, amount: sendAmount, token: 'SOL', timestamp: Date.now() }, publicKey.toBase58());
                                    // Also save to shared notes (visible to both sender and recipient)
                                    const recipientWallet = routeAccount.splits[0]?.recipient?.toBase58();
                                    if (recipientWallet) {
                                        await saveSharedNote(signature, paymentConcept, publicKey.toBase58(), recipientWallet, myAliases[0]);
                                    }
                                    console.log('[Dashboard] Note saved successfully');
                                } catch (noteErr) {
                                    console.error('[Dashboard] Failed to save note:', noteErr);
                                }
                            }

                        } else {
                            // --- SPL TOKEN ROUTING ---
                            const userATA = await getAssociatedTokenAddress(sendToken.mint, publicKey);
                            const remainingAccounts = [];
                            for (const split of routeAccount.splits) {
                                const destATA = await getAssociatedTokenAddress(sendToken.mint, split.recipient);
                                remainingAccounts.push({ pubkey: destATA, isSigner: false, isWritable: true });
                            }

                            const ix = await (program.methods as any)
                                .executeTokenTransfer(targetAlias, amountBN)
                                .accounts({
                                    routeAccount: routePDA,
                                    user: publicKey,
                                    mint: sendToken.mint,
                                    userTokenAccount: userATA,
                                    tokenProgram: TOKEN_PROGRAM_ID,
                                    systemProgram: SystemProgram.programId
                                })
                                .remainingAccounts(remainingAccounts)
                                .instruction();

                            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
                            const messageV0 = new TransactionMessage({
                                payerKey: publicKey, recentBlockhash: blockhash,
                                instructions: [
                                    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
                                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
                                    ix
                                ]
                            }).compileToV0Message();
                            const transaction = new VersionedTransaction(messageV0);
                            const signature = await wallet.sendTransaction(transaction, connection);
                            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
                            showTransactionToast({ signature, message: `Sent ${sendAmount} ${sendToken.symbol} via @${targetAlias}`, type: 'success' });
                            if (paymentConcept) {
                                try {
                                    await noteStorage.saveNote({ signature, note: paymentConcept, recipient: `@${targetAlias}`, amount: sendAmount, token: sendToken.symbol, timestamp: Date.now() }, publicKey.toBase58());
                                    // Also save to shared notes (visible to both sender and recipient)
                                    const recipientWallet = routeAccount.splits[0]?.recipient?.toBase58();
                                    if (recipientWallet) {
                                        await saveSharedNote(signature, paymentConcept, publicKey.toBase58(), recipientWallet, myAliases[0]);
                                    }
                                    console.log('[Dashboard] Note saved successfully');
                                } catch (noteErr) {
                                    console.error('[Dashboard] Failed to save note:', noteErr);
                                }
                            }
                        }
                        setLoading(false); setSendAmount(''); setPaymentConcept(''); return;
                    }
                } catch (e) {
                    console.log("Routing failed/skipped", e);
                }
            }

            // DIRECT TRANSFER
            let recipientPubkey;
            if (targetAlias) {
                const [aliasPDA] = PublicKey.findProgramAddressSync([Buffer.from("alias"), Buffer.from(targetAlias)], PROGRAM_ID);
                const aliasAccount = await (program.account as any).aliasAccount.fetch(aliasPDA);
                recipientPubkey = aliasAccount.owner;
            } else {
                recipientPubkey = new PublicKey(sendRecipient);
            }

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            let ix;

            if (sendToken.symbol === 'SOL') {
                ix = SystemProgram.transfer({
                    fromPubkey: publicKey, toPubkey: recipientPubkey, lamports: amountBN.toNumber(),
                });
            } else {
                const sourceATA = await getAssociatedTokenAddress(sendToken.mint, publicKey);
                const destATA = await getAssociatedTokenAddress(sendToken.mint, recipientPubkey);
                const { createTransferInstruction } = await import('@solana/spl-token');

                // Assumption: Dest ATA exists. MVP limitation.
                ix = createTransferInstruction(sourceATA, destATA, publicKey, amountBN.toNumber());
            }

            const messageV0 = new TransactionMessage({
                payerKey: publicKey, recentBlockhash: blockhash,
                instructions: [
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
                    ix
                ]
            }).compileToV0Message();
            const transaction = new VersionedTransaction(messageV0);
            const signature = await wallet.sendTransaction(transaction, connection);
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
            showTransactionToast({ signature, message: `Sent ${sendAmount} ${sendToken.symbol}`, type: 'success' });
            if (paymentConcept) {
                try {
                    await noteStorage.saveNote({ signature, note: paymentConcept, recipient: targetAlias ? `@${targetAlias}` : sendRecipient.slice(0, 8) + '...', amount: sendAmount, token: sendToken.symbol, timestamp: Date.now() }, publicKey.toBase58());
                    // Also save to shared notes (visible to both sender and recipient)
                    // For direct transfers, sendRecipient should be the full wallet address
                    await saveSharedNote(signature, paymentConcept, publicKey.toBase58(), sendRecipient, myAliases[0]);
                    console.log('[Dashboard] Note saved successfully');
                } catch (noteErr) {
                    console.error('[Dashboard] Failed to save note:', noteErr);
                }
            }

            setLoading(false); setSendAmount(''); setPaymentConcept('');

        } catch (e: any) {
            console.error("Transfer failed", e);
            toast.error("Transfer failed: " + (e.message || "Unknown error"));
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Send Payment</h3>
                <div className="flex gap-2">
                    {TOKEN_OPTIONS.map(token => (
                        <button
                            key={token.symbol}
                            onClick={() => setSendToken(token)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${sendToken.symbol === token.symbol ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'}`}
                        >
                            {token.symbol}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex justify-end mb-4">
                <button
                    onClick={() => {
                        if (scanning) {
                            setScanning(false);
                        } else {
                            handleScanClick();
                        }
                    }}
                    className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-900/30 px-4 py-2 rounded-lg transition-colors border border-cyan-500/30 text-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    {scanning ? 'Cancel Scan' : 'Scan QR Code'}
                </button>
            </div>

            {scanning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-sm border border-gray-700 shadow-2xl relative">
                        <button onClick={() => setScanning(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h4 className="text-xl font-bold mb-4 text-center">Scan Payment QR</h4>
                        <div id="reader" className="overflow-hidden rounded-lg w-full h-64 bg-black"></div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <label className="text-sm text-gray-400 block mb-2">Recipient</label>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="@alias or wallet address"
                            value={sendRecipient}
                            onChange={(e) => { setSendRecipient(e.target.value); setSendAlias(''); setSendNote(''); }}
                            className={`w-full pl-4 pr-20 py-4 bg-gray-800 rounded-xl text-white border font-mono text-sm focus:outline-none transition-colors ${isValidRecipient === true ? 'border-green-500/50 focus:border-green-500' :
                                isValidRecipient === false ? 'border-red-500/50 focus:border-red-500' :
                                    'border-gray-700 focus:border-cyan-500'
                                }`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {/* Validation Indicator */}
                            {isCheckingRecipient ? (
                                <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                            ) : isValidRecipient === true ? (
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            ) : isValidRecipient === false ? (
                                <span className="text-xs text-red-500 font-bold">Invalid</span>
                            ) : null}

                            {/* Contact Book Button */}
                            <button
                                onClick={() => setShowContactPicker(!showContactPicker)}
                                className={`p-2 rounded-lg transition-colors ${showContactPicker ? 'bg-cyan-500 text-white' : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10'}`}
                                title="Contacts"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                            </button>


                        </div>

                        {/* Contact Picker Dropdown */}
                        {showContactPicker && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A24] border border-gray-700/80 rounded-xl z-50 max-h-72 overflow-y-auto shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-3 sticky top-0 bg-[#1A1A24] border-b border-white/5 z-10 space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-xs font-bold text-gray-400">YOUR CONTACTS</span>
                                        <button onClick={() => setShowContactPicker(false)} className="text-gray-500 hover:text-white transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Find by name or alias..."
                                            value={contactSearch}
                                            onChange={(e) => setContactSearch(e.target.value)}
                                            className="w-full bg-black/20 text-sm text-white px-3 py-2 pl-9 rounded-lg border border-gray-700/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all placeholder:text-gray-600"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                    </div>
                                </div>
                                {(() => {
                                    const filterQ = (contactSearch || sendRecipient || '').replace('@', '').toLowerCase();
                                    const filtered = contacts?.filter((c: any) => {
                                        if (!filterQ) return true;
                                        return (c.alias || '').toLowerCase().includes(filterQ) || (c.notes || '').toLowerCase().includes(filterQ) || (c.wallet_address || '').toLowerCase().includes(filterQ);
                                    }) || [];

                                    if (filtered.length === 0) return (
                                        <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-2">
                                            <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                            <span className="text-xs">No contacts match "{filterQ}"</span>
                                        </div>
                                    );

                                    return filtered.map((c: any, idx: number) => {
                                        const isAddressAlias = c.alias && c.alias.length > 32;

                                        const displayTitle = !isAddressAlias ? `@${c.alias}` : (c.notes || 'Wallet Contact');
                                        const displaySub = isAddressAlias ? null : (c.notes ? `“${c.notes}”` : null);

                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    const techVal = isAddressAlias ? c.alias : `@${c.alias}`;
                                                    setSendRecipient(techVal);
                                                    setSendAlias(isAddressAlias ? '' : c.alias);
                                                    setSendNote(c.notes || '');
                                                    setShowContactPicker(false);
                                                }}
                                                className="p-3 hover:bg-white/5 cursor-pointer flex justify-between items-center border-b border-white/5 last:border-0 transition-colors group"
                                            >
                                                <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                                                    <span className={`font-bold text-sm truncate ${!isAddressAlias ? 'text-cyan-400' : 'text-white'}`}>
                                                        {displayTitle}
                                                    </span>
                                                    {displaySub && (
                                                        <span className="text-xs text-gray-400 italic truncate">{displaySub}</span>
                                                    )}
                                                    <div className="flex items-center gap-2 opacity-70 mt-1">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded bg-black/20">
                                                            {!isAddressAlias ? 'ALIAS' : 'ADDRESS'}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-gray-600 truncate max-w-[140px]">
                                                            {c.wallet_address || c.alias}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Visual Context for Selected Recipient */}
                    {(sendNote || (isValidRecipient && sendAlias)) && (
                        <div className="mt-3 flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${sendAlias ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                    {(sendNote || sendAlias || '?')[0]?.toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    {sendNote && <span className="text-sm font-bold text-gray-200">{sendNote}</span>}
                                    {sendAlias && <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                        {sendAlias.startsWith('@') ? 'Alias: ' : 'Linked: @'}{sendAlias.replace('@', '')}
                                    </span>}
                                </div>
                            </div>
                            <button onClick={() => { setSendRecipient(''); setSendAlias(''); setSendNote(''); setPaymentConcept(''); }} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 hover:bg-red-500/10 rounded-lg transition-colors font-medium">Clear</button>
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-sm text-gray-400 block mb-2">Amount ({sendToken.symbol})
                        <span className="float-right text-xs text-gray-500">
                            Balance: {activeBalance !== null ? activeBalance.toFixed(sendToken.symbol === 'SOL' ? 4 : 2) : 'Loading...'}
                        </span>
                    </label>
                    <input
                        type="number"
                        step={sendToken.symbol === 'SOL' ? "0.000000001" : "0.000001"}
                        placeholder="0.00"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className="w-full px-4 py-4 bg-gray-800 rounded-xl text-white text-2xl font-bold border border-gray-700 focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <div>
                    <label className="text-sm text-gray-400 block mb-2">Payment Concept (optional)</label>
                    <input
                        type="text"
                        placeholder="What's this for?"
                        value={paymentConcept}
                        onChange={(e) => setPaymentConcept(e.target.value)}
                        className="w-full px-4 py-4 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <button
                    onClick={handleSend}
                    disabled={loading || !sendRecipient || !sendAmount || parseFloat(sendAmount) <= 0 || activeBalance === null || parseFloat(sendAmount) > activeBalance}
                    className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                >
                    {loading ? 'Sending...' : `Send ${sendToken.symbol} Now`}
                </button>
            </div>
        </div >
    );
}

function SplitsTab({ splits, setSplits, isEditing, setIsEditing, newSplitAddress, setNewSplitAddress, newSplitPercent, setNewSplitPercent, addSplit, removeSplit, totalPercent, handleSaveConfig, loading, registeredAlias, setActiveTab }: any) {
    if (!registeredAlias) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8 bg-gray-900/30 rounded-2xl border border-dashed border-gray-700">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
                    <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold mb-3">Alias Required</h3>
                <p className="text-gray-400 mb-8 max-w-md leading-relaxed">
                    Splits allows you to programmatically distribute incoming funds.
                    <br />You need a registered UNIK Alias to enable these routing rules on-chain.
                </p>
                <button
                    onClick={() => setActiveTab('alias')}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-xl font-bold text-white shadow-lg shadow-purple-900/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-2"
                >
                    <span>Register an Alias</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Routing Rules</h3>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-xl font-semibold text-sm transition-colors"
                >
                    {isEditing ? 'Cancel' : '+ Add Split'}
                </button>
            </div>

            <div className="space-y-4 mb-6">
                {splits.map((split: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                {idx + 1}
                            </div>
                            <div>
                                <p className="font-semibold">{split.recipient}</p>
                                <p className="text-xs text-gray-400 font-mono">{split.address?.slice(0, 6)}...{split.address?.slice(-6)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-xl font-bold text-cyan-400">{split.percent}%</span>
                            {split.recipient !== 'Primary Wallet (You)' && (
                                <button onClick={() => removeSplit(idx)} className="text-red-400 hover:text-red-300 text-2xl">×</button>
                            )}
                        </div>
                    </div>
                ))}

                {splits.length === 0 && <p className="text-center text-gray-500 py-8">No routing rules set.</p>}

                {isEditing && (
                    <div className="p-6 bg-gray-800/50 rounded-xl border border-dashed border-cyan-500">
                        <h4 className="font-semibold mb-4">Add New Recipient</h4>
                        <input
                            className="w-full mb-3 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-sm focus:outline-none focus:border-cyan-500"
                            placeholder="Solana Wallet Address"
                            value={newSplitAddress}
                            onChange={(e) => setNewSplitAddress(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <input
                                className="w-24 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-sm focus:outline-none focus:border-cyan-500"
                                placeholder="%"
                                type="number"
                                value={newSplitPercent}
                                onChange={(e) => setNewSplitPercent(e.target.value)}
                            />
                            <button onClick={addSplit} className="flex-1 bg-cyan-600 hover:bg-cyan-700 rounded-xl font-bold transition-colors">Add Rule</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-gray-800">
                <p className={`font-semibold ${totalPercent === 100 ? 'text-green-400' : 'text-red-400'}`}>
                    Total Allocation: {totalPercent}%
                </p>
                <button
                    onClick={handleSaveConfig}
                    disabled={totalPercent !== 100 || loading}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? 'Saving...' : 'Save on-chain'}
                </button>
            </div>
        </div>
    );
}

function AliasTab({ myAliases, showRegisterForm, setShowRegisterForm, alias, setAlias, handleRegister, loading, setRegisteredAlias }: any) {
    return (
        <div>
            <h3 className="text-2xl font-bold mb-6">Manage Aliases</h3>

            {myAliases.length > 0 && !showRegisterForm && (
                <div className="mb-6">
                    <h4 className="text-sm text-gray-400 mb-3">Your Aliases</h4>
                    <div className="space-y-3">
                        {myAliases.map((a: string) => (
                            <div key={a} className="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-cyan-500 transition-colors cursor-pointer" onClick={() => setRegisteredAlias(a)}>
                                <span className="text-lg font-semibold text-cyan-400">@{a}</span>
                                <span className="text-sm text-gray-500">Click to switch</span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowRegisterForm(true)}
                        className="mt-4 w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold border border-gray-700 transition-colors"
                    >
                        + Register New Alias
                    </button>
                </div>
            )}

            {(showRegisterForm || myAliases.length === 0) && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h4 className="text-lg font-semibold mb-4">Register New Alias</h4>
                    <div className="space-y-4">
                        <div>
                            <input
                                type="text"
                                value={alias}
                                onChange={(e) => {
                                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                                    setAlias(val);
                                }}
                                placeholder="your_alias"
                                className="w-full px-4 py-4 rounded-xl bg-gray-900 border border-gray-700 text-lg focus:outline-none focus:border-cyan-500"
                            />
                            <p className="text-xs text-gray-500 mt-2">3-32 characters. Lowercase alphanumeric only.</p>
                        </div>
                        <button
                            onClick={handleRegister}
                            disabled={loading || !alias}
                            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                        >
                            {loading ? 'Registering...' : 'Register Alias'}
                        </button>
                        {myAliases.length > 0 && (
                            <button onClick={() => setShowRegisterForm(false)} className="w-full py-3 text-gray-400 hover:text-white transition-colors">Cancel</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function NoteModal({ isOpen, alias, initialNote, onSave, onClose }: any) {
    const [tempNote, setTempNote] = useState(initialNote);
    useEffect(() => {
        if (isOpen) setTempNote(initialNote);
    }, [initialNote, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-300" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-[#0d0d15] border border-cyan-500/30 rounded-[2.5rem] shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
                <div className="p-8">
                    <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 mb-6 border border-cyan-500/20">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-1 tracking-tight">Edit Note</h3>
                    <p className="text-xs text-gray-500 mb-6 font-medium uppercase tracking-widest">Contact: @{alias}</p>

                    <textarea
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-cyan-500/50 min-h-[140px] mb-8 placeholder:text-gray-700 transition-all font-medium"
                        placeholder="Add a private note for this contact..."
                        value={tempNote}
                        onChange={(e) => setTempNote(e.target.value)}
                        autoFocus
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold rounded-2xl border border-white/5 transition-all text-xs uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(tempNote)}
                            className="flex-1 py-4 bg-gradient-to-tr from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all text-xs uppercase tracking-widest active:scale-95"
                        >
                            Save Note
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ContactsTab({ setSendRecipient, setSendAlias, setSendNote, setActiveTab, loading, setLoading, connection, wallet, confirmModal, setConfirmModal, noteModal, setNoteModal, contacts, refreshContacts }: any) {
    const [newContactAlias, setNewContactAlias] = useState('');
    const [filter, setFilter] = useState('recent');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAll, setShowAll] = useState(false);

    // Filter Logic
    const filteredContacts = contacts.filter((c: any) =>
        c.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedContacts = [...filteredContacts].sort((a, b) => {
        if (filter === 'alpha') return a.alias.localeCompare(b.alias);
        if (filter === 'notes') {
            const aNote = a.notes ? 1 : 0;
            const bNote = b.notes ? 1 : 0;
            if (aNote !== bNote) return bNote - aNote;
            return a.alias.localeCompare(b.alias);
        }
        return (b.savedAt || 0) - (a.savedAt || 0); // recent
    });

    const displayedContacts = showAll ? sortedContacts : sortedContacts.slice(0, 4);

    const addContact = async () => {
        if (!newContactAlias) return;
        setLoading(true);

        try {
            const inputLower = newContactAlias.trim();
            const ownerKey = wallet?.publicKey?.toBase58();
            if (!ownerKey) return;

            // Check if input is a raw address (Base58ish check: 32-44 chars)
            const isAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(inputLower);

            if (isAddress) {
                // Case 1: Raw Address
                const label = prompt("Enter a name for this wallet address:", "My Wallet");
                if (!label) {
                    setLoading(false);
                    return;
                }

                await contactStorage.saveContact({
                    alias: inputLower,
                    aliasOwner: inputLower,
                    savedAt: Date.now(),
                    notes: label // Save user label (e.g. "Pepe") as note
                }, ownerKey);

                showTransactionToast({ signature: '', message: `Address added as ${label}`, type: 'success' });
            } else {
                // Case 2: UNIK Alias - Verify on-chain using connection directly
                try {
                    // Using connection directly instead of Anchor provider to fetch account info
                    // because we might not be connected or signed in yet if just browsing
                    const [aliasPDA] = PublicKey.findProgramAddressSync(
                        [Buffer.from("alias"), Buffer.from(inputLower)],
                        PROGRAM_ID
                    );

                    // We need to decode the account manually or use the Program if available
                    // For simplicity, let's use the Anchor Program from the hook context if possible
                    const provider = new AnchorProvider(connection, wallet as any, {});
                    const program = new Program(IDL as any, provider);

                    const account = await (program.account as any).aliasAccount.fetch(aliasPDA);
                    const realOwner = account.owner.toBase58();
                    const version = account.version ? account.version.toNumber() : 1;

                    await contactStorage.saveContact({
                        alias: inputLower,
                        aliasOwner: realOwner,
                        version: version,
                        savedAt: Date.now(),
                        notes: ''
                    }, ownerKey);

                    showTransactionToast({ signature: '', message: `Contact @${inputLower} added`, type: 'success' });
                } catch (err) {
                    console.error("Lookup failed", err);
                    showTransactionToast({ signature: '', message: `Alias @${inputLower} not found on-chain`, type: 'error' });
                    setLoading(false);
                    return;
                }
            }

            setNewContactAlias('');
            // Trigger update
            window.dispatchEvent(new Event('unik-contacts-updated'));
            if (refreshContacts) refreshContacts();
        } catch (e) {
            console.error(e);
            showTransactionToast({ signature: '', message: 'Failed to add contact', type: 'error' });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-2xl font-bold">My Contacts</h3>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {/* Search Field */}
                    <div className="relative flex-1 sm:w-64">
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all font-medium"
                        />
                        <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Filter Dropdown */}
                    <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Sort:</span>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-cyan-400 focus:outline-none appearance-none cursor-pointer pr-1"
                        >
                            <option value="recent" className="bg-gray-800">Recent</option>
                            <option value="alpha" className="bg-gray-800">A-Z</option>
                            <option value="notes" className="bg-gray-800">Notes</option>
                        </select>
                        <svg className="w-3 h-3 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            <div className="mb-6 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                    Add New Contact
                </h4>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        placeholder="Enter alias OR address (sol...)"
                        value={newContactAlias}
                        onChange={(e) => setNewContactAlias(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-cyan-500 transition-all font-mono text-sm"
                    />
                    <button
                        onClick={addContact}
                        disabled={loading}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold disabled:opacity-50 transition-all shadow-lg active:scale-95 whitespace-nowrap"
                    >
                        {loading ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full mx-auto"></div>
                        ) : (
                            <>
                                <span className="sm:hidden">Add</span>
                                <span className="hidden sm:inline">Add Contact</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {contacts.length === 0 ? (
                <div className="text-center py-16 bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-700">
                    <div className="text-5xl mb-4">👥</div>
                    <p className="text-gray-400 font-medium">No contacts yet.</p>
                    <p className="text-sm text-gray-500">Add your first one to start sending SOL faster!</p>
                </div>
            ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700">
                    <p className="text-gray-500">No contacts match your search "{searchTerm}"</p>
                    <button onClick={() => setSearchTerm('')} className="text-cyan-500 text-sm mt-2 hover:underline">Clear search</button>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displayedContacts.map((c: any, idx: number) => {
                            const isUnik = c.alias && c.alias.length < 32 && !c.alias.includes(' ');
                            const noteText = c.notes || c.note || '';
                            const ownerAddr = c.aliasOwner || c.address || c.alias;

                            return (
                                <div key={idx} className="group flex flex-col h-full justify-between p-4 sm:p-5 bg-gray-800 rounded-xl border border-gray-700 hover:border-cyan-500/50 hover:bg-gray-750 transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                    {/* Main Content */}
                                    <div className="flex items-start gap-3 sm:gap-4 w-full mb-4">
                                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-cyan-500/20 ${isUnik ? 'bg-gradient-to-br from-cyan-500 to-purple-600' : 'bg-gradient-to-br from-gray-700 to-gray-600'}`}>
                                            {(isUnik ? c.alias : (noteText || '?'))[0]?.toUpperCase()}
                                        </div>

                                        <div className="flex flex-col min-w-0 w-full gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h5 className={`font-bold text-lg leading-tight ${isUnik ? 'text-cyan-400' : 'text-white'}`}>
                                                    {isUnik ? `@${c.alias}` : (noteText || 'Wallet Contact')}
                                                </h5>

                                                {/* Note as a Label/Badge */}
                                                {isUnik && noteText && (
                                                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-200 text-xs font-bold tracking-wide shadow-sm">
                                                        {noteText}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Full Address Display Row */}
                                            <div className="w-full">
                                                <div className="relative group/addr w-full flex items-center gap-2 bg-black/20 p-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                                    {isUnik ? (
                                                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(6,182,212,0.15)] backdrop-blur-sm flex-shrink-0">
                                                            UNIK ID
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 rounded bg-gray-700/50 border border-gray-600/50 text-gray-500 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
                                                            ADDRESS
                                                        </span>
                                                    )}

                                                    <p className="text-xs font-mono text-gray-500 select-all cursor-copy truncate" title={ownerAddr}>
                                                        {ownerAddr}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons Footer */}
                                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5 w-full mt-auto">
                                        <button
                                            onClick={() => {
                                                setNoteModal({
                                                    isOpen: true,
                                                    alias: c.alias,
                                                    currentNote: noteText
                                                });
                                            }}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            EDIT
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (confirmModal && confirmModal.open) {
                                                    confirmModal.open(
                                                        `Delete ${isUnik ? `@${c.alias}` : 'contact'}?`,
                                                        async () => {
                                                            const owner = wallet?.publicKey?.toBase58();
                                                            if (!owner) return;
                                                            try {
                                                                await contactStorage.removeContact(c.alias, owner);
                                                                window.dispatchEvent(new Event('unik-contacts-updated'));
                                                                if (refreshContacts) refreshContacts();
                                                                toast.success("Contact deleted");
                                                            } catch (err) {
                                                                console.error("Failed to delete contact", err);
                                                                toast.error("Failed to delete contact");
                                                            }
                                                        }
                                                    );
                                                } else {
                                                    // Fallback if confirmModal.open is not available (old pattern)
                                                    setConfirmModal({
                                                        isOpen: true,
                                                        title: 'Delete Contact',
                                                        message: `Delete ${isUnik ? `@${c.alias}` : 'contact'}?`,
                                                        onConfirm: async () => {
                                                            const owner = wallet?.publicKey?.toBase58();
                                                            if (!owner) return;
                                                            await contactStorage.removeContact(c.alias, owner);
                                                            if (refreshContacts) refreshContacts();
                                                            toast.success("Contact deleted");
                                                        }
                                                    });
                                                }
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            DELETE
                                        </button>

                                        <button
                                            onClick={() => {
                                                const techVal = isUnik ? `@${c.alias}` : ownerAddr;
                                                setSendRecipient(techVal);
                                                setSendAlias(isUnik ? c.alias : '');
                                                if (noteText) setSendNote(noteText);
                                                setActiveTab('send');
                                            }}
                                            className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white rounded-lg transition-all border border-cyan-500/20 font-bold text-xs shadow-lg shadow-cyan-900/20 ml-2"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                                            PAY
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {
                        sortedContacts.length > 4 && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={() => setShowAll(!showAll)}
                                    className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-sm font-bold text-cyan-400 transition-all"
                                >
                                    {showAll ? (
                                        <>Show Less <span className="text-xs">↑</span></>
                                    ) : (
                                        <>View All {sortedContacts.length} Contacts <span className="text-xs">↓</span></>
                                    )}
                                </button>
                            </div>
                        )
                    }
                </div>
            )
            }
        </div >
    );
}

function HistoryTab({ publicKey, connection, confirmModal, setConfirmModal }: any) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState<Record<string, TransactionNote>>({});
    const [sharedNotes, setSharedNotes] = useState<Record<string, SharedNoteData>>({});

    useEffect(() => {
        // Load saved notes from encrypted cloud storage
        const loadNotes = async () => {
            const owner = publicKey?.toBase58();
            const loadedNotes = await noteStorage.getNotes(owner);
            setNotes(loadedNotes);
        };
        loadNotes();
    }, [publicKey]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!publicKey) return;
            setLoading(true);
            try {
                const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 15 });
                const detailedHistory = await Promise.all(
                    signatures.map(async (sig: any) => {
                        try {
                            const tx = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });

                            let type = 'System';
                            let amount = 0;
                            let otherSide = '';

                            // Simple logic to detect SOL transfers
                            const transferInstruction = tx?.transaction.message.instructions.find(
                                (ins: any) => ins.program === 'system' && ins.parsed?.type === 'transfer'
                            );

                            if (transferInstruction) {
                                const info = (transferInstruction as any).parsed.info;
                                if (info.destination === publicKey.toBase58()) {
                                    type = 'Received';
                                    otherSide = info.source;
                                    amount = info.lamports / 1e9;
                                } else {
                                    type = 'Sent';
                                    otherSide = info.destination;
                                    amount = info.lamports / 1e9;
                                }
                            }

                            return {
                                signature: sig.signature,
                                time: sig.blockTime,
                                type,
                                amount,
                                otherSide,
                                success: !tx?.meta?.err
                            };
                        } catch (e) {
                            return {
                                signature: sig.signature,
                                time: sig.blockTime,
                                type: 'Transaction',
                                amount: 0,
                                otherSide: '',
                                success: true
                            };
                        }
                    })
                );
                setHistory(detailedHistory);

                // Load shared notes for all signatures
                const sigList = detailedHistory.map(tx => tx.signature);
                const loadedSharedNotes = await getSharedNotes(sigList);
                setSharedNotes(loadedSharedNotes);
            } catch (e) {
                console.error("Failed to fetch history", e);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [publicKey, connection]);

    // Helper to get display label for transaction (destination/source info)
    const getDisplayLabel = (tx: any) => {
        const savedNote = notes[tx.signature];

        // For sent transactions: show recipient (alias if available, otherwise address)
        if (tx.type === 'Sent') {
            // If we have a saved recipient alias (like @tests), use it
            if (savedNote?.recipient) {
                return `Sent to ${savedNote.recipient}`;
            }
            // Otherwise use the address
            if (tx.otherSide) {
                return `Sent to ${tx.otherSide.slice(0, 6)}...`;
            }
            return 'Sent';
        }

        // For received transactions: show sender info
        if (tx.type === 'Received' && tx.otherSide) {
            return `From ${tx.otherSide.slice(0, 6)}...`;
        }

        return tx.type;
    };

    // Helper to get the concept/note for a transaction
    // First check personal notes, then shared notes (for received transactions)
    const getConceptLabel = (tx: any) => {
        // Check personal notes first (for sent transactions)
        const savedNote = notes[tx.signature];
        if (savedNote?.note) return savedNote.note;

        // Check shared notes (works for both sent and received)
        const sharedNote = sharedNotes[tx.signature];
        if (sharedNote) return sharedNote.note;

        return null;
    };

    if (loading) {
        return (
            <div className="py-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                Loading history...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-xl mb-4">Transaction History</h3>

            <div className="space-y-2">
                {history.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">No transactions found.</p>
                ) : (
                    history.map((tx: any, i: number) => {
                        const conceptNote = getConceptLabel(tx);
                        const hasNote = !!conceptNote;
                        const sharedData = sharedNotes[tx.signature];
                        const senderAlias = sharedData?.senderAlias;

                        return (
                            <div key={i} className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors rounded-xl">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg ${tx.type === 'Received' ? 'text-green-500 bg-green-500/10' :
                                        tx.type === 'Sent' ? 'text-red-500 bg-red-500/10' : 'text-cyan-500 bg-cyan-500/10'
                                        }`}>
                                        {tx.type === 'Received' ? '↙' : tx.type === 'Sent' ? '↗' : '⚙'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-white truncate max-w-[200px]">
                                                {getDisplayLabel(tx)}
                                            </p>
                                            {hasNote && (
                                                <span className="text-amber-300 text-sm truncate max-w-[150px]">
                                                    • {conceptNote}
                                                </span>
                                            )}
                                            {senderAlias && tx.type === 'Received' && (
                                                <span className="text-cyan-400 text-xs bg-cyan-900/30 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                                    From @{senderAlias}
                                                </span>
                                            )}
                                            {!tx.success && <span className="text-[10px] bg-red-500 text-white px-1 uppercase leading-none py-0.5 rounded">Failed</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 font-mono">
                                            {tx.time ? new Date(tx.time * 1000).toLocaleDateString() + ' ' + new Date(tx.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending...'}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right ml-4">
                                    {tx.amount > 0 && (
                                        <p className={`font-bold ${tx.type === 'Received' ? 'text-green-400' : 'text-red-400'}`}>
                                            {tx.type === 'Received' ? '+' : '-'}{tx.amount.toFixed(4)} {notes[tx.signature]?.token || 'SOL'}
                                        </p>
                                    )}
                                    <a
                                        href={`https://solscan.io/tx/${tx.signature}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-cyan-500 hover:underline font-mono"
                                    >
                                        Solscan ↗
                                    </a>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function SettingsModal({ isOpen, onClose, avatarUrl, handleAvatarUpload, uploadingAvatar, userCurrency, userLanguage, network, saveSettings, registeredAlias, handleRemoveAvatar }: any) {
    const [activeTab, setActiveTab] = useState('general');
    const [tempCurrency, setTempCurrency] = useState(userCurrency);
    const [tempLang, setTempLang] = useState(userLanguage);
    const [tempNet, setTempNet] = useState(network);
    const [removingAvatar, setRemovingAvatar] = useState(false);

    const handleSave = () => {
        saveSettings(tempCurrency, tempLang, tempNet);
        onClose();
    };

    const onRemove = async () => {
        if (!confirm("Are you sure you want to remove your profile picture?")) return;
        setRemovingAvatar(true);
        await handleRemoveAvatar(); // Call parent function
        setRemovingAvatar(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}></div>
            <div className="relative bg-[#1a1a2e] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/5 bg-[#13131f]">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Settings
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 bg-[#13131f]">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'general' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('network')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'network' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        Network
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {activeTab === 'general' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Avatar Section */}
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-black/40 border border-white/10 group">
                                    {avatarUrl ? (
                                        <Image src={avatarUrl} alt="Avatar" layout="fill" objectFit="cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-900">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        </div>
                                    )}
                                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                        {uploadingAvatar ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                                    </label>
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">Profile Picture</h4>
                                    <p className="text-xs text-gray-400">Visible to others in contacts & payments.</p>
                                    {!registeredAlias && <p className="text-xs text-red-400 font-bold mt-1">Register an alias first.</p>}
                                    {avatarUrl && registeredAlias && (
                                        <button
                                            onClick={onRemove}
                                            disabled={removingAvatar}
                                            className="mt-2 text-xs text-red-500 hover:text-red-400 font-bold transition-colors flex items-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            {removingAvatar ? 'Removing...' : 'Remove Photo'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Preferences */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Language</label>
                                    <select
                                        value={tempLang}
                                        onChange={(e) => setTempLang(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none appearance-none"
                                    >
                                        <option value="en">English</option>
                                        <option value="es">Español</option>
                                        <option value="fr">Français</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Currency</label>
                                    <select
                                        value={tempCurrency}
                                        onChange={(e) => setTempCurrency(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none appearance-none"
                                    >
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="GBP">GBP (£)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'network' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                <h4 className="font-bold text-yellow-500 text-sm mb-1">Developer Network</h4>
                                <p className="text-xs text-gray-300">UNIK is currently optimized for Solana Devnet. Switching to Mainnet requires real funds.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Blockchain Network</label>
                                <div className="space-y-2">
                                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${tempNet === 'devnet' ? 'bg-cyan-500/10 border-cyan-500' : 'bg-black/20 border-white/10'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${tempNet === 'devnet' ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-gray-600'}`}></div>
                                            <span className="font-bold text-sm">Devnet (Recommended)</span>
                                        </div>
                                        <input type="radio" name="network" value="devnet" checked={tempNet === 'devnet'} onChange={() => setTempNet('devnet')} className="hidden" />
                                        {tempNet === 'devnet' && <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                    </label>

                                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${tempNet === 'mainnet' ? 'bg-purple-500/10 border-purple-500' : 'bg-black/20 border-white/10'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${tempNet === 'mainnet' ? 'bg-purple-400 shadow-[0_0_8px_purple]' : 'bg-gray-600'}`}></div>
                                            <span className="font-bold text-sm">Mainnet Beta</span>
                                        </div>
                                        <input type="radio" name="network" value="mainnet" checked={tempNet === 'mainnet'} onChange={() => setTempNet('mainnet')} className="hidden" />
                                        {tempNet === 'mainnet' && <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-[#13131f] flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold shadow-lg transition-all">Save Changes</button>
                </div>
            </div>
        </div>
    );
}

