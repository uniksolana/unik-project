'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center border-b border-gray-800">
        <Image src="/logo-full.png" alt="UNIK" width={120} height={40} priority />
        <WalletMultiButton />
      </nav>

      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-20">
          <div className="flex justify-center mb-8">
            <Image src="/logo-icon.png" alt="UNIK" width={120} height={120} priority />
          </div>
          <h1 className="text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            UNIK
          </h1>
          <p className="text-3xl text-gray-400 mb-4">
            The Non-Custodial Payment Router
          </p>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-12">
            Transform your Solana wallet into an intelligent payment infrastructure.
            Create aliases, set routing rules, and automate fund distribution.
          </p>

          <Link
            href="/dashboard"
            className="inline-block px-10 py-5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 font-bold text-xl shadow-2xl shadow-purple-500/50 transition-all transform hover:scale-105"
          >
            🚀 Launch Dashboard
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-gray-900 p-6 md:p-8 border border-gray-800 hover:border-cyan-500 transition-colors">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold mb-3">Smart Aliases</h3>
            <p className="text-gray-400 text-lg">
              Create memorable aliases for your wallet. Share @yourname instead of long addresses.
            </p>
          </div>

          <div className="bg-gray-900 p-6 md:p-8 border border-gray-800 hover:border-purple-500 transition-colors">
            <div className="text-5xl mb-4">🔀</div>
            <h3 className="text-2xl font-bold mb-3">Auto Splits</h3>
            <p className="text-gray-400 text-lg">
              Configure percentage-based splits. Funds distribute automatically on receipt.
            </p>
          </div>

          <div className="bg-gray-900 p-6 md:p-8 border border-gray-800 hover:border-pink-500 transition-colors">
            <div className="text-5xl mb-4">🔐</div>
            <h3 className="text-2xl font-bold mb-3">Non-Custodial</h3>
            <p className="text-gray-400 text-lg">
              You control your funds. UNIK never touches your money. Pure on-chain logic.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 md:p-12 border border-gray-700">
          <h2 className="text-4xl font-bold mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">1</div>
              <h4 className="font-bold text-lg mb-2">Register Alias</h4>
              <p className="text-gray-400 text-sm">Claim your unique @alias on Solana</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">2</div>
              <h4 className="font-bold text-lg mb-2">Set Routes</h4>
              <p className="text-gray-400 text-sm">Configure how incoming funds split</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-pink-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">3</div>
              <h4 className="font-bold text-lg mb-2">Share Link</h4>
              <p className="text-gray-400 text-sm">Give your payment link to anyone</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">4</div>
              <h4 className="font-bold text-lg mb-2">Get Paid</h4>
              <p className="text-gray-400 text-sm">Funds auto-split to your wallets</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800 py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-gray-500">
          <p>UNIK - Building the future of non-custodial payment routing on Solana</p>
        </div>
      </footer>
    </div>
  );
}
