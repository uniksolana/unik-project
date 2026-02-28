'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { showTransactionToast, showSimpleToast } from '../components/CustomToast';
import { PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionMessage, ComputeBudgetProgram, TransactionInstruction } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../utils/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";
import { Buffer } from 'buffer';
import Image from 'next/image';
import { contactStorage, Contact } from '../../utils/contacts';
import { supabase } from '../../utils/supabaseClient';
import { noteStorage, TransactionNote } from '../../utils/notes';
import { saveAvatar, getAvatar, removeAvatar } from '../../utils/avatar';
import { saveSharedNote, getSharedNotes, SharedNoteData } from '../../utils/sharedNotes';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import bs58 from 'bs58';
import { deriveKeyFromSignature, encryptBlob, decryptBlob } from '../../utils/crypto';
import { getSessionKey, setSessionKey } from '../../utils/sessionState';
import { usePreferences } from '../../context/PreferencesContext';
import { SettingsModal } from './SettingsModal';
const TOKEN_OPTIONS = [
    { label: 'SOL', symbol: 'SOL', mint: null, decimals: 9, icon: '/sol.png' },
    { label: 'USDC (Circle Devnet)', symbol: 'USDC', mint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), decimals: 6, icon: '/usdc.png' },
    { label: 'EURC (Devnet)', symbol: 'EURC', mint: new PublicKey('HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'), decimals: 6, icon: '/eurc.png' } // Placeholder EURC Devnet Mint
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

    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [linkAmount, setLinkAmount] = useState('');
    const [linkConcept, setLinkConcept] = useState('');
    const [requestToken, setRequestToken] = useState<any>(TOKEN_OPTIONS[0]); // Default SOL


    // Send Feature State
    const [sendRecipient, setSendRecipient] = useState('');
    const [sendAlias, setSendAlias] = useState('');
    const [sendAmount, setSendAmount] = useState('');
    const [sendNote, setSendNote] = useState('');
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [paymentConcept, setPaymentConcept] = useState('');
    const [sendToken, setSendToken] = useState(TOKEN_OPTIONS[0]); // Default to SOL
    const [aliasDropdownOpen, setAliasDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [network, setNetwork] = useState('devnet');
    const [registeredAt, setRegisteredAt] = useState<number | null>(null);

    // Global Prefs
    const { t, convertPrice, currency, solPrice: liveSolPrice } = usePreferences();
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const lastUploadTime = useRef(0);

    // Phase 1: Load avatar immediately when wallet connects (no encryption needed)
    useEffect(() => {
        const loadPublicAvatar = async () => {
            if (!publicKey) {
                setAvatarUrl(null);
                return;
            }
            if (Date.now() - lastUploadTime.current < 5000) return;

            const owner = publicKey.toBase58();

            // Try local cache first (instant)
            if (typeof window !== 'undefined') {
                const cached = localStorage.getItem(`avatar_cache_${owner}`);
                if (cached && cached.startsWith('data:image')) {
                    setAvatarUrl(cached);
                    return;
                }
            }

            // Try public storage (no encryption needed)
            try {
                const { getPublicAvatar } = await import('../../utils/avatar');
                const pubAvatar = await getPublicAvatar(owner);
                if (pubAvatar) setAvatarUrl(pubAvatar);
            } catch (e) {
                console.warn("Failed to load public avatar", e);
            }
        };
        loadPublicAvatar();
    }, [publicKey]);

    // Phase 2: Upgrade to encrypted version when session is unlocked
    useEffect(() => {
        const loadEncryptedAvatar = async () => {
            if (publicKey && encryptionKey) {
                // Prevent overwriting if we just uploaded (race condition fix)
                if (Date.now() - lastUploadTime.current < 5000) return;

                try {
                    const avatar = await getAvatar(publicKey.toBase58());
                    if (avatar) setAvatarUrl(avatar);
                } catch (e) {
                    console.error("Failed to load avatar", e);
                }
            }
        };
        loadEncryptedAvatar();
    }, [encryptionKey, publicKey]);



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
            const key = await deriveKeyFromSignature(signatureB58, publicKey.toBase58());

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

        if (!registeredAlias) {
            toast.error("Register a UNIK Alias first to set a profile picture.");
            return;
        }

        const file = e.target.files[0];
        setUploadingAvatar(true);

        try {
            // New: Encrypted Avatar Storage (Stored as a Note)
            // This ensures the avatar is encrypted with the same key as other user data
            const base64 = await saveAvatar(file, publicKey.toBase58());

            lastUploadTime.current = Date.now(); // Mark upload time to block effect overwrite
            setAvatarUrl(base64);
            toast.success("Profile picture encrypted & saved!");

            // Dispatch event to update other components if needed
            window.dispatchEvent(new Event('unik-avatar-updated'));
        } catch (error: any) {
            console.error('Error saving avatar:', error);
            toast.error("Failed to save encrypted avatar.");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!publicKey) return;
        try {
            await removeAvatar(publicKey.toBase58());
            setAvatarUrl(null);
            toast.success("Profile picture removed (Encrypted Data).");
        } catch (error: any) {
            console.error("Error removing avatar:", error);
            toast.error("Failed to remove avatar.");
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

    const lastBalanceFetch = useRef(0);

    useEffect(() => {
        const fetchAllBalances = async () => {
            if (!connected || !publicKey) return;

            // Throttle: Max 1 request per 10s
            const now = Date.now();
            if (now - lastBalanceFetch.current < 10000 && balances.length > 0) return;
            lastBalanceFetch.current = now;

            try {
                // 1. SOL Balance
                const solLamports = await connection.getBalance(publicKey);
                const solAmount = solLamports / 1e9;

                // 2. Fetch ALL Token Accounts in ONE call (programId based)
                // This reduces RPC calls from N to 1, avoiding rate limits without needing delays
                const allTokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    programId: TOKEN_PROGRAM_ID
                });

                const tokenBalancesData = TOKEN_OPTIONS.slice(1).map(token => {
                    if (!token.mint) return { ...token, amount: 0 };

                    // Find the account for this specific mint in the batch response
                    const account = allTokenAccounts.value.find((t: any) =>
                        t.account.data.parsed.info.mint === token.mint?.toBase58()
                    );

                    let amount = 0;
                    if (account) {
                        amount = account.account.data.parsed.info.tokenAmount.uiAmount || 0;
                    }

                    return { ...token, amount };
                });

                // Construct Balance State
                const newBalances = [
                    { symbol: 'SOL', amount: solAmount, valueUsd: liveSolPrice ? solAmount * liveSolPrice : null, icon: TOKEN_OPTIONS[0].icon },
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
            const timer = setInterval(fetchAllBalances, 15000); // Check every 15s instead of 10s
            return () => clearInterval(timer);
        }
    }, [connected, publicKey, connection, liveSolPrice]);

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
                        setRegisteredAt(aliases[0].account.registeredAt.toNumber() * 1000); // Convert to JS ms
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
            setRegisteredAt(Date.now()); // Set approximate registration time (JS ms)
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

            const instructions: TransactionInstruction[] = [];

            // L-03: Check if route account exists. If not, we must initialize it in the same tx.
            const routeAccountInfo = await connection.getAccountInfo(routePDA);
            if (!routeAccountInfo) {
                const initInstruction = await program.methods
                    .initRouteConfig(normalizedAlias)
                    .accounts({
                        routeAccount: routePDA,
                        aliasAccount: aliasPDA,
                        user: publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();
                instructions.push(initInstruction);
            }

            const setInstruction = await program.methods
                .setRouteConfig(normalizedAlias, idlSplits)
                .accounts({
                    routeAccount: routePDA,
                    aliasAccount: aliasPDA,
                    user: publicKey,
                    systemProgram: SystemProgram.programId, // Might not strictly need SystemProgram for mut, but safe to leave
                })
                .instruction();
            instructions.push(setInstruction);

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

            const messageV0 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: blockhash,
                instructions: [
                    ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
                    ...instructions
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
                    <h1 className="text-4xl font-bold mb-3 tracking-tight">{t('welcome')}</h1>
                    <p className="text-gray-400 mb-8 max-w-xs mx-auto">{t('subtitle')}</p>
                    <WalletMultiButton />
                </div>
            </div>
        );
    }

    if (!isMounted) return null;

    const handleDeleteAlias = async (aliasToDelete: string) => {
        if (!publicKey || !wallet) return;
        setLoading(true);
        try {
            const provider = new AnchorProvider(connection, wallet as any, {
                commitment: 'confirmed',
                preflightCommitment: 'confirmed',
            });
            const program = new Program(IDL as any, provider);

            const [aliasPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("alias"), Buffer.from(aliasToDelete)],
                PROGRAM_ID
            );

            // 1. Discriminator for "delete_alias" (sha256("global:delete_alias")[..8])
            const discriminator = Buffer.from([218, 54, 238, 46, 173, 75, 242, 207]);

            // 2. Encode alias string (Borsh: 4 bytes len (LE) + utf8 bytes)
            const aliasBuffer = Buffer.from(aliasToDelete, 'utf8');
            const lenBuffer = Buffer.alloc(4);
            lenBuffer.writeUInt32LE(aliasBuffer.length, 0);

            const data = Buffer.concat([discriminator, lenBuffer, aliasBuffer]);

            // 3. Build Instruction manually
            const ix = new TransactionInstruction({
                keys: [
                    { pubkey: aliasPDA, isSigner: false, isWritable: true }, // alias_account (mut)
                    { pubkey: publicKey, isSigner: true, isWritable: true },  // user (signer, mut)
                ],
                programId: PROGRAM_ID,
                data: data
            });

            // 4. Use Legacy Transaction with Compute Budget
            const transaction = new Transaction();

            // Add compute budget instructions (standard + priority fee)
            transaction.add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
            );
            transaction.add(ix);

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            // 5. Sign and Send
            const signature = await wallet.sendTransaction(transaction, connection);
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

            console.log("Delete alias tx signature:", signature);
            toast.success(`Alias @${aliasToDelete} deleted successfully!`);

            // Update local state
            const updatedAliases = myAliases.filter((a: string) => a !== aliasToDelete);
            setMyAliases(updatedAliases);
            if (registeredAlias === aliasToDelete) {
                if (updatedAliases.length > 0) {
                    setRegisteredAlias(updatedAliases[0]);
                } else {
                    setRegisteredAlias(null);
                    setRegisteredAt(null);
                    setShowRegisterForm(true);
                }
            }
        } catch (error: any) {
            console.error("Error deleting alias:", error);
            let message = "Deletion failed.";
            if (error.message?.includes("User rejected")) {
                message = "Request rejected.";
            } else if (error.message) {
                message = error.message.slice(0, 120);
            }
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

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
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                setRegisteredAlias(a);
                                                setAliasDropdownOpen(false);
                                                // Fetch registration time for this specific alias
                                                try {
                                                    const provider = new AnchorProvider(connection, wallet as any, {});
                                                    const program = new Program(IDL as any, provider);
                                                    const [aliasPDA] = PublicKey.findProgramAddressSync(
                                                        [Buffer.from("alias"), Buffer.from(a)],
                                                        PROGRAM_ID
                                                    );
                                                    const acc = await (program.account as any).aliasAccount.fetch(aliasPDA);
                                                    setRegisteredAt(acc.registeredAt.toNumber() * 1000);
                                                } catch (e) {
                                                    console.error("Failed to fetch registration time", e);
                                                }
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
            <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">

                <div className="flex flex-col lg:flex-row gap-8 items-start">

                    {/* LEFT COLUMN: Sidebar (Balance & Actions) */}
                    <div className="w-full lg:w-[350px] flex-shrink-0 space-y-6">
                        {/* Balance Card */}
                        <div className="relative overflow-hidden rounded-[2rem] p-[1px] bg-gradient-to-br from-cyan-500/50 via-purple-500/50 to-pink-500/50 shadow-2xl shadow-purple-900/20">
                            <div className="bg-[#13131f] rounded-[2rem] p-6 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-cyan-500/10 blur-[50px] rounded-full"></div>
                                <p className="text-xs font-bold tracking-[0.2em] text-gray-500 uppercase mb-4">{t('portfolio')}</p>

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
                                                {b.symbol === 'SOL' && (
                                                    <p className="text-[10px] text-cyan-400">≈ {convertPrice(b.amount)}</p>
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
                                label={t('receive')}
                                active={activeTab === 'receive'}
                                onClick={() => setActiveTab('receive')}
                            />
                            <ActionButton
                                icon="send"
                                label={t('send')}
                                active={activeTab === 'send'}
                                onClick={() => setActiveTab('send')}
                            />
                            <ActionButton
                                icon="splits"
                                label={t('splits')}
                                active={activeTab === 'splits'}
                                onClick={() => setActiveTab('splits')}
                            />
                            <ActionButton
                                icon="alias"
                                label={t('alias')}
                                active={activeTab === 'alias'}
                                onClick={() => setActiveTab('alias')}
                            />
                            <ActionButton
                                icon="contacts"
                                label={t('contacts')}
                                active={activeTab === 'contacts'}
                                onClick={() => setActiveTab('contacts')}
                            />
                            <ActionButton
                                icon="history"
                                label={t('history')}
                                active={activeTab === 'history'}
                                onClick={() => setActiveTab('history')}
                            />
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Content Area */}
                    <div className="flex-1 w-full bg-[#13131f]/50 backdrop-blur-sm rounded-[2rem] border border-white/5 p-4 lg:p-8 min-h-[500px]">
                        {activeTab === 'receive' && <ReceiveTab avatarUrl={avatarUrl} registeredAlias={registeredAlias} linkAmount={linkAmount} setLinkAmount={setLinkAmount} linkConcept={linkConcept} setLinkConcept={setLinkConcept} requestToken={requestToken} setRequestToken={setRequestToken} />}
                        {activeTab === 'send' && <SendTab sendRecipient={sendRecipient} setSendRecipient={setSendRecipient} sendAlias={sendAlias} setSendAlias={setSendAlias} sendAmount={sendAmount} setSendAmount={setSendAmount} sendNote={sendNote} setSendNote={setSendNote} paymentConcept={paymentConcept} setPaymentConcept={setPaymentConcept} loading={loading} setLoading={setLoading} publicKey={publicKey} wallet={wallet} connection={connection} solPrice={liveSolPrice} balance={balances.find(b => b.symbol === 'SOL')?.amount || 0} sendToken={sendToken} setSendToken={setSendToken} myAliases={myAliases} contacts={contacts} resolvedAddress={resolvedAddress} setResolvedAddress={setResolvedAddress} />}
                        {activeTab === 'splits' && <SplitsTab splits={splits} setSplits={setSplits} isEditing={isEditing} setIsEditing={setIsEditing} newSplitAddress={newSplitAddress} setNewSplitAddress={setNewSplitAddress} newSplitPercent={newSplitPercent} setNewSplitPercent={setNewSplitPercent} addSplit={addSplit} removeSplit={removeSplit} totalPercent={totalPercent} handleSaveConfig={handleSaveConfig} loading={loading} registeredAlias={registeredAlias} setActiveTab={setActiveTab} />}
                        {activeTab === 'alias' && <AliasTab myAliases={myAliases} showRegisterForm={showRegisterForm} setShowRegisterForm={setShowRegisterForm} alias={alias} setAlias={setAlias} handleRegister={handleRegister} loading={loading} setRegisteredAlias={setRegisteredAlias} handleDeleteAlias={handleDeleteAlias} connection={connection} avatarUrl={avatarUrl} registeredAlias={registeredAlias} />}
                        {activeTab === 'contacts' && <ContactsTab contacts={contacts} refreshContacts={loadContacts} setSendRecipient={setSendRecipient} setSendAlias={setSendAlias} setSendNote={setSendNote} setResolvedAddress={setResolvedAddress} setActiveTab={setActiveTab} loading={loading} setLoading={setLoading} connection={connection} wallet={wallet} confirmModal={confirmModal} setConfirmModal={setConfirmModal} noteModal={noteModal} setNoteModal={setNoteModal} />}
                        {activeTab === 'history' && <HistoryTab publicKey={publicKey} connection={connection} contacts={contacts} />}
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
                        network={network}
                        registeredAlias={registeredAlias}
                        registeredAt={registeredAt}
                        handleRemoveAvatar={handleRemoveAvatar}
                        handleDeleteAlias={handleDeleteAlias}
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

function ReceiveTab({ avatarUrl, registeredAlias, linkAmount, setLinkAmount, linkConcept, setLinkConcept, requestToken, setRequestToken }: any) {
    const { t } = usePreferences();
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

    const getPaymentUrl = (sig?: string, orderId?: string) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        let url = `${origin}/pay/${shareValue}`;
        const params = new URLSearchParams();

        // Hide details from URL if order_id is present (Secure/Clean URL Mode)
        if (linkAmount && !orderId) params.append('amount', linkAmount);

        if (linkConcept && !orderId) {
            params.append('concept', encodeURIComponent(linkConcept));
        }

        if (requestToken.symbol !== 'SOL' && !orderId) params.append('token', requestToken.symbol);

        if (sig) params.append('sig', sig);
        if (orderId) params.append('order_id', orderId);

        if (params.toString()) url += `?${params.toString()}`;
        return url;
    };

    // Auto-sign payment URL and create order when parameters change
    const [signedPaymentUrl, setSignedPaymentUrl] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);

    useEffect(() => {
        const baseUrl = getPaymentUrl();
        const isSimpleLink = !linkAmount && !linkConcept && requestToken.symbol === 'SOL';

        // 0. Base case: Bare/Simple link (No params) -> Immediate display
        if (isSimpleLink) {
            setSignedPaymentUrl(baseUrl);
            setIsGeneratingLink(false);
            return;
        }

        // 1. Secure Link Required -> Hide unsafe link immediately
        setSignedPaymentUrl('');
        setIsGeneratingLink(true);

        // Debounce API calls (1000ms) to prevent rate limits and ensure user finished typing
        const timer = setTimeout(() => {
            if (shareValue && publicKey) {
                const signAndCreateOrder = async () => {
                    try {
                        // 1. Create a backend order for verification first
                        let orderId: string | null = null;
                        try {
                            const orderRes = await fetch('/api/orders/create', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    alias: String(shareValue),
                                    amount: linkAmount,
                                    token: requestToken.symbol,
                                    merchant_wallet: publicKey.toBase58(),
                                    concept: linkConcept || null,
                                }),
                            });

                            if (orderRes.ok) {
                                const orderData = await orderRes.json();
                                if (orderData.order_id) {
                                    orderId = orderData.order_id;
                                }
                            }
                        } catch (e) {
                            console.warn('[Dashboard] Order creation failed:', e);
                        }

                        // 2. Sign the URL (including orderId to bind it cryptographically)
                        const { signPaymentParams } = await import('../../utils/paymentSecurity');
                        const sig = await signPaymentParams(
                            String(shareValue),
                            linkAmount,
                            requestToken.symbol,
                            orderId || undefined,
                            linkConcept || ''
                        );

                        if (sig) {
                            setSignedPaymentUrl(getPaymentUrl(sig, orderId || undefined));
                            setIsGeneratingLink(false);
                        } else {
                            setIsGeneratingLink(false); // Failed to sign
                        }
                    } catch (err) {
                        console.error("Error signing payment:", err);
                        setIsGeneratingLink(false);
                    }
                };
                signAndCreateOrder();
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [linkAmount, linkConcept, requestToken.symbol, shareValue]);

    const getShareMessage = () => {
        const amount = linkAmount ? ` ${linkAmount} ${requestToken.symbol}` : '';
        return `💸 Pay me${amount} via UNIK: ${signedPaymentUrl}`;
    };

    return (
        <div>
            <h3 className="text-2xl font-bold mb-6">{t('receive_payments')}</h3>

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
                            {t('no_alias')}
                        </button>
                    )}
                    <button
                        onClick={() => setUseAddress(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${useAddress ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('wallet_address')}
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <label className="text-sm text-gray-400 block mb-2">{t('request_amount')}</label>
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
                <label className="text-sm text-gray-400 block mb-2">{t('select_token')}</label>
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
                <label className="text-sm text-gray-400 block mb-2">{t('payment_concept_offchain')}</label>
                <input
                    type="text"
                    placeholder="e.g. For dinner, Project XYZ..."
                    value={linkConcept}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                    onChange={(e) => setLinkConcept(e.target.value)}
                />
            </div>

            <div className="bg-gray-800 p-6 border border-gray-700">
                <label className="text-sm text-gray-400 block mb-3">{t('payment_link_label')}</label>

                {/* QR Code Display */}
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-white rounded-xl shadow-lg">
                        {isGeneratingLink || !signedPaymentUrl ? (
                            <div className="flex flex-col items-center justify-center w-[180px] h-[180px] animate-pulse">
                                <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-3"></div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Creating Secure Link...</p>
                            </div>
                        ) : (
                            <QRCode
                                value={signedPaymentUrl}
                                size={180}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                        )}
                    </div>
                </div>

                <div className="mb-4">
                    <code className={`block p-4 bg-black font-mono text-sm break-all border border-gray-700 transition-colors ${isGeneratingLink || !signedPaymentUrl ? 'text-gray-500 animate-pulse' : 'text-cyan-400'}`}>
                        {isGeneratingLink || !signedPaymentUrl ? "Creating Secure Link..." : signedPaymentUrl.replace(/^https?:\/\//, '')}
                    </code>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        disabled={isGeneratingLink || !signedPaymentUrl}
                        onClick={() => {
                            if (!signedPaymentUrl) return;
                            navigator.clipboard.writeText(signedPaymentUrl);
                            toast.success(t('link_copied'));
                        }}
                        className={`flex items-center justify-center gap-2 px-4 py-3 font-semibold transition-colors rounded-xl border border-white/5 ${isGeneratingLink || !signedPaymentUrl ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t('copy')}
                    </button>

                    <button
                        disabled={isGeneratingLink || !signedPaymentUrl}
                        onClick={() => setIsPayShareOpen(!isPayShareOpen)}
                        className={`flex items-center justify-center gap-2 px-4 py-3 font-semibold transition-all rounded-xl border ${isGeneratingLink || !signedPaymentUrl ? 'bg-gray-800 text-gray-500 border-white/5 cursor-not-allowed' : (isPayShareOpen ? 'bg-cyan-600 border-cyan-400' : 'bg-gray-700 hover:bg-gray-600 border-white/5')}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        {t('share')}
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
                            {t('whatsapp')}
                        </button>

                        <button
                            onClick={() => {
                                const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(signedPaymentUrl)}&text=${encodeURIComponent(`💸 Pay me${linkAmount ? ` ${linkAmount} ${requestToken.symbol}` : ''} via UNIK`)}`;
                                window.open(telegramUrl, '_blank');
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30 rounded-xl font-semibold transition-colors"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                            {t('telegram')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function SendTab({ sendRecipient, setSendRecipient, sendAlias, setSendAlias, sendAmount, setSendAmount, sendNote, setSendNote, paymentConcept, setPaymentConcept, loading, setLoading, publicKey, wallet, connection, solPrice, balance, sendToken, setSendToken, myAliases, contacts, resolvedAddress, setResolvedAddress }: any) {
    const { t, convertPrice } = usePreferences();
    // Recipient Status State (Moved local to SendTab)
    const [recipientNeedsSetup, setRecipientNeedsSetup] = useState<boolean>(false);
    const [isCheckingSetup, setIsCheckingSetup] = useState<boolean>(false);

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

    const [securityWarning, setSecurityWarning] = useState<string | null>(null);

    useEffect(() => {
        const validateRecipient = async () => {
            if (!debouncedRecipient || debouncedRecipient.length < 3) {
                setIsValidRecipient(null);
                setSecurityWarning(null);
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
                        setResolvedAddress(debouncedRecipient);
                        setSecurityWarning(null);
                        return;
                    }
                } catch { }

                // Check if it's a valid Alias
                const aliasToCheck = debouncedRecipient.startsWith('@') ? debouncedRecipient.slice(1).toLowerCase() : debouncedRecipient.toLowerCase();
                const [aliasPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("alias"), Buffer.from(aliasToCheck)],
                    PROGRAM_ID
                );

                const provider = new AnchorProvider(connection, { publicKey: PublicKey.default, signTransaction: () => { } } as any, {});
                const program = new Program(IDL as any, provider);
                try {
                    const account: any = await (program.account as any).aliasAccount.fetch(aliasPDA);
                    const currentOwner = account.owner.toBase58();
                    setIsValidRecipient(true);
                    setResolvedAddress(currentOwner);

                    // SECURITY CHECK: Compare with contact list
                    const contact = contacts.find((c: any) => c.alias?.toLowerCase() === aliasToCheck);
                    if (contact && contact.aliasOwner && contact.aliasOwner !== currentOwner) {
                        setSecurityWarning(`Security Alert: The owner of @${aliasToCheck} has changed since you added this contact. Please verify with the recipient before sending funds.`);
                    } else {
                        setSecurityWarning(null);
                    }
                } catch {
                    const info = await connection.getAccountInfo(aliasPDA);
                    setIsValidRecipient(!!info);
                    if (!info) {
                        setResolvedAddress(null);
                        setSecurityWarning(null);
                    }
                }

            } catch (error) {
                console.error("Validation error:", error);
                setIsValidRecipient(false);
                setSecurityWarning(null);
            } finally {
                setIsCheckingRecipient(false);
            }
        };

        validateRecipient();
    }, [debouncedRecipient, connection, contacts]);
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

        // Stop scanner immediately to prevent multiple reads
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                scannerRef.current = null;
                setScanning(false);
            }).catch(console.error);
        } else { setScanning(false); }

        try {
            // Robust URL parsing: Add protocol if missing
            let urlText = decodedText;
            if (!urlText.startsWith('http://') && !urlText.startsWith('https://')) {
                if (urlText.includes('unik.app') || urlText.includes('unikpay.xyz') || urlText.includes('/pay/')) {
                    urlText = 'https://' + urlText;
                }
            }

            if (urlText.includes('/pay/')) {
                try {
                    const url = new URL(urlText);
                    const pathParts = url.pathname.split('/');
                    const aliasIndex = pathParts.indexOf('pay') + 1;

                    if (aliasIndex < pathParts.length && pathParts[aliasIndex]) {
                        const extractedAlias = pathParts[aliasIndex];
                        setSendRecipient(`@${extractedAlias}`);
                        setSendAlias(extractedAlias);

                        // Check for Secure Order ID
                        const orderId = url.searchParams.get('order_id');
                        if (orderId) {
                            const toastId = toast.loading(t('loading') || 'Fetching order...');
                            fetch('/api/orders/status', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ order_id: orderId })
                            })
                                .then(res => res.json())
                                .then(data => {
                                    toast.dismiss(toastId);
                                    if (data.error) {
                                        toast.error('Order not found');
                                        return;
                                    }

                                    // Populate Fields from Order
                                    if (data.expected_amount) setSendAmount(String(data.expected_amount));
                                    if (data.concept) setPaymentConcept(data.concept);
                                    if (data.expected_token) {
                                        const foundToken = TOKEN_OPTIONS.find(t => t.symbol.toUpperCase() === data.expected_token.toUpperCase());
                                        if (foundToken) setSendToken(foundToken);
                                    }
                                    toast.success('Order details loaded');
                                })
                                .catch(err => {
                                    toast.dismiss(toastId);
                                    console.error('Failed to load order:', err);
                                    toast.error('Failed to load order');
                                });
                            // Return early to skip param parsing (Order is authoritative)
                            return;
                        }

                        // Fallback: Parse URL Params (Non-Order Links)
                        const amount = url.searchParams.get('amount');
                        if (amount) setSendAmount(amount);

                        const concept = url.searchParams.get('concept') || url.searchParams.get('message') || url.searchParams.get('memo');
                        if (concept) setPaymentConcept(concept);

                        const tokenSymbol = url.searchParams.get('token');
                        if (tokenSymbol) {
                            const foundToken = TOKEN_OPTIONS.find(t => t.symbol.toUpperCase() === tokenSymbol.toUpperCase());
                            if (foundToken) setSendToken(foundToken);
                        }
                    }
                } catch (e) {
                    console.error("QR URL Parse Failed", e);
                    setSendRecipient(decodedText);
                }
            } else {
                setSendRecipient(decodedText);
                setSendAlias('');
            }
        } catch (e) { console.error("QR General Parse Error", e); }
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

    // ATA Status Check (Separate Flow)
    useEffect(() => {
        const checkATA = async () => {
            setRecipientNeedsSetup(false);
            if (!sendToken.mint || sendToken.symbol === 'SOL') return;
            if (!resolvedAddress && !sendRecipient) return;

            // Use resolvedAddress if available (it refers to Owner PK), otherwise try sendRecipient if it looks like a key
            let targetOwnerStr = resolvedAddress;
            if (!targetOwnerStr) {
                try {
                    new PublicKey(sendRecipient);
                    targetOwnerStr = sendRecipient;
                } catch (e) { return; }
            }

            setIsCheckingSetup(true);
            try {
                const destOwner = new PublicKey(targetOwnerStr!);
                const destATA = await getAssociatedTokenAddress(sendToken.mint, destOwner);
                const info = await connection.getAccountInfo(destATA);
                // If info is null, account does not exist -> Needs Activation
                setRecipientNeedsSetup(!info);
                console.log("[Dashboard] ATA Check:", destATA.toBase58(), "Exists:", !!info);
            } catch (e) {
                console.error("[Dashboard] ATA Check Failed:", e);
                setRecipientNeedsSetup(true); // Conservative fallback
            } finally {
                setIsCheckingSetup(false);
            }
        };
        const timer = setTimeout(checkATA, 500);
        return () => clearTimeout(timer);
    }, [resolvedAddress, sendRecipient, sendToken, connection]);

    const handleActivation = async () => {
        if (!sendToken.mint || !publicKey) return;
        let targetOwnerStr = resolvedAddress || sendRecipient;
        try { new PublicKey(targetOwnerStr); } catch (e) { return; }

        setLoading(true);
        try {
            const destOwner = new PublicKey(targetOwnerStr);
            const destATA = await getAssociatedTokenAddress(sendToken.mint, destOwner);

            const transaction = new Transaction();
            transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));
            transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 50000 }));
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    publicKey,
                    destATA,
                    destOwner,
                    sendToken.mint
                )
            );

            const signature = await wallet.sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');

            showTransactionToast({ signature, message: `Activated ${sendToken.symbol} Account`, type: 'success' });

            // Re-check immediately
            const info = await connection.getAccountInfo(destATA);
            setRecipientNeedsSetup(!info);

        } catch (e: any) {
            console.error("Activation failed:", e);
            toast.error("Activation failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

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
                        const [aliasPDA] = PublicKey.findProgramAddressSync([Buffer.from("alias"), Buffer.from(targetAlias)], PROGRAM_ID);

                        if (sendToken.symbol === 'SOL') {
                            // --- SOL ROUTING ---
                            const remainingAccounts = routeAccount.splits.map((s: any) => ({
                                pubkey: s.recipient, isSigner: false, isWritable: true
                            }));
                            const ix = await (program.methods as any).executeTransfer(targetAlias, amountBN).accounts({
                                routeAccount: routePDA, aliasAccount: aliasPDA, user: publicKey, systemProgram: SystemProgram.programId
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
                            const preInstructions = [];

                            for (const split of routeAccount.splits) {
                                const destATA = await getAssociatedTokenAddress(sendToken.mint, split.recipient);
                                remainingAccounts.push({ pubkey: destATA, isSigner: false, isWritable: true });

                                // Auto-create ATA if missing
                                const info = await connection.getAccountInfo(destATA);
                                if (!info) {
                                    const { createAssociatedTokenAccountIdempotentInstruction } = await import('@solana/spl-token');
                                    preInstructions.push(
                                        createAssociatedTokenAccountIdempotentInstruction(
                                            publicKey,
                                            destATA,
                                            split.recipient,
                                            sendToken.mint
                                        )
                                    );
                                }
                            }

                            const ix = await (program.methods as any)
                                .executeTokenTransfer(targetAlias, amountBN)
                                .accounts({
                                    routeAccount: routePDA,
                                    aliasAccount: aliasPDA,
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
                                    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 + (preInstructions.length * 40000) }),
                                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
                                    ...preInstructions,
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
                } catch (e: any) {
                    // Only fall through to direct transfer if route account doesn't exist
                    // If route exists but transaction fails, show the error (don't bypass splits!)
                    const errMsg = e?.message || String(e);
                    const isAccountNotFound = errMsg.includes('Account does not exist') || errMsg.includes('could not find');
                    if (isAccountNotFound) {
                        console.log("No route account, falling through to direct transfer");
                    } else {
                        console.error("Routing transaction failed:", e);
                        toast.error("Split payment failed. Try re-saving your split config in the Splits tab to update it.");
                        setLoading(false);
                        return;
                    }
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
                <h3 className="text-2xl font-bold">{t('send')}</h3>
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
                    {scanning ? t('cancel_scan') : t('scan_qr')}
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
                {/* Security Warning */}
                {securityWarning && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex gap-4 animate-in shake duration-500">
                        <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 flex-shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-red-500 mb-1">Security Alert</h4>
                            <p className="text-[11px] text-red-200/80 leading-relaxed font-medium">
                                {securityWarning}
                            </p>
                        </div>
                    </div>
                )}
                <div>
                    <label className="text-sm text-gray-400 block mb-2">{t('recipient')}</label>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder={t('recipient_placeholder')}
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
                                        <span className="text-xs font-bold text-gray-400">{t('your_contacts')}</span>
                                        <button onClick={() => setShowContactPicker(false)} className="text-gray-500 hover:text-white transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={t('search_placeholder')}
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
                                            <span className="text-xs">{t('no_contacts')} "{filterQ}"</span>
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
                                                    setResolvedAddress(c.aliasOwner || c.wallet_address || (isAddressAlias ? c.alias : null));
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
                                <div className={`relative w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden ${sendAlias ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                    <span>{(sendNote || sendAlias || '?')[0]?.toUpperCase()}</span>
                                    {(resolvedAddress || (sendRecipient && !sendRecipient.startsWith('@'))) && (
                                        <img
                                            src={`${supabase.storage.from('avatars').getPublicUrl(`${resolvedAddress || sendRecipient}_avatar`).data.publicUrl}?t=${Date.now().toString().slice(0, -5)}`}
                                            alt=""
                                            className="absolute inset-0 w-full h-full object-cover"
                                            style={{ display: 'none' }}
                                            onLoad={(e) => e.currentTarget.style.display = 'block'}
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    {sendNote && <span className="text-sm font-bold text-gray-200">{sendNote}</span>}
                                    {sendAlias && <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                        {sendAlias.startsWith('@') ? 'Alias: ' : 'Linked: @'}{sendAlias.replace('@', '')}
                                    </span>}
                                </div>
                            </div>
                            <button onClick={() => { setSendRecipient(''); setSendAlias(''); setSendNote(''); setPaymentConcept(''); }} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 hover:bg-red-500/10 rounded-lg transition-colors font-medium">{t('clear')}</button>
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-sm text-gray-400 block mb-2">{t('amount')} ({sendToken.symbol})
                        <span className="float-right text-xs text-gray-500">
                            {t('balance')}: {activeBalance !== null ? `${activeBalance.toFixed(sendToken.symbol === 'SOL' ? 4 : 2)} ${sendToken.symbol === 'SOL' ? `(≈ ${convertPrice(activeBalance)})` : ''}` : t('loading')}
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
                    <label className="text-sm text-gray-400 block mb-2">{t('concept')}</label>
                    <input
                        type="text"
                        placeholder={t('concept_placeholder')}
                        value={paymentConcept}
                        onChange={(e) => setPaymentConcept(e.target.value)}
                        className="w-full px-4 py-4 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <button
                    onClick={recipientNeedsSetup ? handleActivation : handleSend}
                    disabled={loading || !sendRecipient || (!recipientNeedsSetup && (!sendAmount || parseFloat(sendAmount) <= 0 || activeBalance === null || parseFloat(sendAmount) > activeBalance)) || isCheckingSetup}
                    className={`w-full py-5 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95
                        ${recipientNeedsSetup
                            ? 'bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 text-white shadow-orange-900/30'
                            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                        }`}
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Processing...
                        </span>
                    ) : isCheckingSetup ? (
                        "Checking Recipient..."
                    ) : recipientNeedsSetup ? (
                        `Activate ${sendToken.symbol} Account (~0.002 SOL)`
                    ) : (
                        `${t('send')} ${sendToken.symbol}`
                    )}
                </button>

                {sendToken.symbol !== 'SOL' && (
                    <div className="text-center mt-2">
                        <button
                            onClick={() => setRecipientNeedsSetup(!recipientNeedsSetup)}
                            className="text-[10px] text-gray-600 hover:text-gray-400 underline decoration-dotted"
                        >
                            [Debug] {recipientNeedsSetup ? "Force Pay Mode" : "Force Activate Mode"} (ATA: {recipientNeedsSetup ? 'Missing' : 'OK'})
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
}

function SplitsTab({ splits, setSplits, isEditing, setIsEditing, newSplitAddress, setNewSplitAddress, newSplitPercent, setNewSplitPercent, addSplit, removeSplit, totalPercent, handleSaveConfig, loading, registeredAlias, setActiveTab }: any) {
    const { t } = usePreferences();
    if (!registeredAlias) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8 bg-gray-900/30 rounded-2xl border border-dashed border-gray-700">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
                    <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold mb-3">{t('alias_required')}</h3>
                <p className="text-gray-400 mb-8 max-w-md leading-relaxed">
                    {t('alias_required_desc')}
                </p>
                <button
                    onClick={() => setActiveTab('alias')}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-xl font-bold text-white shadow-lg shadow-purple-900/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-2"
                >
                    <span>{t('register_btn')}</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">{t('routing_rules')}</h3>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-xl font-semibold text-sm transition-colors"
                >
                    {isEditing ? t('cancel') : t('add_split')}
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
                    {t('total_allocation')}: {totalPercent}%
                </p>
                <button
                    onClick={handleSaveConfig}
                    disabled={totalPercent !== 100 || loading}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? t('sending') : t('save_onchain')}
                </button>
            </div>
        </div>
    );
}

function AliasTab({ myAliases, showRegisterForm, setShowRegisterForm, alias, setAlias, handleRegister, loading, setRegisteredAlias, handleDeleteAlias, connection, avatarUrl, registeredAlias }: any) {
    const { t } = usePreferences();
    const [confirmDeleteAlias, setConfirmDeleteAlias] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Availability State
    const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [debouncedAlias, setDebouncedAlias] = useState(alias);
    const [isContactShareOpen, setIsContactShareOpen] = useState(false);

    const getContactUrl = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.unikpay.xyz';
        return `${origin}/add-contact/${registeredAlias}`;
    };

    const getContactShareMessage = () => {
        return `Add me on UNIK contacts: ${getContactUrl()}`;
    };

    const hasAlias = myAliases.length > 0;
    const MAX_ALIASES = 1;
    const canRegister = myAliases.length < MAX_ALIASES;

    // Debounce alias input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedAlias(alias);
        }, 500);
        return () => clearTimeout(timer);
    }, [alias]);

    // Check availability
    useEffect(() => {
        if (!debouncedAlias || debouncedAlias.length < 3) {
            setAvailability('idle');
            return;
        }

        const checkAvailability = async () => {
            setAvailability('checking');
            try {
                // Determine expected PDA
                const [pda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("alias"), Buffer.from(debouncedAlias)],
                    PROGRAM_ID
                );
                // Check if account exists
                const info = await connection.getAccountInfo(pda);

                // If account exists, it's taken. If null, it's available.
                // Note: We might want to check data size or discriminator to be 100% sure it's an AliasAccount, 
                // but for now existence check is sufficient proxy as only AliasAccounts live at this PDA.
                if (info) {
                    setAvailability('taken');
                } else {
                    setAvailability('available');
                }
            } catch (e) {
                console.error("Availability check failed", e);
                setAvailability('idle');
            }
        };

        checkAvailability();
    }, [debouncedAlias, connection]);

    const onDeleteConfirmed = async (aliasName: string) => {
        setDeleting(true);
        try {
            await handleDeleteAlias(aliasName);
            setConfirmDeleteAlias(null);
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div>
            <h3 className="text-2xl font-bold mb-2">{t('aliases_title')}</h3>
            <p className="text-xs text-gray-500 mb-6">Maximum 1 alias per wallet. You can delete and register a new one at any time.</p>

            {hasAlias && !showRegisterForm && (
                <div className="mb-6">
                    <h4 className="text-sm text-gray-400 mb-3">{t('your_aliases')}</h4>
                    <div className="space-y-3">
                        {myAliases.map((a: string) => (
                            <div key={a} className="p-4 bg-gray-800 rounded-xl border border-gray-700 transition-all">
                                {confirmDeleteAlias === a ? (
                                    /* Inline Confirmation */
                                    <div className="space-y-3 animate-in fade-in duration-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 flex-shrink-0">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">Delete @{a}?</p>
                                                <p className="text-[10px] text-red-300/70">This is permanent. The name will be available for anyone to register.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setConfirmDeleteAlias(null)}
                                                disabled={deleting}
                                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-lg border border-white/5 transition-all text-xs"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => onDeleteConfirmed(a)}
                                                disabled={deleting}
                                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg shadow-red-900/30 transition-all text-xs active:scale-95"
                                            >
                                                {deleting ? 'Deleting...' : 'Confirm Delete'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Normal Alias Row */
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setRegisteredAlias(a)}>
                                            <span className="text-lg font-semibold text-cyan-400">@{a}</span>

                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteAlias(a); }}
                                            disabled={loading}
                                            className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                            title="Delete alias"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Register button - only if under limit */}
                    {canRegister && (
                        <button
                            onClick={() => setShowRegisterForm(true)}
                            className="mt-4 w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold border border-gray-700 transition-colors"
                        >
                            + {t('register_alias')}
                        </button>
                    )}

                    {!canRegister && (
                        <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-center">
                            <p className="text-[11px] text-yellow-500/80">You've reached the maximum of {MAX_ALIASES} alias. Delete your current alias to register a different one.</p>
                        </div>
                    )}
                </div>
            )}

            {(showRegisterForm || !hasAlias) && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h4 className="text-lg font-semibold mb-4">{t('register_alias')}</h4>
                    <div className="space-y-4">
                        <div>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={alias}
                                    onChange={(e) => {
                                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                                        setAlias(val);
                                    }}
                                    placeholder="your_alias"
                                    className={`w-full px-4 py-4 rounded-xl bg-gray-900 border text-lg focus:outline-none transition-colors ${availability === 'available' ? 'border-green-500/50 focus:border-green-500' :
                                        availability === 'taken' ? 'border-red-500/50 focus:border-red-500' :
                                            'border-gray-700 focus:border-cyan-500'
                                        }`}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                    {availability === 'checking' && (
                                        <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                                    )}
                                    {availability === 'available' && (
                                        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    )}
                                    {availability === 'taken' && (
                                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-start mt-2">
                                <p className="text-xs text-gray-500">3-32 characters. Lowercase alphanumeric only.</p>
                                {availability === 'taken' && (
                                    <p className="text-xs text-red-400 font-bold">Alias unavailable</p>
                                )}
                                {availability === 'available' && (
                                    <p className="text-xs text-green-400 font-bold">Alias available!</p>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleRegister}
                            disabled={loading || !alias || availability !== 'available'}
                            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 disabled:active:scale-100"
                        >
                            {loading ? t('loading') : availability === 'taken' ? 'Taken' : t('register_btn')}
                        </button>
                        {hasAlias && (
                            <button onClick={() => setShowRegisterForm(false)} className="w-full py-3 text-gray-400 hover:text-white transition-colors">{t('cancel')}</button>
                        )}
                    </div>
                </div>
            )}

            {/* Share Section - Only if alias registered and not in register mode */}
            {hasAlias && registeredAlias && !showRegisterForm && (
                <div className="mt-8 pt-8 border-t border-gray-700 animate-in slide-in-from-bottom-4 duration-500">
                    <h4 className="text-sm text-gray-400 mb-4 font-semibold uppercase tracking-wider">Share Profile</h4>

                    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 relative overflow-hidden group">

                        {/* Profile Preview */}
                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            {avatarUrl ? (
                                <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 p-1">
                                    <Image src={avatarUrl} alt="Avatar" width={64} height={64} className="rounded-full object-cover w-full h-full" unoptimized />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-2xl font-bold border border-cyan-500/20">
                                    {registeredAlias.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h3 className="text-xl font-bold text-white">@{registeredAlias}</h3>
                                <p className="text-xs text-cyan-400 font-mono mt-1">UNIK Alias</p>
                            </div>
                        </div>

                        {/* Link Box */}
                        <div className="bg-black/40 rounded-xl p-1 flex items-center justify-between border border-white/5 mb-4 relative z-10">
                            <code className="text-xs text-gray-400 font-mono truncate px-3 py-2 flex-1">
                                {getContactUrl().replace(/^https?:\/\//, '')}
                            </code>
                            <button
                                onClick={() => { navigator.clipboard.writeText(getContactUrl()); toast.success(t('link_copied')); }}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 gap-3 relative z-10">
                            <button
                                onClick={() => setIsContactShareOpen(!isContactShareOpen)}
                                className={`w-full py-3 rounded-xl font-bold text-sm transition-all border ${isContactShareOpen ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-gray-700/50 hover:bg-gray-700 text-gray-300 border-white/5'}`}
                            >
                                {isContactShareOpen ? 'Close Share Options' : 'Share Profile'}
                            </button>

                            {isContactShareOpen && (
                                <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                    <button
                                        onClick={() => {
                                            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(getContactShareMessage())}`;
                                            window.open(whatsappUrl, '_blank');
                                        }}
                                        className="flex items-center justify-center gap-2 py-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-xl font-bold text-sm border border-[#25D366]/20 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                        WhatsApp
                                    </button>
                                    <button
                                        onClick={() => {
                                            const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(getContactUrl())}&text=${encodeURIComponent('Add me on UNIK contacts')}`;
                                            window.open(telegramUrl, '_blank');
                                        }}
                                        className="flex items-center justify-center gap-2 py-3 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] rounded-xl font-bold text-sm border border-[#0088cc]/20 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                        </svg>
                                        Telegram
                                    </button>
                                </div>
                            )}
                        </div>
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

function ContactsTab({ setSendRecipient, setSendAlias, setSendNote, setResolvedAddress, setActiveTab, loading, setLoading, connection, wallet, confirmModal, setConfirmModal, noteModal, setNoteModal, contacts, refreshContacts }: any) {
    const { t } = usePreferences();
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
            const isAddress = /^[1-9A-HJ-NP-Za-km-z]{32, 44}$/.test(inputLower);

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

                toast.success(`Address added as ${label}`);
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

                    toast.success(`Contact @${inputLower} added`);
                } catch (err) {
                    console.error("Lookup failed", err);
                    toast.error(`Alias @${inputLower} not found on-chain`);
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
            toast.error('Failed to add contact');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-2xl font-bold">{t('contacts')}</h3>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {/* Search Field */}
                    <div className="relative flex-1 sm:w-64">
                        <input
                            type="text"
                            placeholder={t('search_placeholder')}
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
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t('sort')}:</span>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-cyan-400 focus:outline-none appearance-none cursor-pointer pr-1"
                        >
                            <option value="recent" className="bg-gray-800">{t('recent')}</option>
                            <option value="alpha" className="bg-gray-800">{t('az')}</option>
                            <option value="notes" className="bg-gray-800">{t('notes')}</option>
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
                    {t('add_contact')}
                </h4>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        placeholder={t('recipient_placeholder')}
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
                                <span className="sm:hidden">{t('add_contact')}</span>
                                <span className="hidden sm:inline">{t('add_contact')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {contacts.length === 0 ? (
                <div className="text-center py-16 bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-700">
                    <div className="text-5xl mb-4">👥</div>
                    <p className="text-gray-400 font-medium">{t('no_contacts_yet')}</p>
                    <p className="text-sm text-gray-500">{t('add_first_contact')}</p>
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
                                        <div className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-cyan-500/20 overflow-hidden ${isUnik ? 'bg-gradient-to-br from-cyan-500 to-purple-600' : 'bg-gradient-to-br from-gray-700 to-gray-600'}`}>
                                            {/* Initials (Background) */}
                                            <span>{(isUnik ? c.alias : (noteText || '?'))[0]?.toUpperCase()}</span>

                                            {/* Public Avatar (Overlay) - Best Effort */}
                                            <img
                                                src={`${supabase.storage.from('avatars').getPublicUrl(`${ownerAddr}_avatar`).data.publicUrl}?t=${Date.now().toString().slice(0, -5)}`} // weak cache bust
                                                alt=""
                                                className="absolute inset-0 w-full h-full object-cover bg-gray-800"
                                                style={{ display: 'none' }}
                                                onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
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
                                                    note: noteText,
                                                    onSave: async (newNote: string) => {
                                                        const owner = wallet?.publicKey?.toBase58();
                                                        if (!owner) return;
                                                        try {
                                                            // Use general update method
                                                            await contactStorage.updateContact(c.alias, { notes: newNote }, owner);
                                                            window.dispatchEvent(new Event('unik-contacts-updated'));
                                                            if (refreshContacts) refreshContacts();
                                                            toast.success("Note updated");
                                                        } catch (err) {
                                                            console.error(err);
                                                            toast.error("Failed to update note");
                                                        }
                                                    }
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
                                                setResolvedAddress(ownerAddr);
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

                    {sortedContacts.length > 4 && (
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
                    )}
                </div>
            )}
        </div>
    );
}

function HistoryTab({ publicKey, connection, confirmModal, setConfirmModal, contacts }: any) {
    const { t, language } = usePreferences();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);
    const [filterDate, setFilterDate] = useState('');
    const [filterType, setFilterType] = useState('All');
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

        // Listen for decryption event (from RiskModal)
        const listener = () => loadNotes();
        window.addEventListener('unik-contacts-updated', listener);
        return () => window.removeEventListener('unik-contacts-updated', listener);
    }, [publicKey]);

    const fetchHistory = useCallback(async () => {
        if (!publicKey) return;
        setLoading(true);
        try {
            // 1. Fetch Token Accounts (for incoming SPL detection)
            // We need to check ATAs because incoming SPL transfers might not reference the main wallet directly
            let targetAddresses = [publicKey];
            const myATAKeys = new Set<string>();

            try {
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    programId: TOKEN_PROGRAM_ID
                });

                // Index known ATAs
                tokenAccounts.value.forEach((t: any) => myATAKeys.add(t.pubkey.toBase58()));

                // Also proactively derive expected ATAs for known tokens (USDC/EURC) just in case
                await Promise.all(TOKEN_OPTIONS.filter(t => t.mint).map(async (opt) => {
                    if (opt.mint) {
                        try {
                            const ata = await getAssociatedTokenAddress(opt.mint, publicKey);
                            myATAKeys.add(ata.toBase58());
                        } catch (e) { }
                    }
                }));

                // Prioritize known mints (USDC/EURC)
                const importantMints = TOKEN_OPTIONS.filter(t => t.mint).map(t => t.mint?.toBase58());

                const sortedAtas = tokenAccounts.value.sort((a: any, b: any) => {
                    const mintA = (a.account.data as any).parsed?.info?.mint;
                    const mintB = (b.account.data as any).parsed?.info?.mint;
                    const importantA = importantMints.includes(mintA);
                    const importantB = importantMints.includes(mintB);
                    if (importantA && !importantB) return -1;
                    if (!importantA && importantB) return 1;
                    return 0;
                });

                // Check top 5 active ATAs
                sortedAtas.slice(0, 5).forEach((t: any) => targetAddresses.push(t.pubkey));

                // CRITICAL FIX: Also scan the explicitly derived ATAs (USDC/EURC) 
                // This ensures we catch transfers to new accounts that might not yet appear in 'tokenAccounts' list
                myATAKeys.forEach(key => {
                    if (!targetAddresses.includes(key as any)) { // Cast to avoid TS issues if types differ
                        targetAddresses.push(key as any);
                    }
                });
            } catch (e) {
                console.warn("Failed to fetch token accounts for history", e);
            }

            // Fetch On-Chain History & Backend Orders in parallel
            const [multiSignatures, orderRes] = await Promise.all([
                Promise.all(targetAddresses.map(addr =>
                    connection.getSignaturesForAddress(addr, { limit: 20 })
                        .catch((e: any) => { console.warn("Sig fetch error", addr.toString()); return []; })
                )),
                fetch('/api/orders/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallet: publicKey.toBase58() })
                }).then(r => r.json()).catch(() => ({ orders: [] }))
            ]);

            // Combine and Deduplicate
            const uniqueSigs = new Map<string, any>();
            multiSignatures.flat().forEach(sig => {
                if (sig && sig.signature && !uniqueSigs.has(sig.signature)) {
                    uniqueSigs.set(sig.signature, sig);
                }
            });

            const signatures = Array.from(uniqueSigs.values())
                .sort((a: any, b: any) => (b.blockTime || 0) - (a.blockTime || 0))
                .slice(0, 20);

            const backendOrders = orderRes.orders || [];
            setOrders(backendOrders);

            const detailedHistory = await Promise.all(
                signatures.map(async (sig: any) => {
                    try {
                        const tx = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });

                        let type = 'Interaction'; // Default
                        let amount = 0;
                        let symbol = 'SOL';
                        let otherSide = '';
                        let actionLabel = 'Interaction';
                        let isSmartRouting = false;

                        // 1. Check for UNIK Interactions via Logs
                        const logs = tx?.meta?.logMessages || [];
                        const isRegisterAlias = logs.some((l: string) => l.includes("Instruction: RegisterAlias"));
                        const isSetRoute = logs.some((l: string) => l.includes("Instruction: SetRouteConfig"));

                        // Detect if this transaction involved a split (smart routing)
                        if (logs.some((l: string) => l.includes("Instruction: ExecuteTransfer") || l.includes("Instruction: ExecuteTokenTransfer"))) {
                            isSmartRouting = true;
                        }

                        // Check Order Match (Backend Override - Highest Priority for Meta)
                        const matchingOrder = backendOrders.find((o: any) => o.tx_signature === sig.signature);

                        if (matchingOrder) {
                            if (matchingOrder.payer_wallet === publicKey.toBase58()) {
                                type = 'Sent';
                                otherSide = matchingOrder.alias ? `ALIAS:${matchingOrder.alias}` : matchingOrder.merchant_wallet;
                            } else {
                                type = 'Received';
                                otherSide = matchingOrder.payer_wallet || 'Unknown Sender';
                            }
                            amount = parseFloat(matchingOrder.amount || '0');
                            symbol = matchingOrder.token || 'SOL';
                            actionLabel = matchingOrder.concept || 'Payment';
                        } else {
                            // On-Chain Parsing Fallback

                            // Context Labels
                            if (isRegisterAlias) actionLabel = 'Alias Registration';
                            else if (isSetRoute) actionLabel = 'Routing Configuration';

                            // GLOBAL BALANCE ANALYSIS (Primary Source of Truth for Fund Movement)

                            // A. Token Changes (Prioritize SPL)
                            let relevantMint = null;
                            let tokenDiff = 0;
                            let significantTokenChangeCount = 0;

                            if (tx?.meta?.postTokenBalances) {
                                // Identify if any token balance changed for the user
                                for (const p of tx.meta.postTokenBalances) {
                                    let isMyAccount = p.owner === publicKey.toBase58();

                                    // Fallback: Check if the Token Account address is in our known set of ATAs
                                    if (!isMyAccount && typeof p.accountIndex === 'number') {
                                        const tokenKey = tx.transaction.message.accountKeys[p.accountIndex];
                                        const tokenAddress = tokenKey.pubkey ? tokenKey.pubkey.toString() : tokenKey.toString();
                                        if (myATAKeys.has(tokenAddress)) {
                                            isMyAccount = true;
                                        }
                                    }

                                    if (isMyAccount) {
                                        // Find previous balance for the exact same account index (safest match)
                                        const pre = tx.meta.preTokenBalances?.find((b: any) => b.accountIndex === p.accountIndex);

                                        const diff = (p.uiTokenAmount?.uiAmount || 0) - (pre?.uiTokenAmount?.uiAmount || 0);

                                        // Capture significance
                                        if (Math.abs(diff) > 0.000001) {
                                            if (significantTokenChangeCount === 0) {
                                                relevantMint = p.mint;
                                                tokenDiff = diff;
                                            }
                                            significantTokenChangeCount++;
                                        }
                                    }
                                }
                            }

                            // B. SOL Changes
                            let solDiff = 0;
                            const accountIndex = tx?.transaction.message.accountKeys.findIndex((k: any) =>
                                (k.pubkey ? k.pubkey.toString() : k.toString()) === publicKey.toBase58()
                            );

                            if (accountIndex !== -1) {
                                const preSol = (tx?.meta?.preBalances?.[accountIndex] || 0) / 1e9;
                                const postSol = (tx?.meta?.postBalances?.[accountIndex] || 0) / 1e9;
                                solDiff = postSol - preSol;
                            }

                            if (Math.abs(tokenDiff) > 0) { // Pure Token Transfer
                                amount = Math.abs(tokenDiff);
                                type = tokenDiff > 0 ? 'Received' : 'Sent';

                                // Symbol Lookup
                                const knownToken = TOKEN_OPTIONS.find(t => t.mint?.toBase58() === relevantMint);
                                symbol = knownToken ? knownToken.symbol : 'Token';

                                actionLabel = actionLabel === 'Interaction' ? 'Token Transfer' : actionLabel;

                                // Sender Identification (for Received)
                                if (type === 'Received') {
                                    const payerKey = tx.transaction.message.accountKeys[0];
                                    otherSide = payerKey.pubkey ? payerKey.pubkey.toString() : payerKey.toString();
                                }
                            }
                            // D. Pure SOL Transfer
                            else if (Math.abs(solDiff) > 0.001) {
                                amount = Math.abs(solDiff);
                                symbol = 'SOL';
                                type = solDiff > 0 ? 'Received' : 'Sent';
                                if (type === 'Received') {
                                    const payerKey = tx.transaction.message.accountKeys[0];
                                    otherSide = payerKey.pubkey ? payerKey.pubkey.toString() : payerKey.toString();
                                }
                            }

                            // E. Fallback: Instruction Analysis (for Smart Transfers where balance meta might be ambiguous)
                            if (amount === 0) {
                                // Quick scan of inner instructions for transfers to us
                                const checkIx = (ix: any) => {
                                    // Check for SPL Token Transfer to our ATA
                                    if ((ix.program === 'spl-token' || ix.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') &&
                                        (ix.parsed?.type === 'transfer' || ix.parsed?.type === 'transferChecked')) {

                                        const info = ix.parsed.info;
                                        // If destination is one of our keys
                                        if (myATAKeys.has(info.destination)) {
                                            const val = info.tokenAmount?.uiAmount; // Best case
                                            if (val) {
                                                amount = val;
                                                type = 'Received';

                                                const fallbackSymbol = 'Token'; // Defaults to Token
                                                symbol = fallbackSymbol;

                                                const payerKey = tx.transaction.message.accountKeys[0];
                                                otherSide = payerKey.pubkey ? payerKey.pubkey.toString() : payerKey.toString();
                                            }
                                        }
                                    }
                                };

                                // Scan inner instructions (most likely for Smart Transfer)
                                tx.meta?.innerInstructions?.forEach((inner: any) => inner.instructions.forEach(checkIx));
                            }
                        }

                        return {
                            signature: sig.signature,
                            time: sig.blockTime,
                            type,
                            amount,
                            symbol,
                            otherSide,
                            actionLabel,
                            isSmartRouting,
                            success: !tx?.meta?.err
                        };
                    } catch (e) {
                        return {
                            signature: sig.signature,
                            time: sig.blockTime,
                            type: 'Interaction',
                            amount: 0,
                            symbol: '',
                            otherSide: '',
                            actionLabel: 'Unknown',
                            isSmartRouting: false,
                            success: true
                        };
                    }
                })
            );

            // Batch fetch On-Chain Aliases for unknown senders
            const unknownSenders = new Set<string>();
            detailedHistory.forEach((tx: any) => {
                if (tx.otherSide &&
                    !tx.otherSide.startsWith('ALIAS:') &&
                    !getContactAlias(tx.otherSide)) {
                    try {
                        new PublicKey(tx.otherSide); // Validate address format
                        unknownSenders.add(tx.otherSide);
                    } catch (e) { }
                }
            });

            if (unknownSenders.size > 0) {
                try {
                    const provider = new AnchorProvider(connection, { publicKey: null, signTransaction: () => Promise.reject(), signAllTransactions: () => Promise.reject() } as any, {});
                    const program = new Program(IDL as any, provider);

                    const senders = Array.from(unknownSenders);
                    const aliasMap: Record<string, string> = {};

                    // Use memcmp to find AliasAccount where owner == senderAddr
                    // AliasAccount layout: discriminator (8) + owner (32) + ...
                    // So owner is at offset 8.
                    await Promise.all(senders.map(async (senderAddr) => {
                        try {
                            const accounts = await (program.account as any).aliasAccount.all([
                                { memcmp: { offset: 8, bytes: senderAddr } }
                            ]);
                            if (accounts.length > 0) {
                                aliasMap[senderAddr] = accounts[0].account.alias;
                            }
                        } catch (err) { }
                    }));

                    // Enrich history items
                    detailedHistory.forEach((tx: any) => {
                        if (tx.otherSide && aliasMap[tx.otherSide]) {
                            (tx as any).senderAlias = aliasMap[tx.otherSide];
                        }
                    });
                } catch (err) {
                    console.error("Failed to fetch on-chain aliases:", err);
                }
            }

            // Filter: Show everything for now to debug
            const filteredHistory = detailedHistory;

            setHistory(filteredHistory);

            // Load shared notes for visible transactions only
            const sigList = filteredHistory.map((tx: any) => tx.signature);
            const loadedSharedNotes = await getSharedNotes(sigList);
            setSharedNotes(loadedSharedNotes);


        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setLoading(false);
        }
    }
        , [publicKey, connection]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const getContactAlias = (address: string) => {
        if (!contacts || !address) return null;
        const contact = contacts.find((c: any) => c.address === address);
        return contact ? contact.alias : null;
    };

    const formatTime = (timestamp: number) => {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }).format(date);
    };

    if (loading) {
        return (
            <div className="py-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                {t('loading')}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-2xl text-white">{t('history_title')}</h3>
                    <div className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700 uppercase tracking-widest font-bold">
                        Devnet
                    </div>
                    <button
                        onClick={fetchHistory}
                        disabled={loading}
                        className={`p-2 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-all text-gray-400 hover:text-white ${loading ? 'animate-spin' : ''}`}
                        title="Refresh History"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-gray-800/50 p-1.5 rounded-xl border border-gray-700/50">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-2 hidden sm:inline">Type:</span>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-transparent text-gray-300 text-xs font-bold focus:outline-none cursor-pointer hover:text-white transition-colors"
                        >
                            <option value="All" className="bg-gray-800">All</option>
                            <option value="Received" className="bg-gray-800">Received</option>
                            <option value="Sent" className="bg-gray-800">Sent</option>
                            <option value="Interaction" className="bg-gray-800">Interactions</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-800/50 p-1.5 rounded-xl border border-gray-700/50">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-2 hidden sm:inline">Date:</span>
                        <input
                            type="month"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="bg-transparent text-gray-300 text-xs font-mono focus:outline-none w-auto cursor-pointer hover:text-white transition-colors"
                        />
                        {filterDate && (
                            <button onClick={() => setFilterDate('')} className="text-gray-500 hover:text-red-400 pr-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {history.length === 0 && (
                <div className="text-center py-16 bg-gray-800/30 rounded-3xl border border-dashed border-gray-700">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-gray-400 font-medium">{t('no_history')}</p>
                </div>
            )}

            {history.length > 0 && history.filter(tx => {
                if (filterType !== 'All') {
                    if (filterType === 'Interaction' && (tx.type !== 'Interaction' && tx.type !== 'System')) return false;
                    if (filterType !== 'Interaction' && tx.type !== filterType) return false;
                }
                if (!filterDate) return true;
                const txDate = new Date(tx.time * 1000);
                const [year, month] = filterDate.split('-');
                return txDate.getFullYear() === parseInt(year) && (txDate.getMonth() + 1) === parseInt(month);
            }).map((tx: any, i: number) => {
                const savedNote = notes[tx.signature];
                const sharedNote = sharedNotes[tx.signature];
                const noteContent = savedNote?.note || sharedNote?.note;

                // Resolve Display Name & Metadata
                let typeLabel = tx.type;
                let primaryText = "";

                // Icon Configuration
                let Icon = <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>;
                let amountColor = "text-gray-200";
                let amountPrefix = "";

                if (tx.type === 'Sent') {
                    const rawAlias = getContactAlias(tx.otherSide) || savedNote?.recipient;
                    const cleanAlias = rawAlias ? (rawAlias.startsWith('@') ? rawAlias : `@${rawAlias}`) : null;
                    typeLabel = "Sent Payment";

                    // Check for ALIAS: prefix set in fetchHistory
                    if (tx.otherSide && tx.otherSide.startsWith('ALIAS:')) {
                        const clean = tx.otherSide.replace('ALIAS:', '@');
                        primaryText = `${clean}`;
                    } else {
                        const rawAlias = getContactAlias(tx.otherSide) || savedNote?.recipient;
                        const cleanAlias = rawAlias ? (rawAlias.startsWith('@') ? rawAlias : `@${rawAlias}`) : null;
                        primaryText = cleanAlias ? `${cleanAlias}` : `${tx.otherSide}`;
                    }
                    amountColor = "text-red-400";
                    amountPrefix = "-";
                    Icon = (
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                            <svg className="w-5 h-5 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                        </div>
                    );
                } else if (tx.type === 'Received') {
                    const rawAlias = getContactAlias(tx.otherSide) || sharedNote?.senderAlias || tx.senderAlias;
                    const cleanAlias = rawAlias ? (rawAlias.startsWith('@') ? rawAlias : `@${rawAlias}`) : null;
                    typeLabel = "Received Payment";
                    primaryText = cleanAlias ? `${cleanAlias}` : `${tx.otherSide}`;
                    amountColor = "text-green-400";
                    amountPrefix = "+";
                    Icon = (
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20">
                            <svg className="w-5 h-5 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5M12 5l-7 7 7 7" /></svg>
                        </div>
                    );
                } else if (tx.type === 'System' || tx.type === 'Interaction') {
                    if (tx.actionLabel === 'Unknown' || tx.actionLabel === 'Interaction') {
                        typeLabel = "Contract Interaction";
                        primaryText = "Unik Program";
                    } else {
                        typeLabel = tx.actionLabel;
                        primaryText = "System";
                    }
                    Icon = (
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                    );
                }

                // Calculate amount for Smart Routing
                let amount = tx.amount;
                let isSmartRouting = tx.isSmartRouting;

                // Smart Routing logic was simplified in previous edits but lets restore it properly if needed.
                // Or just use tx.isSmartRouting which backend/hook should provide.
                // Assuming tx object has correct data from simplified fetch logic or hook.
                // Wait, use logic from Step 13381
                if (tx.isSmartRouting && tx.type === 'Interaction') {
                    // We don't have access to full inner parsing here unless I paste it.
                    // But hook returns processed 'orders'.
                    // Actually, parsing logic should be in the LOOP or HOOK, not render.
                    // But previously I put it inside map.
                    // I will restore the inner parsing logic block just in case.
                    if (tx.accountData && tx.accountData.instructions) {
                        let totalLamports = 0;
                        tx.accountData.instructions.forEach((ix: any) => {
                            if (ix.program === 'system' && ix.parsed && ix.parsed.type === 'transfer') {
                                totalLamports += ix.parsed.info.lamports;
                            }
                        });
                        if (totalLamports > 0) amount = totalLamports / 1e9;
                    }
                }

                // Check for Concept
                const isConcept = tx.actionLabel && !['Interaction', 'Payment', 'Smart Transfer', 'Smart Routing', 'Transaction'].includes(tx.actionLabel);
                const displayConcept = isConcept ? tx.actionLabel : null;
                const displayNote = noteContent || displayConcept;

                return (
                    <div key={i} className="flex flex-col bg-[#13131f] border border-gray-800 hover:border-gray-600 rounded-3xl p-5 transition-all group">
                        {/* Header: Icon + Type + Date + Status */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {Icon}
                                <div>
                                    <h4 className="font-bold text-gray-200 text-base">{typeLabel}</h4>
                                    <p className="text-xs text-gray-500 font-medium">{formatTime(tx.time)}</p>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className={`font-bold text-lg ${amountColor} font-mono tracking-tight whitespace-nowrap`}>
                                    {amount > 0 ? (
                                        <span className="flex items-center justify-end gap-1">
                                            {amountPrefix}{amount.toFixed(4)}
                                            <span className="text-xs opacity-70 ml-0.5">{tx.symbol}</span>
                                        </span>
                                    ) : '0 SOL'}
                                </div>
                                <div className="inline-block mt-1">
                                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${tx.success ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                        {tx.success ? 'Confirmed' : 'Failed'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Body: Details with Wrap */}
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
                                    {tx.type === 'Sent' ? 'To' : (tx.type === 'Received' ? 'From' : 'Interact With')}
                                </p>
                                <p className="text-cyan-400 text-sm font-medium break-all leading-relaxed">
                                    {primaryText}
                                </p>
                            </div>

                            {(displayNote || tx.isSmartRouting) && (
                                <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2 items-center">
                                    {displayNote && (
                                        <div className="flex items-center gap-2 text-sm text-gray-300">
                                            <span className="text-gray-500 text-xs uppercase font-bold">Concept:</span>
                                            <span className="italic">"{displayNote}"</span>
                                        </div>
                                    )}

                                    {tx.isSmartRouting && (
                                        <span className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded border border-cyan-500/30 uppercase tracking-wide font-bold shadow-[0_0_10px_rgba(34,211,238,0.1)]">
                                            SPLIT ACTIVE
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer: Explorer */}
                        <div className="flex justify-end mt-3">
                            <a
                                href={`https://solscan.io/tx/${tx.signature}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                            >
                                <span>View Explorer</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                    </div>
                );
            })}

            {/* Explorer Hint */}
            <div className="text-center pt-4">
                <p className="text-xs text-gray-600">
                    Transactions are verified on the Solana Devnet.
                    <a href="https://solscan.io?cluster=devnet" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-cyan-500 ml-1 transition-colors">Solscan</a> is used for details.
                </p>
            </div>
        </div>
    );
}
