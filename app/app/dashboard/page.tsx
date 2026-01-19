'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../utils/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { useConnection } from '@solana/wallet-adapter-react';
import QRCode from "react-qr-code";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Buffer } from 'buffer';
import Image from 'next/image';

type TabType = 'receive' | 'send' | 'splits' | 'alias' | 'contacts' | 'history';

export default function Dashboard() {
    const { publicKey, connected } = useWallet();
    const [activeTab, setActiveTab] = useState<TabType>('receive');
    const [alias, setAlias] = useState('');
    const [loading, setLoading] = useState(false);
    const [registeredAlias, setRegisteredAlias] = useState<string | null>(null);
    const [myAliases, setMyAliases] = useState<string[]>([]);
    const [balance, setBalance] = useState<number | null>(null);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [linkAmount, setLinkAmount] = useState('');
    const [linkConcept, setLinkConcept] = useState('');


    // Send Feature State
    const [sendRecipient, setSendRecipient] = useState('');
    const [sendAlias, setSendAlias] = useState('');
    const [sendAmount, setSendAmount] = useState('');
    const [sendNote, setSendNote] = useState('');
    const [paymentConcept, setPaymentConcept] = useState('');



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
        if (connected && publicKey) {
            connection.getBalance(publicKey).then(b => setBalance(b / 1e9));
            const timer = setInterval(() => {
                connection.getBalance(publicKey).then(b => setBalance(b / 1e9));
            }, 10000);
            return () => clearInterval(timer);
        }
    }, [connected, publicKey, connection]);

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

            const tx = await program.methods
                .registerAlias(normalizedAlias, "https://unik.to/metadata_placeholder")
                .accounts({
                    aliasAccount: aliasPDA,
                    user: publicKey,
                    systemProgram: PublicKey.default,
                })
                .rpc();

            setRegisteredAlias(normalizedAlias);
            setMyAliases([...myAliases, normalizedAlias]);
            setShowRegisterForm(false);
            alert(`Success! Alias @${normalizedAlias} registered on-chain.\nSignature: ${tx}`);
        } catch (error: any) {
            console.error("Error registering:", error);
            let message = "Transaction failed.";
            if (error.message?.includes("User rejected")) message = "Request rejected by user.";
            else if (error.message?.includes("0x1") || error.message?.includes("insufficient funds")) message = "Transaction failed (Insufficient funds?).";

            if (error.logs) {
                if (error.logs.some((l: string) => l.includes("InvalidAliasLength"))) message = "Alias must be 3-32 characters.";
                if (error.logs.some((l: string) => l.includes("InvalidAliasCharacters"))) message = "Alias only allowed a-z, 0-9 and _";
            }

            alert(`Error: ${message}`);
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

            const tx = await program.methods
                .setRouteConfig(normalizedAlias, idlSplits)
                .accounts({
                    routeAccount: routePDA,
                    aliasAccount: aliasPDA,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            alert(`Success! Routing rules saved on-chain.\nSignature: ${tx}`);
            setIsEditing(false);
        } catch (error: any) {
            console.error("Error saving config:", error);
            let message = "Failed to save config.";
            if (error.message?.includes("User rejected")) message = "Rejected by user.";
            alert(`${message} Check console for details.`);
        } finally {
            setLoading(false);
        }
    };

    const totalPercent = splits.reduce((acc, curr) => acc + curr.percent, 0);

    const addSplit = () => {
        if (!newSplitAddress || !newSplitPercent) return;
        const percent = parseInt(newSplitPercent);
        if (isNaN(percent) || percent <= 0 || percent >= 100) return;

        if (totalPercent + percent > 100) {
            alert(`Cannot add split. Total would exceed 100%.`);
            return;
        }

        let currentSplits = [...splits];
        currentSplits.push({ recipient: `Wallet ${currentSplits.length + 1}`, address: newSplitAddress, percent });

        setSplits(currentSplits);
        setNewSplitAddress('');
        setNewSplitPercent('');
        setIsEditing(false);
    };

    const removeSplit = (index: number) => {
        const newSplits = splits.filter((_, i) => i !== index);
        setSplits(newSplits);
    };

    if (!connected) {
        if (!isMounted) return null;

        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white px-4">
                <Image src="/logo-full.png" alt="UNIK" width={300} height={100} className="mb-12" priority />
                <h1 className="text-4xl font-bold mb-4">Welcome to UNIK</h1>
                <p className="text-xl text-gray-400 mb-8 max-w-md text-center">
                    The non-custodial payment router for Solana
                </p>
                <WalletMultiButton />
            </div>
        );
    }

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                    <Image src="/logo-full.png" alt="UNIK" width={120} height={40} priority />
                    <div className="flex items-center gap-4">
                        {balance !== null && (
                            <div className="text-right">
                                <p className="text-xs text-gray-500">Balance</p>
                                <p className="text-lg font-bold">{balance.toFixed(4)} SOL</p>
                            </div>
                        )}
                        <WalletMultiButton />
                    </div>
                </div>
            </nav>

            {/* Main Container */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Wallet Card */}
                <div className="bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 p-6 md:p-8 mb-6 md:mb-8 shadow-2xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 md:mb-6">
                        <div>
                            <p className="text-xs md:text-sm text-white/70 mb-1">Your UNIK Alias</p>
                            <h2 className="text-2xl md:text-4xl font-bold">@{registeredAlias || 'not-set'}</h2>
                        </div>
                        <Image src="/logo-icon.png" alt="UNIK" width={50} height={50} className="md:w-[60px] md:h-[60px]" />
                    </div>

                    {myAliases.length > 1 && (
                        <select
                            value={registeredAlias || ''}
                            onChange={(e) => setRegisteredAlias(e.target.value)}
                            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-semibold border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                            {myAliases.map(a => <option key={a} value={a} className="text-black">@{a}</option>)}
                        </select>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 md:gap-4 mb-8">
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

                {/* Content Area */}
                <div className="bg-gray-900 p-4 md:p-8 border border-gray-800">
                    {activeTab === 'receive' && <ReceiveTab registeredAlias={registeredAlias} linkAmount={linkAmount} setLinkAmount={setLinkAmount} linkConcept={linkConcept} setLinkConcept={setLinkConcept} />}
                    {activeTab === 'send' && <SendTab sendRecipient={sendRecipient} setSendRecipient={setSendRecipient} sendAlias={sendAlias} setSendAlias={setSendAlias} sendAmount={sendAmount} setSendAmount={setSendAmount} sendNote={sendNote} setSendNote={setSendNote} paymentConcept={paymentConcept} setPaymentConcept={setPaymentConcept} loading={loading} setLoading={setLoading} publicKey={publicKey} wallet={wallet} connection={connection} />}
                    {activeTab === 'splits' && <SplitsTab splits={splits} setSplits={setSplits} isEditing={isEditing} setIsEditing={setIsEditing} newSplitAddress={newSplitAddress} setNewSplitAddress={setNewSplitAddress} newSplitPercent={newSplitPercent} setNewSplitPercent={setNewSplitPercent} addSplit={addSplit} removeSplit={removeSplit} totalPercent={totalPercent} handleSaveConfig={handleSaveConfig} loading={loading} />}
                    {activeTab === 'alias' && <AliasTab myAliases={myAliases} showRegisterForm={showRegisterForm} setShowRegisterForm={setShowRegisterForm} alias={alias} setAlias={setAlias} handleRegister={handleRegister} loading={loading} setRegisteredAlias={setRegisteredAlias} />}
                    {activeTab === 'contacts' && <ContactsTab setSendRecipient={setSendRecipient} setSendAlias={setSendAlias} setSendNote={setSendNote} setActiveTab={setActiveTab} loading={loading} setLoading={setLoading} connection={connection} wallet={wallet} />}
                    {activeTab === 'history' && <HistoryTab publicKey={publicKey} connection={connection} />}
                </div>
            </div>
        </div>
    );
}

function ActionButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
    const icons: Record<string, React.ReactElement> = {
        receive: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
        ),
        send: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
        ),
        splits: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
        ),
        alias: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
        ),
        contacts: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
        history: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    };

    return (
        <button
            onClick={onClick}
            className={`p-4 md:p-5 font-semibold transition-all ${active
                ? 'bg-gradient-to-br from-cyan-500 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700 hover:border-gray-600'
                }`}
        >
            <div className="flex flex-col items-center gap-2">
                <div className={active ? 'text-white' : 'text-gray-400'}>
                    {icons[icon] || icons.receive}
                </div>
                <div className="text-xs md:text-sm whitespace-nowrap">{label}</div>
            </div>
        </button>
    );
}

function ReceiveTab({ registeredAlias, linkAmount, setLinkAmount, linkConcept, setLinkConcept }: any) {
    const getPaymentUrl = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        let url = `${origin}/pay/${registeredAlias}?`;
        if (linkAmount) url += `amount=${linkAmount}&`;
        if (linkConcept) url += `concept=${encodeURIComponent(linkConcept)}`;
        return url.endsWith('?') ? url.slice(0, -1) : url.endsWith('&') ? url.slice(0, -1) : url;
    };

    const getShareMessage = () => {
        const amount = linkAmount ? ` ${linkAmount} SOL` : '';
        return `💸 Pay me${amount} via UNIK: ${getPaymentUrl()}`;
    };

    return (
        <div>
            <h3 className="text-2xl font-bold mb-6">Receive Payments</h3>

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
                    <span className="text-lg font-bold text-gray-400">SOL</span>
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
                        {typeof window !== 'undefined' ? window.location.host : 'unik.app'}/pay/{registeredAlias}{linkAmount ? `?amount=${linkAmount}` : ''}
                    </code>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(getPaymentUrl());
                            alert("Link copied to clipboard!");
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 font-semibold transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                    </button>

                    <button
                        onClick={() => {
                            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(getShareMessage())}`;
                            window.open(whatsappUrl, '_blank');
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 font-semibold transition-colors"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp
                    </button>

                    <button
                        onClick={() => {
                            const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(getPaymentUrl())}&text=${encodeURIComponent(`💸 Pay me${linkAmount ? ` ${linkAmount} SOL` : ''} via UNIK`)}`;
                            window.open(telegramUrl, '_blank');
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 font-semibold transition-colors"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                        </svg>
                        Telegram
                    </button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-700">
                    <label className="text-sm text-gray-400 block mb-3">Share Your Contact</label>
                    <p className="text-xs text-gray-500 mb-3">Let others add you to their UNIK contacts instantly</p>
                    <button
                        onClick={() => {
                            const contactUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/add-contact/${registeredAlias}`;
                            navigator.clipboard.writeText(contactUrl);
                            alert("Contact link copied! Share it so others can add you.");
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 font-semibold transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share My Contact (@{registeredAlias})
                    </button>
                </div>
            </div>
        </div>
    );
}

function SendTab({ sendRecipient, setSendRecipient, sendAlias, setSendAlias, sendAmount, setSendAmount, sendNote, setSendNote, paymentConcept, setPaymentConcept, loading, setLoading, publicKey, wallet, connection }: any) {
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        if (scanning) {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                /* verbose= */ false
            );

            scanner.render((decodedText) => {
                console.log("Scanned:", decodedText);
                try {
                    // Handle URL format: domain/pay/alias?amount=X&concept=Y
                    if (decodedText.includes('/pay/')) {
                        const url = new URL(decodedText);
                        const pathParts = url.pathname.split('/');
                        const aliasIndex = pathParts.indexOf('pay') + 1;
                        if (aliasIndex < pathParts.length) {
                            const alias = pathParts[aliasIndex];
                            setSendRecipient(`@${alias}`);
                            setSendAlias(alias);

                            const amount = url.searchParams.get('amount');
                            if (amount) setSendAmount(amount);

                            const concept = url.searchParams.get('concept');
                            if (concept) setSendNote(concept);
                        }
                    } else {
                        // Assume it's a direct address or alias
                        setSendRecipient(decodedText);
                        setSendAlias('');
                    }
                    scanner.clear();
                    setScanning(false);
                } catch (e) {
                    console.error("Error parsing QR", e);
                    alert("Invalid QR Code format");
                    scanner.clear();
                    setScanning(false);
                }
            }, (error) => {
                // console.warn(error);
            });

            return () => {
                scanner.clear().catch(e => console.error("Failed to clear scanner", e));
            };
        }
    }, [scanning]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Send SOL</h3>
                <button
                    onClick={() => setScanning(!scanning)}
                    className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-900/30 px-3 py-1.5 rounded-lg transition-colors border border-cyan-500/30"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    {scanning ? 'Cancel Scan' : 'Scan QR'}
                </button>
            </div>

            {scanning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-sm border border-gray-700 shadow-2xl relative">
                        <button
                            onClick={() => setScanning(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h4 className="text-xl font-bold mb-4 text-center">Scan Payment QR</h4>
                        <div id="reader" className="overflow-hidden rounded-lg"></div>
                        <p className="text-center text-xs text-gray-500 mt-4">Point your camera at a UNIK payment QR code</p>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <label className="text-sm text-gray-400 block mb-2">Recipient</label>
                    {sendAlias && (
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <span className="text-sm text-cyan-400 font-bold">@{sendAlias}</span>
                                {sendNote && <span className="text-xs text-gray-500 ml-2 italic">"{sendNote}"</span>}
                            </div>
                            <button onClick={() => { setSendAlias(''); setSendRecipient(''); setSendNote(''); }} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                        </div>
                    )}
                    <input
                        type="text"
                        placeholder="Solana Address or Alias"
                        value={sendRecipient}
                        onChange={(e) => { setSendRecipient(e.target.value); setSendAlias(''); setSendNote(''); }}
                        className="w-full px-4 py-4 bg-gray-800 rounded-xl text-white border border-gray-700 font-mono text-sm focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <div>
                    <label className="text-sm text-gray-400 block mb-2">Amount (SOL)</label>
                    <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className="w-full px-4 py-4 bg-gray-800 rounded-xl text-white text-2xl font-bold border border-gray-700 focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <div>
                    <label className="text-sm text-gray-400 block mb-2">Payment Concept (optional, off-chain)</label>
                    <input
                        type="text"
                        placeholder="What's this for?"
                        value={paymentConcept}
                        onChange={(e) => setPaymentConcept(e.target.value)}
                        className="w-full px-4 py-4 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <button
                    onClick={async () => {
                        if (!sendRecipient || !sendAmount || !publicKey || !wallet) return;
                        setLoading(true);
                        try {
                            const provider = new AnchorProvider(connection, wallet as any, {});
                            const program = new Program(IDL as any, provider);
                            const amountLamportsBN = new BN(Math.floor(parseFloat(sendAmount) * 1e9));

                            // intelligent routing logic
                            let targetAlias = sendAlias;
                            if (!targetAlias && sendRecipient.startsWith('@')) {
                                targetAlias = sendRecipient.substring(1);
                            } else if (!targetAlias && !sendRecipient.startsWith('@') && sendRecipient.length < 32) {
                                // could be an alias typed without @
                                targetAlias = sendRecipient;
                            }

                            if (targetAlias) {
                                targetAlias = targetAlias.toLowerCase().trim();
                                console.log("Attempting routed transfer for alias:", targetAlias);

                                try {
                                    const [routePDA] = PublicKey.findProgramAddressSync(
                                        [Buffer.from("route"), Buffer.from(targetAlias)],
                                        PROGRAM_ID
                                    );

                                    const routeAccount: any = await (program.account as any).routeAccount.fetch(routePDA);

                                    if (routeAccount && routeAccount.splits && routeAccount.splits.length > 0) {
                                        console.log("Found routing rules, executing intelligent transfer...");

                                        const remainingAccounts = routeAccount.splits.map((s: any) => ({
                                            pubkey: s.recipient,
                                            isSigner: false,
                                            isWritable: true
                                        }));

                                        const signature = await (program.methods as any)
                                            .executeTransfer(targetAlias, amountLamportsBN)
                                            .accounts({
                                                routeAccount: routePDA,
                                                user: publicKey,
                                                systemProgram: SystemProgram.programId,
                                            })
                                            .remainingAccounts(remainingAccounts)
                                            .rpc();

                                        alert(`Intelligent Routing Success!\n${sendAmount} SOL split according to @${targetAlias}'s rules.${paymentConcept ? `\nConcept: ${paymentConcept}` : ''}\nSig: ${signature}`);
                                        setSendAmount('');
                                        setPaymentConcept('');
                                        setLoading(false);
                                        return;
                                    }
                                } catch (e) {
                                    console.log("No routing rules found or alias invalid, checking alias owner...");
                                    try {
                                        const [aliasPDA] = PublicKey.findProgramAddressSync(
                                            [Buffer.from("alias"), Buffer.from(targetAlias)],
                                            PROGRAM_ID
                                        );
                                        const aliasAccount: any = await (program.account as any).aliasAccount.fetch(aliasPDA);

                                        // Fallback to direct transfer to owner
                                        const transaction = new Transaction().add(
                                            SystemProgram.transfer({
                                                fromPubkey: publicKey,
                                                toPubkey: aliasAccount.owner,
                                                lamports: amountLamportsBN.toNumber(),
                                            })
                                        );

                                        const signature = await wallet.sendTransaction(transaction, connection);
                                        await connection.confirmTransaction(signature, 'confirmed');

                                        alert(`Sent ${sendAmount} SOL to @${targetAlias} (${aliasAccount.owner.toBase58()})${paymentConcept ? `\nConcept: ${paymentConcept}` : ''}`);
                                        setSendAmount('');
                                        setPaymentConcept('');
                                        setLoading(false);
                                        return;
                                    } catch (err) {
                                        console.error("Alias resolution failed", err);
                                        throw new Error(`Could not resolve alias @${targetAlias}`);
                                    }
                                }
                            }

                            // Standard Direct Transfer (for plain addresses)
                            console.log("Executing standard direct transfer...");
                            const transaction = new Transaction().add(
                                SystemProgram.transfer({
                                    fromPubkey: publicKey,
                                    toPubkey: new PublicKey(sendRecipient),
                                    lamports: amountLamportsBN.toNumber(),
                                })
                            );

                            const signature = await wallet.sendTransaction(transaction, connection);
                            const latestBlockhash = await connection.getLatestBlockhash();
                            await connection.confirmTransaction({
                                signature,
                                blockhash: latestBlockhash.blockhash,
                                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                            });

                            alert(`Successfully sent ${sendAmount} SOL!${paymentConcept ? `\nConcept: ${paymentConcept}` : ''}\nSignature: ${signature}`);
                            setSendAmount('');
                            setPaymentConcept('');
                        } catch (e: any) {
                            alert(`Send failed: ${e.message}`);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading || !sendRecipient || !sendAmount}
                    className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                >
                    {loading ? 'Sending...' : 'Send SOL Now'}
                </button>
            </div>
        </div>
    );
}

