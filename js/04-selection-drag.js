/* ==========================================================================
   04-selection-drag.js
   - Multi-cell marquee/window selection & shared group action toolbar
   - Rectangular group move/insert calculations & visual drop indicators
   - Single-stone and multi-cell shape drag-and-drop handlers
   ========================================================================== */

function createCloneCell(note, sizeStr, isSelectedEmpty = false) {
    const wrapper = document.createElement('div');
    wrapper.style.width = sizeStr; wrapper.style.height = sizeStr; wrapper.style.padding = '2px'; wrapper.style.boxSizing = 'border-box';
    wrapper.style.display = 'flex'; wrapper.style.alignItems = 'center'; wrapper.style.justifyContent = 'center';
    if (note) {
        const strikeClass = getStrikeClass(note);
        const inner = document.createElement('div');
        inner.className = `w-full h-full ${note.color} rounded-full flex items-center justify-center text-center px-0 stone-effect overflow-visible break-words font-semibold text-white note-engraved-text ${fontSizes[Math.min(fontSizes.length - 1, Math.max(0, note.fontIndex ?? 3))]} ${strikeClass} relative`;
        inner.innerText = note.text;
        wrapper.appendChild(inner);
    } else if (isSelectedEmpty) {
        const inner = document.createElement('div');
        inner.className = 'w-full h-full rounded-xl';
        inner.style.border = '1.5px dashed var(--selection-ring-color, #eab308)';
        inner.style.background = 'color-mix(in srgb, var(--selection-ring-color, #eab308) 12%, transparent)';
        inner.style.opacity = '0.8';
        inner.style.boxSizing = 'border-box';
        wrapper.appendChild(inner);
    } else {
        const emptySlot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        emptySlot.setAttribute('width', '24');
        emptySlot.setAttribute('height', '24');
        emptySlot.setAttribute('viewBox', '0 0 24 24');
        emptySlot.setAttribute('fill', 'none');
        emptySlot.setAttribute('stroke', '#9ca3af');
        emptySlot.setAttribute('stroke-width', '1');
        emptySlot.setAttribute('stroke-linecap', 'round');
        emptySlot.setAttribute('stroke-linejoin', 'round');
        emptySlot.style.opacity = '0.5';
        const verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        verticalLine.setAttribute('x1', '12');
        verticalLine.setAttribute('y1', '5');
        verticalLine.setAttribute('x2', '12');
        verticalLine.setAttribute('y2', '19');
        const horizontalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        horizontalLine.setAttribute('x1', '5');
        horizontalLine.setAttribute('y1', '12');
        horizontalLine.setAttribute('x2', '19');
        horizontalLine.setAttribute('y2', '12');
        emptySlot.append(verticalLine, horizontalLine);
        wrapper.appendChild(emptySlot);
    }
    return wrapper;
}

function getRectangularSelectionIndices(indices) {
    if (indices.length === 0) return [];
    const rows = indices.map((idx) => Math.floor(idx / totalCols));
    const cols = indices.map((idx) => idx % totalCols);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const rectangle = [];

    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            rectangle.push(row * totalCols + col);
        }
    }
    return rectangle;
}

