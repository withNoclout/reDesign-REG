
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Normalize layout items for comparison — strip RGL-added computed properties
const normalizeLayout = (layout) =>
    layout.map(({ i, x, y, w, h, minW, minH, maxW, maxH, isResizable, isDraggable }) => ({
        i, x, y, w, h,
        ...(minW !== undefined && { minW }),
        ...(minH !== undefined && { minH }),
        ...(maxW !== undefined && { maxW }),
        ...(maxH !== undefined && { maxH }),
        ...(isResizable !== undefined && { isResizable }),
        ...(isDraggable !== undefined && { isDraggable }),
    }));

const layoutsEqual = (a, b) =>
    JSON.stringify(normalizeLayout(a)) === JSON.stringify(normalizeLayout(b));

export default function CustomPortfolioGrid({
    items,
    savedLayout,
    onLayoutChange,
    isManageMode,
    maxRows = 30,
    dynamicRowHeight = 10,
    dynamicCols = 100,
    dynamicMargin = 2,
    dynamicWidth = 800,
    isGuest,
    unplacedPool
}) {
    const [currentLayout, setCurrentLayout] = useState([]);
    const isMounted = useRef(false);
    const isInternalUpdate = useRef(false);

    // Popup Modal State
    const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false);

    const cols = { lg: dynamicCols, md: dynamicCols, sm: dynamicCols, xs: dynamicCols, xxs: dynamicCols };
    const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };

    const generateLayout = useCallback(() => {
        const itemLayouts = items.map((item, i) => {
            return {
                i: item.id.toString(),
                x: (i % 3) * 12,
                y: Math.floor(i / 3) * 12,
                w: 12, h: 12, minW: 1, minH: 1
            };
        });
        return itemLayouts;
    }, [items]);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            // Initialize layout on first mount
            if (savedLayout && savedLayout.length > 0) {
                setCurrentLayout(savedLayout.filter(l => l.i !== 'addNew'));
            } else {
                setCurrentLayout(generateLayout());
            }
            return;
        }

        const currentIds = items.map(i => i.id.toString());
        const existingIds = currentLayout.map(l => l.i);

        const hasNewItems = currentIds.some(id => !existingIds.includes(id));
        const hasDeletedItems = existingIds.some(id => !currentIds.includes(id));

        if (!hasNewItems && !hasDeletedItems) return;

        let updatedLayout = currentLayout.filter(l => currentIds.includes(l.i));

        // Add new items at the bottom
        const newItems = items.filter(i => !existingIds.includes(i.id.toString()));
        if (newItems.length > 0) {
            const maxY = updatedLayout.length > 0
                ? updatedLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
                : 0;
            const newLayoutItems = newItems.map((item, idx) => ({
                i: item.id.toString(),
                x: (idx % 3) * 12,
                y: maxY + (Math.floor(idx / 3) * 12),
                w: 12, h: 12, minW: 1, minH: 1
            }));
            updatedLayout = [...updatedLayout, ...newLayoutItems];
        }

        // Clean any potential rogue addNew item if missed during update
        updatedLayout = updatedLayout.filter(l => l.i !== 'addNew');

        isInternalUpdate.current = true;
        setCurrentLayout(updatedLayout);
    }, [items, savedLayout, generateLayout]); // Added savedLayout and generateLayout to dependencies

    // Removed fullLayout as currentLayout now contains everything we need
    const fullLayout = currentLayout || [];

    const handleLayoutChange = useCallback((layout) => {
        // Skip mount callback and programmatic updates
        if (!isMounted.current || isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }

        // Remove the filter for 'addNew' because we want it managed by RGL now
        const itemLayouts = layout;

        // Just validate minimums without forcing y constraints tightly
        const validatedLayout = itemLayouts.map(l => {
            // Keep user's width and height
            return l;
        });

        if (!layoutsEqual(validatedLayout, currentLayout)) {
            setCurrentLayout(validatedLayout);
            onLayoutChange(validatedLayout);
        }
    }, [currentLayout, onLayoutChange]);

    const handleAddFromDock = useCallback((item) => {
        if (currentLayout.length >= 10) return; // Strict 10 item capacity limit

        const maxY = currentLayout.length > 0
            ? currentLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0)
            : 0;

        const newItemLayout = {
            i: item.id.toString(),
            x: 0,
            y: maxY, // Append to bottom
            w: 30, h: 15, minW: 1, minH: 1 // Default Size expanded to stop 100-Column Math crashing
        };

        const updatedLayout = [...currentLayout, newItemLayout];
        setCurrentLayout(updatedLayout);
        onLayoutChange(updatedLayout);
        setIsSelectorModalOpen(false); // Close modal after adding
    }, [currentLayout, onLayoutChange]);

    const handleRemoveFromGrid = useCallback((id) => {
        const updatedLayout = currentLayout.filter(l => l.i !== id);
        setCurrentLayout(updatedLayout);
        onLayoutChange(updatedLayout);
    }, [currentLayout, onLayoutChange]);

    return (
        <div className="relative">
            {isManageMode && (
                <div
                    className="absolute w-full border-b-2 border-red-500/80 border-dashed z-0 pointer-events-none flex flex-col items-end justify-end pb-1"
                    style={{ top: `${maxRows * dynamicRowHeight + (maxRows - 1) * dynamicMargin}px` }}
                >
                    <span className="text-red-500 text-xs font-bold px-3 py-1 bg-black/80 rounded-l-md border border-red-500/30">
                        Page 1 Boundary (Items below will move to Page 2)
                    </span>
                </div>
            )}

            <div
                className={`w-full rounded-3xl ${!isManageMode ? "overflow-hidden relative" : ""}`}
                style={{
                    ...(isManageMode ? {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                        backgroundSize: `${dynamicWidth / dynamicCols}px ${dynamicRowHeight + dynamicMargin}px`,
                        backgroundPosition: '0 0',
                        border: '1px solid rgba(255,255,255,0.1)'
                    } : {}),
                    ...(!isManageMode ? { maxHeight: `${maxRows * dynamicRowHeight + (maxRows - 1) * dynamicMargin + 16}px` } : {})
                }}
            >
                <ResponsiveGridLayout
                    className="layout"
                    width={dynamicWidth}
                    layouts={{ lg: fullLayout, md: fullLayout, sm: fullLayout }}
                    breakpoints={breakpoints}
                    cols={cols}
                    rowHeight={dynamicRowHeight}
                    margin={[dynamicMargin, dynamicMargin]}
                    isDraggable={isManageMode}
                    isResizable={isManageMode}
                    onLayoutChange={handleLayoutChange}
                    containerPadding={[0, 0]}
                    compactType="vertical"
                    preventCollision={false}
                >
                    {items.filter(item => {
                        const layoutInfo = currentLayout.find(l => l.i === item.id.toString());
                        // STRICT GHOST KILLER: Prevent rendering any item that extends beyond maxRows
                        if (!layoutInfo) return true; // Let new items render to be placed
                        return (layoutInfo.y + layoutInfo.h) <= maxRows;
                    }).map(item => {
                        const layoutInfo = currentLayout.find(l => l.i === item.id.toString());
                        return (
                            <div key={item.id} className={`group relative ${isManageMode ? 'cursor-move' : ''}`}>
                                <div className="w-full h-full rounded-2xl overflow-hidden bg-black/20 border border-white/10 backdrop-blur-sm relative">
                                    {isManageMode && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveFromGrid(item.id.toString()); }}
                                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-50 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    )}
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.description}
                                            className="w-full h-full object-cover"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/20">
                                            No Image
                                        </div>
                                    )}

                                    {!layoutInfo || layoutInfo.w >= 15 && layoutInfo.h >= 15 ? (
                                        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
                                            <h3 className="text-white font-bold text-sm truncate">{item.topic || 'Portfolio Item'}</h3>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </ResponsiveGridLayout>
            </div >

            {/* Modal Launch Button */}
            {isManageMode && (
                <div className="flex justify-center mt-6 pb-4">
                    <button
                        onClick={() => setIsSelectorModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-[#ff5722] border border-white/20 hover:border-[#ff5722] rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-[#ff5722]/30"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        Browse Library ({unplacedPool?.length || 0} available)
                    </button>
                </div>
            )}

            {/* The Image Selector Modal Overlay */}
            {isSelectorModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5722" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                Image Library
                            </h3>
                            <button
                                onClick={() => setIsSelectorModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Modal Body - Grid Matrix */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
                            {(!unplacedPool || unplacedPool.length === 0) ? (
                                <div className="text-center py-12">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white/40" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    </div>
                                    <p className="text-white/50">No remaining images in your library.<br />All images are currently placed on the board.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {unplacedPool.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                handleAddFromDock(item);
                                                setIsSelectorModalOpen(false);
                                            }}
                                            disabled={currentLayout.length >= 10}
                                            className={`relative group aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 ${currentLayout.length >= 10 ? 'border-transparent opacity-30 cursor-not-allowed' : 'border-transparent hover:border-[#ff5722] hover:-translate-y-1 hover:shadow-xl hover:shadow-[#ff5722]/20'}`}
                                        >
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.topic || 'Portfolio'} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/50 text-xs">No Image</div>
                                            )}

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="mb-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                <span className="text-white text-xs font-bold px-2 py-1 bg-[#ff5722] rounded-lg shadow-lg">Add to Board</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-white/10 bg-black/50 flex justify-between items-center">
                            <span className="text-white/50 text-sm">
                                {currentLayout.length} / 10 items placed on board
                            </span>
                            <button
                                onClick={() => setIsSelectorModalOpen(false)}
                                className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
