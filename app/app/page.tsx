'use client';


import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

export default function Home() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-white">🧠 UNIK</div>
        <WalletMultiButton />
      </nav>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-4">
            🧠 UNIK
          </h1>
          <p className="text-2xl text-blue-200 mb-8">
            Smart Alias & Payment Routing on Solana
          </p>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Transform your Solana wallet into an intelligent payment infrastructure.
            Create aliases, set routing rules, and automate fund distribution.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="text-xl font-bold text-white mb-2">Smart Aliases</h3>
            <p className="text-gray-300">
              Create memorable aliases for your wallet. Share links instead of long addresses.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-white mb-2">Auto Splits</h3>
            <p className="text-gray-300">
              Configure percentage-based splits. Funds distribute automatically on receipt.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-bold text-white mb-2">Non-Custodial</h3>
            <p className="text-gray-300">
              You control your funds. UNIK never holds or intermediates your assets.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">Ready to get started?</h2>
          <p className="text-gray-300 mb-8">
            Connect your wallet and start routing payments on Solana Devnet today.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-blue-500/20"
          >
            🚀 Launch Dashboard
          </a>
        </div>

        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>

          <div className="space-y-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                1
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Register Your Alias</h3>
                <p className="text-gray-300">
                  Connect your wallet and claim a unique alias. It's yours forever, stored on-chain.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                2
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Configure Routing Rules</h3>
                <p className="text-gray-300">
                  Set up automatic splits (e.g., 70% to savings, 20% to expenses, 10% to charity).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                3
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Receive & Auto-Distribute</h3>
                <p className="text-gray-300">
                  When someone sends to your alias, funds automatically split according to your rules.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-gray-400">
          <p className="mb-2">Built on Solana with Anchor Framework</p>
          <p className="text-sm">Non-custodial • Transparent • Auditable</p>
        </div>
      </div>
    </div>
  );
}
