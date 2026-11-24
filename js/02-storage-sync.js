/* ==========================================================================
   02-storage-sync.js
   - JSON import normalization & data migration (applyLoadedData)
   - localStorage load/save & background color application
   - Two-way file sync (File System Access API + IndexedDB handle storage)
   ========================================================================== */

function normalizeImportedData(rawData) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData) || !Array.isArray(rawData.notes)) {
        throw new Error('Unsupported save format');
    }

    let parsedCols = null;
    let parsedRows = null;

    if (Number.isInteger(rawData.cols) && Number.isInteger(rawData.rows) && rawData.cols >= 1 && rawData.rows >= 1) {
        parsedCols = rawData.cols;
        parsedRows = rawData.rows;
    } else if (Number.isInteger(rawData.totalCols) && Number.isInteger(rawData.totalRows) && rawData.totalCols >= 1 && rawData.totalRows >= 1) {
        parsedCols = rawData.totalCols;
        parsedRows = rawData.totalRows;
    } else if (Number.isInteger(rawData.coreCols) && Number.isInteger(rawData.coreRows) && rawData.coreCols >= 1 && rawData.coreRows >= 1) {
        const mL = Number.isInteger(rawData.mL) ? rawData.mL : 0;
        const mR = Number.isInteger(rawData.mR) ? rawData.mR : 0;
        const mT = Number.isInteger(rawData.mT) ? rawData.mT : 0;
        const mB = Number.isInteger(rawData.mB) ? rawData.mB : 0;
        parsedCols = mL + rawData.coreCols + mR;
        parsedRows = mT + rawData.coreRows + mB;
    } else {
        throw new Error('Unsupported save format');
    }

    if (rawData.notes.length !== parsedCols * parsedRows) throw new Error('Unsupported save format');

    return {
        totalCols: parsedCols,
        totalRows: parsedRows,
        columnGap: Number.isFinite(rawData.columnGap) ? Math.round(Math.max(0, Math.min(100, rawData.columnGap))) : 0,
        rowGap: Number.isFinite(rawData.rowGap) ? Math.round(Math.max(0, Math.min(100, rawData.rowGap))) : 0,
        notes: rawData.notes,
        titleState: rawData.titleState || null,
        titleColorVersion: rawData.titleColorVersion || null,
        pageColorIndex: Number.isInteger(rawData.pageColorIndex) ? rawData.pageColorIndex : null,
        workspaceColorIndex: Number.isInteger(rawData.appColorIndex) ? rawData.appColorIndex : null,
        cellStyle: rawData.cellStyle || null
    };
}

function applyLoadedData(data) {
    totalCols = data.totalCols; totalRows = data.totalRows;
    columnGap = data.columnGap;
    rowGap = data.rowGap;
    notes = data.notes;
    notes.forEach(n => {
        if (n) {
            if (n.color === 'note-white') n.color = 'note-none';
            delete n.statusTimer;
            if (n.opacity !== undefined) delete n.opacity;
            if (n.blinking && !n.status) n.status = n.blinking;
            if (n.status === 'completed' || n.status === 'done' || n.status === 'linethrough') {
                n.status = 'completed';
                delete n.strike;
            }
            n.statuses = getNoteStatuses(n);
            if (n.statuses.length > 0) {
                n.status = n.statuses[0];
            } else {
                delete n.status;
            }
            delete n.blinking;
            delete n.strike;
        }
    });
    if (data.titleState) {
        let loadedTitle = { ...data.titleState };
        if (loadedTitle.text === 'Note Stones') loadedTitle.text = 'Tiny Notes';
        if (!data.titleColorVersion && Number.isInteger(loadedTitle.colorIndex) && loadedTitle.colorIndex >= 0 && loadedTitle.colorIndex < 12) {
            const titlePaletteMap = [11, 10, 4, 5, 6, 8, 7, 9, 3, 2, 1, 0];
            loadedTitle.colorIndex = titlePaletteMap[loadedTitle.colorIndex];
        }
        titleState = { ...titleState, ...loadedTitle, isMenuOpen: false, isEditing: false };
    }
    if (data.pageColorIndex !== null && data.pageColorIndex >= 0 && data.pageColorIndex < pageColors.length) pageColorIndex = data.pageColorIndex;
    if (data.workspaceColorIndex !== null && data.workspaceColorIndex >= 0 && data.workspaceColorIndex < workspaceColors.length) workspaceColorIndex = data.workspaceColorIndex;
    if (data.cellStyle === 'game' || data.cellStyle === 'natural' || data.cellStyle === 'traffic') cellStyle = data.cellStyle;
    applyBackgroundColors();
    applyStyleSettings();
}

function loadData() {
    try {
        const currentData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (currentData) {
            try {
                applyLoadedData(normalizeImportedData(JSON.parse(currentData)));
                return;
            } catch (e) {
                console.warn('Could not load current saved data', e);
            }
        }
    } catch (e) {
        console.warn('Could not access saved data', e);
    }

    totalCols = 4; totalRows = 4;
    notes = Array(totalCols * totalRows).fill(null);
    applyBackgroundColors();
    applyStyleSettings();
}

