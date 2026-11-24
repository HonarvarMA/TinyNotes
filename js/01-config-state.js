/* ==========================================================================
   01-config-state.js
   - Global settings, SVG icons, status helpers & underline SVG generator
   - Color palettes (title, page, workspace, note colors) & font sizes
   - Application state variables & drag-indicator cleanup helpers
   - DOM references, header bar assembly, board style & responsive resizeGrid()
   ========================================================================== */

// Settings
const TOMORROW_UNDIM_HOUR = 17; // From this hour (0-23), tomorrow's cells are no longer dimmed.

// Icons - black on white
const iconCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-black pointer-events-none"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const iconEdit = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black pointer-events-none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const iconTrash = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black pointer-events-none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path></svg>`;
const iconPalette = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black pointer-events-none"><circle cx="13.5" cy="6.5" r=".5" fill="#000000"></circle><circle cx="17.5" cy="10.5" r=".5" fill="#000000"></circle><circle cx="8.5" cy="7.5" r=".5" fill="#000000"></circle><circle cx="6.5" cy="12.5" r=".5" fill="#000000"></circle><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.53-.21-1.04-.59-1.41C13.54 17.72 13.38 17.2 13.53 16.66 13.82 15.65 14.81 15 15.92 15H17c2.76 0 5-2.76 5-5 0-4.42-4.48-8-10-8z"></path></svg>`;
const iconFont = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black pointer-events-none"><path d="M2.5 19 7 5l4.5 14M4 14h6"></path><path d="M21 14.5c0-2.7-1.2-4.2-3.3-4.2s-3.3 1.5-3.3 4.2 1.2 4.5 3.3 4.5 3.3-1.8 3.3-4.5zM21 10.5V19"></path></svg>`;
// Status menu icon (flag)
const iconStatus =  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black pointer-events-none"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;
const iconWeekday = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>`;

const statusModes = ['single', 'double', 'triple', 'dashed', 'wave', 'checkmark', 'sleep'];
                                const statusClassNames = ['cell-status-sleep',      'cell-status-single', 'cell-status-double', 'cell-status-triple', 'cell-status-zigzag', 'cell-status-dotted', 'cell-status-dashed', 'cell-status-wave', 'cell-status-checkmark', 'cell-status-urgent', 'cell-status-priority', 'cell-status-important', 'cell-status-attention', 'cell-status-hold', 'cell-status-waiting', 'cell-status-completed', 'cell-status-conundrum'];

function canonicalStatus(s) {
    if (!s || s === 'off' || s === 'none' || s === false) return null;
    const str = String(s).toLowerCase();
    if (str === 'single' || str === 'important') return 'single';
    if (str === 'double' || str === 'priority') return 'double';
    if (str === 'triple' || str === 'urgent') return 'triple';
    if (str === 'dashed' || str === 'hold' || str === 'waiting') return 'dashed';
    if (str === 'wave' || str === 'attention' || str === 'current') return 'wave';
    if (str === 'checkmark' || str === 'completed' || str === 'done' || str === 'linethrough') return 'checkmark';
    if (str === 'sleep') return 'sleep';
    return statusModes.includes(str) ? str : null;
}

function getNoteStatuses(noteOrStatuses) {
    if (!noteOrStatuses) return [];
    let rawList = [];
    if (Array.isArray(noteOrStatuses)) {
        rawList = noteOrStatuses;
    } else if (typeof noteOrStatuses === 'object') {
        if (Array.isArray(noteOrStatuses.statuses)) rawList = noteOrStatuses.statuses;
        else if (Array.isArray(noteOrStatuses.status)) rawList = noteOrStatuses.status;
        else if (noteOrStatuses.status) rawList = [noteOrStatuses.status];
        else if (noteOrStatuses.blinking) rawList = [noteOrStatuses.blinking];
    } else if (typeof noteOrStatuses === 'string') {
        rawList = [noteOrStatuses];
    }
    const result = [];
    rawList.forEach(item => {
        const c = canonicalStatus(item);
        if (c && !result.includes(c)) result.push(c);
    });
    return result.slice(0, 1);
}

function updateNoteStatusDisplay(index) {
    if (!notes[index]) return;
    const cell = document.getElementById(`grid-cell-${index}`);
    if (!cell) return;
    const dock = cell.querySelector('.cell-underline-dock');
    if (dock) dock.innerHTML = getUnderlineHtml(notes[index]);
    const activeStatuses = getNoteStatuses(notes[index]);
    cell.classList.remove(...statusClassNames, 'cell-status-normal');
    cell.classList.add(activeStatuses.length > 0 ? `cell-status-${activeStatuses[0]}` : 'cell-status-normal');
}

function getUnderlineHtml(noteOrStatuses) {
    const list = getNoteStatuses(noteOrStatuses);
    if (!list || list.length === 0) return '';
    let paths = '';
    // ==============================================================
    // STATUS COLOR REFERENCE FOR EASY SWAPPING
    // ==============================================================
    // Amber:    #f59e0b  |  border-amber-300
    // Orange:   #f97316  |  border-orange-300
    // Red:      #ef4444  |  border-red-300
    // Fuchsia:  #d946ef  |  border-fuchsia-300
    // Indigo:   #4f46e5  |  border-indigo-300
    // Sky Blue: #0ea5e9  |  border-sky-300
    // Green:    #22c55e  |  border-green-300
    // White:    #ffffff  |  border-gray-400 (Used for "None")
    // ==============================================================

    // 1. Single (amber #f59e0b) - single horizontal line
    if (list.includes('single')) {
        paths += `<line x1="5.0" y1="8.5" x2="49.0" y2="8.5" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    
    // 2. Double (orange #f97316) - 2 horizontal lines
    if (list.includes('double')) {
        paths += `<line x1="7" y1="6.0" x2="47" y2="6.0" stroke="#f97316" stroke-width="1.9" stroke-linecap="round"/>
                  <line x1="7" y1="11.5" x2="47" y2="11.5" stroke="#f97316" stroke-width="1.9" stroke-linecap="round"/>`;
    }              

    // 3. Triple (red #ef4444) - 3 horizontal lines
    if (list.includes('triple')) {
        paths += `<line x1="8" y1="4.0" x2="46" y2="4.0" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/>
                  <line x1="8" y1="8.5" x2="46" y2="8.5" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/>
                  <line x1="8" y1="13.0" x2="46" y2="13.0" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/>`;
    }              

    // 4. Checkmark (green #22c55e) - diagonal accent
    if (list.includes('checkmark')) {
        paths += `<path d="M 18.5 9.5 L 24.8 15.0 L 36.5 3.5" fill="none" stroke="#22c55e" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/>`;
    }

    // 5. Dashed (fuchsia #d946ef)
    if (list.includes('dashed')) {
        paths += `<path d="M 5.5 8.5 L 11.5 8.5 M 18.5 8.5 L 24.5 8.5 M 31.5 8.5 L 37.5 8.5 M 44.5 8.5 L 50.5 8.5" stroke="#d946ef" stroke-width="2.8" stroke-linecap="round"/>`;
    }    

    // 7. Wave (indigo #4f46e5)
    if (list.includes('wave')) {
        paths += `<path d="M 5 8.5 Q 10.5 4.0, 16 8.5 T 27 8.5 T 38 8.5 T 49 8.5" fill="none" stroke="#4f46e5" stroke-width="2.3" stroke-linecap="round"/>`;
    }

    // 8. Snooze (sky blue) - "Zzz" icon
    if (list.includes('sleep')) {
        paths += `<g fill="none" stroke="#0ea5e9" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M 15 6.5 H 20.5 L 15 12 H 20.5"/><path d="M 25 6 H 29.5 L 25 10.5 H 29.5"/><path d="M 34 5.5 H 37.5 L 34 9 H 37.5"/></g>`;
    }

    return `<svg viewBox="0 0 54 18" width="54" height="18" class="underline-svg pointer-events-none" shape-rendering="geometricPrecision">${paths}</svg>`;
}

