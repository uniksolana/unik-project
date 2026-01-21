'use client';

import toast from 'react-hot-toast';

interface TransactionToastProps {
    signature: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export const showTransactionToast = ({ signature, message, type }: TransactionToastProps) => {
    const explorerUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;

    toast.custom(
        (t) => (
            <div
                className={`${t.visible ? 'animate-in slide-in-from-bottom-5' : 'animate-out slide-out-to-bottom-5'
                    } max-w-md w-full bg-[#13131f]/95 backdrop-blur-xl shadow-2xl rounded-2xl pointer-events-auto flex flex-col overflow-hidden border ${type === 'success' ? 'border-green-500/30' : type === 'error' ? 'border-red-500/30' : 'border-cyan-500/30'
                    }`}
            >
                {/* Header */}
                <div className={`px-6 py-4 flex items-center gap-3 ${type === 'success' ? 'bg-green-500/10' : type === 'error' ? 'bg-red-500/10' : 'bg-cyan-500/10'
                    }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === 'success' ? 'bg-green-500/20 text-green-400' :
                            type === 'error' ? 'bg-red-500/20 text-red-400' :
                                'bg-cyan-500/20 text-cyan-400'
                        }`}>
                        {type === 'success' ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : type === 'error' ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className={`font-bold text-sm ${type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-cyan-400'
                            }`}>
                            {type === 'success' ? 'Transaction Successful' : type === 'error' ? 'Transaction Failed' : 'Transaction Info'}
                        </h4>
                        <p className="text-white/90 text-xs mt-0.5 font-medium">{message}</p>
                    </div>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="text-gray-500 hover:text-white transition-colors p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Transaction Hash */}
                <div className="px-6 py-4 bg-black/20 border-t border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Transaction Hash</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono text-gray-400 truncate bg-black/40 px-3 py-2 rounded-lg border border-white/5">
                            {signature.substring(0, 8)}...{signature.substring(signature.length - 8)}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(signature);
                                toast.success('Hash copied!', { duration: 2000 });
                            }}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all text-gray-400 hover:text-white"
                            title="Copy hash"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Explorer Link */}
                <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-6 py-4 flex items-center justify-center gap-2 font-bold text-sm transition-all ${type === 'success' ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400' :
                            type === 'error' ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' :
                                'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400'
                        }`}
                >
                    View on Solscan
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>
        ),
        {
            duration: 8000,
            position: 'bottom-right',
        }
    );
};

export const showSimpleToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const icon = type === 'success'
        ? '✓'
        : type === 'error'
            ? '✕'
            : 'ℹ';

    toast.custom(
        (t) => (
            <div
                className={`${t.visible ? 'animate-in slide-in-from-bottom-5' : 'animate-out slide-out-to-bottom-5'
                    } max-w-md w-full bg-[#13131f]/95 backdrop-blur-xl shadow-2xl rounded-2xl pointer-events-auto flex items-center gap-4 p-4 border ${type === 'success' ? 'border-green-500/30' : type === 'error' ? 'border-red-500/30' : 'border-cyan-500/30'
                    }`}
            >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${type === 'success' ? 'bg-green-500/20 text-green-400' :
                        type === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-cyan-500/20 text-cyan-400'
                    }`}>
                    {type === 'success' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : type === 'error' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                </div>
                <p className="flex-1 text-white text-sm font-medium">{message}</p>
                <button
                    onClick={() => toast.dismiss(t.id)}
                    className="text-gray-500 hover:text-white transition-colors p-1 flex-shrink-0"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        ),
        {
            duration: 4000,
            position: 'bottom-right',
        }
    );
};
