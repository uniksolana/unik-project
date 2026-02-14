
"use client";

import { useState, useEffect } from 'react';

import { usePreferences } from '../../context/PreferencesContext';

export function SettingsModal({ isOpen, onClose, avatarUrl, handleAvatarUpload, uploadingAvatar, network, registeredAlias, registeredAt, handleRemoveAvatar, handleDeleteAlias }: any) {
    const { language, setLanguage, currency, setCurrency, t } = usePreferences();

    const [activeTab, setActiveTab] = useState('general');
    const [tempCurrency, setTempCurrency] = useState(currency);
    const [tempLang, setTempLang] = useState(language);
    const [removingAvatar, setRemovingAvatar] = useState(false);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [avatarUrl]);

    // Sync temp state when modal opens
    useEffect(() => {
        if (isOpen) {
            setTempCurrency(currency);
            setTempLang(language);
        }
    }, [isOpen, currency, language]);

    const handleSave = () => {
        setLanguage(tempLang);
        setCurrency(tempCurrency);
        onClose();
    };

    const onRemove = async () => {
        if (!confirm("Are you sure you want to remove your profile picture?")) return;
        setRemovingAvatar(true);
        await handleRemoveAvatar();
        setRemovingAvatar(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}></div>
            <div className="relative bg-[#1a1a2e] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/5 bg-[#13131f]">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {t('settings')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 bg-[#13131f]">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'general' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('network')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'network' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        {t('network')}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {activeTab === 'general' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Avatar Section */}
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-black/40 border border-white/10 group">
                                    {avatarUrl && !imageError ? (
                                        <img
                                            src={avatarUrl}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                            onError={() => setImageError(true)}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-900">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        </div>
                                    )}
                                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                        {uploadingAvatar ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                                    </label>
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{t('profile_picture')}</h4>
                                    <p className="text-xs text-gray-400">Visible to active contacts.</p>
                                    {!registeredAlias && <p className="text-xs text-red-400 font-bold mt-1">Register an alias first.</p>}
                                    {avatarUrl && registeredAlias && (
                                        <button
                                            onClick={onRemove}
                                            disabled={removingAvatar}
                                            className="mt-2 text-xs text-red-500 hover:text-red-400 font-bold transition-colors flex items-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            {removingAvatar ? 'Removing...' : t('remove_photo')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Preferences */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('language')}</label>
                                    <select
                                        value={tempLang}
                                        onChange={(e) => setTempLang(e.target.value as any)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors"
                                    >
                                        <option value="en" className="bg-[#1a1a2e]">English</option>
                                        <option value="es" className="bg-[#1a1a2e]">Español</option>
                                        <option value="fr" className="bg-[#1a1a2e]">Français</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('currency')}</label>
                                    <select
                                        value={tempCurrency}
                                        onChange={(e) => setTempCurrency(e.target.value as any)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors"
                                    >
                                        <option value="USD" className="bg-[#1a1a2e]">USD ($)</option>
                                        <option value="EUR" className="bg-[#1a1a2e]">EUR (€)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'network' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                <h4 className="font-bold text-yellow-500 text-sm mb-1">Developer Network</h4>
                                <p className="text-xs text-gray-300">UNIK is currently optimized for Solana Devnet.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('network')}</label>
                                <div className="space-y-2">
                                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${network === 'devnet' ? 'bg-cyan-500/10 border-cyan-500' : 'bg-black/20 border-white/10'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${network === 'devnet' ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-gray-600'}`}></div>
                                            <span className="font-bold text-sm">Devnet (Recommended)</span>
                                        </div>
                                        <div className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center">
                                            {network === 'devnet' && <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>}
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-[#13131f] flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">{t('cancel')}</button>
                    <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold shadow-lg transition-all">{t('save_settings')}</button>
                </div>
            </div>
        </div>
    );
}
