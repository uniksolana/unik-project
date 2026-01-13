'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, IDL } from '../../../utils/anchor';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Buffer } from 'buffer';
import Image from 'next/image';
import Link from 'next/link';

export default function AddContactPage() {
    const params = useParams();
    const router = useRouter();
    const alias = params.alias as string;
    const { connection } = useConnection();
    const wallet = useWallet();
    const { publicKey } = useWallet();

    const [loading, setLoading] = useState(true);
    const [aliasData, setAliasData] = useState<any>(null);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAliasData = async () => {
            if (!alias) return;

            try {
                const provider = new AnchorProvider(connection, wallet as any, {});
                const program = new Program(IDL as any, provider);

                const [aliasPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("alias"), Buffer.from(alias.toLowerCase())],
                    PROGRAM_ID
                );

                const account = await (program.account as any).aliasAccount.fetch(aliasPDA);
                setAliasData({
                    alias: alias.toLowerCase(),
                    address: account.owner.toBase58()
                });
                setError('');
            } catch (e) {
                console.error(e);
                setError(`Alias "@${alias}" not found. Make sure it's registered on UNIK.`);
            } finally {
                setLoading(false);
            }
        };

        fetchAliasData();
    }, [alias, connection, wallet]);

    const handleAddContact = () => {
        if (!publicKey) {
            alert("Please connect your wallet first!");
            return;
        }

        if (!aliasData) return;

        try {
            const existing = JSON.parse(localStorage.getItem('unik_contacts') || '[]');

            if (existing.some((c: any) => c.alias === aliasData.alias)) {
                alert("Contact already exists in your list!");
                return;
            }

            const newContact = {
                alias: aliasData.alias,
                address: aliasData.address,
                note: note.trim() || '',
                addedAt: Date.now()
            };

            const updated = [...existing, newContact];
            localStorage.setItem('unik_contacts', JSON.stringify(updated));
            window.dispatchEvent(new Event('storage'));

            alert(`Added @${aliasData.alias} to your contacts!`);
            router.push('/dashboard?tab=contacts');
        } catch (e) {
            alert("Failed to add contact. Please try again.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading alias...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                    <Link href="/">
                        <Image src="/logo-full.png" alt="UNIK" width={120} height={40} priority />
                    </Link>
                    <WalletMultiButton />
                </div>
            </nav>

            <div className="max-w-2xl mx-auto px-4 py-16">
                {error ? (
                    <div className="bg-red-900/20 border border-red-500 p-8 text-center">
                        <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h2 className="text-2xl font-bold mb-2">Alias Not Found</h2>
                        <p className="text-gray-400 mb-6">{error}</p>
                        <Link href="/dashboard" className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-700 font-bold transition-colors">
                            Go to Dashboard
                        </Link>
                    </div>
                ) : aliasData ? (
                    <div className="bg-gray-900 border border-gray-800 p-8">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-3xl mx-auto mb-4">
                                {aliasData.alias[0].toUpperCase()}
                            </div>
                            <h1 className="text-4xl font-bold mb-2">@{aliasData.alias}</h1>
                            <p className="text-sm text-gray-400 font-mono">{aliasData.address.slice(0, 8)}...{aliasData.address.slice(-8)}</p>
                        </div>

                        {publicKey ? (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Personal Note (optional, private)</label>
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="e.g., Friend from work, Client..."
                                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-cyan-500"
                                        rows={3}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Only you can see this note</p>
                                </div>

                                <button
                                    onClick={handleAddContact}
                                    className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 font-bold text-lg transition-all"
                                >
                                    Add to My Contacts
                                </button>

                                <Link href="/dashboard" className="block text-center text-gray-400 hover:text-white transition-colors">
                                    Go to Dashboard
                                </Link>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-gray-400 mb-6">Connect your wallet to add this contact</p>
                                <WalletMultiButton />
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