function updateMultiSelectionBox() {
    if (!gridElement) return;
    const existing = document.getElementById('multi-cell-selection-box');
    const existingToolbar = document.getElementById('group-action-toolbar');
    if (selectedNotes.size <= 1) {
        if (existing) existing.remove();
        if (existingToolbar) existingToolbar.remove();
        document.body.classList.remove('has-window-selection');
        return;
    }

    document.body.classList.add('has-window-selection');

    const indices = Array.from(selectedNotes);
    const rows = indices.map((idx) => Math.floor(idx / totalCols));
    const cols = indices.map((idx) => idx % totalCols);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    let box = existing;
    if (!box) {
        box = document.createElement('div');
        box.id = 'multi-cell-selection-box';
        gridElement.appendChild(box);
    }
    box.style.gridArea = `${minRow + 1} / ${minCol + 1} / ${maxRow + 2} / ${maxCol + 2}`;

    // Build / update the shared group action toolbar
    const anchorIdx = indices.find(idx => notes[idx] !== null) ?? indices[0];
    if (existingToolbar) existingToolbar.remove();
    const toolbar = document.createElement('div');
    toolbar.id = 'group-action-toolbar';
    // Spans the ENTIRE bounding rectangle of the selection
    toolbar.style.gridArea = `${minRow + 1} / ${minCol + 1} / ${maxRow + 2} / ${maxCol + 2}`;
    toolbar.style.position = 'relative';
    toolbar.style.pointerEvents = 'none';
    toolbar.style.zIndex = '54';

    const btnBase = 'title-menu-button absolute bg-white text-black rounded-full flex items-center justify-center text-xs shadow-md cursor-pointer hover:bg-gray-100 border border-gray-200 z-[60] transition-colors no-select group-toolbar-btn';
    const btnStyle = 'width:28px;height:28px;pointer-events:auto;';

    // 1. Color button: bottom-left of the selection
    const colorBtn = document.createElement('div');
    colorBtn.className = btnBase;
    colorBtn.setAttribute('style', `${btnStyle}position:absolute;bottom:-14px;left:-14px;`);
    colorBtn.title = 'Change color';
    colorBtn.innerHTML = iconPalette;
    colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeMenuIndex = anchorIdx;
        document.querySelectorAll('.grid-cell.has-menu').forEach(c => c.classList.remove('has-menu'));
        const cell = document.getElementById(`grid-cell-${anchorIdx}`);
        if (cell) cell.classList.add('has-menu');
        toggleColorContextMenu(e.pageX, e.pageY, anchorIdx, colorBtn);
    });
    toolbar.appendChild(colorBtn);

    // 2. Status button: top-right of the selection
    const statusBtn = document.createElement('div');
    statusBtn.className = btnBase;
    statusBtn.setAttribute('style', `${btnStyle}position:absolute;top:-14px;right:-14px;`);
    statusBtn.title = 'Set status';
    statusBtn.innerHTML = iconStatus;
    statusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeMenuIndex = anchorIdx;
        document.querySelectorAll('.grid-cell.has-menu').forEach(c => c.classList.remove('has-menu'));
        const cell = document.getElementById(`grid-cell-${anchorIdx}`);
        if (cell) cell.classList.add('has-menu');
        toggleStatusContextMenu(e.pageX, e.pageY, anchorIdx, statusBtn);
    });
    toolbar.appendChild(statusBtn);

    // 3. Font button: bottom-right of the selection
    const fontBtn = document.createElement('div');
    fontBtn.className = btnBase;
    fontBtn.setAttribute('style', `${btnStyle}position:absolute;bottom:-14px;right:-14px;`);
    fontBtn.title = 'Change font size';
    fontBtn.innerHTML = iconFont;
    fontBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeMenuIndex = anchorIdx;
        document.querySelectorAll('.grid-cell.has-menu').forEach(c => c.classList.remove('has-menu'));
        const cell = document.getElementById(`grid-cell-${anchorIdx}`);
        if (cell) cell.classList.add('has-menu');
        toggleFontContextMenu(e.pageX, e.pageY, anchorIdx, fontBtn);
    });
    toolbar.appendChild(fontBtn);

    if (notes[anchorIdx]) {
        const weekdayBtn = document.createElement('button');
        weekdayBtn.type = 'button';
        weekdayBtn.className = btnBase;
        weekdayBtn.setAttribute('style', `${btnStyle}position:absolute;top:-14px;left:-14px;`);
        weekdayBtn.title = 'Set day of week';
        weekdayBtn.setAttribute('aria-label', 'Set day of week for selection');
        weekdayBtn.innerHTML = iconWeekday;
        weekdayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWeekdayContextMenu(e.pageX, e.pageY, anchorIdx, weekdayBtn);
        });
        toolbar.appendChild(weekdayBtn);
    }

    gridElement.appendChild(toolbar);
}

function setWindowSelectedNotes(indices) {
    const nextSelection = new Set(indices);
    selectedNotes = nextSelection;
    document.body.classList.toggle('has-window-selection', selectedNotes.size > 1);
    const themeOutline = getThemeClasses().outline;
    const totalCells = totalRows * totalCols;
    for (let i = 0; i < totalCells; i++) {
        const cell = document.getElementById(`grid-cell-${i}`);
        if (!cell) continue;
        const isSelected = selectedNotes.has(i);
        cell.classList.toggle('is-selected', isSelected);
        if (selectedNotes.size > 1) {
            cell.querySelectorAll('.stone-action-btn').forEach(btn => btn.classList.remove('stone-menu-btn-visible'));
        }
        const note = notes[i];
        if (note !== null) {
            const circle = cell.querySelector('.stone-effect');
            if (circle) {
                if (isSelected) {
                    cell.style.zIndex = '50';
                    circle.classList.add('stone-effect-active');
                    circle.classList.remove('outline', 'selection-ring');
                    if (themeOutline) circle.classList.remove(themeOutline);
                } else if (editingIndex !== i && draggedIndex !== i) {
                    cell.style.zIndex = '';
                    circle.classList.remove('stone-effect-active', 'outline', 'selection-ring');
                    if (themeOutline) circle.classList.remove(themeOutline);
                }
            }
        } else {
            if (isSelected) {
                cell.style.zIndex = '50';
            } else {
                cell.style.zIndex = '';
            }
            cell.querySelector('.empty-selection-ring')?.remove();
        }
    }
    updateMultiSelectionBox();
}

