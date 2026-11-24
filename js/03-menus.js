/* ==========================================================================
   03-menus.js
   - Context menu positioning, ResizeObserver & close lifecycle
   - Header menus: Board Size / Grid Spacing draft, Appearance Colors, Note Style
   - Cell menus: Weekday picker, Status picker, Color palette, Font size picker
   - Edit commit helpers & menu button factories
   ========================================================================== */

// Shared selection checkmarks (consistent blue #2563eb across all menus, white on dark color swatches)
const menuCheckIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 pointer-events-none"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const swatchCheckIcon = (onLight, size = 12) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${onLight ? '#2563eb' : '#ffffff'}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none" style="filter: drop-shadow(0 0 1px ${onLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.55)'});"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

// Header menus management and staged grid sizing
let activeHeaderMenu = null;
let menuCloseTimer = null;
let gridDraft = null;

function scheduleMenuClose(delay = 120) {
    cancelMenuClose();
    menuCloseTimer = setTimeout(() => {
        closeContextMenu();
    }, delay);
}

function cancelMenuClose() {
    if (menuCloseTimer) {
        clearTimeout(menuCloseTimer);
        menuCloseTimer = null;
    }
}

function initGridDraft() {
    gridDraft = {
        initialCols: totalCols,
        initialRows: totalRows,
        cols: totalCols,
        rows: totalRows,
        notes: notes.slice(),
        isDirty: false
    };
}

function canDraftRemoveRow(side) {
    if (!gridDraft || gridDraft.rows <= 1) return false;
    const cols = gridDraft.cols;
    const rows = gridDraft.rows;
    if (side === 'top') {
        for (let c = 0; c < cols; c++) {
            if (gridDraft.notes[c] !== null) return false;
        }
        return true;
    }
    const rowStart = (rows - 1) * cols;
    for (let c = 0; c < cols; c++) {
        if (gridDraft.notes[rowStart + c] !== null) return false;
    }
    return true;
}

function canDraftRemoveCol(side) {
    if (!gridDraft || gridDraft.cols <= 1) return false;
    const cols = gridDraft.cols;
    const rows = gridDraft.rows;
    if (side === 'left') {
        for (let r = 0; r < rows; r++) {
            if (gridDraft.notes[r * cols] !== null) return false;
        }
        return true;
    }
    for (let r = 0; r < rows; r++) {
        if (gridDraft.notes[r * cols + cols - 1] !== null) return false;
    }
    return true;
}

window.draftAddEdge = function (side) {
    if (!gridDraft) initGridDraft();
    const cols = gridDraft.cols;
    const rows = gridDraft.rows;
    if (side === 'bottom') {
        gridDraft.notes = gridDraft.notes.concat(Array(cols).fill(null));
        gridDraft.rows++;
    } else if (side === 'top') {
        gridDraft.notes = Array(cols).fill(null).concat(gridDraft.notes);
        gridDraft.rows++;
    } else if (side === 'right') {
        const newNotes = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) newNotes.push(gridDraft.notes[r * cols + c]);
            newNotes.push(null);
        }
        gridDraft.notes = newNotes;
        gridDraft.cols++;
    } else if (side === 'left') {
        const newNotes = [];
        for (let r = 0; r < rows; r++) {
            newNotes.push(null);
            for (let c = 0; c < cols; c++) newNotes.push(gridDraft.notes[r * cols + c]);
        }
        gridDraft.notes = newNotes;
        gridDraft.cols++;
    }
    gridDraft.isDirty = true;
    renderGridMenuContent();
};

window.draftRemoveEdge = function (side) {
    if (!gridDraft) initGridDraft();
    if (side === 'bottom') {
        if (!canDraftRemoveRow('bottom')) return;
        const rowStart = (gridDraft.rows - 1) * gridDraft.cols;
        gridDraft.notes = gridDraft.notes.slice(0, rowStart);
        gridDraft.rows--;
    } else if (side === 'top') {
        if (!canDraftRemoveRow('top')) return;
        gridDraft.notes = gridDraft.notes.slice(gridDraft.cols);
        gridDraft.rows--;
    } else if (side === 'right') {
        if (!canDraftRemoveCol('right')) return;
        const newNotes = [];
        const cols = gridDraft.cols;
        const rows = gridDraft.rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - 1; c++) newNotes.push(gridDraft.notes[r * cols + c]);
        }
        gridDraft.notes = newNotes;
        gridDraft.cols--;
    } else if (side === 'left') {
        if (!canDraftRemoveCol('left')) return;
        const newNotes = [];
        const cols = gridDraft.cols;
        const rows = gridDraft.rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 1; c < cols; c++) newNotes.push(gridDraft.notes[r * cols + c]);
        }
        gridDraft.notes = newNotes;
        gridDraft.cols--;
    }
    gridDraft.isDirty = true;
    renderGridMenuContent();
};


function applyGridDraft() {
    if (!gridDraft || !gridDraft.isDirty) {
        gridDraft = null;
        return;
    }
    notes = gridDraft.notes;
    totalCols = gridDraft.cols;
    totalRows = gridDraft.rows;
    gridDraft = null;
    saveData();
    resizeGrid();
    renderGrid();
}

let activeMenuResizeObserver = null;
let activeMenuPosState = null;

function getActiveMenuStoneRect(anchorElement = null) {
    if (anchorElement && anchorElement.closest && anchorElement.closest('#group-action-toolbar')) {
        const box = document.getElementById('multi-cell-selection-box');
        if (box) return box.getBoundingClientRect();
    }
    if (anchorElement && anchorElement.closest) {
        const cell = anchorElement.closest('.grid-cell');
        const circle = cell?.querySelector('.stone-effect') || cell?.querySelector('.stone-wrapper');
        if (circle) return circle.getBoundingClientRect();
    }
    const nIdx = contextMenu.dataset.noteIndex;
    if (nIdx && nIdx !== 'title') {
        const cell = document.getElementById(`grid-cell-${nIdx}`);
        const circle = cell?.querySelector('.stone-effect') || cell?.querySelector('.stone-wrapper');
        if (circle) return circle.getBoundingClientRect();
    }
    if (activeMenuIndex !== null) {
        const cell = document.getElementById(`grid-cell-${activeMenuIndex}`);
        const circle = cell?.querySelector('.stone-effect') || cell?.querySelector('.stone-wrapper');
        if (circle) return circle.getBoundingClientRect();
    }
    return null;
}

