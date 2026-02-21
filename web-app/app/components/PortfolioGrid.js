import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import AddContentCard from './AddContentCard';
import PortfolioEditorModal from './PortfolioEditorModal';
import CustomPortfolioGrid from './CustomPortfolioGrid';
import { TagIcon, FileTextIcon, SparklesIcon, LinkIcon, UsersIcon, CheckIcon, XIcon } from './Icons';

/**
 * Smart sort: visible first → more collaborators first → newer first.
 * Manual mode uses saved order. Newest/oldest sort by created_at.
 */
function sortItems(items, collaborations, sortMode, customItemOrder) {
    const all = [...items, ...collaborations];

    if (sortMode === 'manual' && customItemOrder?.length > 0) {
        const orderMap = new Map(customItemOrder.map((id, i) => [id, i]));
        const ordered = [];
        const unordered = [];
        for (const item of all) {
            if (orderMap.has(item.id)) {
                ordered.push(item);
            } else {
                unordered.push(item);
            }
        }
        ordered.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));
        return [...ordered, ...unordered];
    }

    // Sort by visibility first for all non-manual modes
    return all.sort((a, b) => {
        const isVisibleA = a.is_visible !== false;
        const isVisibleB = b.is_visible !== false;

        // 1. Visible items always come before hidden items
        if (isVisibleA && !isVisibleB) return -1;
        if (!isVisibleA && isVisibleB) return 1;

        // 2. Secondary sort based on the mode
        if (sortMode === 'newest') {
            return new Date(b.created_at) - new Date(a.created_at);
        }

        if (sortMode === 'oldest') {
            return new Date(a.created_at) - new Date(b.created_at);
        }

        // Default: auto sort (More collaborators first, then Chronological)
        const collabA = a.collaborator_count || 0;
        const collabB = b.collaborator_count || 0;
        if (collabA !== collabB) return collabB - collabA;

        return new Date(b.created_at) - new Date(a.created_at);
    });
}