function updateWindowSelection(clientX, clientY) {
    if (!windowSelection || !windowSelection.started) return;

    const left = Math.min(windowSelection.startX, clientX);
    const top = Math.min(windowSelection.startY, clientY);
    const right = Math.max(windowSelection.startX, clientX);
    const bottom = Math.max(windowSelection.startY, clientY);

    const selectedIndices = [];
    const totalCells = totalRows * totalCols;
    for (let idx = 0; idx < totalCells; idx++) {
        const cell = document.getElementById(`grid-cell-${idx}`);
        if (!cell) continue;
        const rect = cell.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const intersects = !(rect.right < left || rect.left > right || rect.bottom < top || rect.top > bottom);
        const overlapW = Math.max(0, Math.min(rect.right, right) - Math.max(rect.left, left));
        const overlapH = Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, top));
        if ((centerX >= left && centerX <= right && centerY >= top && centerY <= bottom) ||
            (intersects && overlapW > rect.width * 0.25 && overlapH > rect.height * 0.25)) {
            selectedIndices.push(idx);
        }
    }
    setWindowSelectedNotes(getRectangularSelectionIndices(selectedIndices));
}

function beginWindowSelection() {
    windowSelection.started = true;
    document.body.classList.add('is-marquee-selecting');
    selectedNotes.clear();
    activeMenuIndex = null;
    closeContextMenu();
    setWindowSelectedNotes([]);
    gridElement.querySelectorAll('.stone-wrapper[draggable="true"], .stone-effect[draggable="true"]').forEach((el) => {
        el.draggable = false;
    });

}

let suppressedMarqueeClickUntil = 0;

function finishWindowSelection(event, wasCancelled = false) {
    if (!windowSelection || event.pointerId !== windowSelection.pointerId) return;
    const selection = windowSelection;
    const pointerX = event.clientX;
    const pointerY = event.clientY;

    try {
        if (workspace.hasPointerCapture(selection.pointerId)) {
            workspace.releasePointerCapture(selection.pointerId);
        }
    } catch (err) { }

    if (selection.started) {
        if (!wasCancelled) updateWindowSelection(pointerX, pointerY);
        if (!wasCancelled) {
            suppressedMarqueeClickUntil = Date.now() + 150;
            if (selectedNotes.size === 1) {
                activeMenuIndex = Array.from(selectedNotes)[0];
            } else {
                activeMenuIndex = null;
            }
        }
        document.body.classList.toggle('has-window-selection', selectedNotes.size > 1);
        renderGrid();
    }
    document.body.classList.remove('is-marquee-selecting');
    windowSelection = null;
}