function computeAndApplyMenuPosition() {
    if (!contextMenu || contextMenu.classList.contains('hidden') || !activeMenuPosState) return;
    const { x, y, anchorElement, alignMode } = activeMenuPosState;
    const margin = 10;
    const vv = window.visualViewport;
    const vpW = vv ? vv.width : (document.documentElement.clientWidth || window.innerWidth);
    const vpH = vv ? vv.height : (document.documentElement.clientHeight || window.innerHeight);
    const vpL = vv ? vv.offsetLeft : 0;
    const vpT = vv ? vv.offsetTop : 0;

    contextMenu.style.maxWidth = `${Math.max(0, vpW - 2 * margin)}px`;
    contextMenu.style.maxHeight = `${Math.max(0, vpH - 2 * margin)}px`;

    const rect = contextMenu.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const anchorRect = anchorElement ? anchorElement.getBoundingClientRect() : null;
    const stoneRect = getActiveMenuStoneRect(anchorElement);

    let posX, posY;
    if (alignMode === 'timer-left' || alignMode === 'timer-right') {
        const targetElement = selectedNotes.size > 1
            ? document.getElementById('multi-cell-selection-box')
            : document.getElementById(`grid-cell-${contextMenu.dataset.noteIndex}`);
        const targetRect = targetElement?.getBoundingClientRect() || stoneRect;
        if (!targetRect) return;
        const avoidAnchor = anchorRect && (contextMenu.dataset.menuType === 'weekday' || contextMenu.dataset.menuType === 'status');
        const leftEdge = Math.min(targetRect.left - 8, avoidAnchor ? anchorRect.left - 2 : Infinity);
        const rightEdge = Math.max(targetRect.right + 8, avoidAnchor ? anchorRect.right + 2 : -Infinity);
        const topEdge = Math.min(targetRect.top - 8, avoidAnchor ? anchorRect.top - 2 : Infinity);
        const bottomEdge = Math.max(targetRect.bottom + 8, avoidAnchor ? anchorRect.bottom + 2 : -Infinity);
        const spaceLeft = leftEdge - (vpL + margin);
        const spaceRight = vpL + vpW - margin - rightEdge;
        const spaceBelow = vpT + vpH - margin - bottomEdge;
        const spaceAbove = topEdge - (vpT + margin);

        if (spaceLeft >= rect.width || spaceRight >= rect.width) {
            posX = spaceLeft >= rect.width && (alignMode === 'timer-left' || spaceRight < rect.width)
                ? leftEdge - rect.width
                : rightEdge;
            posY = targetRect.top + (targetRect.height - rect.height) / 2;
        } else if (spaceBelow >= rect.height || spaceAbove >= rect.height) {
            posX = targetRect.left + (targetRect.width - rect.width) / 2;
            posY = spaceBelow >= rect.height
                ? bottomEdge
                : topEdge - rect.height;
        } else if (avoidAnchor && anchorRect.right + 2 + rect.width <= vpL + vpW - margin) {
            posX = anchorRect.right + 2;
            posY = anchorRect.top + (anchorRect.height - rect.height) / 2;
        } else if (avoidAnchor && anchorRect.left - 2 - rect.width >= vpL + margin) {
            posX = anchorRect.left - 2 - rect.width;
            posY = anchorRect.top + (anchorRect.height - rect.height) / 2;
        } else if (avoidAnchor && anchorRect.bottom + 2 + rect.height <= vpT + vpH - margin) {
            posX = anchorRect.left + (anchorRect.width - rect.width) / 2;
            posY = anchorRect.bottom + 2;
        } else if (avoidAnchor && anchorRect.top - 2 - rect.height >= vpT + margin) {
            posX = anchorRect.left + (anchorRect.width - rect.width) / 2;
            posY = anchorRect.top - 2 - rect.height;
        } else {
            posX = spaceLeft >= spaceRight
                ? leftEdge - rect.width
                : rightEdge;
            posY = targetRect.top + (targetRect.height - rect.height) / 2;
        }
    } else if (stoneRect && (alignMode === 'left' || alignMode === 'right')) {
        const spaceLeft = (stoneRect.left - 10) - (vpL + margin);
        const spaceRight = (vpL + vpW - margin) - (stoneRect.right + 10);
        const preferLeft = (alignMode === 'left');

        if (preferLeft && spaceLeft >= rect.width) {
            posX = stoneRect.left - rect.width - 10;
        } else if (!preferLeft && spaceRight >= rect.width) {
            posX = stoneRect.right + 10;
        } else if (spaceRight >= rect.width) {
            posX = stoneRect.right + 10;
        } else if (spaceLeft >= rect.width) {
            posX = stoneRect.left - rect.width - 10;
        } else {
            const spaceBelow = (vpT + vpH - margin) - (stoneRect.bottom + 10);
            if (spaceBelow >= rect.height) {
                posY = stoneRect.bottom + 10;
            } else {
                posY = Math.max(vpT + margin, stoneRect.top - rect.height - 10);
            }
            posX = Math.min(Math.max(stoneRect.left + (stoneRect.width - rect.width) / 2, vpL + margin), vpL + vpW - rect.width - margin);
        }

        if (posY === undefined) {
            const targetCenterY = anchorRect ? (anchorRect.top + anchorRect.height / 2) : (stoneRect.top + stoneRect.height / 2);
            posY = targetCenterY - rect.height / 2;
            posY = Math.min(Math.max(posY, vpT + margin), vpT + vpH - rect.height - margin);
        }
    } else if (alignMode === 'left') {
        const targetCenterY = anchorRect ? (anchorRect.top + anchorRect.height / 2) : (y - window.scrollY);
        posY = targetCenterY - rect.height / 2;

        const idealLeft = anchorRect ? (anchorRect.left - rect.width - 8) : (x - window.scrollX - rect.width - 8);
        if (idealLeft >= vpL + margin) {
            posX = idealLeft;
        } else {
            posX = anchorRect ? (anchorRect.right + 8) : (x - window.scrollX + 8);
        }
    } else if (alignMode === 'right') {
        const targetCenterY = anchorRect ? (anchorRect.top + anchorRect.height / 2) : (y - window.scrollY);
        posY = targetCenterY - rect.height / 2;

        const idealRight = anchorRect ? (anchorRect.right + 8) : (x - window.scrollX + 8);
        if (idealRight + rect.width <= vpL + vpW - margin) {
            posX = idealRight;
        } else {
            posX = anchorRect ? (anchorRect.left - rect.width - 8) : (x - window.scrollX - rect.width - 8);
        }
    } else if (alignMode === 'center') {
        const targetCenterX = anchorRect ? (anchorRect.left + anchorRect.width / 2) : (x - window.scrollX);
        const targetCenterY = anchorRect ? (anchorRect.top + anchorRect.height / 2) : (y - window.scrollY);
        posX = targetCenterX - rect.width / 2;
        posY = targetCenterY - rect.height / 2;
    } else if (anchorRect) {
        posX = anchorRect.left;
        posY = anchorRect.bottom + 8;
        // If it overflows bottom, flip above anchor if there is space
        if (posY + rect.height > vpT + vpH - margin && anchorRect.top - rect.height - 8 >= vpT + margin) {
            posY = anchorRect.top - rect.height - 8;
        }
    } else {
        posX = x - window.scrollX;
        posY = y - window.scrollY;
    }

    // Clamping within viewport
    posX = Math.min(posX, vpL + vpW - rect.width - margin);
    posY = Math.min(posY, vpT + vpH - rect.height - margin);
    posX = Math.max(vpL + margin, posX);
    posY = Math.max(vpT + margin, posY);

    if (Math.abs(parseFloat(contextMenu.style.left) - posX) > 0.5) {
        contextMenu.style.left = `${posX}px`;
    }
    if (Math.abs(parseFloat(contextMenu.style.top) - posY) > 0.5) {
        contextMenu.style.top = `${posY}px`;
    }
}