function applyBackgroundColors() {
    document.body.style.setProperty('--page-background', pageColors[pageColorIndex] || pageColors[0]);
    workspace.style.setProperty('--workspace-background', workspaceColors[workspaceColorIndex] || workspaceColors[0]);
}

function getSaveObject() {
    return {
        cols: totalCols,
        rows: totalRows,
        totalCols,
        totalRows,
        columnGap,
        rowGap,
        notes,
        titleState,
        titleColorVersion: 2,
        pageColorIndex,
        appColorIndex: workspaceColorIndex,
        cellStyle
    };
}

const LOCAL_MODIFIED_KEY = 'tinyNotesLocalModified';
const formatSyncTime = (ms) => ms ? new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown';
const getLocalModified = () => Number(localStorage.getItem(LOCAL_MODIFIED_KEY)) || 0;
const hasLocalNotes = () => notes.some(Boolean);

let syncFileHandle = null;
let syncWriteTimer = null;
let syncChain = Promise.resolve();
let syncKnownModified = 0;
let syncDirty = false;
let syncPollTimer = null;
let syncPaused = false;
let syncUnsaved = false;

// yellow = paused after reload, red = edited while paused, blue = writing, green = in sync
function updateSyncIndicator() {
    const btn = document.getElementById('btn-sync');
    if (!btn) return;
    const state = syncFileHandle ? (syncDirty ? 'working' : 'ok') : (syncPaused ? (syncUnsaved ? 'unsaved' : 'paused') : '');
    ['paused', 'unsaved', 'working', 'ok'].forEach(s => btn.classList.toggle('sync-' + s, s === state));
}

function runSyncTask(task) {
    syncChain = syncChain.then(task).catch((err) => {
        if (syncFileHandle) {
            setSyncHandle(null);
            alert('Syncing stopped: the file could not be accessed.');
        }
    });
    return syncChain;
}

function scheduleSyncWrite() {
    if (!syncFileHandle) return;
    syncDirty = true;
    updateSyncIndicator();
    clearTimeout(syncWriteTimer);
    syncWriteTimer = setTimeout(() => runSyncTask(syncWithFile), 400);
}

async function writeSyncFile(handle) {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(getSaveObject()));
    await writable.close();
    syncKnownModified = (await handle.getFile()).lastModified;
    syncDirty = false;
    updateSyncIndicator();
}

function applySyncedText(text) {
    const data = normalizeImportedData(JSON.parse(text));
    const wasSyncing = syncFileHandle;
    syncFileHandle = null;
    applyLoadedData(data);
    editingIndex = null;
    activeMenuIndex = null;
    selectedNotes.clear();
    saveData(); resizeGrid(); renderTitle(); renderGrid();
    syncFileHandle = wasSyncing;
    syncDirty = false;
    updateSyncIndicator();
}

// Two-way step: pull the file if it changed elsewhere, push local changes otherwise
async function syncWithFile() {
    const handle = syncFileHandle;
    if (!handle || editingIndex !== null || titleState.isEditing) return;
    const file = await handle.getFile();
    if (file.lastModified > syncKnownModified) {
        let text = '';
        let valid = false;
        try { text = await file.text(); JSON.parse(text); valid = true; } catch (e) { }
        if (valid) {
            const useFile = !syncDirty || window.confirm(`The sync file was changed elsewhere and you also have unsynced changes here.\n\nFile changed: ${formatSyncTime(file.lastModified)}\nYour changes: ${formatSyncTime(getLocalModified())}\n\nOK = use the file version (discard my changes)\nCancel = keep my version (overwrite the file)`);
            if (useFile) {
                syncKnownModified = file.lastModified;
                applySyncedText(text);
                return;
            }
        }
        await writeSyncFile(handle);
    } else if (syncDirty) {
        await writeSyncFile(handle);
    }
}

function setSyncHandle(handle) {
    syncFileHandle = handle;
    clearInterval(syncPollTimer);
    syncPollTimer = null;
    syncDirty = false;
    syncPaused = false;
    syncUnsaved = false;
    const btn = document.getElementById('btn-sync');
    btn.title = handle ? `Syncing with ${handle.name} (click to stop)` : 'Sync with a file';
    if (handle) syncPollTimer = setInterval(() => runSyncTask(syncWithFile), 4000);
    updateSyncIndicator();
}

const SYNC_PICKER_TYPES = [{ description: 'Tiny Notes file', accept: { 'application/json': ['.json'] } }];
let rememberedSyncHandle = null;

function openSyncDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('tinyNotesSync', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('handles');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storeSyncHandle(handle) {
    try {
        const db = await openSyncDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readwrite');
            if (handle) tx.objectStore('handles').put(handle, 'file');
            else tx.objectStore('handles').delete('file');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (e) { }
}

async function loadStoredSyncHandle() {
    try {
        const db = await openSyncDb();
        const handle = await new Promise((resolve, reject) => {
            const request = db.transaction('handles').objectStore('handles').get('file');
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return handle;
    } catch (e) { return null; }
}

function stopFileSync() {
    setSyncHandle(null);
    rememberedSyncHandle = null;
    storeSyncHandle(null);
}

// Loads the file first; local data is only written over it when the user chooses so
async function beginSyncWithHandle(handle, isNewFile = false) {
    const file = await handle.getFile();
    let text = '';
    let valid = false;
    if (file.size > 0) {
        try { text = await file.text(); JSON.parse(text); valid = true; } catch (e) { }
        if (!valid && !window.confirm('This file is not a Tiny Notes file. Overwrite it with the current board?')) return;
    }
    let loadFile = valid && !isNewFile;
    if (loadFile && hasLocalNotes() && getLocalModified() > file.lastModified
        && JSON.stringify(JSON.parse(text)) !== JSON.stringify(getSaveObject())) {
        loadFile = window.confirm(`This board has changes that are not in the file.\n\nFile changed: ${formatSyncTime(file.lastModified)}\nYour changes: ${formatSyncTime(getLocalModified())}\n\nOK = load the file (discard my changes)\nCancel = keep my board and overwrite the file`);
    }
    rememberedSyncHandle = handle;
    storeSyncHandle(handle);
    setSyncHandle(handle);
    await runSyncTask(async () => {
        if (loadFile) {
            syncKnownModified = file.lastModified;
            applySyncedText(text);
        } else {
            await writeSyncFile(handle);
        }
    });
}

async function chooseSyncFile(mode) {
    try {
        if (mode === 'new') {
            const handle = await window.showSaveFilePicker({ suggestedName: 'TinyNotes.json', types: SYNC_PICKER_TYPES });
            await beginSyncWithHandle(handle, true);
        } else {
            // The save picker empties an existing file, so existing files use the open picker
            const [handle] = await window.showOpenFilePicker({ types: SYNC_PICKER_TYPES });
            if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') return;
            await beginSyncWithHandle(handle);
        }
    } catch (err) { /* picker cancelled */ }
}

async function resumeRememberedSync() {
    try {
        const handle = rememberedSyncHandle;
        if (!handle || await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') return;
        await beginSyncWithHandle(handle);
    } catch (err) { stopFileSync(); }
}

function showSyncMenu(anchorElement) {
    activeHeaderMenu = 'sync';
    contextMenu.dataset.menuType = 'sync';
    contextMenu.classList.remove('menu-opacity-90', 'menu-cell');
    contextMenu.classList.add('menu-thumbtack');
    contextMenu.style.opacity = '1';
    contextMenu.style.backgroundColor = '#ffffff';
    const items = [];
    if (rememberedSyncHandle) items.push({ label: `Resume with ${rememberedSyncHandle.name}`, action: resumeRememberedSync });
    if (window.showOpenFilePicker) items.push({ label: 'Choose existing file…', action: () => chooseSyncFile('existing') });
    if (window.showSaveFilePicker) items.push({ label: 'Create new file…', action: () => chooseSyncFile('new') });
    contextMenu.innerHTML = `<div class="menu-option-container select-none"></div>`;
    const container = contextMenu.firstChild;
    items.forEach(({ label, action }) => {
        const item = document.createElement('div');
        item.className = 'menu-option-item text-gray-800';
        item.textContent = label;
        item.addEventListener('click', () => { closeContextMenu(); action(); });
        container.appendChild(item);
    });
    positionMenu(0, 0, anchorElement);
}

async function restoreSyncOnStartup() {
    if (!window.showOpenFilePicker) return;
    const handle = await loadStoredSyncHandle();
    if (!handle) return;
    rememberedSyncHandle = handle;
    syncPaused = true;
    updateSyncIndicator();
    document.getElementById('btn-sync').title = `Sync paused - click to resume with ${handle.name}`;
    try {
        if (await handle.queryPermission({ mode: 'readwrite' }) === 'granted') await beginSyncWithHandle(handle);
    } catch (e) { }
}
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && syncFileHandle) runSyncTask(syncWithFile);
});
window.addEventListener('focus', () => { if (syncFileHandle) runSyncTask(syncWithFile); });
function saveData() {
    try {
        const json = JSON.stringify(getSaveObject());
        if (json !== localStorage.getItem(LOCAL_STORAGE_KEY)) localStorage.setItem(LOCAL_MODIFIED_KEY, String(Date.now()));
        localStorage.setItem(LOCAL_STORAGE_KEY, json);
    } catch (e) { }
    if (syncPaused && !syncUnsaved) { syncUnsaved = true; updateSyncIndicator(); }
    scheduleSyncWrite();
}


