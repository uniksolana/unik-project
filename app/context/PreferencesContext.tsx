
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import { translations, Language, Currency } from '../utils/i18n';

interface PreferencesContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    currency: Currency;
    setCurrency: (curr: Currency) => void;
    solPrice: number | null;
    convertPrice: (amountSol: number) => string;
    t: (key: keyof typeof translations['en']) => string;
    isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
    const { publicKey } = useWallet();
    const [language, setLanguageState] = useState<Language>('en');
    const [currency, setCurrencyState] = useState<Currency>('USD');
    const [solPriceData, setSolPriceData] = useState<{ usd: number, eur: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Load from LocalStorage on mount
    useEffect(() => {
        const storedLang = localStorage.getItem('unik_language') as Language;
        const storedCurr = localStorage.getItem('unik_currency') as Currency;
        if (storedLang && ['en', 'es', 'fr'].includes(storedLang)) setLanguageState(storedLang);
        if (storedCurr && ['USD', 'EUR'].includes(storedCurr)) setCurrencyState(storedCurr);
        setIsLoading(false);
    }, []);

    // 2. Load from Supabase when wallet connects
    useEffect(() => {
        const loadProfile = async () => {
            if (!publicKey) return;
            try {
                const res = await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'get_profile',
                        wallet_address: publicKey.toBase58(),
                    }),
                });
                const { data, error } = await res.json();

                if (data && !error) {
                    if (data.preferred_language) {
                        setLanguageState(data.preferred_language as Language);
                        localStorage.setItem('unik_language', data.preferred_language);
                    }
                    if (data.preferred_currency) {
                        setCurrencyState(data.preferred_currency as Currency);
                        localStorage.setItem('unik_currency', data.preferred_currency);
                    }
                }
            } catch (e) {
                console.error("Error loading profile prefs", e);
            }
        };
        loadProfile();
    }, [publicKey]);

    // 3. Save changes (wrapper functions)
    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('unik_language', lang);
        if (publicKey) {
            fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_profile',
                    wallet_address: publicKey.toBase58(),
                    preferred_language: lang,
                }),
            });
        }
    };

    const setCurrency = async (curr: Currency) => {
        setCurrencyState(curr);
        localStorage.setItem('unik_currency', curr);
        if (publicKey) {
            fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_profile',
                    wallet_address: publicKey.toBase58(),
                    preferred_currency: curr,
                }),
            });
        }
    };

    // 4. Fetch Prices (Real-time with Cache & Fallback)
    useEffect(() => {
        const CACHE_KEY = 'unik_price_cache';

        // Load cache first for instant UI
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                setSolPriceData(JSON.parse(cached));
            } catch (e) { }
        } else {
            // No cache and no fetch yet -> Show loading state
            setSolPriceData(null);
        }

        const fetchPrices = async () => {
            try {
                // 1. Try CoinGecko first
                const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,eur');
                if (!res.ok) throw new Error('CoinGecko failed');
                const data = await res.json();

                if (data.solana) {
                    const newPrices = {
                        usd: data.solana.usd,
                        eur: data.solana.eur
                    };
                    setSolPriceData(newPrices);
                    localStorage.setItem(CACHE_KEY, JSON.stringify(newPrices));
                    return; // Success
                }
            } catch (e) {
                console.warn("CoinGecko failed, trying Binance fallback...", e);
            }

            // 2. Fallback to Binance (SOL/USDT ~ USD) & Kraken (SOL/EUR) or estimate EUR
            try {
                const resBinance = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT');
                if (!resBinance.ok) throw new Error('Binance failed');
                const dataBinance = await resBinance.json();
                const priceUsd = parseFloat(dataBinance.price);

                // Estimate EUR (USD * 0.92 roughly, or fetch EUR pair if needed)
                // Let's try fetching EUR pair too if possible, otherwise estimate
                let priceEur = priceUsd * 0.92;
                try {
                    const resEur = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLEUR');
                    if (resEur.ok) {
                        const dataEur = await resEur.json();
                        priceEur = parseFloat(dataEur.price);
                    }
                } catch (e) { }

                if (priceUsd) {
                    const newPrices = { usd: priceUsd, eur: priceEur };
                    setSolPriceData(newPrices);
                    localStorage.setItem(CACHE_KEY, JSON.stringify(newPrices));
                }

            } catch (e) {
                console.warn("All price APIs failed. Using cache only.");
            }
        };

        fetchPrices();
        const interval = setInterval(fetchPrices, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    // Helper: Convert SOL to displayed currency formatted string
    const convertPrice = (amountSol: number): string => {
        if (!solPriceData) return '...';
        const rate = currency === 'EUR' ? solPriceData.eur : solPriceData.usd;
        const symbol = currency === 'EUR' ? '€' : '$';
        const val = amountSol * rate;
        return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper: Translate
    const t = (key: keyof typeof translations['en']): string => {
        // Fallback to English if translation missing
        return translations[language][key] || translations['en'][key] || key;
    };

    // Current SOL Price (for raw calculations if needed elsewhere)
    const solPrice = solPriceData ? (currency === 'EUR' ? solPriceData.eur : solPriceData.usd) : null;

    return (
        <PreferencesContext.Provider value={{ language, setLanguage, currency, setCurrency, solPrice, convertPrice, t, isLoading }}>
            {children}
        </PreferencesContext.Provider>
    );
}

export const usePreferences = () => {
    const context = useContext(PreferencesContext);
    if (!context) throw new Error("usePreferences must be used within a PreferencesProvider");
    return context;
};