function positionMenu(x, y, anchorElement = null, alignMode = 'default') {
    cancelMenuClose();
    if (activeMenuResizeObserver) {
        activeMenuResizeObserver.disconnect();
        activeMenuResizeObserver = null;
    }

    if ((x === null || x === undefined) && (y === null || y === undefined) && activeMenuPosState) {
        x = activeMenuPosState.x;
        y = activeMenuPosState.y;
    }
    if (!anchorElement && activeMenuPosState && activeMenuPosState.anchorElement) {
        anchorElement = activeMenuPosState.anchorElement;
    }

    activeMenuPosState = { x, y, anchorElement, alignMode };

    const vv = window.visualViewport;
    const vpW = vv ? vv.width : (document.documentElement.clientWidth || window.innerWidth);
    const vpH = vv ? vv.height : (document.documentElement.clientHeight || window.innerHeight);
    const vpL = vv ? vv.offsetLeft : 0;
    const vpT = vv ? vv.offsetTop : 0;
    const margin = 10;

    contextMenu.style.position = 'fixed';
    contextMenu.style.visibility = 'hidden';
    contextMenu.style.left = `${vpL}px`;
    contextMenu.style.top = `${vpT}px`;
    contextMenu.style.maxWidth = `${Math.max(0, vpW - 2 * margin)}px`;
    contextMenu.style.maxHeight = `${Math.max(0, vpH - 2 * margin)}px`;
    contextMenu.style.overflowX = 'auto';
    contextMenu.style.overflowY = 'auto';
    contextMenu.classList.remove('hidden');

    computeAndApplyMenuPosition();
    contextMenu.style.visibility = '';

    // Double check on subsequent animation frames to catch any late layout changes (Tailwind JIT, font loading, etc.)
    requestAnimationFrame(() => {
        computeAndApplyMenuPosition();
        requestAnimationFrame(computeAndApplyMenuPosition);
    });

    // Re-compute automatically if contextMenu dimensions change while open
    if (window.ResizeObserver) {
        let initial = true;
        activeMenuResizeObserver = new ResizeObserver(() => {
            if (initial) { initial = false; return; }
            computeAndApplyMenuPosition();
        });
        activeMenuResizeObserver.observe(contextMenu);
    }
}

function closeContextMenu() {
    cancelMenuClose();
    if (activeMenuResizeObserver) {
        activeMenuResizeObserver.disconnect();
        activeMenuResizeObserver = null;
    }
    activeMenuPosState = null;
    if (gridDraft && gridDraft.isDirty) {
        applyGridDraft();
    } else {
        gridDraft = null;
    }
    activeHeaderMenu = null;
    contextMenu.classList.add('hidden');
    contextMenu.classList.remove('menu-opacity-90', 'menu-cell', 'menu-thumbtack');
    contextMenu.style.opacity = '';
    contextMenu.style.backgroundColor = '';
    contextMenu.style.visibility = '';
    contextMenu.style.left = '0px';
    contextMenu.style.top = '0px';
    delete contextMenu.dataset.menuType;
    delete contextMenu.dataset.noteIndex;
    delete contextMenu.dataset.dockMenu;
    document.querySelectorAll('.grid-cell.has-menu').forEach(c => c.classList.remove('has-menu'));
    if (activeMenuIndex !== null && !selectedNotes.has(activeMenuIndex) && editingIndex === null) {
        activeMenuIndex = null;
        document.querySelectorAll('.stone-menu-btn-visible').forEach(b => b.classList.remove('stone-menu-btn-visible'));
    }
    return true;
}


const svgGrid = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`;
const svgSpacing = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 17h16"/><path d="m8 4-3 3 3 3M16 14l3 3-3 3"/></svg>`;

function edgeBtnClass(canDo) {
    return canDo
        ? 'w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer transition-all select-none'
        : 'w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold border border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed select-none';
}

