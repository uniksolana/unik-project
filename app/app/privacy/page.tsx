'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-[#0d0d12] text-white">
            {/* Navigation */}
            <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
                <Link href="/" className="flex items-center gap-3">
                    <Image src="/logo-icon.png" alt="UNIK" width={48} height={48} className="w-12 h-12" />
                    <Image src="/logo-text.png" alt="UNIK" width={96} height={28} className="h-7 w-auto hidden sm:block" />
                </Link>
            </nav>

            <div className="container mx-auto px-6 py-12 max-w-4xl">
                <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
                <p className="text-gray-400 mb-8">Last updated: January 2025</p>

                <div className="prose prose-invert prose-lg max-w-none space-y-8">

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
                        <p className="text-gray-300 leading-relaxed">
                            UNIK Protocol ("we", "us", "our") respects your privacy and is committed to transparency about the data we collect. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>

                        <h3 className="text-xl font-semibold text-cyan-400 mt-6 mb-3">2.1 Blockchain Data (Public)</h3>
                        <p className="text-gray-300 leading-relaxed">
                            When you use UNIK, the following information is recorded on the Solana blockchain and is publicly accessible:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Your wallet address and Public Keys</li>
                            <li>Registered aliases (stored as Program Derived Addresses)</li>
                            <li>Split configurations (recipient addresses and percentages)</li>
                            <li>Transaction history, amounts, and public signatures</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            <strong>This data is stored on a decentralized blockchain and cannot be deleted or modified.</strong>
                        </p>

                        <h3 className="text-xl font-semibold text-cyan-400 mt-6 mb-3">2.2 Application Database (Cloud)</h3>
                        <p className="text-gray-300 leading-relaxed">
                            Our secure databases (hosted via Supabase) store the following data necessary to provide our UI enrichment:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li><strong>Encrypted Private Data:</strong> Your contact list, private notes, and private avatar are End-to-End Encrypted (AES-256-GCM) in your browser before reaching our servers. We only store unreadable ciphertext and cannot decrypt or access this data.</li>
                            <li><strong>Shared Transaction Notes:</strong> Messages attached to payments are obfuscated using the public transaction signature to protect them from casual observation.</li>
                            <li><strong>Public Avatars & Settings:</strong> Non-encrypted profile photos (if uploaded publicly), your preferred language, and display currency.</li>
                            <li><strong>Payment Orders:</strong> Generated payment links (concept, amount, token, expiration, and their HMAC-SHA256 signatures).</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-cyan-400 mt-6 mb-3">2.3 Technical Data</h3>
                        <p className="text-gray-300 leading-relaxed">
                            Our servers may automatically collect:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>IP address (for security and rate limiting against DDoS attacks)</li>
                            <li>Browser type and version</li>
                            <li>Device information</li>
                            <li>Access timestamps</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-cyan-400 mt-6 mb-3">2.4 Local Storage & Memory Data</h3>
                        <p className="text-gray-300 leading-relaxed">
                            We store the following data locally in your browser (not on our servers):
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li><strong>Ephemeral Session Keys:</strong> Your encryption derivation key is held exclusively in browser RAM and is instantly destroyed when you close the tab.</li>
                            <li>Local caches of your contact lists and UI preferences (when not synced to the cloud).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. Information We Do NOT Collect</h2>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Your name or personal identity</li>
                            <li>Email addresses</li>
                            <li>Phone numbers</li>
                            <li>Physical addresses</li>
                            <li>Private keys or seed phrases (You authenticate via wallet signatures; your keys never leave your device)</li>
                            <li>Passwords</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            UNIK is designed to be pseudonymous. We do not require or store personally identifiable information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">4. How We Use Your Information</h2>
                        <p className="text-gray-300 leading-relaxed">We use collected information to:</p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Provide and maintain the service</li>
                            <li>Process transactions on the blockchain</li>
                            <li>Improve user experience</li>
                            <li>Detect and prevent fraud or abuse</li>
                            <li>Ensure security and prevent attacks</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">5. Data Sharing</h2>
                        <p className="text-gray-300 leading-relaxed">We may share data with:</p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li><strong>Blockchain Networks:</strong> Transaction data is publicly broadcast to the Solana network</li>
                            <li><strong>Service Providers:</strong> Infrastructure providers (hosting, CDN) may process technical data</li>
                            <li><strong>Law Enforcement:</strong> When required by law or to protect our legal rights</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            We do not sell your personal data to third parties.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">6. Cookies and Tracking</h2>
                        <p className="text-gray-300 leading-relaxed">
                            We may use essential cookies to:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Maintain session state</li>
                            <li>Remember user preferences</li>
                            <li>Prevent CSRF attacks</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            We do not use third-party advertising or tracking cookies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">7. Data Security & Encryption</h2>
                        <p className="text-gray-300 leading-relaxed">
                            We implement industry-leading security and cryptographic measures including:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li><strong>AES-256-GCM End-to-End Encryption:</strong> For your private data, using PBKDF2 with 600,000 iterations to derive your key from your wallet signature.</li>
                            <li><strong>HMAC-SHA256 Signatures:</strong> To mathematically guarantee payment orders cannot be tampered with.</li>
                            <li>HTTPS encryption for all network connections.</li>
                            <li>Strict API rate-limiting and input sanitization.</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            However, no system is 100% secure. You are responsible for keeping your wallet credentials safe as they act as your master key.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">8. Your Rights</h2>
                        <p className="text-gray-300 leading-relaxed">Depending on your jurisdiction, you may have the right to:</p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Access the data we have about you</li>
                            <li>Request deletion of off-chain data</li>
                            <li>Object to processing</li>
                            <li>Data portability</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            <strong>Note:</strong> Data stored on the blockchain cannot be deleted due to its immutable nature.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">9. Data Retention</h2>
                        <p className="text-gray-300 leading-relaxed">
                            <strong>Blockchain Data:</strong> Permanent and immutable.
                        </p>
                        <p className="text-gray-300 leading-relaxed mt-2">
                            <strong>Technical Logs:</strong> Retained for up to 90 days.
                        </p>
                        <p className="text-gray-300 leading-relaxed mt-2">
                            <strong>Local Storage:</strong> Remains until you clear your browser data.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">10. Children's Privacy</h2>
                        <p className="text-gray-300 leading-relaxed">
                            UNIK is not intended for users under 18 years of age. We do not knowingly collect data from minors.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">11. International Users</h2>
                        <p className="text-gray-300 leading-relaxed">
                            By using UNIK, you consent to the transfer of your data to servers that may be located outside your country of residence.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">12. Changes to This Policy</h2>
                        <p className="text-gray-300 leading-relaxed">
                            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">13. Contact</h2>
                        <p className="text-gray-300 leading-relaxed">
                            For privacy-related questions, please contact us through our official channels.
                        </p>
                    </section>

                </div>

                <div className="mt-12 pt-8 border-t border-white/10">
                    <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