const titleColors = [
    'text-white',       // Pure White (#ffffff)
    'text-lime-400',   // Lime (#a3e635)
    'text-amber-400',  // Amber Gold (#fbbf24)
    'text-sky-400',    // Sky Cyan (#38bdf8)
    'text-blue-600',   // Sapphire Blue (#2563eb)
    'text-teal-700',   // Teal Ocean (#0f766e)
    'text-indigo-700', // Dark Indigo (#4338ca)
    'text-red-800',    // Deep Burgundy (#991b1b)
    'text-stone-700',  // Warm Espresso (#44403c)
    'text-purple-900', // Dark Plum (#581c87)
    'text-blue-900',   // Midnight Navy (#1e3a8a)
    'text-gray-800'    // Deep Charcoal (#1f2937)
];
const titleColorNames = [
    'Pure White', 'Lime', 'Amber Gold', 'Sky Cyan',
    'Sapphire Blue', 'Teal Ocean', 'Dark Indigo', 'Deep Burgundy',
    'Warm Espresso', 'Dark Plum', 'Midnight Navy', 'Deep Charcoal'
];
const titleColorValues = {
    'text-white': '#ffffff',
    'text-lime-400': '#a3e635',
    'text-amber-400': '#fbbf24',
    'text-sky-400': '#38bdf8',
    'text-blue-600': '#2563eb',
    'text-teal-700': '#0f766e',
    'text-indigo-700': '#4338ca',
    'text-red-800': '#991b1b',
    'text-stone-700': '#44403c',
    'text-purple-900': '#581c87',
    'text-blue-900': '#1e3a8a',
    'text-gray-800': '#1f2937'
};

