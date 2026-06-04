
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    unplacedPool,
    leftPanelHeight = 800
}) {
    const [currentLayout, setCurrentLayout] = useState([]);
    const isMounted = useRef(false);
    const isInternalUpdate = useRef(false);

    const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]); // State for bulk selection

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
                x: (idx % 3) * 5,
                y: maxY + (Math.floor(idx / 3) * 5),
                w: 5, h: 5, minW: 2, minH: 2
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

    // --- Bulk Addition Logic ---
    const handleAddSelected = useCallback(() => {
        if (selectedItems.length === 0) return;

        const remainingCapacity = 10 - currentLayout.length;
        const validItems = selectedItems.slice(0, Math.max(0, remainingCapacity));

        if (validItems.length === 0) {
            alert("Board capacity reached (Maximum 10 items).");
            return;
        }

        let currentMaxY = currentLayout.length > 0
            ? currentLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0)
            : 0;

        const newItemsLayout = validItems.map((item, index) => {
            const layoutItem = {
                i: item.id.toString(),
                x: (index * 5) % dynamicCols, // Flow across columns if possible
                y: currentMaxY + Math.floor((index * 5) / dynamicCols) * 5, // Stack down
                w: 5, h: 5, minW: 2, minH: 2
            };
            return layoutItem;
        });

        const updatedLayout = [...currentLayout, ...newItemsLayout];
        setCurrentLayout(updatedLayout);
        onLayoutChange(updatedLayout);

        // Reset and close
        setSelectedItems([]);
        setIsSelectorModalOpen(false);
    }, [currentLayout, selectedItems, onLayoutChange, dynamicCols]);

    const toggleItemSelection = useCallback((item) => {
        setSelectedItems(prev => {
            const isSelected = prev.some(si => si.id === item.id);
            if (isSelected) {
                return prev.filter(si => si.id !== item.id); // Deselect
            } else {
                // Check capacity before adding
                const remainingCapacity = 10 - currentLayout.length;
                if (prev.length >= remainingCapacity) {
                    return prev; // Ignore click, limit reached
                }
                return [...prev, item]; // Select
            }
        });
    }, [currentLayout.length]);

    // Clear selection when modal closes
    useEffect(() => {
        if (!isSelectorModalOpen) {
            setSelectedItems([]);
        }
    }, [isSelectorModalOpen]);

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
                    height: `${leftPanelHeight}px`,
                    overflow: isManageMode ? 'visible' : 'hidden',
                    ...(isManageMode ? {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                        backgroundSize: `${dynamicWidth / dynamicCols}px ${dynamicRowHeight + dynamicMargin}px`,
                        backgroundPosition: '0 0',
                        border: '1px solid rgba(255,255,255,0.1)'
                    } : {})
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
                    compactType={null}
                    preventCollision={false}
                >
                    {items.map(item => {
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
                            <path d="M21 15v4a2 0 0 1-2 2H5a2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        Browse Library ({unplacedPool?.length || 0} available)
                    </button>
                </div>
            )}

            {/* The Image Selector Modal Overlay - Bulk Selector Edition */}
            {isSelectorModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5722" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                Image Library <span className="text-white/40 text-sm font-normal ml-2">Click images to select</span>
                            </h3>
                            <button
                                onClick={() => setIsSelectorModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Capacity Progress Bar */}
                        <div className="bg-white/5 px-6 py-2 border-b border-white/5 flex items-center justify-between text-xs">
                            <span className="text-white/60">Board Capacity:</span>
                            <span className="text-white/90 font-bold">{currentLayout.length + selectedItems.length} / 10 limit</span>
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
                            ) : (() => {
                                const remainingSlots = 10 - currentLayout.length;
                                const isAtLimit = selectedItems.length >= remainingSlots;

                                return (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {unplacedPool.map(item => {
                                            const isSelected = selectedItems.some(si => si.id === item.id);
                                            const isDisabled = !isSelected && isAtLimit; // Only disable unselected ones if limit reached

                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => toggleItemSelection(item)}
                                                    disabled={isDisabled}
                                                    className={`relative group aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 
                                                        ${isDisabled ? 'border-transparent opacity-30 cursor-not-allowed' :
                                                            isSelected ? 'border-[#ff5722] shadow-[0_0_20px_rgba(255,87,34,0.3)]' :
                                                                'border-transparent hover:border-white/30 hover:-translate-y-1'}`}
                                                >
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt={item.topic || 'Portfolio'} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/50 text-xs">No Image</div>
                                                    )}

                                                    {/* Selection Overlay / Checkmark Badge */}
                                                    {isSelected && (
                                                        <div className="absolute inset-0 bg-[#ff5722]/20 outline outline-4 outline-[#ff5722] -outline-offset-4 pointer-events-none">
                                                            <div className="absolute top-2 right-2 bg-[#ff5722] text-white rounded-full p-1 shadow-lg">
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Hover Overlay Suggestion */}
                                                    {!isSelected && !isDisabled && (
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                            <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
                                                                <div className="w-3 h-3 bg-white rounded-full"></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Modal Footer - Action Button */}
                        <div className="bg-black/80 border-t border-white/10 px-6 py-4 flex items-center justify-between">
                            <p className="text-white/60 text-sm">
                                Selected: <strong className="text-white">{selectedItems.length}</strong> items
                            </p>
                            <button
                                onClick={handleAddSelected}
                                disabled={selectedItems.length === 0}
                                className="px-6 py-2.5 bg-[#ff5722] hover:bg-orange-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-xl font-bold shadow-lg shadow-[#ff5722]/20 transition-all flex items-center gap-2"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Add {selectedItems.length > 0 ? `${selectedItems.length} items` : ''} to Board
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