function setupWindowSelection() {
    document.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || editingIndex !== null || titleState.isEditing) return;
        if (event.target.closest('.app-header, #context-menu, #about-modal, .title-menu-button, .thumbtack, button, input, textarea, [contenteditable="true"], .btn-save, .cell-underline-dock, .cell-timer-dock')) return;

        const cell = event.target.closest('.grid-cell');
        if (cell) {
            const cellIdx = parseInt(cell.id.replace('grid-cell-', ''), 10);
            if (selectedNotes.size > 1 && selectedNotes.has(cellIdx)) {
                return; // Cell is part of active window selection: allow dragging it!
            }

            const circle = cell.querySelector('.stone-effect');
            if (circle) {
                if (isPointInsideStone(circle, event.clientX, event.clientY)) {
                    return; // Only clicks strictly inside the stone circle belong to stone interactions
                }
            } else if (notes[cellIdx] === null) {
                if (event.target.closest('.cell-add-icon')) {
                    return; // Clicking the '+' sign adds a note.
                }
            }
        }

        try {
            workspace.setPointerCapture(event.pointerId);
        } catch (err) { }

        windowSelection = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            started: false
        };
    });

    document.addEventListener('dragstart', (e) => {
        if (windowSelection) {
            e.preventDefault();
            return false;
        }
    }, true);

    document.addEventListener('pointermove', (event) => {
        if (!windowSelection || event.pointerId !== windowSelection.pointerId) return;
        if (!windowSelection.started) {
            const dx = event.clientX - windowSelection.startX;
            const dy = event.clientY - windowSelection.startY;
            if (dx * dx + dy * dy < 25) return;
            beginWindowSelection();
        }
        event.preventDefault();
        updateWindowSelection(event.clientX, event.clientY);
    });

    document.addEventListener('pointerup', (event) => finishWindowSelection(event));
    document.addEventListener('pointercancel', (event) => {
        if (windowSelection && event.pointerId === windowSelection.pointerId) {
            finishWindowSelection(event, true);
        }
    });
    document.addEventListener('click', (event) => {
        if (Date.now() <= suppressedMarqueeClickUntil) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
}

function canInsertSelection(selection, origin, row, col, direction, isCopy) {
    if (!selection) return false;
    return buildSelectionInsertion(selection, origin, row, col, direction, isCopy) !== null;
}

function insertSelectionIntoBoard(selection, origin, row, col, direction, isCopy) {
    const insertion = buildSelectionInsertion(selection, origin, row, col, direction, isCopy);
    if (!insertion) return false;
    notes = insertion.notes;
    selectedNotes.clear();
    insertion.indices.forEach((idx) => selectedNotes.add(idx));
    return true;
}

function buildSelectionInsertion(selection, origin, row, col, direction, isCopy) {
    if (!selection) return null;
    const bounds = getSelectionBounds(selection.indices);
    if (!bounds) return null;
    const isHorizontal = direction === 'left' || direction === 'right';
    const isVertical = direction === 'top' || direction === 'bottom';
    if (!isHorizontal && !isVertical) return null;

    const originRow = Math.floor(origin / totalCols);
    const originCol = origin % totalCols;
    const targetTop = row + bounds.minRow - originRow;
    const targetLeft = col + bounds.minCol - originCol;
    const rowCount = bounds.maxRow - bounds.minRow + 1;
    const colCount = bounds.maxCol - bounds.minCol + 1;
    const rowDelta = targetTop - bounds.minRow;
    const colDelta = targetLeft - bounds.minCol;
    if (targetTop < 0 || targetTop + rowCount > totalRows ||
        targetLeft < 0 || targetLeft + colCount > totalCols) return null;
    if (isHorizontal &&
        (rowDelta !== 0 || colDelta === 0 ||
            (direction === 'right' ? colDelta < 0 : colDelta > 0))) return null;
    if (isVertical &&
        (colDelta !== 0 || rowDelta === 0 ||
            (direction === 'bottom' ? rowDelta < 0 : rowDelta > 0))) return null;

    const shiftedNotes = notes.slice();
    const initialNotes = notes.slice();
    const blockForLine = (line, start, length) => line.slice(start, start + length);
    const writeLine = (line, rowIndex, isRow) => {
        const base = isRow ? rowIndex * totalCols : rowIndex;
        const lineLength = isRow ? totalCols : totalRows;
        const start = isRow ? bounds.minCol : bounds.minRow;
        const target = isRow ? targetLeft : targetTop;
        const length = isRow ? colCount : rowCount;
        const directionDelta = target - start;
        const getValue = (position) => shiftedNotes[base + (isRow ? position : position * totalCols)];
        const setValue = (position, value) => {
            shiftedNotes[base + (isRow ? position : position * totalCols)] = value;
        };
        const block = blockForLine(line, start, length);

        if (!isCopy) {
            const reordered = line.slice();
            reordered.splice(start, length);
            reordered.splice(target, 0, ...block);
            for (let position = 0; position < lineLength; position++) {
                setValue(position, reordered[position]);
            }
            return true;
        }

        if (directionDelta > 0) {
            for (let position = lineLength - length; position < lineLength; position++) {
                if (getValue(position) !== null) return false;
            }
            for (let position = lineLength - 1; position >= target + length; position--) {
                setValue(position, getValue(position - length));
            }
        } else {
            for (let position = 0; position < length; position++) {
                if (getValue(position) !== null) return false;
            }
            for (let position = 0; position < target; position++) {
                setValue(position, getValue(position + length));
            }
        }
        for (let offset = 0; offset < length; offset++) {
            setValue(target + offset, block[offset]);
        }
        return true;
    };

    for (let offset = 0; offset < (isHorizontal ? rowCount : colCount); offset++) {
        const lineStart = isHorizontal
            ? (bounds.minRow + offset) * totalCols
            : bounds.minCol + offset;
        const lineLength = isHorizontal ? totalCols : totalRows;
        const line = Array.from({ length: lineLength }, (_, position) =>
            initialNotes[lineStart + (isHorizontal ? position : position * totalCols)]);
        if (!writeLine(line, isHorizontal ? bounds.minRow + offset : bounds.minCol + offset, isHorizontal)) {
            return null;
        }
    }

    return {
        notes: shiftedNotes,
        indices: Array.from({ length: rowCount * colCount }, (_, offset) =>
            (targetTop + Math.floor(offset / colCount)) * totalCols + targetLeft + offset % colCount)
    };
}

function getSelectionBounds(indices) {
    if (!indices.length) return null;
    const rows = indices.map((idx) => Math.floor(idx / totalCols));
    const cols = indices.map((idx) => idx % totalCols);
    const bounds = {
        minRow: Math.min(...rows),
        maxRow: Math.max(...rows),
        minCol: Math.min(...cols),
        maxCol: Math.max(...cols)
    };
    const expectedSize = (bounds.maxRow - bounds.minRow + 1) *
        (bounds.maxCol - bounds.minCol + 1);
    return indices.length === expectedSize ? bounds : null;
}

function getWindowMoveTargetIndices(selection, origin, row, col) {
    const bounds = getSelectionBounds(selection.indices);
    if (!bounds) return null;

    const rowOffset = row - Math.floor(origin / totalCols);
    const colOffset = col - (origin % totalCols);
    const sourceIndices = new Set(selection.indices);
    const targetIndices = selection.indices.map((idx) => {
        const targetRow = Math.floor(idx / totalCols) + rowOffset;
        const targetCol = idx % totalCols + colOffset;
        if (targetRow < 0 || targetRow >= totalRows ||
            targetCol < 0 || targetCol >= totalCols) return null;
        return targetRow * totalCols + targetCol;
    });

    if (targetIndices.some((idx) => idx === null ||
        (notes[idx] !== null && !sourceIndices.has(idx)))) return null;
    return targetIndices;
}

function showGroupMoveIndicator(targetIndices, borderColor) {
    const existing = document.getElementById('group-move-indicator');
    if (existing) existing.remove();

    const bounds = getSelectionBounds(targetIndices);
    if (!bounds) return;
    const firstCell = document.getElementById(`grid-cell-${bounds.minRow * totalCols + bounds.minCol}`);
    const lastCell = document.getElementById(`grid-cell-${bounds.maxRow * totalCols + bounds.maxCol}`);
    if (!firstCell || !lastCell) return;

    const gridRect = gridElement.getBoundingClientRect();
    const firstRect = firstCell.getBoundingClientRect();
    const lastRect = lastCell.getBoundingClientRect();
    const indicator = document.createElement('div');
    indicator.id = 'group-move-indicator';
    indicator.style.position = 'absolute';
    indicator.style.pointerEvents = 'none';
    indicator.style.zIndex = '65';
    indicator.style.boxSizing = 'border-box';
    indicator.style.left = `${firstRect.left - gridRect.left}px`;
    indicator.style.top = `${firstRect.top - gridRect.top}px`;
    indicator.style.width = `${lastRect.right - firstRect.left}px`;
    indicator.style.height = `${lastRect.bottom - firstRect.top}px`;
    indicator.style.border = `3.5px solid ${borderColor}`;
    indicator.style.borderRadius = '12px';
    indicator.style.backgroundColor = 'transparent';
    indicator.style.boxShadow = 'none';
    indicator.style.opacity = '0.95';
    indicator.style.transition = 'none';
    gridElement.appendChild(indicator);
}

function showLocalInsertIndicator(selection, origin, row, col, direction, borderColor) {
    const existing = document.getElementById('group-insert-indicator');
    if (existing) existing.remove();

    const originRow = Math.floor(origin / totalCols);
    const originCol = origin % totalCols;
    const positions = selection.indices.map((idx) => ({
        row: row + Math.floor(idx / totalCols) - originRow,
        col: col + (idx % totalCols) - originCol
    }));
    const firstRow = Math.min(...positions.map((pos) => pos.row));
    const lastRow = Math.max(...positions.map((pos) => pos.row));
    const firstCol = Math.min(...positions.map((pos) => pos.col));
    const lastCol = Math.max(...positions.map((pos) => pos.col));
    const firstCell = document.getElementById(`grid-cell-${firstRow * totalCols + firstCol}`);
    const lastCell = document.getElementById(`grid-cell-${lastRow * totalCols + lastCol}`);
    if (!firstCell || !lastCell) return;

    const gridRect = gridElement.getBoundingClientRect();
    const firstRect = firstCell.getBoundingClientRect();
    const lastRect = lastCell.getBoundingClientRect();
    const indicator = document.createElement('div');
    indicator.id = 'group-insert-indicator';
    indicator.style.position = 'absolute';
    indicator.style.pointerEvents = 'none';
    indicator.style.zIndex = '65';
    indicator.style.boxSizing = 'border-box';
    indicator.style.left = `${firstRect.left - gridRect.left}px`;
    indicator.style.top = `${firstRect.top - gridRect.top}px`;
    indicator.style.width = `${lastRect.right - firstRect.left}px`;
    indicator.style.height = `${lastRect.bottom - firstRect.top}px`;
    indicator.style.borderColor = borderColor;
    indicator.style.borderStyle = 'solid';
    indicator.style.backgroundColor = 'transparent';
    indicator.style.boxShadow = 'none';
    indicator.style.opacity = '0.95';
    indicator.style.transition = 'none';
    indicator.style.borderWidth = '0';
    if (direction === 'top' || direction === 'bottom') {
        indicator.style.borderLeftWidth = '3.5px';
        indicator.style.borderRightWidth = '3.5px';
        if (direction === 'top') {
            indicator.style.borderTopWidth = '3.5px';
            indicator.style.borderTopLeftRadius = '12px';
            indicator.style.borderTopRightRadius = '12px';
        } else {
            indicator.style.borderBottomWidth = '3.5px';
            indicator.style.borderBottomLeftRadius = '12px';
            indicator.style.borderBottomRightRadius = '12px';
        }
    } else {
        indicator.style.borderTopWidth = '3.5px';
        indicator.style.borderBottomWidth = '3.5px';
        if (direction === 'left') {
            indicator.style.borderLeftWidth = '3.5px';
            indicator.style.borderTopLeftRadius = '12px';
            indicator.style.borderBottomLeftRadius = '12px';
        } else {
            indicator.style.borderRightWidth = '3.5px';
            indicator.style.borderTopRightRadius = '12px';
            indicator.style.borderBottomRightRadius = '12px';
        }
    }
    gridElement.appendChild(indicator);
}

function initiateShapeDrag(e, i, r, c) {
    if (commitCurrentEdit()) { e.preventDefault(); return; }

    document.documentElement.classList.add('is-dragging-stone');
    document.body.classList.add('is-dragging-stone');

    draggedShape = { origin: i, indices: Array.from(selectedNotes) };

    const cSizeStr = getComputedStyle(document.documentElement).getPropertyValue('--cell-size').trim();
    const cSize = parseFloat(cSizeStr);
    const columnGapSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-column-gap').trim()) || 0;
    const rowGapSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-row-gap').trim()) || 0;

    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    draggedShape.indices.forEach(idx => {
        let cl = idx % totalCols; let rl = Math.floor(idx / totalCols);
        if (cl < minC) minC = cl; if (cl > maxC) maxC = cl;
        if (rl < minR) minR = rl; if (rl > maxR) maxR = rl;
    });

    const PAD = 32;
    const contentW = (maxC - minC + 1) * cSize + (maxC - minC) * columnGapSize;
    const contentH = (maxR - minR + 1) * cSize + (maxR - minR) * rowGapSize;

    const cloneContainer = document.createElement('div');
    cloneContainer.style.position = 'fixed';
    cloneContainer.style.left = '-9999px';
    cloneContainer.style.top = '-9999px';
    cloneContainer.style.width = `${contentW + PAD * 2}px`;
    cloneContainer.style.height = `${contentH + PAD * 2}px`;
    cloneContainer.style.boxSizing = 'border-box';
    cloneContainer.style.background = 'transparent';
    cloneContainer.style.pointerEvents = 'none';
    cloneContainer.style.opacity = '0.95';

    for (let rl = minR; rl <= maxR; rl++) {
        for (let cl = minC; cl <= maxC; cl++) {
            const curIdx = rl * totalCols + cl;
            const isCellSelected = draggedShape.indices.includes(curIdx);
            const cellClone = createCloneCell(notes[curIdx], cSizeStr, isCellSelected);
            cellClone.style.position = 'absolute';
            cellClone.style.left = `${(cl - minC) * (cSize + columnGapSize) + PAD}px`;
            cellClone.style.top = `${(rl - minR) * (cSize + rowGapSize) + PAD}px`;
            cloneContainer.appendChild(cellClone);
        }
    }
    document.body.appendChild(cloneContainer);

    const offsetX = (c - minC) * (cSize + columnGapSize) + cSize / 2 + PAD;
    const offsetY = (r - minR) * (cSize + rowGapSize) + cSize / 2 + PAD;

    e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', '');

    setTimeout(() => {
        if (draggedShape) {
            draggedShape.indices.forEach(idx => {
                const cEl = document.getElementById(`grid-cell-${idx}`);
                const dWrap = cEl?.querySelector('.stone-wrapper');
                if (dWrap) dWrap.classList.add('dragging');
                cEl?.classList.add('dragging');
            });
        }
    }, 0);

    try { e.dataTransfer.setDragImage(cloneContainer, offsetX, offsetY); } catch (err) { }
    setTimeout(() => cloneContainer.remove(), 0);
}

function attachWindowDragHandler(cell, i, r, c) {
    if (selectedNotes.size > 1 && selectedNotes.has(i)) {
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => {
            if (draggedShape) return;
            initiateShapeDrag(e, i, r, c);
        });
        cell.addEventListener('dragend', endDragSession);
    } else {
        cell.draggable = false;
    }
}

