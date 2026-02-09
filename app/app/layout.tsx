import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletContextProvider } from "./components/WalletContextProvider";
import { PreferencesProvider } from "../context/PreferencesContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UNIK | Smart Payments on Solana",
  description: "Send crypto easily with @aliases. Automatic payment splitting and routing on Solana blockchain.",
};

import { Toaster } from "react-hot-toast";
import RiskModal from './components/RiskModal';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WalletContextProvider>
          <PreferencesProvider>
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 5000,
                style: {
                  background: "#13131f",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "1rem",
                  fontSize: "14px",
                  backdropFilter: "blur(10px)",
                  padding: "12px 20px",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                },
                success: {
                  iconTheme: {
                    primary: "#22c55e",
                    secondary: "#fff",
                  },
                  style: {
                    border: "1px solid rgba(34,197,94,0.3)",
                  }
                },
                error: {
                  iconTheme: {
                    primary: "#ef4444",
                    secondary: "#fff",
                  },
                  style: {
                    border: "1px solid rgba(239,68,68,0.3)",
                  }
                }
              }}
            />
            <RiskModal />
            {children}
          </PreferencesProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}
