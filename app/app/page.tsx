'use client';

import { useState } from 'react';

export default function Home() {
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const checkAlias = async () => {
    if (!alias) return;

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/check/${alias}`);
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Failed to check alias' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
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

        <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">Check Alias Availability</h2>

          <div className="flex gap-4 mb-6">
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Enter alias name..."
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={checkAlias}
              disabled={loading || !alias}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Checking...' : 'Check'}
            </button>
          </div>

          {result && (
            <div className="bg-black/30 rounded-lg p-4">
              <pre className="text-sm text-gray-300 overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
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