// 12 Refined Neutral & Classic Colors for Note Board & Web Page
const pageColors = [
    '#ffffff', // Pure White
    '#f8fafc', // Soft Snow
    '#f1f5f9', // Cool Platinum
    '#e5e7eb', // Classic Light Gray
    '#cbd5e1', // Cool Silver
    '#e7e5e4', // Warm Linen
    '#d6d3d1', // Warm Sand
    '#a8a29e', // Neutral Taupe
    '#64748b', // Slate Stone
    '#475569', // Deep Steel
    '#132238', // Midnight Navy (سورمه‌ای)
    '#18181b'  // Obsidian Charcoal
];
const pageColorNames = [
    'Pure White', 'Soft Snow', 'Cool Platinum', 'Classic Light Gray',
    'Cool Silver', 'Warm Linen', 'Warm Sand', 'Neutral Taupe',
    'Slate Stone', 'Deep Steel', 'Midnight Navy', 'Obsidian Charcoal'
];

const workspaceColors = pageColors;
const workspaceColorNames = pageColorNames;
const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-400', 'note-stone-gray', 'bg-gray-500', 'bg-zinc-900', 'note-none'];
const noteColorNames = ['Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink', 'Stone Gray', 'Gray', 'Dark Charcoal', 'None'];
const fontSizes = ['tiny', 'fine', 'small', 'medium', 'large', 'huge', 'giant'];

const LOCAL_STORAGE_KEY = 'singleBoardNotesV4';

// Application State
let totalCols = 4, totalRows = 4;
let columnGap = 0, rowGap = 0;

let notes = Array(16).fill(null);
let pageColorIndex = 3; // Classic Light Gray (#e5e7eb)
let workspaceColorIndex = 0; // Pure White (#ffffff)
let cellStyle = 'game'; // 'game' | 'natural' | 'traffic'
let titleState = { text: "Tiny Notes", colorIndex: 4, fontIndex: 4, isMenuOpen: false, isEditing: false };

let selectedNotes = new Set();
let lastUsedColor = colors[3]; // 'bg-green-500' (Green)
let lastUsedFontIndex = 3; // 'medium' (Medium)
let editingIndex = null;
let activeMenuIndex = null;
let editMouseDownInside = false;

let activeDragHoverCellIndex = null;
let activeDragHoverDir = null;
let activeDragHoverIsCopy = null;
let activeDragHoverCellRect = null;
let activeDragHoverShapeKey = null;

function clearActiveDropIndicator() {
    if (activeDragHoverCellIndex !== null) {
        const prevCell = document.getElementById(`grid-cell-${activeDragHoverCellIndex}`);
        const prevInd = prevCell?.querySelector('.drop-indicator');
        if (prevInd) {
            prevInd.className = 'drop-indicator absolute inset-0 pointer-events-none z-30 opacity-0 box-border';
            prevInd.removeAttribute('style');
        }
    }
    document.getElementById('group-insert-indicator')?.remove();
    document.getElementById('group-move-indicator')?.remove();
    activeDragHoverCellIndex = null;
    activeDragHoverDir = null;
    activeDragHoverIsCopy = null;
    activeDragHoverCellRect = null;
    activeDragHoverShapeKey = null;
}

