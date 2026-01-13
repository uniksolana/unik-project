'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../utils/anchor';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useConnection } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer';
import Image from 'next/image';

type TabType = 'receive' | 'send' | 'splits' | 'alias' | 'contacts';

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

    // Send Feature State
    const [sendRecipient, setSendRecipient] = useState('');
    const [sendAlias, setSendAlias] = useState('');
    const [sendAmount, setSendAmount] = useState('');

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
                <div className="bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 rounded-3xl p-8 mb-8 shadow-2xl">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-sm text-white/70 mb-1">Your UNIK Alias</p>
                            <h2 className="text-4xl font-bold">@{registeredAlias || 'not-set'}</h2>
                        </div>
                        <Image src="/logo-icon.png" alt="UNIK" width={60} height={60} />
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
                <div className="grid grid-cols-5 gap-4 mb-8">
                    <ActionButton
                        icon="📥"
                        label="Receive"
                        active={activeTab === 'receive'}
                        onClick={() => setActiveTab('receive')}
                    />
                    <ActionButton
                        icon="📤"
                        label="Send"
                        active={activeTab === 'send'}
                        onClick={() => setActiveTab('send')}
                    />
                    <ActionButton
                        icon="🔀"
                        label="Splits"
                        active={activeTab === 'splits'}
                        onClick={() => setActiveTab('splits')}
                    />
                    <ActionButton
                        icon="🎯"
                        label="Alias"
                        active={activeTab === 'alias'}
                        onClick={() => setActiveTab('alias')}
                    />
                    <ActionButton
                        icon="👥"
                        label="Contacts"
                        active={activeTab === 'contacts'}
                        onClick={() => setActiveTab('contacts')}
                    />
                </div>

                {/* Content Area */}
                <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
                    {activeTab === 'receive' && <ReceiveTab registeredAlias={registeredAlias} linkAmount={linkAmount} setLinkAmount={setLinkAmount} />}
                    {activeTab === 'send' && <SendTab sendRecipient={sendRecipient} setSendRecipient={setSendRecipient} sendAlias={sendAlias} setSendAlias={setSendAlias} sendAmount={sendAmount} setSendAmount={setSendAmount} loading={loading} setLoading={setLoading} publicKey={publicKey} wallet={wallet} connection={connection} />}
                    {activeTab === 'splits' && <SplitsTab splits={splits} setSplits={setSplits} isEditing={isEditing} setIsEditing={setIsEditing} newSplitAddress={newSplitAddress} setNewSplitAddress={setNewSplitAddress} newSplitPercent={newSplitPercent} setNewSplitPercent={setNewSplitPercent} addSplit={addSplit} removeSplit={removeSplit} totalPercent={totalPercent} handleSaveConfig={handleSaveConfig} loading={loading} />}
                    {activeTab === 'alias' && <AliasTab myAliases={myAliases} showRegisterForm={showRegisterForm} setShowRegisterForm={setShowRegisterForm} alias={alias} setAlias={setAlias} handleRegister={handleRegister} loading={loading} setRegisteredAlias={setRegisteredAlias} />}
                    {activeTab === 'contacts' && <ContactsTab setSendRecipient={setSendRecipient} setSendAlias={setSendAlias} setActiveTab={setActiveTab} loading={loading} setLoading={setLoading} connection={connection} wallet={wallet} />}
                </div>
            </div>
        </div>
    );
}

function ActionButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`p-6 rounded-2xl font-semibold transition-all transform hover:scale-105 ${active
                    ? 'bg-gradient-to-br from-cyan-500 to-purple-500 text-white shadow-lg shadow-purple-500/50'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                }`}
        >
            <div className="text-3xl mb-2">{icon}</div>
            <div className="text-sm">{label}</div>
        </button>
    );
}