function SplitsTab({ splits, setSplits, isEditing, setIsEditing, newSplitAddress, setNewSplitAddress, newSplitPercent, setNewSplitPercent, addSplit, removeSplit, totalPercent, handleSaveConfig, loading }: any) {
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
                            <button onClick={() => removeSplit(idx)} className="text-red-400 hover:text-red-300 text-2xl">×</button>
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

function ContactsTab({ setSendRecipient, setSendAlias, setSendNote, setActiveTab, loading, setLoading, connection, wallet }: any) {
    const [contacts, setContacts] = useState<any[]>([]);
    const [newContactAlias, setNewContactAlias] = useState('');
    const [filter, setFilter] = useState('recent');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAll, setShowAll] = useState(false);

    const loadContacts = () => {
        try {
            const raw = localStorage.getItem('unik_contacts');
            if (raw) setContacts(JSON.parse(raw));
        } catch (e) {
            console.error("Failed to load contacts", e);
        }
    };

    useEffect(() => {
        loadContacts();
        const listener = () => loadContacts();
        window.addEventListener('storage', listener);
        return () => window.removeEventListener('storage', listener);
    }, []);

    const filteredContacts = contacts.filter(c =>
        c.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.note && c.note.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedContacts = [...filteredContacts].sort((a, b) => {
        if (filter === 'alpha') return a.alias.localeCompare(b.alias);
        if (filter === 'notes') {
            const aNote = a.note ? 1 : 0;
            const bNote = b.note ? 1 : 0;
            if (aNote !== bNote) return bNote - aNote;
            return a.alias.localeCompare(b.alias);
        }
        return (b.addedAt || 0) - (a.addedAt || 0); // recent
    });

    const displayedContacts = showAll ? sortedContacts : sortedContacts.slice(0, 4);

    const addContact = async () => {
        if (!newContactAlias) return;
        setLoading(true);

        try {
            const provider = new AnchorProvider(connection, wallet as any, {});
            const program = new Program(IDL as any, provider);

            const [aliasPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("alias"), Buffer.from(newContactAlias.toLowerCase())],
                PROGRAM_ID
            );

            const account = await (program.account as any).aliasAccount.fetch(aliasPDA);

            const newContact = {
                alias: newContactAlias.toLowerCase(),
                address: account.owner.toBase58(),
                note: '',
                addedAt: Date.now()
            };

            const existing = JSON.parse(localStorage.getItem('unik_contacts') || '[]');
            if (existing.some((c: any) => c.alias === newContactAlias.toLowerCase())) {
                alert("Contact already exists!");
                setLoading(false);
                return;
            }

            const updated = [...existing, newContact];
            localStorage.setItem('unik_contacts', JSON.stringify(updated));
            window.dispatchEvent(new Event('storage'));
            setNewContactAlias('');
            alert(`Added @${newContactAlias} to contacts!`);
        } catch (e) {
            alert(`Could not find alias "@${newContactAlias}". Make sure it is registered.`);
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
                        placeholder="Enter alias (e.g. alice)"
                        value={newContactAlias}
                        onChange={(e) => setNewContactAlias(e.target.value.toLowerCase())}
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
                        {displayedContacts.map((c: any, i: number) => (
                            <div key={i} className="group flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-cyan-500/50 hover:bg-gray-750 transition-all duration-300 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-cyan-500/20">
                                        {c.alias[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-lg flex items-center gap-1">
                                            @{c.alias}
                                        </p>
                                        {c.note ? (
                                            <p className="text-xs text-gray-400 truncate italic bg-gray-900/50 px-2 py-0.5 rounded border border-gray-700/50 inline-block mb-1">
                                                "{c.note}"
                                            </p>
                                        ) : null}
                                        <p className="text-[10px] text-gray-500 font-mono tracking-tighter opacity-60 group-hover:opacity-100 transition-opacity">
                                            {c.address.slice(0, 10)}...{c.address.slice(-10)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            const note = prompt(`Note for @${c.alias}:`, c.note || '');
                                            if (note !== null) {
                                                const updated = contacts.map((x: any) => x.alias === c.alias ? { ...x, note: note.trim() } : x);
                                                localStorage.setItem('unik_contacts', JSON.stringify(updated));
                                                window.dispatchEvent(new Event('storage'));
                                            }
                                        }}
                                        className="p-2.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors border border-gray-600/50 shadow-sm"
                                        title="Edit note"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSendRecipient(c.address);
                                            setSendAlias(c.alias);
                                            setSendNote(c.note || '');
                                            setActiveTab('send');
                                        }}
                                        className="px-5 py-2.5 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600 hover:to-blue-600 text-cyan-400 hover:text-white font-bold text-sm rounded-lg border border-cyan-500/30 transition-all shadow-lg active:scale-95"
                                    >
                                        Pay
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm(`Delete @${c.alias} from contacts?`)) {
                                                const updated = contacts.filter((x: any) => x.alias !== c.alias);
                                                localStorage.setItem('unik_contacts', JSON.stringify(updated));
                                                window.dispatchEvent(new Event('storage'));
                                            }
                                        }}
                                        className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Delete contact"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
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

function HistoryTab({ publicKey, connection }: any) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
            } catch (e) {
                console.error("Failed to fetch history", e);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [publicKey, connection]);

    if (loading) {
        return (
            <div className="py-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                <p>Loading transaction history...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Recent History</h3>
                <button
                    onClick={() => { setLoading(true); window.location.reload(); }}
                    className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold"
                >
                    Refresh
                </button>
            </div>

            <div className="space-y-3">
                {history.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">No transactions found.</p>
                ) : (
                    history.map((tx: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-10 h-10 flex items-center justify-center text-xl ${tx.type === 'Received' ? 'text-green-500 bg-green-500/10' :
                                    tx.type === 'Sent' ? 'text-red-500 bg-red-500/10' : 'text-cyan-500 bg-cyan-500/10'
                                    }`}>
                                    {tx.type === 'Received' ? '↙' : tx.type === 'Sent' ? '↗' : '⚙'}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold truncate">{tx.type}</p>
                                        {!tx.success && <span className="text-[10px] bg-red-500 text-white px-1 uppercase leading-none py-0.5">Failed</span>}
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono">
                                        {tx.time ? new Date(tx.time * 1000).toLocaleDateString() + ' ' + new Date(tx.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending...'}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right ml-4">
                                {tx.amount > 0 && (
                                    <p className={`font-bold ${tx.type === 'Received' ? 'text-green-400' : 'text-red-400'}`}>
                                        {tx.type === 'Received' ? '+' : '-'}{tx.amount.toFixed(4)} SOL
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
                    ))
                )}
            </div>
        </div>
    );
}
