# CHANGELOG - Bug Fixes (v2164)

## Date: March 29, 2026

### Fixed Issues

#### 1. **Duplicate Variable Declaration in MapGenerator.js**

- **File:** `runtime/world/MapGenerator.js` (Line 1648)
- **Issue:** Uncaught SyntaxError - Identifier 'mat' has already been declared
- **Fix:** Removed duplicate `const mat = MAT[biome] || MAT.asteroid;` line
- **Impact:** Eliminated console syntax error preventing world generation

#### 2. **Missing Favicon (404 Error)**

- **File:** `index.html` (Line 5)
- **Issue:** Browser requested favicon.ico but file not found (404 Not Found)
- **Fix:** Added inline SVG favicon link to suppress the missing asset error
- **Impact:** Cleaner browser dev tools console

#### 3. **Equipment Sprite Path Mismatch**

- **File:** `runtime/UI.js` (Lines 39-65)
- **Issue:** Multiple 404 errors for equipment sprites (equip_secondary, equip_engine, equip_reactor, equip_module, equip_weapon, equip_shield, equip_drone)
- **Root Cause:** Sprite paths pointed to `.png` files directly, but actual sprites are in subdirectories with `/idle.png` structure
- **Fix:** Updated all equipment sprite paths to include subdirectory and filename:
  - `assets/sprites/equipment/equip_weapon.png` → `assets/sprites/equipment/equip_weapon/idle.png`
  - `assets/sprites/equipment/equip_secondary.png` → `assets/sprites/equipment/equip_secondary/idle.png`
  - Applied same fix to: `shield`, `engine`, `reactor`, `module`, `drone`
- **Impact:** Equipment icons now load correctly in UI

#### 4. **Screen Freeze When Picking Up Loot**

- **File:** `runtime/UI.js` (Lines 68-86 equipment grid, 110-145 stash grid)
- **Issue:** Game freezes/becomes unresponsive when items are picked up and UI re-renders
- **Root Cause:** Sprite image loading failed with inline `onerror` event handlers. When equipment slots or stash items tried to load sprites that didn't exist, all onerror handlers fired simultaneously, causing massive DOM manipulation and freezing the browser
- **Fix:** Disabled sprite image loading for item icons. Now displays emoji icons directly without attempting sprite loading:
  - Equipment grid: Removed sprite image fallback, uses emoji only
  - Stash grid: Removed sprite image with onerror handler, uses emoji only
- **Impact:** Smooth and responsive item pickup, UI rendering no longer causes freezes

#### 5. **ReferenceError: window is not defined**

- **File:** `runtime/UI.js` (Line 1141-1142)
- **Issue:** `ReferenceError: window is not defined` when importing modules in Node.js environment
- **Root Cause:** Module-level code `window.UI = UI` attempted to access `window` global, which doesn't exist in Node.js
- **Fix:** Wrapped assignment in browser environment check:
  ```javascript
  if (typeof window !== "undefined") {
    window.UI = UI;
  }
  ```
- **Impact:** Modules can now be safely imported in Node.js environments (build tools, testing, etc.)

### UI Improvements

#### 6. **Reorganized Combat Modal Layout**

- **File:** `index.html`, `main.js`, `runtime/Input.js`
- **Changes:**
  - **Inventory Modal (I key):** Improved 3-column layout - Equipment (left) + Stash (center with 6-column grid) + Quick Stats (right)
  - **Paragon Modal (P key):** Dedicated full-width modal with 4-column branching grid (responsive: 3 cols on tablets, 2 cols on mobile)
  - **Skill Tree Modal (T key):** Dedicated modal for skill trees with smooth scrolling and vertical layout
  - **Ship Stats Modal:** Separate modal for quick reference during combat
  - **Removed:** Combined "Ship & Paragon" modal - now split into dedicated interfaces
- **Keyboard Shortcuts:**
  - `I` = Inventory Modal (equipment + stash + stats)
  - `P` = Paragon Tree Modal (skill allocation)
  - `T` = Skill Tree Modal (abilities & perks)
  - `ESC` = Close all modals / Resume combat
- **Impact:** Better organization of complex character progression systems, dedicated focus on each system, improved visual hierarchy

### Summary

These fixes resolve all console errors visible during boot, proper sprite asset loading, critical freeze bug during loot collection, Node.js/build compatibility, and improved modal organization for better UX. Game is now fully playable and visually organized.