function renderGridMenuContent() {
    if (!gridDraft) initGridDraft();
    const canRmTop = canDraftRemoveRow('top'), canRmBot = canDraftRemoveRow('bottom');
    const canRmLeft = canDraftRemoveCol('left'), canRmRight = canDraftRemoveCol('right');
    const addBtn = (side, lbl) =>
        `<div class="${edgeBtnClass(true)}" onclick="event.stopPropagation(); draftAddEdge('${side}')">${lbl}</div>`;
    const remBtn = (side, lbl, ok) =>
        `<div class="${edgeBtnClass(ok)}"${ok ? ` onclick="event.stopPropagation(); draftRemoveEdge('${side}')"` : ''}>${lbl}</div>`;

    const sectionHead = (icon, text) =>
        `<div class="flex items-center gap-2 text-sm font-bold text-gray-700 mb-1.5 pb-1.5 border-b border-gray-200">${icon}<span>${text}</span></div>`;

    let html = `<div class="menu-panel-container flex flex-col items-center gap-2 cursor-default w-max">`;
    html += `<div class="w-full">${sectionHead(svgGrid, 'Board Size')}</div>`;

    // Top row: + further (above), − near center (below)
    html += `<div class="flex flex-col items-center gap-1">${addBtn('top', '+')}${remBtn('top', '−', canRmTop)}</div>`;

    // Middle: Left Col (+ then -), Center Box, Right Col (- then +)
    html += `<div class="flex items-center justify-center gap-2.5 my-0.5">`;
    // Left col: + is further (left), − is near center (right)
    html += `<div class="flex items-center gap-1">${addBtn('left', '+')}${remBtn('left', '−', canRmLeft)}</div>`;

    // Center Box
    const dCols = gridDraft.cols - gridDraft.initialCols;
    const dRows = gridDraft.rows - gridDraft.initialRows;
    const hasChanges = (dCols !== 0 || dRows !== 0) || gridDraft.isDirty;

    html += `<div class="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-center min-w-[72px] shadow-sm select-none">`;
    html += `<div class="text-[15px] font-bold text-blue-700 leading-tight">${gridDraft.cols} × ${gridDraft.rows}</div>`;
    html += `<div class="text-[10px] text-gray-400">cols × rows</div>`;
    html += `</div>`;

    // Right col: − is near center (left), + is further (right)
    html += `<div class="flex items-center gap-1">${remBtn('right', '−', canRmRight)}${addBtn('right', '+')}</div>`;
    html += `</div>`;

    // Bottom row: − near center (above), + further (below)
    html += `<div class="flex flex-col items-center gap-1">${remBtn('bottom', '−', canRmBot)}${addBtn('bottom', '+')}</div>`;

    html += `<div class="w-full mt-1 pt-1">`;
    html += sectionHead(svgSpacing, 'Grid Spacing');
    html += `<div class="grid grid-cols-2 gap-2">`;
    html += `<label class="flex flex-col gap-1 text-[10px] font-medium text-gray-600">Column gap (px)<input type="number" min="0" max="100" step="1" value="${columnGap}" aria-label="Gap between columns in pixels" class="w-full box-border rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800" onclick="event.stopPropagation()" oninput="updateGridGap('column', this)"></label>`;
    html += `<label class="flex flex-col gap-1 text-[10px] font-medium text-gray-600">Row gap (px)<input type="number" min="0" max="100" step="1" value="${rowGap}" aria-label="Gap between rows in pixels" class="w-full box-border rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800" onclick="event.stopPropagation()" oninput="updateGridGap('row', this)"></label>`;
    html += `</div></div>`;

    // Below the menu window: notes and Apply button
    if (hasChanges) {
        const rowStr = dRows !== 0 ? `${dRows > 0 ? '+' : ''}${dRows} ${Math.abs(dRows) === 1 ? 'row' : 'rows'}` : '';
        const colStr = dCols !== 0 ? `${dCols > 0 ? '+' : ''}${dCols} ${Math.abs(dCols) === 1 ? 'col' : 'cols'}` : '';
        const diffStr = [rowStr, colStr].filter(Boolean).join(', ');
        html += `<div class="w-full mt-2 pt-2 border-t border-gray-200 flex flex-col items-center gap-1 select-none">`;
        if (diffStr) {
            html += `<div class="text-[11px] font-semibold text-blue-600 leading-tight">${diffStr}</div>`;
        }
        html += `<div class="text-[9px] text-gray-400">Click icon or Apply to close</div>`;
        html += `<button type="button" class="mt-0.5 px-4 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-md text-xs font-semibold shadow cursor-pointer transition-all flex items-center justify-center gap-1" onclick="closeContextMenu()">✓ Apply</button>`;
        html += `</div>`;
    }

    html += `</div>`;
    contextMenu.innerHTML = html;
}

function updateGridGap(axis, input) {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    const gap = Math.round(Math.max(0, Math.min(100, value)));
    input.value = String(gap);
    if (axis === 'column') columnGap = gap;
    else if (axis === 'row') rowGap = gap;
    else return;
    resizeGrid();
    saveData();
}

function showGridContextMenu(x, y, anchorElement = null) {
    activeHeaderMenu = 'grid';
    contextMenu.dataset.menuType = 'grid';
    contextMenu.classList.remove('menu-opacity-90', 'menu-cell');
    contextMenu.classList.add('menu-thumbtack');
    contextMenu.style.opacity = '1';
    contextMenu.style.backgroundColor = '#ffffff';
    initGridDraft();
    renderGridMenuContent();
    positionMenu(x, y, anchorElement);
}



window.changeTitleColor = function (idx) { titleState.colorIndex = idx; saveData(); renderTitle(); renderGrid(); };
window.changeTitleFont = function (idx) { titleState.fontIndex = idx; saveData(); renderTitle(); };
window.changeNoteColor = function (idx, color) {
    if (!notes[idx]) return;
    const targets = (selectedNotes.has(idx) && selectedNotes.size > 1) ? Array.from(selectedNotes) : [idx];
    targets.forEach(targetIdx => {
        if (notes[targetIdx]) notes[targetIdx].color = color;
    });
    lastUsedColor = color;
    saveData();
    renderGrid();
};

window.changeNoteFont = function (idx, fontIdx) {
    if (!notes[idx]) return;
    const clamped = Math.min(fontSizes.length - 1, Math.max(0, fontIdx));
    const targets = (selectedNotes.has(idx) && selectedNotes.size > 1) ? Array.from(selectedNotes) : [idx];
    targets.forEach(targetIdx => {
        if (notes[targetIdx]) notes[targetIdx].fontIndex = clamped;
    });
    lastUsedFontIndex = clamped;
    saveData();
    renderGrid();
};

function getStrikeClass(noteOrStrike) {
    if (!noteOrStrike) return '';
    if (typeof noteOrStrike === 'object') {
        const st = noteOrStrike.status;
        if (st === 'checkmark' || st === 'completed' || st === 'done') return '';
        if (noteOrStrike.strike && noteOrStrike.strike !== 'none') return 'note-line-through';
        return '';
    }
    if (noteOrStrike === 'checkmark' || noteOrStrike === 'completed' || noteOrStrike === 'done') return '';
    return (noteOrStrike && noteOrStrike !== 'none') ? 'note-line-through' : '';
}



window.changeWorkspaceColor = function (idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= workspaceColors.length) return;
    workspaceColorIndex = idx;
    applyBackgroundColors();
    saveData();
};
window.changePageColor = function (idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= pageColors.length) return;
    pageColorIndex = idx;
    applyBackgroundColors();
    saveData();
    renderGrid();
};
window.setCellStyle = function (style) {
    cellStyle = style; applyStyleSettings(); saveData(); renderGrid();
};

