# Portfolio Gallery Layout & Resize Plan

## Objective
Harmonize the "Add New Content" card and the first portfolio item to have identical dimensions (50% width of the first row each), creating a balanced split-header effect. Align the design with "ProMax" standards (Executive Typography, Split Layout).

## Current State Analysis
-   **`PortfolioGrid.js`**: Uses a CSS column masonry layout (`columns-3`) for the fixed mode, which causes items to flow vertically and makes precise row alignment difficult. "Add Content" is currently a full-width card in the flow.
-   **`CustomPortfolioGrid.js`**: Uses `react-grid-layout` with a 12-column grid. The "Add New" button is a static item.
-   **Inconsistency**: The user reports two sizes for "Add New" (fixed vs custom). The goal is to enforce a consistent 50/50 split for the top row in *both* modes.

## Proposed Changes

### 1. Refactor `PortfolioGrid.js` (Fixed Mode)
*   **Problem**: CSS Columns (`columns-3`) cannot easily enforce "First 2 items are 50% width, rest are 3 columns".
*   **Solution**: Switch from CSS Columns to a CSS Grid for the layout.
    *   **Grid Template**: Define a grid where the first two slots span 6 columns each (in a 12-col grid), and subsequent items span 4 columns (3 per row).
    *   **Logic**:
        ```css
        .grid-container {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 1.5rem;
        }
        .item-add-new { grid-column: span 6; } /* 50% width */
        .item-first { grid-column: span 6; }   /* 50% width */
        .item-others { grid-column: span 4; }  /* 33% width */
        ```
*   **Add Content Card**: Ensure it always renders as the *first* item in the grid.
*   **First Portfolio Item**: Ensure it always renders as the *second* item.

### 2. Refactor `CustomPortfolioGrid.js` (Custom Mode)
*   **Logic**: Enforce the "Add New" item (static) to be `w: 6` (50% of 12 cols) and `h: 2`.
*   **Constraint**: Force the *first* user item (index 0) to also be `w: 6` and placed at `x: 6, y: 0` to complete the row.
*   **Locking**: Prevent resizing of these top two items to maintain the design integrity.

### 3. Visual & Typography Updates ("ProMax" Alignment)
*   **Typography**: Update "Add Content" label to use `uppercase tracking-wider` (Executive style).
*   **Styling**: Ensure both cards have the exact same height (`aspect-video` or fixed height) to align perfectly.

## Implementation Steps

1.  **Modify `PortfolioGrid.js`**:
    *   Replace `columns-3` div with a `grid grid-cols-12` container.
    *   Apply `col-span-6` to "Add New" and the first item.
    *   Apply `col-span-4` (or dynamic based on settings) to the rest.

2.  **Modify `CustomPortfolioGrid.js`**:
    *   Update `generateLayout` to set the first item's width to 6.
    *   Update `fullLayout` to set "addNew" width to 6.

3.  **Update `AddContentCard.js`**:
    *   Remove `aspect-square` and use `h-full` to fill the grid cell.
    *   Apply "ProMax" typography classes.

## UX/UI "ProMax" Check
-   [x] **Split-Header Layout**: The top row will now be a perfect 50/50 split (Add New | First Item), matching the "Split-Header" pattern.
-   [x] **Info Grid**: The rest of the items will follow a clean 3-column grid.
-   [x] **Executive Typography**: "ADD CONTENT" will be uppercase and tracked.

## Verification Plan
-   Verify "Add New" is half-width.
-   Verify 1st Image is half-width and next to "Add New".
-   Verify subsequent items flow in 3 columns.
-   Verify behavior in both "Fixed" and "Custom" modes.
