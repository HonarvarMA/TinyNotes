/* ==========================================================================
   05-render-init.js
   - Title rendering (renderTitle)
   - Main board grid rendering & cell drop logic (renderGrid)
   - Toolbar button events (Save, Load, Sync, Trash, Grid, Colors, Style, About)
   - Global listeners, startup initialization & midnight weekday refresh
   ========================================================================== */

function renderTitle() {
    titleContainer.innerHTML = '';
    const textEl = document.createElement('div');
    const colorClass = titleColors[titleState.colorIndex] || titleColors[0];
    const fontClass = fontSizes[titleState.fontIndex];
    const strikeClass = getStrikeClass(titleState.strike);

    textEl.className = `title-text-element title-text-effect font-medium text-center tracking-wide font-sans outline-none p-1 px-4 rounded-lg transition-colors ${colorClass} ${fontClass} ${strikeClass}`;
    textEl.setAttribute('dir', 'auto');

    if (titleState.isEditing) {
        textEl.contentEditable = true; textEl.id = 'title-edit-input';
        textEl.className += ' cursor-text border-b-2 border-blue-400 border-dashed';
        textEl.innerText = titleState.text;
        textEl.addEventListener('input', resizeGrid);
        setTimeout(() => {
            textEl.focus(); const range = document.createRange(); const sel = window.getSelection();
            range.selectNodeContents(textEl); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
        }, 10);

        textEl.addEventListener('click', e => { e.stopPropagation(); closeContextMenu(); });
        textEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); titleContainer.querySelector('.btn-save')?.click(); } });

        // Font size button on the left
        const fontBtn = createTitleButton(iconFont, 'Title font size', (e) => {
            titleState.text = textEl.innerText;
            toggleFontContextMenu(e.pageX, e.pageY, 'title', e.currentTarget);
        });
        titleContainer.appendChild(fontBtn);

        titleContainer.appendChild(textEl);

        // Action button on the right (Save)
        const btnRow = document.createElement('div');
        btnRow.className = 'title-buttons-row flex items-center gap-1.5 flex-shrink-0';

        btnRow.appendChild(createTitleButton(iconCheck, 'Save title', () => {
            closeContextMenu(); const newText = textEl.innerText.trim();
            if (newText !== '' && newText !== titleState.text) titleState.text = newText;
            titleState.isEditing = false; titleState.isMenuOpen = false; saveData(); renderTitle();
        }, 'btn-save'));

        titleContainer.appendChild(btnRow);
    } else {
        textEl.innerText = titleState.text; textEl.className += ' cursor-pointer no-select';
        textEl.addEventListener('click', (e) => {
            if (editMouseDownInside) return;
            e.stopPropagation(); if (commitCurrentEdit()) renderGrid();
            titleState.isMenuOpen = !titleState.isMenuOpen; renderTitle();
        });

        if (titleState.isMenuOpen) {
            // Font size button on the left
            const fontBtn = createTitleButton(iconFont, 'Title font size', (e) => {
                toggleFontContextMenu(e.pageX, e.pageY, 'title', e.currentTarget);
            });
            titleContainer.appendChild(fontBtn);

            titleContainer.appendChild(textEl);

            // Edit button on the right
            const btnRow = document.createElement('div');
            btnRow.className = 'title-buttons-row flex items-center gap-1.5 flex-shrink-0';

            btnRow.appendChild(createTitleButton(iconEdit, 'Edit title', () => {
                closeContextMenu(); titleState.isEditing = true; renderTitle();
            }));

            titleContainer.appendChild(btnRow);
        } else {
            titleContainer.appendChild(textEl);
        }
    }
    const computedColor = titleColorValues[titleColors[titleState.colorIndex]] || getComputedStyle(textEl).color;
    document.documentElement.style.setProperty('--title-color', computedColor);
    document.documentElement.style.setProperty('--selection-ring-color', computedColor);
    resizeGrid();
}


