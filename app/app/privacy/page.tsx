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
                            <li>Your wallet address</li>
                            <li>Registered aliases</li>
                            <li>Split configurations (recipient addresses and percentages)</li>
                            <li>Transaction history and amounts</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            <strong>This data is stored on a decentralized blockchain and cannot be deleted or modified.</strong>
                        </p>

                        <h3 className="text-xl font-semibold text-cyan-400 mt-6 mb-3">2.2 Technical Data</h3>
                        <p className="text-gray-300 leading-relaxed">
                            Our servers may automatically collect:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>IP address (for security and rate limiting)</li>
                            <li>Browser type and version</li>
                            <li>Device information</li>
                            <li>Access timestamps</li>
                            <li>Referring URLs</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-cyan-400 mt-6 mb-3">2.3 Local Storage Data</h3>
                        <p className="text-gray-300 leading-relaxed">
                            We store the following data locally in your browser (not on our servers):
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Contact lists you create</li>
                            <li>UI preferences</li>
                            <li>Recent transaction history cache</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. Information We Do NOT Collect</h2>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Your name or personal identity</li>
                            <li>Email addresses</li>
                            <li>Phone numbers</li>
                            <li>Physical addresses</li>
                            <li>Private keys or seed phrases</li>
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
                        <h2 className="text-2xl font-bold text-white mb-4">7. Data Security</h2>
                        <p className="text-gray-300 leading-relaxed">
                            We implement industry-standard security measures including:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>HTTPS encryption for all connections</li>
                            <li>Regular security audits</li>
                            <li>Access controls and monitoring</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            However, no system is 100% secure. You are responsible for keeping your wallet credentials safe.
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