function showAppearanceMenu(x, y, anchorElement = null) {
    activeHeaderMenu = 'colors';
    contextMenu.dataset.menuType = 'colors';
    contextMenu.classList.remove('menu-opacity-90', 'menu-cell');
    contextMenu.classList.add('menu-thumbtack');
    contextMenu.style.opacity = '1';
    contextMenu.style.backgroundColor = '#ffffff';
    let html = `<div class="menu-panel-container flex flex-col gap-3 w-max cursor-default">`;

    // Main Topic 1: Note Board (with icon) - 12 colors in one line
    html += `<div class="flex flex-col gap-1">`;
    html += `<div class="flex items-center gap-2 text-sm font-bold text-gray-700 pb-1.5 border-b border-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M3 9h18"/>
            <path d="M9 21V9"/>
        </svg>
        <span>Note Board</span>
    </div>`;
    html += `<div class="flex items-center gap-1 w-max pt-0.5">`;
    const lightPageHexes = new Set(['#ffffff', '#f8fafc', '#f1f5f9', '#e5e7eb', '#cbd5e1', '#e7e5e4', '#d6d3d1']);
    workspaceColors.forEach((color, idx) => {
        const name = workspaceColorNames[idx] || `Color ${idx + 1}`;
        const isSelected = idx === workspaceColorIndex;
        const isLight = color === '#ffffff' || color === '#f8fafc' || color === '#f1f5f9';
        const borderClass = isLight ? 'border-2 border-gray-400 shadow-sm' : 'border border-gray-300';
        html += `<button type="button" class="w-5 h-5 rounded-full ${borderClass} flex items-center justify-center cursor-pointer transition-all hover:scale-110" style="background-color: ${color}" title="${name}" aria-label="Set Note Board to ${name}" onclick="changeWorkspaceColor(${idx}); showAppearanceMenu(null, null, document.getElementById('btn-colors'));">${isSelected ? swatchCheckIcon(lightPageHexes.has(color)) : ''}</button>`;
    });
    html += `</div></div>`;

    // Main Topic 2: Title & Border Color (with icon) - 12 colors in one line matching backgrounds
    html += `<div class="flex flex-col gap-1">`;
    html += `<div class="flex items-center gap-2 text-sm font-bold text-gray-700 pb-1.5 border-b border-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M7 8h10"/>
            <path d="M12 8v8"/>
        </svg>
        <span>Title & Border Color</span>
    </div>`;
    html += `<div class="flex items-center gap-1 w-max pt-0.5">`;
    const lightTitleClasses = new Set(['text-white', 'text-lime-400', 'text-amber-400', 'text-sky-400']);
    titleColors.slice().reverse().forEach((c, revIdx) => {
        const idx = titleColors.length - 1 - revIdx;
        const colorHex = titleColorValues[c] || '#1f2937';
        const name = titleColorNames[idx] || `Color ${idx + 1}`;
        const isSelected = idx === titleState.colorIndex;
        const isWhite = c === 'text-white' || colorHex === '#ffffff';
        const borderClass = isWhite ? 'border-2 border-gray-400 shadow-sm' : 'border border-gray-300';
        html += `<button type="button" class="w-5 h-5 rounded-full ${borderClass} flex items-center justify-center cursor-pointer transition-all hover:scale-110" style="background-color: ${colorHex}" title="${name}" aria-label="Set Title & Border Color to ${name}" onclick="changeTitleColor(${idx}); showAppearanceMenu(null, null, document.getElementById('btn-colors'));">${isSelected ? swatchCheckIcon(lightTitleClasses.has(c)) : ''}</button>`;
    });
    html += `</div></div>`;

    // Main Topic 3: Web Page (with icon) - 12 colors in one line
    html += `<div class="flex flex-col gap-1">`;
    html += `<div class="flex items-center gap-2 text-sm font-bold text-gray-700 pb-1.5 border-b border-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="14" x="2" y="3" rx="2"/>
            <line x1="8" x2="16" y1="21" y2="21"/>
            <line x1="12" x2="12" y1="17" y2="21"/>
        </svg>
        <span>Web Page</span>
    </div>`;
    html += `<div class="flex items-center gap-1 w-max pt-0.5">`;
    pageColors.forEach((color, idx) => {
        const name = pageColorNames[idx] || `Color ${idx + 1}`;
        const isSelected = idx === pageColorIndex;
        const isLight = color === '#ffffff' || color === '#f8fafc' || color === '#f1f5f9';
        const borderClass = isLight ? 'border-2 border-gray-400 shadow-sm' : 'border border-gray-300';
        html += `<button type="button" class="w-5 h-5 rounded-full ${borderClass} flex items-center justify-center cursor-pointer transition-all hover:scale-110" style="background-color: ${color}" title="${name}" aria-label="Set Web Page to ${name}" onclick="changePageColor(${idx}); showAppearanceMenu(null, null, document.getElementById('btn-colors'));">${isSelected ? swatchCheckIcon(lightPageHexes.has(color)) : ''}</button>`;
    });
    html += `</div></div>`;

    html += `</div>`;
    contextMenu.innerHTML = html;
    positionMenu(x, y, anchorElement);
}

function showNoteStyleMenu(x, y, anchorElement = null) {
    activeHeaderMenu = 'style';
    contextMenu.dataset.menuType = 'style';
    contextMenu.classList.remove('menu-opacity-90', 'menu-cell');
    contextMenu.classList.add('menu-thumbtack');
    contextMenu.style.opacity = '1';
    contextMenu.style.backgroundColor = '#ffffff';


    const styleOptions = [
        {
            id: 'game',
            name: 'Checkers',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600 shrink-0"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>`
        },
        {
            id: 'natural',
            name: 'Natural Stones',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600 shrink-0"><path d="M12 3c5 0 9 3.5 9 8.5s-3.5 9.5-9 9.5-9-4-9-9.5S7 3 12 3z"/><path d="M8 11c1-2 3-3 5-3"/></svg>`
        },
        {
            id: 'traffic',
            name: 'Traffic Lights',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500 shrink-0"><rect x="6" y="2" width="12" height="20" rx="6"/><circle cx="12" cy="7" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="17" r="1.5" fill="currentColor"/></svg>`
        }
    ];

    let html = `<div class="menu-option-container select-none" style="min-width: 170px;">`;
    styleOptions.forEach(opt => {
        const isSelected = cellStyle === opt.id;
        const selectedClass = isSelected ? 'menu-item-selected' : 'text-gray-800';
        html += `<div class="menu-option-item ${selectedClass}" onclick="setCellStyle('${opt.id}'); showNoteStyleMenu(null, null, document.getElementById('btn-note-style'));">
            <div class="flex items-center gap-2.5">
                ${opt.icon}
                <span class="font-medium">${opt.name}</span>
            </div>
            ${isSelected ? menuCheckIcon : ''}
        </div>`;
    });
    html += `</div>`;

    contextMenu.innerHTML = html;
    positionMenu(x, y, anchorElement);
}

