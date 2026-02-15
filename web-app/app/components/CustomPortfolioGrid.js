
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { WidthProvider, Responsive } from 'react-grid-layout/legacy';
const ResponsiveGridLayout = WidthProvider(Responsive);
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
    onAddNew,
    maxRows = 4
}) {
    const cols = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };
    const isInternalUpdate = useRef(false);
    const isMounted = useRef(false);

    const generateLayout = useCallback(() => {
        return items.map((item, i) => {
            const isFirst = i === 0;
            if (isFirst) {
                return {
                    i: item.id.toString(),
                    x: 4, y: 0, w: 4, h: 2,
                    minW: 4, minH: 2, maxW: 4, maxH: 2,
                    isResizable: false
                };
            }
            const positionIndex = (i - 1) + 2;
            return {
                i: item.id.toString(),
                x: (positionIndex % 3) * 4,
                y: Math.floor(positionIndex / 3) * 2,
                w: 4, h: 2, minW: 2, minH: 2
            };
        });
    }, [items]);

    const enforceFirstItemConstraints = useCallback((layout) => {
        if (items.length === 0) return layout;
        const firstItemId = items[0].id.toString();
        return layout.map(l => {
            if (l.i === firstItemId) {
                return { ...l, w: 4, h: 2, minW: 4, minH: 2, maxW: 4, maxH: 2, isResizable: false };
            }
            return l;
        });
    }, [items]);

    const [currentLayout, setCurrentLayout] = useState(() => {
        if (savedLayout && savedLayout.length > 0) {
            return enforceFirstItemConstraints(savedLayout);
        }
        return generateLayout();
    });

    // Sync layout only when items change (add/delete) — NOT when savedLayout changes from parent
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
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
                : 2;
            const newLayoutItems = newItems.map((item, idx) => ({
                i: item.id.toString(),
                x: (idx % 3) * 4,
                y: maxY + (Math.floor(idx / 3) * 2),
                w: 4, h: 2, minW: 2, minH: 2
            }));
            updatedLayout = [...updatedLayout, ...newLayoutItems];
        }

        updatedLayout = enforceFirstItemConstraints(updatedLayout);

        isInternalUpdate.current = true;
        setCurrentLayout(updatedLayout);
    }, [items]); // Only items — NOT savedLayout

    const fullLayout = useMemo(() => {
        return [
            {
                i: 'addNew', x: 0, y: 0, w: 4, h: 2,
                minW: 4, maxW: 4, minH: 2, maxH: 2,
                static: true, isResizable: false, isDraggable: false
            },
            ...(currentLayout || [])
        ];
    }, [currentLayout]);

    const handleLayoutChange = useCallback((layout) => {
        // Skip mount callback and programmatic updates
        if (!isMounted.current || isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }

        const itemLayouts = layout.filter(l => l.i !== 'addNew');

        // Enforce constraints without mutation
        const validatedLayout = itemLayouts.map(l => {
            if (l.y < 2 && l.h > 2) {
                return { ...l, h: 2 };
            }
            return l;
        });

        if (!layoutsEqual(validatedLayout, currentLayout)) {
            setCurrentLayout(validatedLayout);
            onLayoutChange(validatedLayout);
        }
    }, [currentLayout, onLayoutChange]);

    return (
        <div className="relative">
            {isManageMode && (
                <div
                    className="absolute w-full border-b-2 border-red-500/50 border-dashed z-0 pointer-events-none flex items-end justify-end"
                    style={{ top: `${maxRows * 150}px` }}
                >
                    <span className="text-red-500/50 text-xs font-bold px-2 bg-black/50">Max Page Height Recommended</span>
                </div>
            )}

            <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: fullLayout, md: fullLayout, sm: fullLayout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={cols}
                rowHeight={150}
                isDraggable={isManageMode}
                isResizable={isManageMode}
                onLayoutChange={handleLayoutChange}
                margin={[16, 16]}
                containerPadding={[0, 0]}
                compactType="vertical"
                preventCollision={false}
            >
                <div key="addNew" className="group relative">
                    <div
                        onClick={onAddNew}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddNew?.(); } }}
                        role="button"
                        tabIndex={0}
                        aria-label="Add new content"
                        className="w-full h-full rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-[#ff5722] hover:bg-white/5 transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#ff5722]/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5722" strokeWidth="2" aria-hidden="true">
                                <path d="M12 5v14m-7-7h14" />
                            </svg>
                        </div>
                        <span className="text-xs font-bold text-white/70 group-hover:text-white">Add New</span>
                    </div>
                </div>

                {items.map(item => {
                    const itemLayout = currentLayout.find(l => l.i === item.id.toString());
                    const isOverflow = itemLayout && (itemLayout.y + itemLayout.h) > (maxRows * 2);

                    return (
                        <div key={item.id} className={`group relative ${isManageMode ? 'cursor-move' : ''} ${isOverflow && isManageMode ? 'ring-2 ring-red-500/50' : ''}`}>
                            <div className="w-full h-full rounded-2xl overflow-hidden bg-black/20 border border-white/10 backdrop-blur-sm relative">
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
                                <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
                                    <h3 className="text-white font-bold text-sm truncate">{item.topic || 'Portfolio Item'}</h3>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </ResponsiveGridLayout>
        </div>
    );
}
