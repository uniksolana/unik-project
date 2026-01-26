'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function TermsOfService() {
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
                <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
                <p className="text-gray-400 mb-8">Last updated: January 2025</p>

                <div className="prose prose-invert prose-lg max-w-none space-y-8">

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                        <p className="text-gray-300 leading-relaxed">
                            By accessing and using UNIK Protocol ("the Service", "UNIK", "we", "us", or "our"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use this service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
                        <p className="text-gray-300 leading-relaxed">
                            UNIK Protocol is a non-custodial payment routing protocol built on the Solana blockchain. The service allows users to:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Create human-readable aliases for their Solana wallet addresses</li>
                            <li>Configure automatic payment splits to multiple recipients</li>
                            <li>Generate shareable payment links</li>
                            <li>Send and receive cryptocurrency payments</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            <strong className="text-yellow-400">IMPORTANT: UNIK is currently deployed on Solana DEVNET and is in active development.</strong> Devnet tokens have no real monetary value.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. Non-Custodial Nature</h2>
                        <p className="text-gray-300 leading-relaxed">
                            UNIK Protocol is non-custodial. This means:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>We never hold, control, or have access to your funds</li>
                            <li>All transactions are executed directly on the Solana blockchain</li>
                            <li>You are solely responsible for the security of your wallet and private keys</li>
                            <li>We cannot reverse, cancel, or modify any transactions</li>
                            <li>We cannot recover lost or stolen funds</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">4. User Responsibilities</h2>
                        <p className="text-gray-300 leading-relaxed">By using UNIK, you agree that:</p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>You are at least 18 years old or the age of majority in your jurisdiction</li>
                            <li>You are solely responsible for maintaining the security of your wallet</li>
                            <li>You will verify all transaction details before confirming</li>
                            <li>You understand and accept the risks associated with cryptocurrency</li>
                            <li>You will comply with all applicable laws and regulations in your jurisdiction</li>
                        </ul>
                    </section>

                    <section className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                        <h2 className="text-2xl font-bold text-red-400 mb-4">5. Prohibited Activities</h2>
                        <p className="text-gray-300 leading-relaxed">The following activities are strictly prohibited:</p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li><strong>Money laundering</strong> or any attempt to disguise the origins of illegally obtained funds</li>
                            <li><strong>Terrorist financing</strong> or support of any terrorist activities</li>
                            <li><strong>Tax evasion</strong> or any illegal tax avoidance schemes</li>
                            <li><strong>Fraud, scams, or deceptive practices</strong> of any kind</li>
                            <li><strong>Trading or purchasing illegal goods or services</strong></li>
                            <li><strong>Circumventing economic sanctions</strong> or using the service from sanctioned jurisdictions</li>
                            <li><strong>Impersonating</strong> other users, entities, or organizations</li>
                            <li><strong>Attempting to exploit, hack, or manipulate</strong> the smart contracts</li>
                            <li><strong>Any activity that violates local, national, or international laws</strong></li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            We reserve the right to report suspicious activities to relevant authorities and cooperate with law enforcement investigations.
                        </p>
                    </section>

                    <section className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
                        <h2 className="text-2xl font-bold text-yellow-400 mb-4">6. Disclaimer of Warranties & Risk Acknowledgment</h2>
                        <p className="text-gray-300 leading-relaxed">
                            <strong>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.</strong>
                        </p>
                        <p className="text-gray-300 leading-relaxed mt-4">By using UNIK, you acknowledge and accept:</p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Cryptocurrency transactions are irreversible and carry inherent risks</li>
                            <li>Smart contracts may contain bugs or vulnerabilities</li>
                            <li>The value of cryptocurrencies can be highly volatile</li>
                            <li>You may lose some or all of your funds</li>
                            <li>The service may experience downtime or technical issues</li>
                            <li>Blockchain networks may become congested or experience failures</li>
                            <li>Regulatory changes may affect the availability or legality of the service</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4 font-bold">
                            YOU USE THIS SERVICE ENTIRELY AT YOUR OWN RISK. WE ARE NOT RESPONSIBLE FOR ANY LOSSES.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">7. Limitation of Liability</h2>
                        <p className="text-gray-300 leading-relaxed">
                            TO THE MAXIMUM EXTENT PERMITTED BY LAW, UNIK PROTOCOL AND ITS DEVELOPERS, CONTRIBUTORS, AND AFFILIATES SHALL NOT BE LIABLE FOR:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Any direct, indirect, incidental, special, or consequential damages</li>
                            <li>Loss of profits, revenue, data, or cryptocurrency</li>
                            <li>Service interruptions or technical failures</li>
                            <li>Actions of third parties, including hackers or malicious actors</li>
                            <li>Errors in transaction processing</li>
                            <li>User errors, including sending funds to wrong addresses</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">8. Indemnification</h2>
                        <p className="text-gray-300 leading-relaxed">
                            You agree to indemnify, defend, and hold harmless UNIK Protocol and its developers from any claims, damages, losses, or expenses arising from:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 mt-4 space-y-2">
                            <li>Your use or misuse of the service</li>
                            <li>Your violation of these terms</li>
                            <li>Your violation of any applicable laws or regulations</li>
                            <li>Any claims by third parties related to your use of the service</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">9. Modifications to Service and Terms</h2>
                        <p className="text-gray-300 leading-relaxed">
                            We reserve the right to modify, suspend, or discontinue the service at any time without notice. We may also update these Terms of Service. Continued use of the service after changes constitutes acceptance of the modified terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">10. Governing Law</h2>
                        <p className="text-gray-300 leading-relaxed">
                            These terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration in a neutral jurisdiction.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">11. Severability</h2>
                        <p className="text-gray-300 leading-relaxed">
                            If any provision of these terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">12. Contact</h2>
                        <p className="text-gray-300 leading-relaxed">
                            For questions about these Terms of Service, please contact us through our official channels.
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
