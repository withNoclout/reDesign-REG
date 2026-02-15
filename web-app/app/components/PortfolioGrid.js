import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import AddContentCard from './AddContentCard';
import PortfolioEditorModal from './PortfolioEditorModal';
import CustomPortfolioGrid from './CustomPortfolioGrid';

export default function PortfolioGrid() {
    const { user, logout } = useAuth();

    // Portfolio Settings Hook
    const {
        settings,
        isLoading,
        setIsLoading,
        isSaving,
        updateSetting,
        saveSettings
    } = usePortfolioSettings();

    // Local State
    const [items, setItems] = useState([]);
    const [retryingItem, setRetryingItem] = useState(null);
    const [showControls, setShowControls] = useState(false);
    const [isManageMode, setIsManageMode] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Helper Classes
    const columnClass = `columns-${settings.fixedConfig?.columnCount || 3}`;
    const gapClass = settings.fixedConfig?.gapSize === 'compact' ? 'gap-1.5' : 'gap-6';

    const fetchContent = useCallback(async () => {
        try {
            const res = await fetch(`/api/portfolio/content?t=${Date.now()}`);

            if (res.status === 401) {
                if (logout) logout();
                return;
            }

            const json = await res.json();
            if (json.success) {
                setItems(json.data);
            }
        } catch (err) {
            console.error('Failed to fetch portfolio:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

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
                await fetchContent();
                alert('✅ อัพโหลดสำเร็จ');
            } else {
                alert('❌ อัพโหลดไม่สำเร็จ');
            }
        } catch (error) {
            alert('❌ เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setRetryingItem(null);
        }
    };

    const handleToggleVisibility = async (id, currentVisibility) => {
        const newVisibility = !currentVisibility;
        setItems(prev => prev.map(item => item.id === id ? { ...item, is_visible: newVisibility } : item));
        try {
            const res = await fetch('/api/portfolio/content', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_visible: newVisibility }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
        } catch (err) {
            setItems(prev => prev.map(item => item.id === id ? { ...item, is_visible: currentVisibility } : item));
            alert('❌ Failed to update visibility');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('ยืนยันการลบ?')) return;
        const previousItems = [...items];
        setItems(prev => prev.filter(item => item.id !== id));
        try {
            const res = await fetch(`/api/portfolio/content?id=${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
        } catch (err) {
            setItems(previousItems);
            alert('❌ Failed to delete item');
        }
    };

    const handleSaveSettings = async () => {
        await saveSettings(settings);
    };

    const updateFixedConfig = (key, value) => {
        updateSetting('fixedConfig', { ...settings.fixedConfig, [key]: value });
    };

    const handleCustomLayoutChange = (newLayout) => {
        updateSetting('customLayout', newLayout);
    };

    const isCustomMode = settings.mode === 'custom';

    return (
        <section className="relative pt-0">
            {/* View Controls (Absolute Top Right) */}
            <div className="absolute -top-12 right-4 z-20 flex items-center gap-2">
                <AnimatePresence>
                    {showControls && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="bg-black/80 backdrop-blur-md border border-white/10 rounded-full p-2 flex items-center gap-4 pr-6"
                        >
                            {/* Manage Mode Toggle */}
                            <button
                                onClick={() => setIsManageMode(!isManageMode)}
                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${isManageMode ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
                            >
                                {isManageMode ? 'Done' : 'Manage'}
                            </button>
                            <div className="w-px h-4 bg-white/20"></div>

                            {/* Mode Toggle: Fixed / Custom */}
                            <div className="flex bg-white/10 rounded-lg p-0.5">
                                <button
                                    onClick={() => updateSetting('mode', 'fixed')}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!isCustomMode ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
                                >
                                    Fixed
                                </button>
                                <button
                                    onClick={() => updateSetting('mode', 'custom')}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${isCustomMode ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
                                >
                                    Custom
                                </button>
                            </div>

                            <div className="w-px h-4 bg-white/20"></div>

                            {/* Column Slider (Only for Fixed Mode) - Hidden on Mobile */}
                            {!isCustomMode && (
                                <div className="hidden md:flex items-center gap-2 pl-2 border-l border-white/20 ml-2">
                                    <span className="text-xs text-white/50">Cols</span>
                                    <input
                                        type="range"
                                        min="2"
                                        max="5"
                                        step="1"
                                        value={settings.fixedConfig?.columnCount || 3}
                                        onChange={(e) => updateFixedConfig('columnCount', parseInt(e.target.value))}
                                        className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#ff5722]"
                                    />
                                    <span className="text-xs text-white font-bold w-3">{settings.fixedConfig?.columnCount || 3}</span>
                                </div>
                            )}

                            {/* Gap Toggle (Only for Fixed Mode) */}
                            {!isCustomMode && (
                                <>
                                    <div className="w-px h-4 bg-white/20"></div>
                                    <button
                                        onClick={() => updateFixedConfig('gapSize', (settings.fixedConfig?.gapSize || 'normal') === 'normal' ? 'compact' : 'normal')}
                                        className={`text-xs font-medium transition-colors ${(settings.fixedConfig?.gapSize || 'normal') === 'compact' ? 'text-[#ff5722]' : 'text-white/60 hover:text-white'}`}
                                    >
                                        {(settings.fixedConfig?.gapSize || 'normal') === 'compact' ? 'Compact' : 'Comfy'}
                                    </button>
                                </>
                            )}


                            <div className="w-px h-4 bg-white/20"></div>

                            {/* Save Button */}
                            <button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="text-xs font-bold text-white/80 hover:text-white transition-colors"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={() => setShowControls(!showControls)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showControls ? 'bg-[#ff5722] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </div>

            {/* Layout Rendering */}
            {isCustomMode ? (
                <CustomPortfolioGrid
                    items={items.slice(0, settings.maxItemsPerPage || 12)}
                    savedLayout={settings.customLayout}
                    onLayoutChange={handleCustomLayoutChange}
                    isManageMode={isManageMode}
                    onAddNew={() => setIsModalOpen(true)}
                    maxRows={4}
                />
            ) : (
                /* CSS Grid Layout for ProMax Split-Header */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 px-4">

                    {/* Add Trigger (Always First, 33% Width on Desktop) */}
                    <div className="md:col-span-4 h-full min-h-[250px]">
                        <AddContentCard onClick={() => setIsModalOpen(true)} className="w-full h-full shadow-xl hover:shadow-[#ff5722]/10" />
                    </div>

                    {/* Content Items */}
                    <AnimatePresence mode='popLayout'>
                        {items.slice(0, settings.maxItemsPerPage || 12).map((item, index) => {
                            // First item is 33% width to match Add Button
                            const isFirstItem = index === 0;
                            // Dynamic Column Span Calculation based on Slider
                            const columns = settings.fixedConfig?.columnCount || 3;
                            const otherSpan = 12 / columns;
                            const colSpanClass = isFirstItem ? 'md:col-span-4' : `md:col-span-${otherSpan}`;
                            
                            return (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: item.is_visible === false && !isManageMode ? 0.3 : 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: index * 0.05 }}
                                className={`${colSpanClass} h-full min-h-[250px] p-4 rounded-3xl group relative bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-[box-shadow,background-color,border-color] duration-300 hover:shadow-2xl ${item.is_visible === false && !isManageMode ? 'grayscale opacity-50' : ''}`}
                            >
                                {/* Management Overlays */}
                                {isManageMode && (
                                    <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
                                        {/* Visibility Toggle */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleVisibility(item.id, item.is_visible);
                                            }}
                                            className={`p-2 rounded-full backdrop-blur-md shadow-lg transition-all ${item.is_visible !== false ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                                            title={item.is_visible !== false ? "Visible" : "Hidden"}
                                        >
                                            {item.is_visible !== false ? (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                            ) : (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                            )}
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(item.id);
                                            }}
                                            className="p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white backdrop-blur-md shadow-lg transition-all"
                                            title="Delete"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    </div>
                                )}

                                {/* Image Container with Natural Aspect Ratio */}
                                <div className={`relative overflow-hidden rounded-2xl mb-4 bg-black/20 h-48`}>
                                    {item.is_visible === false && (
                                        <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center pointer-events-none">
                                            <span className="bg-black/50 backdrop-blur px-2 py-1 rounded text-xs text-white/70 font-bold border border-white/10">Hidden</span>
                                        </div>
                                    )}
                                    {item.image_url && item.uploaded_to_supabase ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.description}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full aspect-[4/3] flex flex-col items-center justify-center text-white/20">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            <span className="text-sm">Not Uploaded</span>
                                        </div>
                                    )}

                                    {/* Status Badges */}
                                    {!item.uploaded_to_supabase && (
                                        <div className="absolute top-3 right-3 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10 backdrop-blur-md bg-opacity-90">
                                            Upload Pending
                                        </div>
                                    )}
                                </div>

                                {/* Content Below Image */}
                                <div className='space-y-3'>

                                    {/* Topic (New Field) */}
                                    {item.topic && (
                                        <h3 className='font-prompt font-bold text-white leading-tight text-lg'>
                                            {item.topic}
                                        </h3>
                                    )}

                                    {/* Description */}
                                    <p className='text-white font-prompt font-light text-white/80 text-sm leading-relaxed line-clamp-2'>
                                        {item.description}
                                    </p>

                                    {/* Metadata & Actions */}
                                    <div className='flex items-center justify-between border-t border-white/5 pt-3'>
                                        <span className="text-white/40 text-xs font-light">
                                            {new Date(item.created_at).toLocaleDateString('th-TH', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </span>

                                        {/* Retry Button */}
                                        {!item.uploaded_to_supabase && item.temp_path && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRetryItem(item.id);
                                                }}
                                                disabled={retryingItem === item.id}
                                                className="px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/20 hover:border-orange-500 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                            >
                                                {retryingItem === item.id ? (
                                                    <>
                                                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
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
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            <PortfolioEditorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onRefresh={fetchContent}
            />
        </section>
    );
}
