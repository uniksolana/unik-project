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
    <div className="min-h-screen bg-[#0d0d12] text-white selection:bg-purple-500/30 overflow-x-hidden font-sans">

      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-cyan-600/10 rounded-full blur-[150px] animate-pulse-slow delay-1000"></div>
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px]"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 container mx-auto px-6 py-6 flex justify-between items-center backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Image src="/logo-icon.png" alt="UNIK" width={40} height={40} className="w-10 h-10" />
          <span className="text-2xl font-bold tracking-tight text-white hidden sm:block">UNIK</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="https://docs.unik.app" className="hidden md:block text-gray-400 hover:text-white transition-colors text-sm font-medium">Documentation</Link>
          <WalletMultiButton />
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-4 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto">

          <div className="relative w-24 h-24 mx-auto mb-12 group perspective-1000">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-tilt"></div>
            <div className="relative w-full h-full bg-[#13131f] rounded-2xl border border-white/10 flex items-center justify-center p-4 shadow-2xl transform transition-transform duration-500 hover:scale-110 hover:rotate-3">
              <Image src="/logo-icon.png" alt="UNIK" width={80} height={80} priority className="drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight">
            The <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">Non-Custodial</span><br />
            Payment Router
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Transform your Solana wallet into an intelligent payment infrastructure.
            Create aliases, set routing rules, and automate fund distribution.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/dashboard"
              className="group relative px-8 py-4 bg-white text-black font-bold rounded-full text-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all hover:-translate-y-1 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Launch Dashboard
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-200 to-purple-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Link>

            <Link
              href="#features"
              className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-full text-lg hover:bg-white/10 transition-all hover:-translate-y-1 backdrop-blur-md"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div id="features" className="relative z-10 container mx-auto px-4 pb-32">
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Card 1 */}
          <div className="group p-8 rounded-[2rem] bg-[#13131f]/50 border border-white/5 hover:border-cyan-500/30 transition-all hover:bg-[#1a1a2e] duration-300">
            <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300 border border-cyan-500/20">
              🎯
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white">Smart Aliases</h3>
            <p className="text-gray-400 leading-relaxed">
              Create memorable aliases for your wallet. Share <span className="text-cyan-400">@yourname</span> instead of long, confusing addresses.
            </p>
          </div>

          {/* Card 2 */}
          <div className="group p-8 rounded-[2rem] bg-[#13131f]/50 border border-white/5 hover:border-purple-500/30 transition-all hover:bg-[#1a1a2e] duration-300">
            <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300 border border-purple-500/20">
              🔀
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white">Auto Splits</h3>
            <p className="text-gray-400 leading-relaxed">
              Configure percentage-based splits. Funds distribute automatically to multiple wallets instantly upon receipt.
            </p>
          </div>

          {/* Card 3 */}
          <div className="group p-8 rounded-[2rem] bg-[#13131f]/50 border border-white/5 hover:border-pink-500/30 transition-all hover:bg-[#1a1a2e] duration-300">
            <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300 border border-pink-500/20">
              🔐
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white">Non-Custodial</h3>
            <p className="text-gray-400 leading-relaxed">
              You maintain full control. UNIK smart contracts never touch your funds; they simply route the instructions.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="relative z-10 container mx-auto px-4 pb-32">
        <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>
        <div className="relative max-w-5xl mx-auto">
          {/* Connecting Line */}
          <div className="absolute top-[30px] left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent hidden md:block"></div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: 1, title: 'Register', desc: 'Claim your unique alias', color: 'bg-cyan-500' },
              { step: 2, title: 'Configure', desc: 'Set routing rules', color: 'bg-purple-500' },
              { step: 3, title: 'Share', desc: 'Send your payment link', color: 'bg-pink-500' },
              { step: 4, title: 'Receive', desc: 'Funds auto-split', color: 'bg-green-500' }
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center group">
                <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center text-xl font-bold mb-6 shadow-lg relative z-10 transition-transform hover:rotate-6 hover:scale-110`}>
                  {item.step}
                </div>
                <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12 bg-black/20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
            <Image src="/logo-icon.png" alt="UNIK" width={24} height={24} />
            <span className="font-bold">UNIK Protocol</span>
          </div>
          <p className="text-gray-600 text-sm">© 2024 UNIK. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