function getNoteStatusGroup(note) {
    if (!note) return false;
    const list = getNoteStatuses(note);
    return list.length > 0 ? list[0] : false;
}

function isHeaderMenuOpen(menuType) {
    return !contextMenu.classList.contains('hidden') &&
        (activeHeaderMenu === menuType || contextMenu.dataset.menuType === menuType);
}

function isContextMenuOpenFor(menuType, noteIndex) {
    return !contextMenu.classList.contains('hidden') &&
        contextMenu.dataset.menuType === menuType &&
        contextMenu.dataset.noteIndex === String(noteIndex);
}

function toggleDockMenu(event, menuType, noteIndex) {
    event.stopPropagation();
    if (isContextMenuOpenFor(menuType, noteIndex) && contextMenu.dataset.dockMenu) {
        closeContextMenu();
        return;
    }
    const keepNoteState = editingIndex === noteIndex ||
        (selectedNotes.size === 1 && selectedNotes.has(noteIndex));
    const needsRender = editingIndex !== null || titleState.isEditing ||
        selectedNotes.size > 0 || activeMenuIndex !== null || titleState.isMenuOpen;
    closeContextMenu();
    if (!keepNoteState) {
        commitCurrentEdit();
        selectedNotes.clear();
        activeMenuIndex = null;
        titleState.isMenuOpen = false;
        if (needsRender) {
            renderTitle();
            renderGrid();
        }
    }
    if (!notes[noteIndex]) return;
    const dockClass = menuType === 'status' ? 'cell-underline-dock' : 'cell-timer-dock';
    const dock = document.getElementById(`grid-cell-${noteIndex}`).querySelector(`.${dockClass}`);
    contextMenu.dataset.dockMenu = 'true';
    if (menuType === 'status') showStatusContextMenu(event.pageX, event.pageY, noteIndex, dock);
    else showWeekdayContextMenu(event.pageX, event.pageY, noteIndex, dock);
}

function toggleFontContextMenu(x, y, noteIndex, anchorElement = null) {
    if (isContextMenuOpenFor('font', noteIndex)) {
        closeContextMenu();
    } else if (closeContextMenu()) {
        showFontContextMenu(x, y, noteIndex, anchorElement);
    }
}

function toggleColorContextMenu(x, y, noteIndex, anchorElement = null) {
    if (isContextMenuOpenFor('color', noteIndex)) {
        closeContextMenu();
    } else if (closeContextMenu()) {
        showColorContextMenu(x, y, noteIndex, anchorElement);
    }
}

function getSelectionTargets(noteIndex) {
    const indices = selectedNotes.has(noteIndex) && selectedNotes.size > 1
        ? Array.from(selectedNotes)
        : [noteIndex];
    return indices.filter(index => notes[index]);
}

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getNoteWeekdays(note) {
    if (note?.weekday === 'everyday') return 'everyday';
    const days = Array.isArray(note?.weekday) ? note.weekday : [note?.weekday];
    return [...new Set(days.filter(day => Number.isInteger(day) && day >= 0 && day < 7))];
}

function updateWeekdayDisplay(index) {
    const cell = document.getElementById(`grid-cell-${index}`);
    if (!cell || !notes[index]) return;
    const days = getNoteWeekdays(notes[index]);
    const now = new Date();
    const sortedDays = days === 'everyday' ? [] : days.slice().sort((a, b) =>
        (a - now.getDay() + 7) % 7 - (b - now.getDay() + 7) % 7);
    const day = sortedDays[0];
    const distance = day === undefined ? 0 : (day - now.getDay() + 7) % 7;
    const visibleDistance = now.getHours() >= TOMORROW_UNDIM_HOUR ? 1 : 0;
    cell.classList.toggle('weekday-dimmed', editingIndex !== index && distance > visibleDistance);
    const dock = cell.querySelector('.cell-timer-dock');
    if (dock) {
        dock.classList.toggle('has-weekday', day !== undefined);
        dock.querySelector('span').textContent = day === undefined ? '' :
            weekdayNames[day].slice(0, 3).toUpperCase() + (sortedDays.length > 1 ? `+${sortedDays.length - 1}` : '');
        const label = days === 'everyday' ? 'Everyday' : sortedDays.map(selectedDay => weekdayNames[selectedDay]).join(', ');
        dock.setAttribute('aria-label', label ? `Days of week: ${label}` : 'Set day of week');
    }
}

function toggleWeekdayContextMenu(x, y, noteIndex, anchorElement) {
    if (isContextMenuOpenFor('weekday', noteIndex)) {
        closeContextMenu();
    } else if (closeContextMenu()) {
        activeMenuIndex = noteIndex;
        document.getElementById(`grid-cell-${noteIndex}`)?.classList.add('has-menu');
        showWeekdayContextMenu(x, y, noteIndex, anchorElement);
    }
}

function showWeekdayContextMenu(x, y, noteIndex, anchorElement) {
    contextMenu.dataset.menuType = 'weekday';
    contextMenu.dataset.noteIndex = String(noteIndex);
    contextMenu.classList.remove('menu-thumbtack', 'menu-opacity-90');
    contextMenu.classList.add('menu-cell');
    const targets = getSelectionTargets(noteIndex);
    const today = new Date().getDay();
    const options = ['everyday', ...Array.from({ length: 7 }, (_, offset) => (today + offset) % 7)];
    const item = (day, label) => {
        const selected = targets.length > 0 && targets.every(index => {
            const days = getNoteWeekdays(notes[index]);
            return day === 'everyday' ? days === 'everyday' : days !== 'everyday' && days.includes(day);
        });
        const value = day === 'everyday' ? "'everyday'" : day;
        return `<button type="button" class="menu-option-item ${selected ? 'menu-item-selected' : 'text-gray-800'}" role="menuitemcheckbox" aria-checked="${selected}" data-day="${day}" onclick="applyWeekdayToSelection(${noteIndex}, ${value})">
            <span class="font-medium">${label}</span>
            ${selected ? menuCheckIcon : ''}
        </button>`;
    };
    contextMenu.innerHTML = `<div class="menu-option-container select-none" role="menu">${options.map(day => item(day, day === 'everyday' ? 'Everyday' : weekdayNames[day])).join('')}</div>`;
    positionMenu(x, y, anchorElement, contextMenu.dataset.dockMenu ? 'timer-right' : 'timer-left');
}

