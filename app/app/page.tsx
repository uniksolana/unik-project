'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const LandingAuth = dynamic(
  () => import('./components/LandingAuth'),
  { ssr: false }
);

/* ───────────────────────────── Intersection Observer Hook ───────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

/* ───────────────────────────── Animated Counter ───────────────────────────── */
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useInView(0.5);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = Math.max(1, Math.floor(target / 40));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 30);
    return () => clearInterval(timer);
  }, [isVisible, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ───────────────────────────── Roadmap Data ───────────────────────────── */
const ROADMAP = [
  { phase: '1', title: 'Foundation', desc: 'Smart contract architecture & core protocol development on Anchor/Rust.', status: 'done' },
  { phase: '2', title: 'Testing', desc: 'Internal QA, stress testing, and security hardening of all endpoints.', status: 'done' },
  { phase: '3', title: 'Devnet Launch', desc: 'Public beta on Solana Devnet. Community testing with test tokens.', status: 'current' },
  { phase: '4', title: 'User Acquisition', desc: 'Onboard early adopters, gather feedback, iterate on UX.', status: 'upcoming' },
  { phase: '5', title: 'Security Audit', desc: 'Professional third-party audit. Fundraising for mainnet preparation.', status: 'upcoming' },
  { phase: '6', title: 'Advanced Features', desc: 'Notifications, smart rules, recurring payments, and more.', status: 'upcoming' },
  { phase: '7', title: 'Mainnet Launch', desc: 'Production deployment on Solana Mainnet with real assets.', status: 'upcoming' },
  { phase: '8', title: 'Utility Token', desc: 'Possible governance/utility token launch for the ecosystem.', status: 'upcoming' },
] as const;

/* ───────────────────────────── Features Data ───────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
    title: 'Integrated Contacts',
    desc: 'Save friends once, pay in one click forever. No more copy-pasting 44-character addresses.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
      </svg>
    ),
    title: 'Automated Splits',
    desc: 'Divide bills, share revenue, or split expenses — automatically, on every single payment.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    title: '100% Non-Custodial',
    desc: 'Your keys, your funds. UNIK smart contracts never touch your money — they just route instructions.',
    gradient: 'from-emerald-500 to-cyan-500',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
      </svg>
    ),
    title: 'Payment Links',
    desc: 'Generate tamper-proof HMAC-signed payment links. Share via WhatsApp, Telegram, or QR codes.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    title: 'E2E Encrypted',
    desc: 'Contacts, notes, and private data are AES-256-GCM encrypted in your browser. We see nothing.',
    gradient: 'from-rose-500 to-purple-500',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    title: 'Mobile First',
    desc: 'Deep-linked to Phantom Wallet. Tap a link → opens in Phantom → pay instantly. Zero friction.',
    gradient: 'from-blue-500 to-indigo-500',
  },
];

/* ───────────────────────────── How It Works Steps ───────────────────────────── */
const HOW_STEPS = [
  {
    step: '01',
    title: 'Connect Phantom Wallet',
    desc: 'Link your Phantom wallet in one click. No emails, no passwords.',
    color: 'from-cyan-500 to-blue-500',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Claim Your @name',
    desc: 'Register a unique alias on-chain. It becomes your identity across UnikPay.',
    color: 'from-purple-500 to-pink-500',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Add Contacts',
    desc: 'Build your encrypted address book. Save aliases and wallet addresses privately.',
    color: 'from-emerald-500 to-cyan-500',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    step: '04',
    title: 'Send & Receive',
    desc: 'Pay anyone with their @alias. SOL, USDC, or EURC — instant, with optional auto-splits.',
    color: 'from-amber-500 to-orange-500',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    step: '05',
    title: 'Track Everything',
    desc: 'Full history with encrypted notes, amounts, and payment concepts for every transaction.',
    color: 'from-rose-500 to-purple-500',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
];

/* ───────────────────────────── MAIN COMPONENT ───────────────────────────── */
export default function Home() {
  const heroRef = useInView(0.1);
  const featRef = useInView(0.1);
  const roadmapRef = useInView(0.1);
  const howRef = useInView(0.1);
  const tokensRef = useInView(0.1);

  /* Floating particles effect */
  const [particles] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.05,
    }))
  );

  return (
    <div className="min-h-screen bg-[#030014] text-white selection:bg-purple-500/30 overflow-x-hidden">
      {/* ─── Google Font ─── */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <style jsx global>{`
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }

        @keyframes float1 { 0%,100% { transform: translateY(0px) rotate(-3deg); } 50% { transform: translateY(-20px) rotate(-1deg); } }
        @keyframes float2 { 0%,100% { transform: translateY(0px) rotate(2deg); } 50% { transform: translateY(-15px) rotate(4deg); } }
        @keyframes float3 { 0%,100% { transform: translateY(0px) rotate(-1deg); } 50% { transform: translateY(-25px) rotate(1deg); } }
        @keyframes gradient-x { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes pulse-glow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes drift { 0% { transform: translateY(0) translateX(0); } 25% { transform: translateY(-30px) translateX(15px); } 50% { transform: translateY(-10px) translateX(-10px); } 75% { transform: translateY(-40px) translateX(5px); } 100% { transform: translateY(0) translateX(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        .animate-float1 { animation: float1 6s ease-in-out infinite; }
        .animate-float2 { animation: float2 5s ease-in-out infinite 0.5s; }
        .animate-float3 { animation: float3 7s ease-in-out infinite 1s; }
        .animate-gradient-x { animation: gradient-x 6s ease infinite; background-size: 200% 200%; }
        .animate-pulse-glow { animation: pulse-glow 4s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-shimmer { animation: shimmer 3s linear infinite; background-size: 200% 100%; }

        .reveal { opacity: 0; transform: translateY(40px); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal.visible { opacity: 1; transform: translateY(0); }

        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.06); }
        .glass-strong { background: rgba(255,255,255,0.05); backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.08); }

        .step-connector { position: relative; }
        .step-connector::after {
          content: '';
          position: absolute;
          top: 24px;
          right: -50%;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
        }
        .step-connector:last-child::after { display: none; }
      `}</style>

      {/* ─── Ambient Background ─── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-15%] w-[900px] h-[900px] bg-purple-600/8 rounded-full blur-[180px] animate-pulse-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-cyan-500/8 rounded-full blur-[180px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[30%] left-[60%] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px]" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Floating particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animation: `drift ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ═══════════════════ DEVNET BANNER ═══════════════════ */}
      <div className="relative z-50 bg-amber-500/5 border-b border-amber-500/20">
        <div className="container mx-auto py-2.5 px-4 text-center">
          <p className="text-amber-400/90 text-xs sm:text-sm font-medium tracking-wide">
            ⚠️ <strong className="font-bold">DEVNET BETA</strong> — Currently testing on Solana Devnet. Tokens have no real value.
            <Link href="/terms" className="underline underline-offset-2 hover:text-amber-300 ml-1.5 transition-colors">Terms</Link>
          </p>
        </div>
      </div>

      {/* ═══════════════════ NAVBAR ═══════════════════ */}
      <nav className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <Image src="/logo-icon.png" alt="UNIK" width={40} height={40} className="w-10 h-10 group-hover:scale-110 transition-transform duration-300" />
            <Image src="/logo-text.png" alt="UNIK" width={80} height={24} className="h-6 w-auto hidden sm:block opacity-90" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/docs" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">Documentation</Link>
            <Link href="https://x.com/UnikPay" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">Twitter</Link>
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">Features</a>
            <a href="#roadmap" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">Roadmap</a>
          </div>
          <LandingAuth />
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section ref={heroRef.ref} className="relative z-10 container mx-auto px-4 pt-16 md:pt-24 pb-24 md:pb-36">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center max-w-7xl mx-auto">

          {/* Left Column — Text */}
          <div className={`reveal ${heroRef.isVisible ? 'visible' : ''} max-w-xl`}>
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
              <span className="text-xs font-semibold text-emerald-300 tracking-wider uppercase">Live on Devnet</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-6">
              Pay Anyone on Solana with{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#9945FF] via-[#14F195] to-[#00C2FF] animate-gradient-x">
                Just an @name.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 mb-10 leading-relaxed max-w-lg">
              The easiest payment infrastructure on Solana.
              Claim your alias, send and receive crypto like a message, and auto-split funds — all non-custodial.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="group relative px-8 py-4 bg-white text-black font-bold rounded-2xl text-lg shadow-[0_0_40px_rgba(153,69,255,0.25)] hover:shadow-[0_0_60px_rgba(153,69,255,0.4)] transition-all duration-300 hover:-translate-y-1 text-center"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Claim your @alias
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </span>
              </Link>
              <Link
                href="/docs"
                className="px-8 py-4 glass hover:bg-white/8 text-white font-semibold rounded-2xl text-lg transition-all duration-300 hover:-translate-y-1 text-center"
              >
                Read Docs
              </Link>
            </div>

            {/* Token Support */}
            <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 text-sm">
              <div className="flex items-center gap-3 glass rounded-full px-4 py-2">
                <Image src="/sol.png" alt="SOL" width={22} height={22} className="w-5 h-5" />
                <span className="text-gray-300 font-medium">Solana</span>
                <span className="text-gray-600">·</span>
                <Image src="/usdc.png" alt="USDC" width={22} height={22} className="w-5 h-5" />
                <span className="text-gray-300 font-medium">USDC</span>
                <span className="text-gray-600">·</span>
                <Image src="/eurc.png" alt="EURC" width={22} height={22} className="w-5 h-5" />
                <span className="text-gray-300 font-medium">EURC</span>
              </div>
              <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <Image src="/logophantom.png" alt="Phantom" width={20} height={20} className="w-5 h-5 rounded" />
                <span className="text-gray-400 text-xs">Phantom Ready</span>
              </div>
            </div>
          </div>

          {/* Right Column — Floating Cards */}
          <div className={`reveal ${heroRef.isVisible ? 'visible' : ''} relative h-[450px] md:h-[500px] w-full max-w-[320px] md:max-w-none mx-auto mt-16 md:mt-0`} style={{ transitionDelay: '0.3s' }}>

            {/* Decorative ring */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[350px] h-[300px] md:h-[350px] rounded-full border border-purple-500/10 animate-spin-slow" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] md:w-[250px] h-[200px] md:h-[250px] rounded-full border border-cyan-500/5 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />

            {/* Card 1 — Alias Input */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-0 md:top-4 w-[260px] md:w-[280px] glass-strong rounded-2xl p-4 md:p-5 shadow-2xl animate-float1 z-30">
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Claim Alias</p>
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <span className="text-purple-400 font-bold">@</span>
                <span className="text-white font-semibold text-base">david_unik</span>
                <span className="ml-auto flex items-center gap-1 text-emerald-400 text-xs font-bold">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Available
                </span>
              </div>
              <button className="w-full mt-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold text-sm py-2.5 rounded-xl hover:opacity-90 transition-opacity">
                Claim Now
              </button>
            </div>

            {/* Card 2 — Chat Bubble */}
            <div className="absolute top-[130px] md:top-[140px] left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-0 w-[280px] md:w-[300px] glass-strong rounded-2xl p-4 md:p-5 shadow-2xl animate-float2 z-20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-sm font-bold text-black">D</div>
                <div>
                  <p className="text-white font-semibold text-sm">David</p>
                  <p className="text-gray-500 text-[11px]">just now</p>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl rounded-tl-none p-3.5 border border-white/10">
                <p className="text-gray-300 text-sm leading-relaxed">Hey! Pay me for the pizza here 🍕</p>
                <p className="text-cyan-400 text-sm font-medium mt-1.5">unikpay.xyz/pay/david_unik</p>
              </div>
            </div>

            {/* Card 3 — Transaction Approve */}
            <div className="absolute bottom-0 md:bottom-4 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-8 w-[250px] md:w-[260px] glass-strong rounded-2xl p-4 md:p-5 shadow-2xl animate-float3 z-30">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Confirm Payment</p>
                <Image src="/logophantom.png" alt="Phantom" width={22} height={22} className="w-5 h-5 rounded opacity-70" />
              </div>
              <div className="text-center mb-4">
                <p className="text-gray-400 text-xs mb-1">Send to @david_unik</p>
                <p className="text-3xl font-black text-white">$20.00</p>
                <p className="text-gray-500 text-xs mt-1">USDC</p>
              </div>
              <button className="w-full bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-bold text-sm py-3 rounded-xl">
                Approve ✓
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ STATS BAR ═══════════════════ */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.01]">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto text-center">
            {[
              { value: <Counter target={400} suffix="ms" />, label: 'Transaction Speed' },
              { value: '$0.001', label: 'Avg. Fee' },
              { value: '5', label: 'Max Split Recipients' },
              { value: <Counter target={100} suffix="%" />, label: 'Non-Custodial' },
            ].map((stat, i) => (
              <div key={i}>
                <p className="text-2xl md:text-3xl font-black text-white mb-1">{stat.value}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section id="features" ref={featRef.ref} className="relative z-10 container mx-auto px-4 py-24 md:py-36">
        <div className={`reveal ${featRef.isVisible ? 'visible' : ''} text-center mb-16`}>
          <div className="inline-block px-5 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 mb-6 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <p className="text-sm font-bold text-purple-400 uppercase tracking-widest">Why UnikPay</p>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">
            Everything you need.<br />
            <span className="text-gray-500">Nothing you don&apos;t.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className={`reveal ${featRef.isVisible ? 'visible' : ''} group glass hover:bg-white/[0.04] rounded-2xl p-7 transition-all duration-500 hover:-translate-y-1 hover:border-white/10`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <div className="text-white">{f.icon}</div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════ SUPPORTED TOKENS ═══════════════════ */}
      <section ref={tokensRef.ref} className="relative z-10 container mx-auto px-4 py-16">
        <div className={`reveal ${tokensRef.isVisible ? 'visible' : ''} max-w-4xl mx-auto`}>
          <div className="glass-strong rounded-3xl p-8 md:p-12 relative overflow-hidden">
            {/* Shimmer line */}
            <div className="absolute top-0 left-0 right-0 h-[1px] animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(153,69,255,0.3), transparent)' }} />

            <p className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4 text-center">Supported Tokens</p>
            <h3 className="text-2xl md:text-3xl font-black text-center mb-10">
              Send and receive in the currency you prefer.
            </h3>

            <div className="grid grid-cols-3 gap-4 md:gap-6">
              {[
                { name: 'Solana', symbol: 'SOL', img: '/sol.png', color: 'from-[#9945FF]/10 to-[#14F195]/10', border: 'hover:border-[#14F195]/30' },
                { name: 'USD Coin', symbol: 'USDC', img: '/usdc.png', color: 'from-blue-500/10 to-cyan-500/10', border: 'hover:border-blue-500/30' },
                { name: 'Euro Coin', symbol: 'EURC', img: '/eurc.png', color: 'from-blue-600/10 to-indigo-500/10', border: 'hover:border-blue-400/30' },
              ].map((token, i) => (
                <div
                  key={i}
                  className={`group flex flex-col items-center justify-center gap-4 py-8 rounded-2xl bg-gradient-to-br ${token.color} border border-white/5 ${token.border} transition-all duration-300 hover:-translate-y-1`}
                >
                  <Image src={token.img} alt={token.name} width={56} height={56} className="w-14 h-14 group-hover:scale-110 transition-transform duration-300 mix-blend-screen" />
                  <div className="text-center mt-2">
                    <p className="text-white font-bold text-xl">{token.symbol}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section ref={howRef.ref} className="relative z-10 container mx-auto px-4 py-24 md:py-36">
        <div className={`reveal ${howRef.isVisible ? 'visible' : ''} text-center mb-16`}>
          <div className="inline-block px-5 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 mb-6 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <p className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Simplicity by Design</p>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">
            From zero to payment<br />
            <span className="text-gray-500">in 5 simple steps.</span>
          </h2>
        </div>

        <div className={`reveal ${howRef.isVisible ? 'visible' : ''} max-w-5xl mx-auto`} style={{ transitionDelay: '0.2s' }}>
          {/* Step Cards with Icons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-5">
            {HOW_STEPS.map((s, i) => (
              <div
                key={i}
                className="group glass rounded-2xl p-6 hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-2 text-center relative step-connector"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Step Number Circle */}
                <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br ${s.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <div className="text-white">{s.icon}</div>
                </div>
                {/* Step Label */}
                <div className={`text-[10px] font-black bg-gradient-to-r ${s.color} bg-clip-text text-transparent mb-2 uppercase tracking-widest`}>Step {s.step}</div>
                <h4 className="text-sm font-bold text-white mb-2">{s.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ ROADMAP ═══════════════════ */}
      <section id="roadmap" ref={roadmapRef.ref} className="relative z-10 container mx-auto px-4 py-24 md:py-36 overflow-hidden">
        <div className={`reveal ${roadmapRef.isVisible ? 'visible' : ''} text-center mb-16`}>
          <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-3">Roadmap</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">
            Building the future<br />
            <span className="text-gray-500">of P2P payments.</span>
          </h2>
        </div>

        <div className={`reveal ${roadmapRef.isVisible ? 'visible' : ''} max-w-5xl mx-auto relative`} style={{ transitionDelay: '0.2s' }}>

          {/* Desktop Timeline */}
          <div className="hidden md:block">
            {/* Connecting line */}
            <div className="absolute top-[38px] left-0 right-0 h-[2px]">
              <div className="w-full h-full bg-white/5 rounded-full" />
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: '31%' }} />
            </div>

            <div className="grid grid-cols-8 gap-2">
              {ROADMAP.map((item, i) => {
                const isDone = item.status === 'done';
                const isCurrent = item.status === 'current';
                const isUpcoming = item.status === 'upcoming';
                return (
                  <div key={i} className="relative flex flex-col items-center text-center pt-0">
                    <div className={`relative z-10 w-[18px] h-[18px] rounded-full mb-5 flex items-center justify-center ring-4 transition-all duration-500
                      ${isDone ? 'bg-emerald-400 ring-emerald-400/20' : ''}
                      ${isCurrent ? 'bg-cyan-400 ring-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.5)]' : ''}
                      ${isUpcoming ? 'bg-gray-700 ring-gray-700/20' : ''}
                    `}>
                      {isDone && (
                        <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      )}
                      {isCurrent && <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-40" />}
                    </div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 ${isDone ? 'text-emerald-400' : isCurrent ? 'text-cyan-400' : 'text-gray-600'}`}>
                      Phase {item.phase}
                    </p>
                    <h4 className={`text-xs font-bold mb-1 leading-tight ${isUpcoming ? 'text-gray-500' : 'text-white'}`}>{item.title}</h4>
                    <p className="text-[10px] text-gray-600 leading-relaxed hidden lg:block px-1">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Timeline (Vertical) */}
          <div className="md:hidden space-y-0">
            <div className="absolute top-0 left-[15px] bottom-0 w-[2px] bg-white/5">
              <div className="w-full bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" style={{ height: '31%' }} />
            </div>

            {ROADMAP.map((item, i) => {
              const isDone = item.status === 'done';
              const isCurrent = item.status === 'current';
              const isUpcoming = item.status === 'upcoming';
              return (
                <div key={i} className="relative flex items-start gap-4 py-4 pl-1">
                  <div className={`relative z-10 mt-0.5 w-[14px] h-[14px] rounded-full flex-shrink-0 ring-4
                    ${isDone ? 'bg-emerald-400 ring-emerald-400/20' : ''}
                    ${isCurrent ? 'bg-cyan-400 ring-cyan-400/30 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : ''}
                    ${isUpcoming ? 'bg-gray-700 ring-gray-700/20' : ''}
                  `}>
                    {isCurrent && <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-40" />}
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDone ? 'text-emerald-400' : isCurrent ? 'text-cyan-400' : 'text-gray-600'}`}>Phase {item.phase}</p>
                    <h4 className={`text-sm font-bold ${isUpcoming ? 'text-gray-500' : 'text-white'}`}>{item.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section className="relative z-10 container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center glass-strong rounded-3xl p-12 md:p-16 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-cyan-600/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2" />
          {/* Shimmer line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(20,241,149,0.3), transparent)' }} />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
              Ready to start?
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto">
              Join the Devnet beta and be among the first to experience the future of P2P payments on Solana.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-bold rounded-2xl text-lg shadow-[0_0_40px_rgba(153,69,255,0.3)] hover:shadow-[0_0_60px_rgba(153,69,255,0.5)] transition-all duration-300 hover:-translate-y-1"
            >
              Launch Dashboard
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <Image src="/logo-icon.png" alt="UNIK" width={28} height={28} className="w-7 h-7" />
                <span className="font-bold text-white">UnikPay</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed mb-4">The easiest way to send and receive payments on Solana. Simple aliases, auto-splits, and encrypted notes.</p>
              <div className="flex items-center gap-3">
                <Image src="/sol.png" alt="Solana" width={18} height={18} className="w-4 h-4 opacity-50" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Built on Solana</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Product</p>
              <ul className="space-y-2.5">
                <li><Link href="/dashboard" className="text-sm text-gray-500 hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/docs" className="text-sm text-gray-500 hover:text-white transition-colors">Documentation</Link></li>
                <li><a href="#features" className="text-sm text-gray-500 hover:text-white transition-colors">Features</a></li>
                <li><a href="#roadmap" className="text-sm text-gray-500 hover:text-white transition-colors">Roadmap</a></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Legal</p>
              <ul className="space-y-2.5">
                <li><Link href="/privacy" className="text-sm text-gray-500 hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-sm text-gray-500 hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Community</p>
              <ul className="space-y-2.5">
                <li>
                  <Link href="https://x.com/UnikPay" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-white transition-colors inline-flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    Twitter / X
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-700">© {new Date().getFullYear()} UNIK Protocol. All rights reserved.</p>
            <p className="text-xs text-gray-700">Deployed on Solana Devnet · v1.2-beta</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
