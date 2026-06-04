'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scaleIn } from '@/lib/animations';
import { CameraIcon } from './Icons';

export default function NewsEditorModal({ isOpen, onClose, onRefresh }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File too large (max 5MB)');
            return;
        }

        setImageFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            if (imageFile) {
                formData.append('image', imageFile);
            }

            const res = await fetch('/api/news', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to create news');
            }

            // Success
            setTitle('');
            setDescription('');
            setImageFile(null);
            setPreviewUrl(null);
            if (onRefresh) onRefresh();
            onClose();
        } catch (err) {
            console.error('Error submitting news:', err);
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div
                    variants={scaleIn}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-white mb-4 font-prompt">เพิ่มข่าวประชาสัมพันธ์</h2>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-white/70 text-sm font-medium mb-1">หัวข้อข่าว</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#4ade80]"
                                    placeholder="ใส่หัวข้อข่าว..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-white/70 text-sm font-medium mb-1">รายละเอียด</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#4ade80] min-h-[100px]"
                                    placeholder="ใส่รายละเอียด..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-white/70 text-sm font-medium mb-1">รูปภาพประกอบ</label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center cursor-pointer hover:border-[#4ade80]/50 transition-colors"
                                >
                                    {previewUrl ? (
                                        <div className="relative h-40 w-full rounded-md overflow-hidden">
                                            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="py-4 text-white/40">
                                            <span className="block text-2xl mb-2"><CameraIcon size={28} /></span>
                                            <span>คลิกเพื่อเลือกรูปภาพ</span>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2 bg-[#4ade80] hover:bg-[#4ade80]/80 text-black font-bold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            กำลังบันทึก...
                                        </>
                                    ) : (
                                        'โพสต์ข่าว'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
