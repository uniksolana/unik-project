'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../utils/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { useConnection } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer'; // Required for Buffer.from

export default function Dashboard() {
    const { publicKey, connected } = useWallet();
    const [alias, setAlias] = useState('');
    const [loading, setLoading] = useState(false);
    const [registeredAlias, setRegisteredAlias] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);

    // Constants
    const { connection } = useConnection();
    const wallet = useWallet(); // Get full wallet context for provider

    // Fix hydration error
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (connected && publicKey) {
            connection.getBalance(publicKey).then(b => setBalance(b / 1e9));
            const timer = setInterval(() => {
                connection.getBalance(publicKey).then(b => setBalance(b / 1e9));
            }, 10000);
            return () => clearInterval(timer);
        }
    }, [connected, publicKey, connection]);

    // Dashboard State (Moved up to fix hook ordering)
    const [splits, setSplits] = useState([{ recipient: 'Primary Wallet (You)', address: publicKey?.toBase58(), percent: 100 }]);
    const [isEditing, setIsEditing] = useState(false);
    const [newSplitAddress, setNewSplitAddress] = useState('');
    const [newSplitPercent, setNewSplitPercent] = useState('');

    // Update primary wallet address when connected
    useEffect(() => {
        if (publicKey && splits.length === 1 && splits[0].address !== publicKey.toBase58()) {
            setSplits([{ recipient: 'Primary Wallet (You)', address: publicKey.toBase58(), percent: 100 }]);
        }
    }, [publicKey]);

    const handleRegister = async () => {
        if (!alias || !publicKey || !wallet) return;
        setLoading(true);
        try {
            // 1. Setup Provider
            const provider = new AnchorProvider(connection, wallet as any, {});

            // 2. Setup Program
            const program = new Program(IDL as any, provider);

            // 3. Derive PDA
            // Normalization: Ensure lowercase for consistency with contract
            const normalizedAlias = alias.toLowerCase().trim();

            const [aliasPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("alias"), Buffer.from(normalizedAlias)],
                PROGRAM_ID
            );

            console.log("Registering alias:", normalizedAlias, "PDA:", aliasPDA.toBase58());

            // 4. Send Transaction
            const tx = await program.methods
                .registerAlias(normalizedAlias, "https://unik.to/metadata_placeholder")
                .accounts({
                    aliasAccount: aliasPDA,
                    user: publicKey,
                    systemProgram: PublicKey.default,
                })
                .rpc();

            console.log("Transaction signature", tx);
            setRegisteredAlias(normalizedAlias);
            alert(`Success! Alias @${normalizedAlias} registered on-chain.\nSignature: ${tx}`);

        } catch (error: any) {
            console.error("Error registering:", error);

            let message = "Transaction failed.";
            if (error.message?.includes("User rejected")) {
                message = "Request rejected by user.";
            } else if (error.message?.includes("0x1") || error.message?.includes("insufficient funds")) {
                message = "Transaction failed (Insufficient funds?).";
            }

            if (error.logs) {
                console.log("On-chain logs:", error.logs);
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

            // Convert frontend splits to IDL format (Recipient Pubkey + Bps)
            const idlSplits = splits.map(s => ({
                recipient: new PublicKey(s.address!),
                percentage: s.percent * 100 // 100% -> 10000 bps
            }));

            console.log("Saving route config to PDA:", routePDA.toBase58());

            const tx = await program.methods
                .setRouteConfig(normalizedAlias, idlSplits)
                .accounts({
                    routeAccount: routePDA,
                    aliasAccount: aliasPDA,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Route config saved. Tx:", tx);
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

    if (!connected) {
        // Return conditional UI but component logic runs first
        if (!isMounted) return null; // Ensure no hydration mismatch for this too

        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center text-white px-4">
                <h1 className="text-4xl font-bold mb-8">Access Your Dashboard</h1>
                <p className="text-xl text-gray-300 mb-8 max-w-md text-center">
                    Connect your Solana wallet to manage your aliases and routing rules.
                </p>
                <WalletMultiButton />
            </div>
        );
    }

    const totalPercent = splits.reduce((acc, curr) => acc + curr.percent, 0);

    const addSplit = () => {
        if (!newSplitAddress || !newSplitPercent) return;
        const percent = parseInt(newSplitPercent);
        if (isNaN(percent) || percent <= 0 || percent >= 100) return;

        // Auto-adjust primary wallet calculation
        // Strategy: Subtract from the first wallet (Primary) if it has enough
        // Otherwise, just add and let user fix (but user reported stuck state, so better to enforce valid state)

        let currentSplits = [...splits];
        let primaryWallet = currentSplits[0]; // Assuming first is primary

        if (primaryWallet.percent > percent) {
            // Deduct from primary
            currentSplits[0] = { ...primaryWallet, percent: primaryWallet.percent - percent };
            // Add new
            currentSplits.push({ recipient: `Wallet ${currentSplits.length + 1}`, address: newSplitAddress, percent });

            setSplits(currentSplits);
            setNewSplitAddress('');
            setNewSplitPercent('');
            setIsEditing(false);
        } else {
            alert("Not enough percentage available in Primary Wallet to allocate. Reduce others first.");
        }
    };

    const removeSplit = (index: number) => {
        // When removing, add back to primary wallet logic?
        // Or just remove and let total < 100
        // Better UX: Add back to primary

        const splitToRemove = splits[index];
        const newSplits = splits.filter((_, i) => i !== index);

        // Add back to first wallet (Primary)
        if (newSplits.length > 0) {
            newSplits[0].percent += splitToRemove.percent;
        }

        setSplits(newSplits);
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
            <nav className="bg-white dark:bg-slate-800 shadow-sm">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">🧠 UNIK Dashboard</div>
                    <div className="flex items-center gap-4">
                        {registeredAlias && <span className="text-sm font-bold text-slate-700 dark:text-gray-300">@{registeredAlias}</span>}
                        <WalletMultiButton />
                    </div>
                </div>
            </nav>
            {balance !== null && balance < 0.01 && (
                <div className="bg-amber-100 border-b border-amber-200 py-2 px-4 text-amber-800 text-sm flex items-center justify-center gap-2">
                    ⚠️ <b>Low Balance:</b> You have {balance.toFixed(4)} SOL. You need Devnet SOL to register or save configs.
                </div>
            )}

            <main className="container mx-auto px-4 py-8">
                {!registeredAlias ? (
                    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Register Your UNIK Alias</h2>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={alias}
                                    onChange={(e) => {
                                        // Enforce client-side normalization for better UX
                                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                                        setAlias(val);
                                    }}
                                    placeholder="Enter desired alias (e.g. david)"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <p className="text-sm text-gray-500 mt-2">Maximum 32 characters. Lowercase alphanumeric only.</p>
                            </div>
                            <button
                                onClick={handleRegister}
                                disabled={loading || !alias}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors h-fit flex items-center gap-2"
                            >
                                {loading ? 'Minting...' : 'Register'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 h-fit">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Your Identity</h3>
                            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-6">
                                <div>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Active Alias</p>
                                    <p className="text-2xl font-bold text-slate-800 dark:text-white">@{registeredAlias}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">Routing Status</p>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${totalPercent === 100 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {totalPercent === 100 ? 'Active' : 'Invalid Config'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                <h4 className="text-sm font-semibold text-gray-500 mb-2">My Payment Link (Local)</h4>
                                <div className="flex bg-white dark:bg-slate-900 p-2 rounded border border-gray-200 dark:border-slate-600">
                                    <code className="flex-1 text-sm pt-1 text-gray-600 dark:text-gray-300 truncate">localhost:3000/pay/{registeredAlias}</code>
                                    <button
                                        className="text-xs text-blue-600 font-bold uppercase tracking-wider hover:text-blue-800"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`http://localhost:3000/pay/${registeredAlias}`);
                                            alert("Link copied to clipboard! (Share this URL to get paid)");
                                        }}
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Routing Rules</h3>
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    {isEditing ? 'Cancel' : '+ Add Split'}
                                </button>
                            </div>

                            <div className="space-y-4">
                                {splits.map((split, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-sm font-bold">
                                                {idx + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-800 dark:text-white truncate">{split.recipient}</p>
                                                <p className="text-xs text-gray-400 font-mono truncate" title={split.address}>
                                                    {split.address?.slice(0, 6)}...{split.address?.slice(-6)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-slate-800 dark:text-white">{split.percent}%</span>
                                            {idx > 0 && <button onClick={() => removeSplit(idx)} className="text-red-400 hover:text-red-600">×</button>}
                                        </div>
                                    </div>
                                ))}

                                {splits.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No routing rules set.</p>}

                                {isEditing && (
                                    <div className="p-4 bg-gray-50 dark:bg-slate-700/30 rounded-lg border border-dashed border-blue-200 dark:border-blue-900">
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">Add New Recipient</h4>
                                        <input
                                            className="w-full mb-2 px-3 py-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                            placeholder="Solana Wallet Address"
                                            value={newSplitAddress}
                                            onChange={(e) => setNewSplitAddress(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                className="w-24 px-3 py-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                                placeholder="%"
                                                type="number"
                                                value={newSplitPercent}
                                                onChange={(e) => setNewSplitPercent(e.target.value)}
                                            />
                                            <button onClick={addSplit} className="flex-1 bg-blue-600 text-white rounded text-sm font-bold shadow-sm hover:bg-blue-700">Add Rule</button>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                                    <p className={`text-sm font-medium ${totalPercent === 100 ? 'text-green-600' : 'text-red-500'}`}>
                                        Total Allocation: {totalPercent}%
                                    </p>
                                    <button
                                        onClick={handleSaveConfig}
                                        className="px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-slate-800 transition-colors"
                                        disabled={totalPercent !== 100 || loading}
                                    >
                                        {loading ? 'Saving...' : 'Save on-chain'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