function renderGrid() {
    clearActiveDropIndicator();
    resizeGrid();
    document.body.classList.toggle('has-window-selection', selectedNotes.size > 1);
    gridElement.innerHTML = '';

    selectedNotes.forEach(idx => {
        if (idx >= totalRows * totalCols) {
            selectedNotes.delete(idx);
        }
    });
    if (activeMenuIndex !== null && activeMenuIndex >= totalRows * totalCols) {
        activeMenuIndex = null;
    }

    gridElement.style.gridTemplateColumns = `repeat(${totalCols}, var(--cell-size))`;
    gridElement.style.gridTemplateRows = `repeat(${totalRows}, var(--cell-height, var(--cell-size)))`;

    for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
            const i = r * totalCols + c;
            const cell = document.createElement('div');
            cell.id = `grid-cell-${i}`;
            cell.style.gridArea = `${r + 1} / ${c + 1} / ${r + 2} / ${c + 2}`;
            cell.className = 'grid-cell z-10';

            // Attach window drag handler so ANY cell in a multi-cell selection can drag the window
            attachWindowDragHandler(cell, i, r, c);

            // Flat plate surface backing
            const plateSurface = document.createElement('div');
            plateSurface.className = 'cell-plate-surface';
            cell.appendChild(plateSurface);

            const note = notes[i];

            // Drop Indicator Overlay
            const dropIndicator = document.createElement('div');
            dropIndicator.className = 'drop-indicator absolute inset-0 pointer-events-none z-30 opacity-0 box-border';
            cell.appendChild(dropIndicator);

            if (note === null) {
                cell.classList.add('cell-status-normal');
                const isEmptySelected = selectedNotes.has(i);
                if (isEmptySelected) {
                    cell.style.zIndex = '50';
                    cell.classList.add('is-selected');
                }

                cell.insertAdjacentHTML('beforeend', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="cell-add-icon text-gray-400 opacity-50 select-none absolute" draggable="false"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`);

                cell.addEventListener('click', (e) => {
                    if (Date.now() <= suppressedMarqueeClickUntil) return;
                    if (editMouseDownInside) return;
                    e.stopPropagation();
                    const wasEditingNote = editingIndex !== null;
                    commitOutsideEdit();
                    const clickedAddIcon = e.target.closest('.cell-add-icon');
                    if (!clickedAddIcon && wasEditingNote) {
                        renderTitle();
                        renderGrid();
                        return;
                    }
                    if (!clickedAddIcon && selectedNotes.size > 0) {
                        selectedNotes.clear();
                        activeMenuIndex = null;
                        document.body.classList.remove('has-window-selection');
                        renderGrid();
                        return;
                    }
                    if (!clickedAddIcon) return;
                    activeMenuIndex = null;
                    selectedNotes.clear();
                    notes[i] = { text: '', color: lastUsedColor, fontIndex: lastUsedFontIndex };
                    editingIndex = i; renderTitle(); renderGrid();
                });
            } else {
                const statusGroup = getNoteStatusGroup(note);
                cell.classList.add(statusGroup ? `cell-status-${statusGroup}` : 'cell-status-normal');
                const isSelectedCell = selectedNotes.has(i) || editingIndex === i;
                if (isSelectedCell) {
                    cell.style.zIndex = '50';
                    cell.classList.add('is-selected');
                }
                if (activeMenuIndex === i && selectedNotes.size === 1) {
                    cell.style.zIndex = '50';
                }
                const isMenuOpenForCell = !contextMenu.classList.contains('hidden') &&
                    !contextMenu.dataset.dockMenu && contextMenu.dataset.noteIndex === String(i);
                if (isMenuOpenForCell) {
                    cell.classList.add('has-menu');
                    cell.style.zIndex = '55';
                }

                cell.classList.add('no-select');

                cell.addEventListener('click', (e) => {
                    if (Date.now() <= suppressedMarqueeClickUntil) return;
                    if (editMouseDownInside) return;
                    if (editingIndex === i) {
                        e.stopPropagation();
                        commitCurrentEdit();
                        selectedNotes.clear();
                        activeMenuIndex = null;
                        document.body.classList.remove('has-window-selection');
                        renderTitle();
                        renderGrid();
                        return;
                    }
                    e.stopPropagation();
                    const isOnlySelected = selectedNotes.size === 1 && selectedNotes.has(i);
                    closeContextMenu();
                    commitCurrentEdit();

                    if (isOnlySelected) {
                        selectedNotes.clear();
                        activeMenuIndex = null;
                    } else {
                        selectedNotes.clear();
                        selectedNotes.add(i);
                        activeMenuIndex = i;
                    }
                    document.body.classList.remove('has-window-selection');
                    renderTitle();
                    renderGrid();
                });

                const isEditing = editingIndex === i;
                const isSelected = selectedNotes.has(i) || isEditing || draggedIndex === i;
                const dragWrapper = document.createElement('div');
                dragWrapper.className = 'stone-wrapper transition-opacity';

                const circle = document.createElement('div');
                const currentFontSize = fontSizes[Math.min(fontSizes.length - 1, Math.max(0, note.fontIndex ?? 3))];
                const strikeClass = getStrikeClass(note);
                circle.className = `w-full h-full ${note.color} rounded-full flex items-center justify-center text-center px-0 stone-effect ${isSelected ? 'stone-effect-active' : ''} overflow-visible break-words font-semibold note-engraved-text ${currentFontSize} ${strikeClass} ${isEditing ? 'cursor-text' : 'cursor-grab'} relative`;
                circle.setAttribute('dir', 'auto');

                const underlineDock = document.createElement('div');
                underlineDock.className = 'cell-underline-dock';
                underlineDock.setAttribute('role', 'button');
                underlineDock.setAttribute('tabindex', '0');
                underlineDock.setAttribute('aria-label', 'Set status');
                underlineDock.innerHTML = getUnderlineHtml(note);
    if (!isEditing) {
        underlineDock.draggable = true;
        underlineDock.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            draggedStatusIndex = i;
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', '');
        });
        underlineDock.addEventListener('dragover', (e) => {
            if (draggedStatusIndex === null) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move';
        });
        underlineDock.addEventListener('drop', (e) => {
            if (draggedStatusIndex === null) return;
            e.preventDefault();
            e.stopPropagation();
            const from = draggedStatusIndex;
            draggedStatusIndex = null;
            if (e.ctrlKey || e.metaKey) copyNoteStatus(from, i);
            else swapNoteStatuses(from, i);
        });
        underlineDock.addEventListener('dragend', () => { draggedStatusIndex = null; });
    }
    underlineDock.addEventListener('click', (e) => toggleDockMenu(e, 'status', i));
    underlineDock.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDockMenu(e, 'status', i);
        }
    });

                if (isEditing) {
                    dragWrapper.draggable = false;
                    const inputContainer = document.createElement('div');
                    inputContainer.contentEditable = true; inputContainer.id = 'note-edit-input';
                    inputContainer.className = `outline-none w-full break-words whitespace-pre-wrap text-center cursor-text relative z-30 ${strikeClass}`;
                    inputContainer.setAttribute('dir', 'auto'); inputContainer.innerText = note.text;
                    inputContainer.addEventListener('input', () => { note.text = inputContainer.innerText; });

                    setTimeout(() => {
                        if (!inputContainer.isConnected || editingIndex !== i) return;
                        inputContainer.focus(); const range = document.createRange(); const sel = window.getSelection();
                        range.selectNodeContents(inputContainer); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
                    }, 10);
                    inputContainer.addEventListener('click', e => { e.stopPropagation(); closeContextMenu(); });

                    let lastKey = null;
                    inputContainer.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            if (lastKey === 'Enter') {
                                e.preventDefault();
                                commitCurrentEdit();
                                selectedNotes.clear();
                                activeMenuIndex = null;
                                renderGrid();
                            }
                            lastKey = 'Enter';
                        } else lastKey = e.key;
                    });

                    circle.appendChild(inputContainer);
                    dragWrapper.appendChild(circle);
                    cell.appendChild(dragWrapper);
                    cell.appendChild(underlineDock);

                    // Bottom-Left: Color
                    dragWrapper.appendChild(createMenuButton('-bottom-2 -left-2 w-7 h-7', iconPalette, (e) => {
                        activeMenuIndex = i;
                        cell.classList.add('has-menu');
                        note.text = inputContainer.innerText;
                        toggleColorContextMenu(e.pageX, e.pageY, i, e.currentTarget);
                    }, 'Change color'));

                    // Bottom-Right: Font Size
                    dragWrapper.appendChild(createMenuButton('-bottom-2 -right-2 w-7 h-7', iconFont, (e) => {
                        activeMenuIndex = i;
                        cell.classList.add('has-menu');
                        note.text = inputContainer.innerText;
                        toggleFontContextMenu(e.pageX, e.pageY, i, e.currentTarget);
                    }, 'Change font size'));

                    // Top-Left: Delete
                    dragWrapper.appendChild(createMenuButton('-top-2 -left-2 w-7 h-7', iconTrash, () => {
                        if (confirmDeleteNotes([i])) closeContextMenu();
                    }, 'Delete note', true));

                    // Top-Right: Finish editing
                    dragWrapper.appendChild(createMenuButton('-top-2 -right-2 w-7 h-7', iconCheck, () => {
                        commitCurrentEdit();
                        selectedNotes.clear();
                        activeMenuIndex = null;
                        document.body.classList.remove('has-window-selection');
                        renderTitle();
                        renderGrid();
                    }, 'Finish editing', true));
                } else {
                    circle.innerText = note.text;
                    attachStoneDragHandlers(dragWrapper, circle, i, r, c);
                    dragWrapper.appendChild(circle);
                    cell.appendChild(dragWrapper);
                    cell.appendChild(underlineDock);

                    if (!titleState.isEditing) {
                        // Never render individual cell action buttons if a group selection is active
                        if (selectedNotes.size <= 1) {
                            const isExplicitActive = (activeMenuIndex === i && selectedNotes.size === 1 && selectedNotes.has(i));
                            const btnExtraClass = isExplicitActive ? 'stone-menu-btn-visible' : '';

                            // Bottom-Left: Color
                            dragWrapper.appendChild(createMenuButton(`-bottom-2 -left-2 w-7 h-7 stone-action-btn ${btnExtraClass}`, iconPalette, (e) => {
                                activeMenuIndex = i;
                                document.querySelectorAll('.grid-cell.has-menu').forEach(c => c.classList.remove('has-menu'));
                                cell.classList.add('has-menu');
                                toggleColorContextMenu(e.pageX, e.pageY, i, e.currentTarget);
                            }, 'Change color'));

                            // Bottom-Right: Font Size
                            dragWrapper.appendChild(createMenuButton(`-bottom-2 -right-2 w-7 h-7 stone-action-btn ${btnExtraClass}`, iconFont, (e) => {
                                activeMenuIndex = i;
                                document.querySelectorAll('.grid-cell.has-menu').forEach(c => c.classList.remove('has-menu'));
                                cell.classList.add('has-menu');
                                toggleFontContextMenu(e.pageX, e.pageY, i, e.currentTarget);
                            }, 'Change font size'));

                            if (selectedNotes.has(i)) {
                                // Top-Left: Delete
                                dragWrapper.appendChild(createMenuButton(`-top-2 -left-2 w-7 h-7 stone-action-btn ${btnExtraClass}`, iconTrash, () => {
                                    if (confirmDeleteNotes([i])) closeContextMenu();
                                }, 'Delete note', true));

                                // Top-Right: Edit selected note
                                dragWrapper.appendChild(createMenuButton(`-top-2 -right-2 w-7 h-7 stone-action-btn ${btnExtraClass}`, iconEdit, () => {
                                    closeContextMenu();
                                    editingIndex = i;
                                    renderTitle();
                                    renderGrid();
                                }, 'Edit note', true));
                            }
                        }
                    }
                }
                const timerDock = document.createElement('button');
                timerDock.type = 'button';
                timerDock.className = 'cell-timer-dock';
                timerDock.appendChild(document.createElement('span'));
                timerDock.dataset.noteIndex = String(i);
                timerDock.title = 'Set day of week';
                timerDock.addEventListener('click', (e) => {
                    toggleDockMenu(e, 'weekday', i);
                });
                cell.appendChild(timerDock);
            }

            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedShape && draggedIndex === null) return;

                // Copy functionality (Ctrl or Meta key)
                const isCopy = e.ctrlKey || e.metaKey;
                e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';

                // Cache cell rect while cursor is in this cell to avoid layout reflows
                if (activeDragHoverCellIndex !== i || !activeDragHoverCellRect) {
                    activeDragHoverCellRect = cell.getBoundingClientRect();
                }
                const rect = activeDragHoverCellRect;
                const nx = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
                const ny = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;

                let dir = 'swap';
                let dropRow = r;
                let dropCol = c;
                let groupMoveTargetIndices = null;

                if (draggedShape) {
                    if (!draggedShape.indices.includes(i)) {
                        const edgeDistances = [
                            { dir: 'left', distance: nx },
                            { dir: 'right', distance: 1 - nx },
                            { dir: 'top', distance: ny },
                            { dir: 'bottom', distance: 1 - ny }
                        ].sort((a, b) => a.distance - b.distance);
                        if (edgeDistances[0].distance < 0.3) dir = edgeDistances[0].dir;
                        if (dir !== 'swap' &&
                            !canInsertSelection(draggedShape, draggedShape.origin, r, c, dir, isCopy)) dir = 'swap';
                        if (dir === 'swap') {
                            groupMoveTargetIndices = getWindowMoveTargetIndices(
                                draggedShape, draggedShape.origin, r, c
                            );
                        }
                    }
                } else if (notes[i] === null) {
                    dir = 'swap';
                }
                else if (draggedIndex !== null) {
                    if (draggedIndex === i) {
                        if (activeDragHoverCellIndex !== null) clearActiveDropIndicator();
                        return;
                    }

                    if (nx > 0.25 && nx < 0.75 && ny > 0.25 && ny < 0.75) {
                        dir = 'swap';
                    } else {
                        const distL = nx; const distR = 1 - nx;
                        const distT = ny; const distB = 1 - ny;
                        const min = Math.min(distL, distR, distT, distB);

                        if (min === distL) dir = 'right';
                        else if (min === distR) dir = 'left';
                        else if (min === distT) dir = 'bottom';
                        else dir = 'top';
                    }

                    // Check empty spots, considering if we are copying
                    let emptyFound = false;
                    if (dir === 'bottom') {
                        for (let y = r; y < totalRows; y++) if (notes[y * totalCols + c] === null || (!isCopy && y * totalCols + c === draggedIndex)) { emptyFound = true; break; }
                    } else if (dir === 'top') {
                        for (let y = r; y >= 0; y--) if (notes[y * totalCols + c] === null || (!isCopy && y * totalCols + c === draggedIndex)) { emptyFound = true; break; }
                    } else if (dir === 'right') {
                        for (let x = c; x < totalCols; x++) if (notes[r * totalCols + x] === null || (!isCopy && r * totalCols + x === draggedIndex)) { emptyFound = true; break; }
                    } else if (dir === 'left') {
                        for (let x = c; x >= 0; x--) if (notes[r * totalCols + x] === null || (!isCopy && r * totalCols + x === draggedIndex)) { emptyFound = true; break; }
                    }

                    if (!emptyFound) dir = 'swap';
                }

                currentDropDir = dir;
                currentDropAnchor = dir !== 'swap' && (dropRow !== r || dropCol !== c)
                    ? { row: dropRow, col: dropCol }
                    : { row: r, col: c };

                const shapeKey = groupMoveTargetIndices ? groupMoveTargetIndices.join(',') : (draggedShape ? `${dropRow},${dropCol},${dir}` : '');

                // If hovering over the same cell with unchanged target/direction, skip DOM mutations completely
                if (activeDragHoverCellIndex === i && activeDragHoverDir === dir && activeDragHoverIsCopy === isCopy && activeDragHoverShapeKey === shapeKey) {
                    return;
                }

                // State changed: clean up previous active indicator only
                if (activeDragHoverCellIndex !== null && activeDragHoverCellIndex !== i) {
                    const prevCell = document.getElementById(`grid-cell-${activeDragHoverCellIndex}`);
                    const prevInd = prevCell?.querySelector('.drop-indicator');
                    if (prevInd) {
                        prevInd.className = 'drop-indicator absolute inset-0 pointer-events-none z-30 opacity-0 box-border';
                        prevInd.removeAttribute('style');
                    }
                }
                document.getElementById('group-insert-indicator')?.remove();
                document.getElementById('group-move-indicator')?.remove();

                activeDragHoverCellIndex = i;
                activeDragHoverDir = dir;
                activeDragHoverIsCopy = isCopy;
                activeDragHoverShapeKey = shapeKey;

                const ind = cell.querySelector('.drop-indicator');
                if (ind) {
                    if (draggedShape) {
                        ind.className = 'drop-indicator absolute inset-0 pointer-events-none z-30 opacity-0 box-border';
                    } else {
                        ind.className = 'drop-indicator drop-indicator-active absolute inset-0 pointer-events-none z-30 box-border';
                        const theme = getThemeClasses().border || 'border-blue-500';
                        if (dir === 'swap') ind.classList.add('border-[3.5px]', theme, 'rounded-xl');
                        else if (dir === 'right') ind.classList.add('border-y-[3.5px]', 'border-l-[3.5px]', 'border-r-0', theme, 'rounded-l-xl');
                        else if (dir === 'left') ind.classList.add('border-y-[3.5px]', 'border-r-[3.5px]', 'border-l-0', theme, 'rounded-r-xl');
                        else if (dir === 'bottom') ind.classList.add('border-x-[3.5px]', 'border-t-[3.5px]', 'border-b-0', theme, 'rounded-t-xl');
                        else if (dir === 'top') ind.classList.add('border-x-[3.5px]', 'border-b-[3.5px]', 'border-t-0', theme, 'rounded-b-xl');
                    }
                }
                if (draggedShape) {
                    const borderColor = getComputedStyle(titleContainer.firstElementChild).color || '#3b82f6';
                    if (dir !== 'swap') {
                        showLocalInsertIndicator(draggedShape, draggedShape.origin, dropRow, dropCol, dir, borderColor);
                    } else if (groupMoveTargetIndices) {
                        showGroupMoveIndicator(groupMoveTargetIndices, borderColor);
                    }
                }
            });

            cell.addEventListener('dragleave', (e) => {
                if (!cell.contains(e.relatedTarget)) {
                    if (activeDragHoverCellIndex === i) {
                        clearActiveDropIndicator();
                    }
                }
            });

            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                const isCopy = e.ctrlKey || e.metaKey;
                const dropRow = currentDropAnchor ? currentDropAnchor.row : r;
                const dropCol = currentDropAnchor ? currentDropAnchor.col : c;
                let stateChanged = false;



                if (draggedShape && currentDropDir && currentDropDir !== 'swap') {
                    const didDrop = canInsertSelection(draggedShape, draggedShape.origin, dropRow, dropCol, currentDropDir, isCopy) &&
                        insertSelectionIntoBoard(draggedShape, draggedShape.origin, dropRow, dropCol, currentDropDir, isCopy);
                    if (didDrop) {
                        selectedNotes.clear();
                        activeMenuIndex = null;
                        stateChanged = true;
                    }
                } else if (draggedShape) {
                    const targetIndices = getWindowMoveTargetIndices(
                        draggedShape, draggedShape.origin, r, c
                    );
                    if (targetIndices) {
                        const shapeNotes = {};
                        draggedShape.indices.forEach(idx => {
                            shapeNotes[idx] = JSON.parse(JSON.stringify(notes[idx]));
                            if (!isCopy) notes[idx] = null;
                        });
                        draggedShape.indices.forEach((idx, offset) => {
                            const targetIdx = targetIndices[offset];
                            notes[targetIdx] = shapeNotes[idx];
                        });
                        selectedNotes.clear();
                        activeMenuIndex = null;
                        stateChanged = true;
                    }
                } else if (draggedIndex !== null && currentDropDir) {
                    if (draggedIndex !== i || currentDropDir !== 'swap') {
                        let item = JSON.parse(JSON.stringify(notes[draggedIndex]));
                        if (!isCopy) notes[draggedIndex] = null;

                        if (currentDropDir === 'swap') {
                            if (isCopy) {
                                notes[i] = item;
                            } else {
                                notes[draggedIndex] = notes[i];
                                notes[i] = item;
                            }
                        } else if (currentDropDir === 'right') {
                            let emptyC = -1;
                            for (let x = c; x < totalCols; x++) if (notes[r * totalCols + x] === null) { emptyC = x; break; }
                            if (emptyC !== -1) {
                                for (let x = emptyC; x > c; x--) notes[r * totalCols + x] = notes[r * totalCols + x - 1];
                                notes[i] = item;
                            } else {
                                if (isCopy) notes[i] = item;
                                else { notes[draggedIndex] = notes[i]; notes[i] = item; }
                            }
                        } else if (currentDropDir === 'left') {
                            let emptyC = -1;
                            for (let x = c; x >= 0; x--) if (notes[r * totalCols + x] === null) { emptyC = x; break; }
                            if (emptyC !== -1) {
                                for (let x = emptyC; x < c; x++) notes[r * totalCols + x] = notes[r * totalCols + x + 1];
                                notes[i] = item;
                            } else {
                                if (isCopy) notes[i] = item;
                                else { notes[draggedIndex] = notes[i]; notes[i] = item; }
                            }
                        } else if (currentDropDir === 'bottom') {
                            let emptyR = -1;
                            for (let y = r; y < totalRows; y++) if (notes[y * totalCols + c] === null) { emptyR = y; break; }
                            if (emptyR !== -1) {
                                for (let y = emptyR; y > r; y--) notes[y * totalCols + c] = notes[(y - 1) * totalCols + c];
                                notes[i] = item;
                            } else {
                                if (isCopy) notes[i] = item;
                                else { notes[draggedIndex] = notes[i]; notes[i] = item; }
                            }
                        } else if (currentDropDir === 'top') {
                            let emptyR = -1;
                            for (let y = r; y >= 0; y--) if (notes[y * totalCols + c] === null) { emptyR = y; break; }
                            if (emptyR !== -1) {
                                for (let y = emptyR; y < r; y++) notes[y * totalCols + c] = notes[(y + 1) * totalCols + c];
                                notes[i] = item;
                            } else {
                                if (isCopy) notes[i] = item;
                                else { notes[draggedIndex] = notes[i]; notes[i] = item; }
                            }
                        }

                        selectedNotes.clear();
                        activeMenuIndex = null;
                        stateChanged = true;
                    }
                }

                endDragSession();
                if (stateChanged) {
                    saveData();
                    renderGrid();
                }
            });

            gridElement.appendChild(cell);
            if (note) updateWeekdayDisplay(i);
        }
    }

    updateMultiSelectionBox();
}


function getFileTimestamp() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return { date: `${y}${m}${d}`, time: `${hh}${mm}${ss}` };
}

document.getElementById('btn-save').addEventListener('click', (e) => {
    e.stopPropagation(); closeContextMenu(); commitOutsideEditAndRender();
    const data = getSaveObject();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const ts = getFileTimestamp();
    const cleanTitle = (titleState.text || "").trim().replace(/[^a-zA-Z0-9]/g, '');
    const isCustomTitle = cleanTitle !== '' && cleanTitle.toLowerCase() !== 'tinynotes';
    const baseName = isCustomTitle ? cleanTitle : 'TinyNotes';
    downloadAnchorNode.setAttribute("download", `${ts.date}${baseName}${ts.time}.json`);
    document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
});

document.getElementById('btn-load').addEventListener('click', (e) => {
    e.stopPropagation(); closeContextMenu(); commitOutsideEditAndRender(); fileInput.click();
});

document.getElementById('btn-sync').addEventListener('click', async (e) => {
    e.stopPropagation(); closeContextMenu(); commitOutsideEditAndRender();
    if (syncFileHandle) { stopFileSync(); return; }
    if (!window.showSaveFilePicker && !window.showOpenFilePicker) {
        alert('File syncing needs a browser that can write files directly (for example Chrome or Edge).');
        return;
    }
    if (isHeaderMenuOpen('sync')) return;
    showSyncMenu(e.currentTarget);
});
function confirmDeleteNotes(indices) {
    const targets = indices.filter(index => notes[index]);
    if (!targets.length) return false;
    const first = (notes[targets[0]].text || '').trim();
    const preview = first.length > 120 ? `${first.slice(0, 120)}…` : first;
    const message = targets.length === 1
        ? `Delete this note?\n\n${preview || '(empty note)'}`
        : `Delete ${targets.length} notes?`;
    if (!window.confirm(message)) return false;
    targets.forEach(index => { notes[index] = null; });
    selectedNotes.clear();
    activeMenuIndex = null;
    editingIndex = null;
    saveData();
    renderGrid();
    return true;
}

const trashButton = document.getElementById('btn-trash');
trashButton.addEventListener('click', (e) => {
    e.stopPropagation(); closeContextMenu();
    if (editingIndex !== null) { commitOutsideEditAndRender(); }
    const targets = selectedNotes.size ? Array.from(selectedNotes) : (activeMenuIndex !== null ? [activeMenuIndex] : []);
    confirmDeleteNotes(targets);
});
trashButton.addEventListener('dragover', (e) => {
    if (draggedShape || draggedIndex !== null) {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        trashButton.classList.add('trash-drop-target');
    }
});
trashButton.addEventListener('dragleave', () => trashButton.classList.remove('trash-drop-target'));
document.addEventListener('dragend', () => trashButton.classList.remove('trash-drop-target'));
trashButton.addEventListener('drop', (e) => {
    e.preventDefault();
    trashButton.classList.remove('trash-drop-target');
    const dragged = draggedShape ? draggedShape.indices.slice() : (draggedIndex !== null ? [draggedIndex] : []);
    endDragSession();
    setTimeout(() => confirmDeleteNotes(dragged), 0);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const data = normalizeImportedData(JSON.parse(event.target.result));
            applyLoadedData(data);
            editingIndex = null;
            activeMenuIndex = null;
            selectedNotes.clear();
            saveData(); resizeGrid(); renderTitle(); renderGrid();
        } catch (err) { alert("Unsupported or invalid save file."); }
    };
    reader.readAsText(file); e.target.value = '';
});

document.getElementById('btn-grid').addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = isHeaderMenuOpen('grid');
    commitOutsideEditAndRender();
    if (wasOpen) {
        closeContextMenu();
    } else if (closeContextMenu()) {
        showGridContextMenu(e.pageX, e.pageY, e.currentTarget);
    }
});

document.getElementById('btn-colors').addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = isHeaderMenuOpen('colors');
    commitOutsideEditAndRender();
    if (wasOpen) {
        closeContextMenu();
    } else if (closeContextMenu()) {
        showAppearanceMenu(e.pageX, e.pageY, e.currentTarget);
    }
});

document.getElementById('btn-note-style').addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = isHeaderMenuOpen('style');
    commitOutsideEditAndRender();
    if (wasOpen) {
        closeContextMenu();
    } else if (closeContextMenu()) {
        showNoteStyleMenu(e.pageX, e.pageY, e.currentTarget);
    }
});

contextMenu.addEventListener('click', (e) => e.stopPropagation());
contextMenu.addEventListener('mouseenter', () => {
    cancelMenuClose();
});
contextMenu.addEventListener('mouseleave', () => {
    scheduleMenuClose(120);
});

const aboutModal = document.getElementById('about-modal');
document.getElementById('about-app-icon').src = document.querySelector('link[rel="icon"]').href;
document.getElementById('btn-info').addEventListener('click', (e) => {
    e.stopPropagation(); closeContextMenu(); commitOutsideEditAndRender(); aboutModal.classList.remove('hidden');
});
// Keyboard activation for header action buttons
['btn-grid', 'btn-colors', 'btn-note-style'].forEach((id) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            control.click();
        }
    });
});
document.getElementById('close-about').addEventListener('click', (e) => {
    e.stopPropagation(); aboutModal.classList.add('hidden');
});
aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.classList.add('hidden');
    else e.stopPropagation();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        aboutModal.classList.add('hidden');
        closeContextMenu();
    }
});

document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    if (e.target.closest('#context-menu') || contextMenu.contains(e.target)) return;
    if (editMouseDownInside) return;
    if (!closeContextMenu()) return;
    const wasEditingNote = editingIndex !== null;
    let needsRender = commitOutsideEdit();
    if (!wasEditingNote && activeMenuIndex !== null) { activeMenuIndex = null; needsRender = true; }
    if (!wasEditingNote && selectedNotes.size > 0) { selectedNotes.clear(); needsRender = true; }
    if (titleState.isMenuOpen) { titleState.isMenuOpen = false; needsRender = true; }
    if (needsRender) { renderTitle(); renderGrid(); }
});

setupWindowSelection();
document.addEventListener('dragover', (e) => {
    if (draggedShape || draggedIndex !== null) {
        e.preventDefault();
        e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move';
    }
});
document.addEventListener('dragend', endDragSession);
loadData();
restoreSyncOnStartup();
renderTitle();
resizeGrid();
renderGrid();
let lastWeekdayDate = new Date().toDateString();
let weekdayRefreshTimer;
function refreshWeekdays() {
    const now = new Date();
    if (now.toDateString() !== lastWeekdayDate) {
        lastWeekdayDate = now.toDateString();
        notes.forEach((note, index) => {
            if (note) updateWeekdayDisplay(index);
        });
        if (contextMenu.dataset.menuType === 'weekday' && activeMenuPosState) {
            const { x, y, anchorElement } = activeMenuPosState;
            showWeekdayContextMenu(x, y, Number(contextMenu.dataset.noteIndex), anchorElement);
        }
    }
    clearTimeout(weekdayRefreshTimer);
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    weekdayRefreshTimer = setTimeout(refreshWeekdays, midnight - now + 50);
}
document.addEventListener('visibilitychange', refreshWeekdays);
window.addEventListener('focus', refreshWeekdays);
setInterval(refreshWeekdays, 60000);
refreshWeekdays();
// Prevent flicker by showing the workspace only after the first render
setTimeout(() => {
    workspace.style.opacity = '1';
}, 50);