function endDragSession() {
    suppressedMarqueeClickUntil = Date.now() + 150;
    document.documentElement.classList.remove('is-dragging-stone');
    document.body.classList.remove('is-dragging-stone');
    document.querySelectorAll('.stone-wrapper.dragging, .grid-cell.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.grid-cell > *').forEach(el => {
        if (!el.classList.contains('drop-indicator') && !el.classList.contains('cell-plate-surface') && !el.classList.contains('cell-underline-dock') && !el.classList.contains('cell-timer-dock')) {
            el.classList.remove('pointer-events-none');
        }
    });
    draggedIndex = null;
    draggedShape = null;
    currentDropDir = null;
    currentDropAnchor = null;
    windowSelection = null;
    clearActiveDropIndicator();
}

function isPointInsideStone(circle, x, y) {
    const rect = circle.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = x - rect.left - radius;
    const dy = y - rect.top - radius;
    return dx * dx + dy * dy <= radius * radius;
}

function checkEditMouseDown(e) {
    if (editingIndex !== null) {
        const cell = document.getElementById(`grid-cell-${editingIndex}`);
        const circle = cell && cell.querySelector('.stone-effect');
        editMouseDownInside = !!(circle && circle.contains(e.target) &&
            isPointInsideStone(circle, e.clientX, e.clientY));
    } else if (titleState.isEditing) {
        editMouseDownInside = !!(titleContainer && titleContainer.contains(e.target));
    } else {
        editMouseDownInside = false;
    }
}
function clearEditMouseDown() {
    setTimeout(() => { editMouseDownInside = false; }, 0);
}
document.addEventListener('pointerdown', checkEditMouseDown, true);
document.addEventListener('mousedown', checkEditMouseDown, true);
document.addEventListener('pointerup', clearEditMouseDown, true);
document.addEventListener('mouseup', clearEditMouseDown, true);
window.addEventListener('blur', () => { editMouseDownInside = false; });

let draggedIndex = null;
let draggedShape = null;
let currentDropDir = null;
let currentDropAnchor = null;
let windowSelection = null;

const gridElement = document.getElementById('puzzle-grid');
const titleContainer = document.getElementById('title-container');
const contextMenu = document.getElementById('context-menu');
const workspace = document.getElementById('workspace');
const fileInput = document.getElementById('file-input');
const headerRow = document.createElement('div');
const leftControls = document.createElement('div');
const rightControls = document.createElement('div');
headerRow.className = 'app-header';
leftControls.className = 'header-controls';
rightControls.className = 'header-controls header-controls-right';
leftControls.append(
    document.getElementById('btn-grid'),
    document.getElementById('btn-colors'),
    document.getElementById('btn-note-style'),
    document.getElementById('btn-trash')
);

rightControls.append(
    document.getElementById('btn-load'),
    document.getElementById('btn-save'),
    document.getElementById('btn-sync'),
    document.getElementById('btn-info')
);
headerRow.append(leftControls, titleContainer, rightControls);
workspace.insertBefore(headerRow, gridElement);

function applyStyleSettings() {
    document.body.classList.toggle('style-natural', cellStyle === 'natural');
    document.body.classList.toggle('style-traffic', cellStyle === 'traffic');
}

let lastFullViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