function attachStoneDragHandlers(dragWrapper, circle, i, r, c) {
    circle.draggable = true;
    dragWrapper.draggable = false;

    circle.addEventListener('dragstart', (e) => {
        if (selectedNotes.has(i) && selectedNotes.size > 1) {
            e.stopPropagation();
            initiateShapeDrag(e, i, r, c);
            return;
        }

        const circleRect = circle.getBoundingClientRect();
        const normalizedX = (e.clientX - circleRect.left - circleRect.width / 2) / (circleRect.width / 2);
        const normalizedY = (e.clientY - circleRect.top - circleRect.height / 2) / (circleRect.height / 2);
        if (normalizedX ** 2 + normalizedY ** 2 > 1) { e.preventDefault(); return; }

        if (commitCurrentEdit()) { e.preventDefault(); return; }

        document.documentElement.classList.add('is-dragging-stone');
        document.body.classList.add('is-dragging-stone');

        draggedIndex = i; activeMenuIndex = null; draggedShape = null;
        e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', '');

        const PAD = 32;
        const dragGhost = document.createElement('div');
        dragGhost.style.position = 'fixed';
        dragGhost.style.left = '-9999px';
        dragGhost.style.top = '-9999px';
        dragGhost.style.width = `${circleRect.width + PAD * 2}px`;
        dragGhost.style.height = `${circleRect.height + PAD * 2}px`;
        dragGhost.style.boxSizing = 'border-box';
        dragGhost.style.background = 'transparent';
        dragGhost.style.pointerEvents = 'none';

        const stoneClone = circle.cloneNode(true);
        stoneClone.style.position = 'absolute';
        stoneClone.style.left = `${PAD}px`;
        stoneClone.style.top = `${PAD}px`;
        stoneClone.style.width = `${circleRect.width}px`;
        stoneClone.style.height = `${circleRect.height}px`;
        stoneClone.style.margin = '0';
        stoneClone.style.transform = 'none';
        stoneClone.style.transition = 'none';
        stoneClone.style.opacity = '1';

        dragGhost.appendChild(stoneClone);
        document.body.appendChild(dragGhost);

        const offsetX = (e.clientX - circleRect.left) + PAD;
        const offsetY = (e.clientY - circleRect.top) + PAD;

        try {
            e.dataTransfer.setDragImage(dragGhost, offsetX, offsetY);
        } catch (err) { }

        setTimeout(() => dragGhost.remove(), 0);

        setTimeout(() => {
            if (dragWrapper && draggedIndex !== null) dragWrapper.classList.add('dragging');
        }, 0);
    });

    circle.addEventListener('dragend', endDragSession);
}

