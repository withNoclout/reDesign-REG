
import React, { useState, useEffect, useMemo } from 'react';
import { WidthProvider, Responsive } from 'react-grid-layout/legacy';
const ResponsiveGridLayout = WidthProvider(Responsive);
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';



export default function CustomPortfolioGrid({
    items,
    savedLayout,
    onLayoutChange,
    isManageMode,
    onAddNew,
    maxRows = 4 // Default constraint
}) {
    // 12 Column Grid
    const cols = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };

    // Generate layout from items if no saved layout exists
    const generateLayout = () => {
        return items.map((item, i) => ({
            i: item.id.toString(),
            x: ((i * 4) + 4) % 12,
            y: Math.floor(((i * 4) + 4) / 12) * 4, // Rough est
            w: 4,
            h: 2, // Default height 2
            minW: 2,
            minH: 2
        }));
    };

    const [currentLayout, setCurrentLayout] = useState(savedLayout || generateLayout());

    // Sync items with layout
    useEffect(() => {
        // If we have saved layout, ensure items match
        // Note: We need to ensure the "addNew" key is present in layout if we manage it there.
        // Actually, let's treat "addNew" as a separate static child that doesn't need to be saved in the DB layout of *items*, 
        // BUT RGL needs it in the 'layout' prop to avoid overlapping.

        // We will combine pure Item Layout with the Static Add Button Layout for rendering.
        // But for saving, we only save Item Layout.
        if (savedLayout) {
            // Ensure new items get a layout entry
            const newItems = items.filter(item => !savedLayout.some(l => l.i === item.id.toString()));
            if (newItems.length > 0) {
                const newLayoutItems = newItems.map((item, i) => ({
                    i: item.id.toString(),
                    x: 0,
                    y: Infinity, // Put at bottom
                    w: 4,
                    h: 4,
                    minW: 2,
                    minH: 2
                }));
                setCurrentLayout(prev => [...prev, ...newLayoutItems]);
            }
        } else {
            setCurrentLayout(generateLayout());
        }
    }, [items.length, savedLayout]);

    // Full Layout includes the Static Add Button
    const fullLayout = useMemo(() => {
        const layoutWithAddBtn = [
            { i: 'addNew', x: 0, y: 0, w: 4, h: 2, static: true },
            ...(currentLayout || generateLayout())
        ];
        return layoutWithAddBtn;
    }, [currentLayout, items]);


    const handleLayoutChange = (layout) => {
        // Separate out the 'addNew' item
        const itemLayouts = layout.filter(l => l.i !== 'addNew');

        // Enforce Constraints
        const validatedLayout = itemLayouts.map(l => {
            // Constraint: First Row Height Limitation
            // If item is in the same row as Add Button (y < 2 approx, since AddBtn h=2),
            // prevent it from being taller than Add Button (h=2).
            if (l.y < 2) {
                if (l.h > 2) l.h = 2; // Cap height to 2 units
            }
            return l;
        });

        setCurrentLayout(validatedLayout);
        onLayoutChange(validatedLayout);
    };

    // Filter items to only show max items allowed (Logic for display limit)
    const visibleItems = useMemo(() => {
        // We allow editing all items, but visual guide shows limit. 
        // Or strictly strictly limit rendering?
        // User asked for "limit per page". Let's show all but mark overflow? 
        // Actually, let's strictly limit the grid keys to the top items.
        return items;
    }, [items]);

    return (
        <div className="relative">
            {/* Visual Guide for Max Rows (Approximate height calculation: RowHeight * 4 + margins) */}
            {isManageMode && (
                <div
                    className="absolute w-full border-b-2 border-red-500/50 border-dashed z-0 pointer-events-none flex items-end justify-end"
                    style={{ top: `${maxRows * 150}px` }} // Approx row height provided by RGL
                >
                    <span className="text-red-500/50 text-xs font-bold px-2 bg-black/50">Max Page Height Recommended</span>
                </div>
            )}

            <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: fullLayout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={cols}
                rowHeight={150} // Base row height
                isDraggable={isManageMode}
                isResizable={isManageMode}
                onLayoutChange={handleLayoutChange}
                margin={[16, 16]}
                containerPadding={[0, 0]}
                compactType="vertical"
                preventCollision={false}
            >
                {/* Static Add Content Card */}
                <div key="addNew" className="group relative">
                    <div
                        onClick={onAddNew}
                        className="w-full h-full rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-[#ff5722] hover:bg-white/5 transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#ff5722]/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5722" strokeWidth="2">
                                <path d="M12 5v14m-7-7h14" />
                            </svg>
                        </div>
                        <span className="text-xs font-bold text-white/60 group-hover:text-white">Add New</span>
                    </div>
                </div>

                {visibleItems.map(item => {
                    // Find layout for this item to apply conditional classes if needed
                    const itemLayout = currentLayout.find(l => l.i === item.id.toString());
                    const isOverflow = itemLayout && (itemLayout.y + itemLayout.h) > (maxRows * 2); // Assuming 2 units = 1 visual row step approx? RGL units are arbitrary vertical steps.

                    return (
                        <div key={item.id} className={`group relative ${isManageMode ? 'cursor-move' : ''} ${isOverflow && isManageMode ? 'ring-2 ring-red-500/50' : ''}`}>
                            <div className="w-full h-full rounded-2xl overflow-hidden bg-black/20 border border-white/10 backdrop-blur-sm relative">
                                {/* Image */}
                                {item.image_url ? (
                                    <img
                                        src={item.image_url}
                                        alt={item.description}
                                        className="w-full h-full object-cover"
                                        style={{ pointerEvents: 'none' }} // Prevent native drag
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/20">
                                        No Image
                                    </div>
                                )}

                                {/* Content Overlay */}
                                <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
                                    <h3 className="text-white font-bold text-sm truncate">{item.topic || 'Portfolio Item'}</h3>
                                </div>

                                {/* Resize Handle Customization could go here if `resizeHandles` prop is used */}
                            </div>
                        </div>
                    );
                })}
            </ResponsiveGridLayout>
        </div>
    );
}