function resizeGrid() {
    const viewport = window.visualViewport;
    const currentViewportHeight = viewport ? viewport.height : window.innerHeight;
    const isEditing = editingIndex !== null || titleState.isEditing;
    const viewportHeight = isEditing
        ? Math.max(currentViewportHeight, lastFullViewportHeight)
        : currentViewportHeight;
    if (!isEditing) lastFullViewportHeight = currentViewportHeight;
    document.documentElement.style.setProperty('--visible-viewport-height', `${viewportHeight}px`);
    document.documentElement.style.setProperty('--visible-viewport-top', `${viewport ? viewport.offsetTop : 0}px`);

    const rootStyles = getComputedStyle(document.documentElement);
    const columnGapSize = columnGap;
    const rowGapSize = rowGap;
    const minCellSize = parseFloat(rootStyles.getPropertyValue('--cell-size-min')) || 24;
    const maxCellSize = parseFloat(rootStyles.getPropertyValue('--cell-size-max')) || 160;
    const windowPadX = parseFloat(rootStyles.getPropertyValue('--window-padding-horizontal')) || 0;
    const windowPadY = parseFloat(rootStyles.getPropertyValue('--window-padding-vertical')) || 0;
    const appPadX = parseFloat(rootStyles.getPropertyValue('--app-padding-horizontal')) || 10;
    const appPadTop = parseFloat(rootStyles.getPropertyValue('--app-padding-top')) || 6;
    const appPadBottom = parseFloat(rootStyles.getPropertyValue('--app-padding-bottom')) || 10;
    const extraGridInsetX = parseFloat(rootStyles.getPropertyValue('--grid-horizontal-inset')) || 0;
    const extraGridInsetY = parseFloat(rootStyles.getPropertyValue('--grid-vertical-inset')) || 0;
    const extraHeaderGap = parseFloat(rootStyles.getPropertyValue('--header-grid-gap')) || 0;
    const headerHeight = headerRow.offsetHeight + rowGapSize + extraHeaderGap;

    const availW = window.innerWidth - 2 * windowPadX - 2 * appPadX - extraGridInsetX;
    const availH = viewportHeight - 2 * windowPadY - appPadTop - appPadBottom - extraGridInsetY - headerHeight;

    const maxCellW = (availW - (totalCols - 1) * columnGapSize) / totalCols;
    const maxCellH = (availH - (totalRows - 1) * rowGapSize) / totalRows;

    let size = Math.min(maxCellW, maxCellH);
    size = Math.max(minCellSize, Math.min(size, maxCellSize));
    const cellH = size;

    document.documentElement.style.setProperty('--cell-size', `${size}px`);
    document.documentElement.style.setProperty('--cell-padding-top', '0px');
    document.documentElement.style.setProperty('--cell-height', `${cellH}px`);
    document.documentElement.style.setProperty('--plate-extra-h', '0px');
    document.documentElement.style.setProperty('--grid-column-gap', `${columnGapSize}px`);
    document.documentElement.style.setProperty('--grid-row-gap', `${rowGapSize}px`);
}
window.addEventListener('resize', resizeGrid);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeGrid);
    window.visualViewport.addEventListener('scroll', resizeGrid);
}

// Dynamically maintain exact radial boundary cursor:
// Inside circle = grab (pan) or text (if editing)
// The '+' SVG handles its own pointer cursor; blank-cell space = default.
gridElement.addEventListener('mousemove', (e) => {
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    const cellIdx = parseInt(cell.id.replace('grid-cell-', ''), 10);

    if (document.body.classList.contains('is-dragging-stone')) {
        cell.style.cursor = 'grabbing';
        const circle = cell.querySelector('.stone-effect');
        if (circle) circle.style.cursor = 'grabbing';
        return;
    }

    // When a window selection is active, cells within the selection show grab cursor
    if (selectedNotes.size > 1 && selectedNotes.has(cellIdx)) {
        cell.style.cursor = 'grab';
        const circle = cell.querySelector('.stone-effect');
        if (circle) circle.style.cursor = 'grab';
        return;
    }

    const circle = cell.querySelector('.stone-effect');
    if (circle) {
        const r = circle.getBoundingClientRect();
        const radius = r.width / 2;
        const cx = r.left + radius;
        const cy = r.top + radius;
        const distSq = (e.clientX - cx) ** 2 + (e.clientY - cy) ** 2;
        if (distSq <= radius ** 2) {
            const isEditing = circle.querySelector('#note-edit-input') || circle.isContentEditable;
            const cur = isEditing ? 'text' : 'grab';
            circle.style.cursor = cur;
            cell.style.cursor = cur;
        } else {
            circle.style.cursor = 'default';
            cell.style.cursor = 'default';
        }
    } else {
        cell.style.cursor = 'default';
    }
});
gridElement.addEventListener('mouseleave', () => {
    gridElement.querySelectorAll('.grid-cell').forEach(c => { c.style.cursor = 'default'; });
});

