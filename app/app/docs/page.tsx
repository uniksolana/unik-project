'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function DocsPage() {
    const [content, setContent] = useState<string>('');
    const [activeSection, setActiveSection] = useState<string>('');

    useEffect(() => {
        fetch('/DOCUMENTATION.md')
            .then(res => res.text())
            .then(text => setContent(text))
            .catch(() => setContent('# Error loading documentation'));
    }, []);

    // Parse markdown to HTML (lightweight parser)
    const parseMarkdown = (md: string): string => {
        let html = md
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

            // Horizontal rules
            .replace(/^---$/gm, '<hr class="border-white/10 my-10" />')

            // Headers
            .replace(/^######\s+(.+)$/gm, '<h6 class="text-base font-semibold text-gray-300 mt-6 mb-2">$1</h6>')
            .replace(/^#####\s+(.+)$/gm, '<h5 class="text-lg font-semibold text-gray-200 mt-6 mb-2">$1</h5>')
            .replace(/^####\s+(.+)$/gm, '<h4 class="text-xl font-bold text-white mt-8 mb-3">$1</h4>')
            .replace(/^###\s+(.+)$/gm, '<h3 class="text-2xl font-bold text-white mt-10 mb-4">$1</h3>')
            .replace(/^##\s+(.+)$/gm, '<h2 id="$1" class="text-3xl font-bold text-white mt-14 mb-6 pb-3 border-b border-white/10">$1</h2>')
            .replace(/^#\s+(.+)$/gm, '<h1 class="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">$1</h1>')

            // Blockquotes
            .replace(/^&gt;\s+(.+)$/gm, '<blockquote class="border-l-4 border-purple-500/50 pl-4 py-2 my-4 text-gray-400 bg-purple-500/5 rounded-r-lg">$1</blockquote>')

            // Code blocks
            .replace(/```(\w*)\n([\s\S]*?)```/gm, (_match, _lang, code) =>
                `<pre class="bg-[#1a1a2e] border border-white/5 rounded-xl p-4 my-4 overflow-x-auto text-sm"><code class="text-green-400">${code.trim()}</code></pre>`
            )

            // Tables
            .replace(/^\|(.+)\|$/gm, (match) => {
                const cells = match.split('|').filter(c => c.trim());
                if (cells.every(c => /^[\s-:]+$/.test(c))) {
                    return '<!-- table-separator -->';
                }
                return match;
            })

            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')

            // Italic
            .replace(/\*(.+?)\*/g, '<em class="text-gray-300 italic">$1</em>')

            // Inline code
            .replace(/`([^`]+)`/g, '<code class="bg-white/5 text-cyan-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')

            // Unordered lists
            .replace(/^- (.+)$/gm, '<li class="ml-4 pl-2 py-1 text-gray-300 list-disc">$1</li>')

            // Ordered lists
            .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 pl-2 py-1 text-gray-300 list-decimal">$1</li>')

            // Paragraphs (lines that aren't already tagged)
            .replace(/^(?!<[hbloupri]|<!--|$)(.+)$/gm, '<p class="text-gray-400 leading-relaxed mb-4">$1</p>');

        // Wrap consecutive list items
        html = html.replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul class="my-4 space-y-1">$1</ul>');

        // Simple table parsing
        const tableRegex = /(<p[^>]*>\|.+\|<\/p>\s*(?:<!-- table-separator -->\s*)?)+/g;
        html = html.replace(tableRegex, (block) => {
            const lines = block
                .replace(/<\/?p[^>]*>/g, '')
                .replace(/<!-- table-separator -->/g, '|||SEPARATOR|||')
                .split('\n')
                .filter(l => l.trim());

            let tableHtml = '<div class="overflow-x-auto my-6"><table class="w-full text-sm border-collapse">';
            let isHeader = true;

            for (const line of lines) {
                if (line.includes('|||SEPARATOR|||')) {
                    isHeader = false;
                    continue;
                }
                const cells = line.split('|').filter(c => c.trim());
                if (cells.length === 0) continue;

                const tag = isHeader ? 'th' : 'td';
                const cellClass = isHeader
                    ? 'px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider bg-white/5 border-b border-white/10'
                    : 'px-4 py-3 text-gray-400 border-b border-white/5';

                tableHtml += '<tr>';
                for (const cell of cells) {
                    tableHtml += `<${tag} class="${cellClass}">${cell.trim()}</${tag}>`;
                }
                tableHtml += '</tr>';
                if (isHeader) isHeader = false;
            }

            tableHtml += '</table></div>';
            return tableHtml;
        });

        return html;
    };

    // Extract sections for navigation
    const sections = content.match(/^##\s+.+$/gm)?.map(s => s.replace(/^##\s+/, '')) || [];

    return (
        <div className="min-h-screen bg-[#0d0d12] text-white selection:bg-purple-500/30 font-sans">

            {/* Background Elements */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[150px]"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[150px]"></div>
            </div>

            {/* Navigation */}
            <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0d0d12]/80 border-b border-white/5">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-3 group">
                        <Image src="/logo-icon.png" alt="UNIK" width={36} height={36} className="w-9 h-9" />
                        <Image src="/logo-text.png" alt="UNIK" width={80} height={24} className="h-6 w-auto hidden sm:block" />
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold rounded-full hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all hover:-translate-y-0.5"
                        >
                            Launch Dashboard →
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="relative z-10 flex container mx-auto">

                {/* Sidebar - Desktop */}
                <aside className="hidden lg:block w-64 shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto border-r border-white/5 py-8 pr-6">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-4">Contenido</h3>
                    <nav className="space-y-1">
                        {sections.map((section, i) => (
                            <a
                                key={i}
                                href={`#${section}`}
                                onClick={() => setActiveSection(section)}
                                className={`block px-4 py-2 text-sm rounded-lg transition-all truncate ${activeSection === section
                                        ? 'bg-purple-500/10 text-purple-400 border-l-2 border-purple-500'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                {section.replace(/^\d+\.\s+/, '').replace(/[📖🔐]/g, '').trim()}
                            </a>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0 px-6 md:px-12 py-12 pb-24 max-w-4xl">
                    {content ? (
                        <article
                            className="prose prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </main>
            </div>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/5 py-8 bg-black/20">
                <div className="container mx-auto px-6 text-center text-gray-600 text-sm">
                    © 2024 UNIK Protocol. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