window.applyWeekdayToSelection = function (noteIndex, day) {
    const targets = getSelectionTargets(noteIndex);
    const clear = day === null || targets.every(index => {
        const days = getNoteWeekdays(notes[index]);
        return day === 'everyday' ? days === 'everyday' : days !== 'everyday' && days.includes(day);
    });
    targets.forEach(index => {
        const current = getNoteWeekdays(notes[index]);
        if (day === null || (day === 'everyday' && clear)) {
            delete notes[index].weekday;
        } else if (day === 'everyday') {
            notes[index].weekday = day;
        } else {
            const days = current === 'everyday' ? [] : current;
            const updated = clear ? days.filter(selectedDay => selectedDay !== day) :
                [...new Set([...days, day])];
            if (updated.length) notes[index].weekday = updated;
            else delete notes[index].weekday;
        }
        delete notes[index].number;
        updateWeekdayDisplay(index);
    });
    saveData();
    if (contextMenu.dataset.menuType === 'weekday' && activeMenuPosState) {
        const { x, y, anchorElement } = activeMenuPosState;
        showWeekdayContextMenu(x, y, noteIndex, anchorElement);
        contextMenu.querySelector(`[data-day="${day}"]`)?.focus();
    }
};

let draggedStatusIndex = null;

function copyNoteStatus(from, to) {
    if (from === to || !notes[from] || !notes[to]) return;
    setNoteStatus(to, getNoteStatuses(notes[from])[0] || false);
    saveData();
}

function swapNoteStatuses(a, b) {
    if (a === b || !notes[a] || !notes[b]) return;
    const sa = getNoteStatuses(notes[a])[0] || false;
    const sb = getNoteStatuses(notes[b])[0] || false;
    if (sa === sb) return;
    setNoteStatus(a, sb);
    setNoteStatus(b, sa);
    saveData();
}

function setNoteStatus(index, status) {
    const note = notes[index];
    if (!note) return;
    note.statuses = status ? [status] : [];
    note.status = status;
    delete note.blinking;
    delete note.strike;
    delete note.xMark;
    updateNoteStatusDisplay(index);
}

function toggleStatusContextMenu(x, y, noteIndex, anchorElement = null) {
    if (isContextMenuOpenFor('status', noteIndex)) {
        closeContextMenu();
    } else if (closeContextMenu()) {
        showStatusContextMenu(x, y, noteIndex, anchorElement);
    }
}

function showStatusContextMenu(x, y, noteIndex, anchorElement = null) {
    contextMenu.dataset.menuType = 'status';
    contextMenu.dataset.noteIndex = String(noteIndex);
    contextMenu.classList.remove('menu-thumbtack');
    contextMenu.classList.add('menu-cell');
    contextMenu.style.opacity = '1';
    contextMenu.style.backgroundColor = '#ffffff';

    const targets = getSelectionTargets(noteIndex);
    const firstStatus = getNoteStatuses(notes[targets[0]])[0] || false;
    const current = targets.length && targets.every(index => (getNoteStatuses(notes[index])[0] || false) === firstStatus)
        ? firstStatus : undefined;
    // ==============================================================
    // STATUS COLORS & BORDERS
    // ==============================================================
    // Yellow:   #f59e0b  |  border-amber-300
    // Orange:   #f97316  |  border-orange-300
    // Red:      #ef4444  |  border-red-300
    // Magenta:  #d946ef  |  border-fuchsia-300
    // Indigo:   #4f46e5  |  border-indigo-300
    // Blue:     #0ea5e9  |  border-sky-300
    // Brown:    #8b4513  |  border-amber-900
    // Green:    #22c55e  |  border-green-300
    // White:    #ffffff  |  border-gray-400 (Used for "Normal")
    // ==============================================================
    const options = [
        { id: 'single', name: 'Single', color: '#f59e0b', border: 'border-amber-300' },
        { id: 'double', name: 'Double', color: '#f97316', border: 'border-orange-300' },
        { id: 'triple', name: 'Triple', color: '#ef4444', border: 'border-red-300' },
        { id: 'dashed', name: 'Dashed', color: '#d946ef', border: 'border-fuchsia-300' },
        { id: 'wave', name: 'Wave', color: '#4f46e5', border: 'border-indigo-300' },
        { id: 'sleep', name: 'Snooze', color: '#0ea5e9', border: 'border-sky-300' },
        { id: 'checkmark', name: 'Checkmark', color: '#22c55e',                 border: 'border-green-300' }
    ];
    let html = `<div class="menu-option-container select-none">`;
    options.forEach(opt => {
        const isSelected = opt.id === current;
        const selectedClass = isSelected ? 'menu-item-selected' : 'text-gray-800';
        html += `<div class="menu-option-item ${selectedClass}" onclick="applyStatusToSelection(${noteIndex}, ${opt.id ? `'${opt.id}'` : 'false'})">
            <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-full shrink-0 border ${opt.border} shadow-sm" style="background-color: ${opt.color};"></span>
                <span class="font-medium">${opt.name}</span>
            </div>
            ${isSelected ? menuCheckIcon : ''}
        </div>`;
    });
    html += `</div>`;
    contextMenu.innerHTML = html;
    positionMenu(x, y, anchorElement, 'timer-right');
}

window.applyStatusToSelection = function (noteIndex, status) {
    const targets = getSelectionTargets(noteIndex);
    const clear = !status || targets.every(index => getNoteStatuses(notes[index])[0] === status);
    targets.forEach(index => setNoteStatus(index, clear ? false : status));
    saveData();
    closeContextMenu();
    renderTitle();
    renderGrid();
};

// Prefer the side of the stone where the clicked icon sits (left or right)
function getPreferredMenuSide(anchorElement) {
    const stoneRect = getActiveMenuStoneRect(anchorElement);
    const anchorRect = anchorElement?.getBoundingClientRect?.();
    if (!stoneRect || !anchorRect) return 'right';
    const anchorCenter = anchorRect.left + anchorRect.width / 2;
    return anchorCenter < stoneRect.left + stoneRect.width / 2 ? 'left' : 'right';
}

