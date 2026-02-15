'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentSearchInput from './StudentSearchInput';

export default function PortfolioEditorModal({ isOpen, onClose, onRefresh }) {
    const [topic, setTopic] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const fileInputRef = useRef(null);

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate File Type
            if (!file.type.startsWith('image/')) {
                setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPEG, PNG, WebP)');
                return;
            }

            // Validate File Size
            if (file.size > MAX_FILE_SIZE) {
                setError('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)');
                return;
            }

            setError(null);
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const triggerUpload = async (itemId, tempPath, retryCount = 0) => {
        const MAX_RETRIES = 3;

        try {
            setUploading(true);
            console.log('[Frontend] Triggering upload for:', itemId, tempPath);

            const res = await fetch('/api/portfolio/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, tempPath }),
            });

            // Check if response is OK before parsing JSON
            if (!res.ok) {
                const errorText = await res.text();
                console.error('[Frontend] Upload failed with status:', res.status, errorText);

                // Retry logic for specific errors
                if (retryCount < MAX_RETRIES && (res.status >= 500 || res.status === 504)) {
                    console.log(`[Frontend] Retrying upload (${retryCount + 1}/${MAX_RETRIES})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
                    return triggerUpload(itemId, tempPath, retryCount + 1);
                }

                throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
            }

            // Parse JSON safely
            let data;
            try {
                data = await res.json();
            } catch (jsonError) {
                console.error('[Frontend] Failed to parse JSON response:', jsonError);
                throw new Error('Invalid response from server');
            }

            if (data.success) {
                console.log('[Frontend] Upload completed successfully');
                // Use callback to refresh instead of reload
                onRefresh && onRefresh();
                onClose();
            } else {
                throw new Error(data.message || 'Upload failed');
            }
        } catch (error) {
            console.error('[Frontend] Upload error:', error);
            setError(`Upload error: ${error.message}`);
            // Don't retry client-side errors
            return false;
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('description', description);
            formData.append('topic', topic);
            if (imageFile) formData.append('image', imageFile);
            if (selectedStudents.length > 0) {
                formData.append('collaborators', JSON.stringify(selectedStudents.map(s => s.user_code)));
            }

            const res = await fetch('/api/portfolio/content', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (res.ok && data.success) {
                const savedItem = data.data[0];
                setDescription('');
                setImageFile(null);
                setPreviewUrl(null);
                setSelectedStudents([]);
                setLoading(false);

                // If there's a temp file, trigger upload
                if (savedItem.temp_path) {
                    await triggerUpload(savedItem.id, savedItem.temp_path);
                } else {
                    // No image, just close modal and refresh
                    onRefresh && onRefresh();
                    onClose();
                }
            } else {
                setError(data.message || 'Failed to upload');
            }
        } catch (error) {
            console.error(error);
            setError('Error submitting: ' + error.message);
        } finally {
            if (!uploading) {
                setLoading(false);
            }
        }
    };

    if (!isOpen) return null;

    // Upload notification component
    const UploadNotification = () => {
        if (!uploading) return null;
        return (
            <div className="fixed bottom-6 left-6 z-[200] bg-[#0f172a] border border-[#ff5722]/50 rounded-xl px-6 py-4 shadow-2xl flex items-center gap-3 animate-pulse" role="status" aria-live="polite">
                <div className="w-6 h-6 border-2 border-[#ff5722] border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
                <div className="text-white font-medium">กำลังอัพโหลดภาพ...</div>
            </div>
        );
    };

    return (
        <>
            <UploadNotification />
            <AnimatePresence>
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative w-full max-w-xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10"
                    >
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-white mb-6 font-prompt text-center">Add Content</h2>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Error Banner */}
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-3 rounded-lg flex items-center gap-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        {error}
                                    </div>
                                )}

                                {/* Image Upload Area */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Click to upload image"
                                    className={`relative aspect-video rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden group ${previewUrl ? 'border-transparent' : 'border-white/20 hover:border-[#ff5722]'
                                        }`}
                                >
                                    {previewUrl ? (
                                        <>
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                                                Change Image
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 group-hover:text-[#ff5722] transition-colors gap-2">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <polyline points="21 15 16 10 5 21" />
                                            </svg>
                                            <span>Click to upload image</span>
                                        </div>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                </div>

                                {/* Description Input */}
                                <div>
                                    <table className="w-full">
                                        <tbody>
                                            <tr className="border-b border-white/10">
                                                <td className="py-2 pr-4 align-top w-24">
                                                    <label className="text-white/70 text-sm font-medium pt-2 block">Topic</label>
                                                </td>
                                                <td className="py-2">
                                                    <input
                                                        type="text"
                                                        value={topic}
                                                        onChange={(e) => setTopic(e.target.value)}
                                                        className="w-full bg-transparent text-white font-prompt font-bold text-lg focus:outline-none placeholder-white/30"
                                                        placeholder="หัวข้อเรื่อง..."
                                                    />
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 align-top">
                                                    <label className="text-white/70 text-sm font-medium pt-2 block">Content</label>
                                                </td>
                                                <td className="py-2">
                                                    <textarea
                                                        value={description}
                                                        onChange={(e) => setDescription(e.target.value)}
                                                        className="w-full bg-transparent text-white/90 focus:outline-none min-h-[100px] resize-none placeholder-white/30 leading-relaxed font-light"
                                                        placeholder="รายละเอียด..."
                                                        required
                                                    />
                                                </td>
                                            </tr>
                                            <tr className="border-t border-white/10">
                                                <td className="py-2 pr-4 align-top">
                                                    <label className="text-white/70 text-xs font-medium pt-2 block uppercase tracking-wider">Related Students</label>
                                                </td>
                                                <td className="py-2">
                                                    <StudentSearchInput
                                                        selectedStudents={selectedStudents}
                                                        onStudentsChange={setSelectedStudents}
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-6 py-2 rounded-xl text-white/60 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-6 py-2 bg-[#ff5722] hover:bg-[#ff7043] text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loading ? 'Uploading...' : 'Post Content'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        </>
    );
}
