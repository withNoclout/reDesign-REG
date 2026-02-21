'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LockIcon } from '../components/Icons';

const CredentialContext = createContext(null);

export function CredentialProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState({ title: '', message: '', resolve: null });
    const [password, setPassword] = useState('');

    const requestCredential = useCallback((title = 'ยืนยันตัวตน', message = 'กรุณากรอกรหัสผ่านเพื่อดำเนินการต่อ') => {
        return new Promise((resolve) => {
            setConfig({ title, message, resolve });
            setPassword('');
            setIsOpen(true);
        });
    }, []);

    const handleConfirm = () => {
        if (!password) return;
        if (config.resolve) config.resolve(password);
        setIsOpen(false);
    };

    const handleCancel = () => {
        if (config.resolve) config.resolve(null);
        setIsOpen(false);
    };

    // Handle Enter key pressing
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <CredentialContext.Provider value={{ requestCredential }}>
            {children}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#1a1c29] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
                        >
                            <div className="text-center mb-6">
                                <div className="mx-auto w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-3 border border-blue-500/30">
                                    <LockIcon size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{config.title}</h3>
                                <p className="text-white/60 text-sm">
                                    {config.message}
                                </p>
                            </div>

                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="รหัสผ่านเข้าสู่ระบบสำนักทะเบียน"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 mb-6 transition-colors"
                                autoFocus
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors font-medium text-sm"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={!password}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all font-medium text-sm disabled:opacity-50 shadow-lg"
                                >
                                    ยืนยัน
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </CredentialContext.Provider>
    );
}

export function useCredential() {
    const context = useContext(CredentialContext);
    if (!context) {
        throw new Error('useCredential must be used within a CredentialProvider');
    }
    return context;
}