function ReceiveTab({ registeredAlias, linkAmount, setLinkAmount }: any) {
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

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <label className="text-sm text-gray-400 block mb-2">Your Payment Link</label>
                <div className="flex gap-3">
                    <code className="flex-1 p-4 bg-black rounded-lg text-cyan-400 font-mono text-sm truncate border border-gray-700">
                        {typeof window !== 'undefined' ? window.location.host : 'unik.app'}/pay/{registeredAlias}{linkAmount ? `?amount=${linkAmount}` : ''}
                    </code>
                    <button
                        onClick={() => {
                            const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                            const url = `${origin}/pay/${registeredAlias}${linkAmount ? `?amount=${linkAmount}` : ''}`;
                            navigator.clipboard.writeText(url);
                            alert("Link copied to clipboard!");
                        }}
                        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-xl font-bold transition-colors"
                    >
                        Copy
                    </button>
                </div>
            </div>
        </div>
    );
}

function SendTab({ sendRecipient, setSendRecipient, sendAlias, setSendAlias, sendAmount, setSendAmount, loading, setLoading, publicKey, wallet, connection }: any) {
    return (
        <div>
            <h3 className="text-2xl font-bold mb-6">Send SOL</h3>

            <div className="space-y-6">
                <div>
                    <label className="text-sm text-gray-400 block mb-2">Recipient</label>
                    {sendAlias && (
                        <div className="flex justify-between items-center mb-2 text-sm text-cyan-400 font-bold">
                            <span>@{sendAlias}</span>
                            <button onClick={() => { setSendAlias(''); setSendRecipient(''); }} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                        </div>
                    )}
                    <input
                        type="text"
                        placeholder="Solana Address or Alias"
                        value={sendRecipient}
                        onChange={(e) => { setSendRecipient(e.target.value); setSendAlias(''); }}
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

                <button
                    onClick={async () => {
                        if (!sendRecipient || !sendAmount || !publicKey || !wallet) return;
                        setLoading(true);
                        try {
                            const amountLamports = parseFloat(sendAmount) * 1e9;
                            const transaction = new Transaction().add(
                                SystemProgram.transfer({
                                    fromPubkey: publicKey,
                                    toPubkey: new PublicKey(sendRecipient),
                                    lamports: Math.floor(amountLamports),
                                })
                            );

                            const signature = await wallet.sendTransaction(transaction, connection);
                            const latestBlockhash = await connection.getLatestBlockhash();
                            await connection.confirmTransaction({
                                signature,
                                blockhash: latestBlockhash.blockhash,
                                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                            });

                            alert(`Successfully sent ${sendAmount} SOL!\nSignature: ${signature}`);
                            setSendAmount('');
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

function ContactsTab({ setSendRecipient, setSendAlias, setActiveTab, loading, setLoading, connection, wallet }: any) {
    const [contacts, setContacts] = useState<any[]>([]);
    const [newContactAlias, setNewContactAlias] = useState('');

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
            <h3 className="text-2xl font-bold mb-6">My Contacts</h3>

            <div className="mb-6 bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h4 className="font-semibold mb-3">Add New Contact</h4>
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Enter alias (e.g. alice)"
                        value={newContactAlias}
                        onChange={(e) => setNewContactAlias(e.target.value.toLowerCase())}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                        onClick={addContact}
                        disabled={loading}
                        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-xl font-bold disabled:opacity-50 transition-colors"
                    >
                        {loading ? '...' : 'Add'}
                    </button>
                </div>
            </div>

            {contacts.length === 0 ? (
                <p className="text-center text-gray-500 py-12">No contacts yet. Add your first one!</p>
            ) : (
                <div className="space-y-3">
                    {contacts.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-cyan-500 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white text-lg font-bold">
                                    {c.alias[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-lg">@{c.alias}</p>
                                    <p className="text-xs text-gray-400 font-mono">{c.address.slice(0, 4)}...{c.address.slice(-4)}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setSendRecipient(c.address);
                                        setSendAlias(c.alias);
                                        setActiveTab('send');
                                    }}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-xl font-semibold text-sm transition-colors"
                                >
                                    Pay
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm("Delete contact?")) {
                                            const updated = contacts.filter(x => x.alias !== c.alias);
                                            localStorage.setItem('unik_contacts', JSON.stringify(updated));
                                            window.dispatchEvent(new Event('storage'));
                                        }
                                    }}
                                    className="text-gray-400 hover:text-red-400 text-xl px-2"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