function showColorContextMenu(x, y, noteIndex, anchorElement = null) {
    contextMenu.dataset.menuType = 'color';
    contextMenu.dataset.noteIndex = String(noteIndex);
    contextMenu.classList.remove('menu-thumbtack');
    contextMenu.classList.add('menu-opacity-90', 'menu-cell');
    contextMenu.style.opacity = '0.9';
    contextMenu.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    const isTitle = noteIndex === 'title';
    const currentColor = isTitle ? titleColors[titleState.colorIndex] || titleColors[0] : notes[noteIndex].color;
    const colorArray = isTitle ? titleColors : colors;
    // If editing a note cell, do not close context menu / exit editing on color pick
    const isEditingNote = !isTitle && editingIndex === noteIndex;

    const renderColors = isTitle ? colorArray.slice().reverse() : colorArray;
    let html = `<div class="menu-color-palette select-none">`;
    const lightSwatches = new Set(['note-none', 'text-white', 'text-lime-400', 'text-amber-400', 'text-sky-400']);
    renderColors.forEach((c, revIdx) => {
        const idx = isTitle ? colorArray.length - 1 - revIdx : revIdx;
        const name = isTitle ? titleColorNames[idx] : noteColorNames[idx];
        const isSelected = currentColor === c;
        const opacityClass = isSelected ? 'opacity-100' : 'opacity-85';
        const displayClass = isTitle ? c.replace('text-', 'bg-') : c;
        const whiteBorder = (c === 'text-white') ? 'border border-gray-300' : '';
        const useDarkCheck = lightSwatches.has(c);
        const checkMark = isSelected ? swatchCheckIcon(useDarkCheck, 14) : '';
        let actionStr;
        if (isEditingNote) {
            actionStr = `changeNoteColorKeepEditing(${noteIndex}, '${c}'); closeContextMenu();`;
        } else {
            actionStr = isTitle ? `changeTitleColor(${idx}); closeContextMenu();` : `changeNoteColor(${noteIndex}, '${c}'); closeContextMenu();`;
        }
        html += `<div class="w-6 h-6 rounded-full ${displayClass} ${whiteBorder} flex items-center justify-center cursor-pointer hover:scale-110 hover:opacity-100 transition-all ${opacityClass}" title="${name}" aria-label="${name}" onclick="${actionStr}">${checkMark}</div>`;
    });
    html += `</div>`;

    contextMenu.innerHTML = html; positionMenu(x, y, anchorElement, isTitle ? 'default' : getPreferredMenuSide(anchorElement));
}

window.changeNoteColorKeepEditing = function (idx, color) {
    if (!notes[idx]) return;
    notes[idx].color = color;
    lastUsedColor = color;
    saveData();
    // Update the circle color in-place without exiting edit mode
    const circle = document.querySelector('#grid-cell-' + idx + ' .stone-effect');
    if (circle) {
        colors.forEach(cls => circle.classList.remove(cls));
        circle.classList.remove('note-white');
        circle.classList.add(color);
    }
};

function showFontContextMenu(x, y, noteIndex, anchorElement = null) {
    contextMenu.dataset.menuType = 'font';
    contextMenu.dataset.noteIndex = String(noteIndex);
    contextMenu.classList.remove('menu-thumbtack');
    contextMenu.classList.add('menu-opacity-90', 'menu-cell');
    contextMenu.style.opacity = '1';
    contextMenu.style.backgroundColor = '#ffffff';
    const isTitle = noteIndex === 'title';
    let currentFontIdx = isTitle ? titleState.fontIndex : notes[noteIndex].fontIndex;
    const labelArray = ['Tiny', 'Fine', 'Small', 'Medium', 'Large', 'Huge', 'Giant'];
    // Show sizes from smallest to largest for both cells and title
    const indices = [0, 1, 2, 3, 4, 5, 6];

    let html = `<div class="menu-font-container select-none">`;

    // Font sizes
    indices.forEach((idx) => {
        const isSelected = currentFontIdx === idx;
        const selectedClass = isSelected ? 'menu-item-selected' : 'text-gray-800';
        const action = isTitle ? `changeTitleFont(${idx})` : `changeNoteFont(${noteIndex}, ${idx})`;
        html += `<div class="menu-font-item ${selectedClass}" onclick="${action}; closeContextMenu();">
            <span class="font-medium">${labelArray[idx]}</span>
            ${isSelected ? menuCheckIcon : ''}
        </div>`;
    });

    html += `</div>`;
    contextMenu.innerHTML = html;             positionMenu(x, y, anchorElement, isTitle ? 'default' : 'timer-right');
}

function commitCurrentEdit() {
    closeContextMenu();
    let committed = false;
    if (titleState.isEditing) {
        const titleInput = document.getElementById('title-edit-input');
        if (titleInput) {
            const newText = titleInput.innerText.trim();
            if (newText !== '' && newText !== titleState.text) titleState.text = newText;
        }
        titleState.isEditing = false; titleState.isMenuOpen = false; committed = true;
    }
    if (editingIndex !== null) {
        const noteInput = document.getElementById('note-edit-input');
        if (noteInput) {
            const newText = noteInput.innerText.trim();
            const note = notes[editingIndex];
            if (newText === '') {
                notes[editingIndex] = null;
                selectedNotes.clear();
            } else note.text = newText;
        }
        editingIndex = null; committed = true;
    }
    if (committed) saveData();
    return committed;
}

function commitOutsideEdit() {
    const noteIndex = editingIndex;
    const committed = commitCurrentEdit();
    if (noteIndex !== null) {
        selectedNotes.clear();
        activeMenuIndex = null;
        document.body.classList.remove('has-window-selection');
    }
    return committed;
}

function commitOutsideEditAndRender() {
    if (commitOutsideEdit()) {
        renderTitle();
        renderGrid();
    }
}

function createMenuButton(positionClasses, iconHTML, onClick, tooltip = '', isButton = false) {
    const btn = document.createElement(isButton ? 'button' : 'div');
    if (isButton) btn.type = 'button';
    btn.className = `title-menu-button absolute ${positionClasses} bg-white text-black rounded-full flex items-center justify-center text-xs shadow-md cursor-pointer hover:bg-gray-100 border border-gray-200 z-[60] transition-colors no-select`;
    if (tooltip) {
        btn.title = tooltip;
        btn.setAttribute('aria-label', tooltip);
    }
    btn.innerHTML = iconHTML;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(e); });
    return btn;
}

function createTitleButton(iconHTML, tooltip, onClick, extraClass = '') {
    const btn = document.createElement('div');
    btn.className = `title-action-btn ${extraClass}`;
    btn.title = tooltip;
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', tooltip);
    btn.innerHTML = iconHTML;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(e); });
    return btn;
}

function getThemeClasses() {
    const baseClass = titleColors[titleState.colorIndex] || titleColors[0];
    return { outline: baseClass.replace('text-', 'outline-'), border: baseClass.replace('text-', 'border-') };
}