function PendingTagsBanner({ count, userId, onRespond }) {
    const [tags, setTags] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [responding, setResponding] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!expanded || !userId) return;
        setLoading(true);
        fetch('/api/portfolio/collaborator')
            .then(res => res.json())
            .then(json => {
                if (json.success && json.data?.tags) {
                    setTags(json.data.tags);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [expanded, userId]);

    const handleRespond = async (portfolioId, action) => {
        setResponding(portfolioId);
        try {
            const res = await fetch('/api/portfolio/collaborator', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolio_id: portfolioId, action }),
            });
            const json = await res.json();
            if (json.success) {
                setTags(prev => prev.filter(t => t.portfolio_id !== portfolioId));
                onRespond && onRespond();
            }
        } catch (err) {
            console.error('Respond error:', err);
        } finally {
            setResponding(null);
        }
    };

    if (count === 0) return null;

    return (
        <div className="mb-4 mx-4">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl px-4 py-3 flex items-center justify-between text-left transition-all hover:border-blue-500/40"
                aria-expanded={expanded}
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg"><TagIcon size={18} /></span>
                    <span className="text-white/90 text-sm font-medium">
                        {count} pending collaboration {count > 1 ? 'tags' : 'tag'}
                    </span>
                </div>
                <span className="text-white/40 text-xs">{expanded ? '▲' : '▼'}</span>
            </button>

            {/* Expanded tag list */}
            {expanded && (
                <div className="mt-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-4 text-center text-white/50 text-sm">กำลังโหลด...</div>
                    ) : tags.length === 0 ? (
                        <div className="p-4 text-center text-white/50 text-sm">ไม่มีคำเชิญที่รอดำเนินการ</div>
                    ) : (
                        tags.map((tag) => (
                            <div key={tag.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
                                {/* Portfolio thumbnail */}
                                <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                                    {tag.portfolio?.image_url ? (
                                        <img src={tag.portfolio.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/20 text-lg"><FileTextIcon size={24} /></div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white/90 font-medium truncate">
                                        {tag.portfolio?.topic || tag.portfolio?.description || 'Portfolio item'}
                                    </div>
                                    <div className="text-xs text-white/50">
                                        เพิ่มโดย {tag.added_by_info?.name_th || tag.added_by_info?.name_en || tag.added_by}
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleRespond(tag.portfolio_id, 'accepted')}
                                        disabled={responding === tag.portfolio_id}
                                        className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/30 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                                        aria-label="Accept collaboration"
                                    >
                                        <CheckIcon size={14} className="inline" /> ยอมรับ
                                    </button>
                                    <button
                                        onClick={() => handleRespond(tag.portfolio_id, 'rejected')}
                                        disabled={responding === tag.portfolio_id}
                                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                                        aria-label="Reject collaboration"
                                    >
                                        <XIcon size={14} className="inline" /> ปฏิเสธ
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function getPaginationGroup(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
        return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function PortfolioGrid() {
    const { user, logout } = useAuth();
    const { isGuest } = useGuest();

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
    const [collaborations, setCollaborations] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [retryingItem, setRetryingItem] = useState(null);
    const [showControls, setShowControls] = useState(false);
    const [isManageMode, setIsManageMode] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Helper Classes
    const columnClass = `columns-${settings.fixedConfig?.columnCount || 3}`;
    const gapClass = settings.fixedConfig?.gapSize === 'compact' ? 'gap-1.5' : 'gap-6';

    const fetchContent = useCallback(async () => {
        try {
            const res = await fetch(`/api/portfolio/content`);

            if (res.status === 401) {
                if (logout) logout();
                return;
            }

            const json = await res.json();
            if (json.success) {
                setItems(json.data);
                setCollaborations(json.collaborations || []);
                setPendingCount(json.pending_count || 0);
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
                alert('อัพโหลดสำเร็จ');
            } else {
                alert('อัพโหลดไม่สำเร็จ');
            }
        } catch (error) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
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
            alert('Failed to update visibility');
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
            alert('Failed to delete item');
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

    // Sorted items for rendering (Filter out hidden if Guest)
    const sortedItems = useMemo(() => {
        const activeItems = isGuest ? items.filter(i => i.is_visible !== false) : items;
        return sortItems(activeItems, collaborations, settings.sortMode, settings.customItemOrder);
    }, [items, collaborations, settings.sortMode, settings.customItemOrder, isGuest]);

    // --- Pagination Logic ---
    const ITEMS_PER_PAGE = 9; // Hardcoded to 9 as requested

    // Page 1 has Add Content Card (1 slot) for owners, so it fits ITEMS_PER_PAGE - 1 items. Guests get all 9.
    const firstPageItemCount = isGuest ? ITEMS_PER_PAGE : ITEMS_PER_PAGE - 1;

    const totalPages = useMemo(() => {
        if (sortedItems.length === 0) return 1;
        // If items can fit on page 1
        if (sortedItems.length <= firstPageItemCount) return 1;

        // Remaining items after page 1
        const remainingItems = sortedItems.length - firstPageItemCount;
        return 1 + Math.ceil(remainingItems / ITEMS_PER_PAGE);
    }, [sortedItems.length, firstPageItemCount, ITEMS_PER_PAGE]);

    // Ensure currentPage is valid if items are deleted
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(Math.max(1, totalPages));
        }
    }, [totalPages, currentPage]);

    const paginatedItems = useMemo(() => {
        if (isCustomMode) {
            // In custom mode, pagination might ruin absolute positioning layouts unless strictly handled.
            // For now, let's just return all items up to the max safe limit or simply all items.
            return sortedItems;
        }

        if (currentPage === 1) {
            return sortedItems.slice(0, firstPageItemCount);
        } else {
            const startIndex = firstPageItemCount + (currentPage - 2) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            return sortedItems.slice(startIndex, endIndex);
        }
    }, [sortedItems, currentPage, isCustomMode, firstPageItemCount, ITEMS_PER_PAGE]);

    // Save manual order (for drag-to-reorder in Fixed mode)
    const handleManualReorder = useCallback((newOrder) => {
        updateSetting('customItemOrder', newOrder);
        updateSetting('sortMode', 'manual');
    }, [updateSetting]);

    return (
        <section className="relative pt-0 flex flex-col min-h-[750px]">
            {/* Pending Collaboration Tags Banner */}
            {pendingCount > 0 && (
                <PendingTagsBanner count={pendingCount} userId={user?.usercode} onRespond={fetchContent} />
            )}

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
                                    <span className="text-xs text-white/70">Cols</span>
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

                            {/* Sort Mode */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-white/70">Sort</span>
                                <select
                                    value={settings.sortMode || 'auto'}
                                    onChange={(e) => updateSetting('sortMode', e.target.value)}
                                    className="bg-white/10 text-white text-xs rounded-md px-2 py-1 border border-white/10 focus:outline-none focus:border-[#ff5722]/50 cursor-pointer appearance-none"
                                    aria-label="Sort order"
                                >
                                    <option value="auto" className="bg-black">Auto</option>
                                    <option value="newest" className="bg-black">Newest</option>
                                    <option value="oldest" className="bg-black">Oldest</option>
                                    <option value="manual" className="bg-black">Manual</option>
                                </select>
                            </div>

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

                {!isGuest && (
                    <button
                        onClick={() => setShowControls(!showControls)}
                        aria-label={showControls ? 'ปิดการตั้งค่า Portfolio' : 'เปิดการตั้งค่า Portfolio'}
                        aria-expanded={showControls}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showControls ? 'bg-[#ff5722] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                )}
            </div>

            {/* Layout Rendering */}
            {isCustomMode ? (
                <CustomPortfolioGrid
                    items={sortedItems.slice(0, settings.maxItemsPerPage || 12)}
                    savedLayout={settings.customLayout}
                    onLayoutChange={handleCustomLayoutChange}
                    isManageMode={isManageMode}
                    onAddNew={() => { setEditingItem(null); setIsModalOpen(true); }}
                    maxRows={4}
                />
            ) : (
                /* CSS Grid Layout for ProMax Split-Header */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 px-4 content-start min-h-[800px] md:min-h-[1100px]">

                    {/* Add Trigger (Always First, 33% Width on Desktop) - ONLY ON PAGE 1 */}
                    {currentPage === 1 && !isGuest && (
                        <div className="md:col-span-4 flex">
                            <AddContentCard onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="w-full shadow-xl hover:shadow-[#ff5722]/10" />
                        </div>
                    )}

                    {/* Content Items */}
                    <AnimatePresence mode='popLayout'>
                        {paginatedItems.map((item, index) => {
                            // First item is 33% width to match Add Button ONLY ON PAGE 1
                            const isFirstItem = currentPage === 1 && index === 0;
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
                                    className={`${colSpanClass} flex flex-col p-4 rounded-3xl group relative bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-[box-shadow,background-color,border-color] duration-300 hover:shadow-2xl ${item.is_visible === false && !isManageMode ? 'grayscale opacity-50' : ''}`}
                                >
                                    {/* Management Overlays */}
                                    {isManageMode && (
                                        <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
                                            {/* Edit Button (own items only) */}
                                            {!item.is_collaboration && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingItem(item);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="p-2 rounded-full bg-white/20 text-white hover:bg-[#ff5722] backdrop-blur-md shadow-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>
                                            )}

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
                                        {!item.uploaded_to_supabase && !item.is_collaboration && (
                                            <div className="absolute top-3 right-3 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10 backdrop-blur-md bg-opacity-90">
                                                Upload Pending
                                            </div>
                                        )}

                                        {/* Collaboration Badge */}
                                        {item.is_collaboration && (
                                            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white/90 px-3 py-1 rounded-full text-xs font-medium shadow-lg z-10 border border-white/10 flex items-center gap-1.5">
                                                <LinkIcon size={14} className="inline" /> Shared with you
                                            </div>
                                        )}

                                        {/* Collaborator Count Badge (own items) */}
                                        {!item.is_collaboration && item.collaborator_count > 0 && (
                                            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white/90 px-2.5 py-1 rounded-full text-xs font-medium shadow-lg z-10 border border-white/10 flex items-center gap-1">
                                                <UsersIcon size={14} className="inline" /> {item.collaborator_count}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Below Image (Flex Grow to push footer to bottom) */}
                                    <div className='flex flex-col flex-grow space-y-3'>

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

                                        {/* Metadata & Actions (Pushed to bottom using mt-auto) */}
                                        <div className='flex items-center justify-between border-t border-white/5 pt-3 mt-auto'>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-white/70 text-xs font-light">
                                                    {new Date(item.created_at).toLocaleDateString('th-TH', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                                {item.is_collaboration && item.added_by && (
                                                    <span className="text-white/40 text-[10px]">
                                                        Added by: {item.added_by}
                                                    </span>
                                                )}
                                            </div>

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

            {/* Pagination Controls (Only for Fixed Mode) */}
            {!isCustomMode && totalPages > 1 && (
                <div className="flex justify-center items-center mt-auto pt-12 pb-12 gap-2 w-full">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        aria-label="Previous Page"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>

                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/5">
                        {getPaginationGroup(currentPage, totalPages).map((page, idx) => (
                            page === '...' ? (
                                <span key={`ellipsis-${idx}`} className="w-10 h-10 flex items-center justify-center text-white/40 font-bold select-none text-sm">
                                    ...
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${currentPage === page ? 'bg-[#ff5722] text-white shadow-lg shadow-[#ff5722]/20' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {page}
                                </button>
                            )
                        ))}
                    </div>

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        aria-label="Next Page"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            )}

            <PortfolioEditorModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
                onRefresh={fetchContent}
                editItem={editingItem}
            />
        </section>
    );
}
