'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import AddContentCard from './AddContentCard';
import PortfolioEditorModal from './PortfolioEditorModal';

export default function PortfolioGrid() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [retryingItem, setRetryingItem] = useState(null);

    // Check if user is specific admin
    const isAdmin = user?.username === 's6701091611290';

    const fetchContent = async () => {
        try {
            const res = await fetch('/api/portfolio/content');
            const json = await res.json();
            if (json.success) {
                setItems(json.data);
            }
        } catch (err) {
            console.error('Failed to fetch portfolio:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchContent();
    }, []);

    const handleRetryItem = async (itemId) => {
        setRetryingItem(itemId);

        try {
            const res = await fetch('/api/portfolio/retry-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId }),
            });

            const data = await res.json();

            if (data.success) {
                // Refresh the grid
                await fetchContent();
                alert('✅ อัพโหลดสำเร็จ');
            } else {
                alert('❌ อัพโหลดไม่สำเร็จ: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Retry error:', error);
            alert('❌ เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setRetryingItem(null);
        }
    };

    return (
        <section className="py-12">
            <div className="flex items-center justify-between mb-8 px-4">
                <h2 className="text-3xl font-bold text-white font-prompt flex items-center gap-3">
                    <span className="w-2 h-8 bg-[#ff5722] rounded-full"></span>
                    Portfolio Gallery
                </h2>
                <div className="text-white/40 text-sm">{items.length} Posts</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                {/* Add Trigger (Visible to all users for their own portfolio) */}
                <AddContentCard onClick={() => setIsModalOpen(true)} className="col-span-2 aspect-[2/1]" />

                {/* Content Items */}
                <AnimatePresence>
                    {items.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/5"
                        >
                            {/* Image */}
                            {item.image_url && item.uploaded_to_supabase ? (
                                <img
                                    src={item.image_url}
                                    alt={item.description}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 text-white/20 p-4">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <span className="text-sm">Not Uploaded</span>
                                </div>
                            )}

                            {/* Upload Status Indicator */}
                            {!item.uploaded_to_supabase && (
                                <div className="absolute top-3 right-3 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10">
                                    Upload Pending
                                </div>
                            )}

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                                <p className="text-white font-prompt text-sm line-clamp-3">
                                    {item.description}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-white/40 text-xs">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </span>

                                    {/* Retry Button for Failed Uploads */}
                                    {!item.uploaded_to_supabase && item.temp_path && (
                                        <button
                                            onClick={() => handleRetryItem(item.id)}
                                            disabled={retryingItem === item.id}
                                            className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                        >
                                            {retryingItem === item.id ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Uploading...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M23 4v6h-6" />
                                                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                                    </svg>
                                                    <span>Retry</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <PortfolioEditorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onRefresh={fetchContent}
            />
        </section>
    );
}
