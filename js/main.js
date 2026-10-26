'use strict';
/* VERTFORM 2.0 — boot, event wiring, backup / import / restore actions */

/* ---------- file helpers ---------- */
function downloadText(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const backupName = () => `vertform-backup-${todayISO()}.json`;
function canShareFiles() {
  try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })); } catch (e) { return false; }
}
function onSaveFailure() { if (typeof render === 'function' && $('#view')) { try { render(); } catch (e) { /* ignore */ } } }

/* ---------- backups ---------- */
ACTIONS['backup.export'] = () => {
  const text = JSON.stringify(buildBackup(), null, 1);
  downloadText(backupName(), text);
  recordExport(); render(); refreshSheet();
  toast('Backup file created. Check it saved to Files or Downloads, then copy it somewhere safe.', { ms: 7000 });
};
ACTIONS['backup.share'] = async () => {
  const text = JSON.stringify(buildBackup(), null, 1);
  try {
    const file = new File([text], backupName(), { type: 'application/json' });
    await navigator.share({ files: [file], title: 'VERTFORM backup' });
    recordExport(); render(); toast('Backup handed to the share sheet. Make sure you chose a place that keeps it.', { ms: 7000 });
  } catch (e) { if (e && e.name !== 'AbortError') toast('Sharing was not possible. Use “Create backup file” instead.'); }
};
ACTIONS['premigrate.download'] = () => {
  try { downloadText(`vertform-before-upgrade-${todayISO()}.json`, localStorage.getItem(KEY_PREMIGRATE) || ''); } catch (e) { toast('That copy could not be read.'); }
};
ACTIONS['problem.download'] = () => {
  if (storageProblem?.raw) downloadText(`vertform-unreadable-records-${todayISO()}.json`, storageProblem.raw, 'text/plain');
};
ACTIONS['problem.fresh'] = async () => {
  const ok = await askConfirm({ title: 'Start with empty records?', message: '<p>The unreadable records stay in this browser’s storage until you save something new, which replaces them. Download the raw data first if you might want it.</p>', confirmLabel: 'Start fresh', danger: true });
  if (!ok) return;
  data = baseData(); data.settings.backup.firstSeenAt = new Date().toISOString(); storageBlocked = false; storageProblem = null; save(); render();
};

/* ---------- import ---------- */
function pickBackupFile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json,text/plain'; inp.style.display = 'none';
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
    if (f.size > 40 * 1048576) { showImportError('This file is larger than 40 MB, which is far bigger than any VERTFORM backup.'); return; }
    let text; try { text = await f.text(); } catch (e) { showImportError('The file could not be read.'); return; }
    try { showImportPreview(f.name, inspectBackup(text)); } catch (e) { showImportError(e.message || 'This file is not a usable backup.'); }
  });
  document.body.appendChild(inp); inp.click();
}
function showImportError(msg) {
  askChoice({ title: 'This file cannot be imported', message: `<p>${esc(msg)}</p><p class="tiny">Your current records have not been changed.</p>`, choices: [{ label: 'Close', value: null, kind: 'primary' }] });
}
const countRows = c => [['Workouts', c.workouts], ['Food entries', c.foodEntries], ['Recipes / meals', c.recipes], ['Measurements', c.measurements], ['Volleyball logs', c.volleyballLogs], ['Matches', c.fixtures]];
function showImportPreview(name, info) {
  const nv = info.meta?.appVersion;
  const newer = info.meta && Number(info.meta.format) > BACKUP_FORMAT;
  const rows = countRows(info.incomingCounts).map(([l, n], i) => `<tr><td>${l}</td><td class="mono">${n}</td><td class="mono">${countRows(info.currentCounts)[i][1]}</td></tr>`).join('');
  openSheet({
    eyebrow: 'IMPORT', title: 'Check this backup', size: 'md',
    render: () => ({
      body: `<p><b>${esc(name)}</b></p>
        <p class="tiny">${info.isLegacy ? 'Made by an earlier VERTFORM (no backup header). It can still be read; newer features will start empty.' : `Made by VERTFORM ${esc(nv || '?')}${info.meta.exportedAt ? ' on ' + esc(pretty(info.meta.exportedAt.slice(0, 10))) : ''}.`}</p>
        ${newer ? `<div class="status warn"><b>Newer file format.</b> This backup came from a newer VERTFORM. Anything this version does not understand is ignored.</div>` : ''}
        ${info.warnings.length ? `<div class="status warn"><b>Notes</b><ul>${info.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
        <table class="tbl"><thead><tr><th></th><th>In file</th><th>On this device now</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="tiny">Importing replaces everything currently on this device. A copy of the current records is kept so you can undo it from Settings.</p>`,
      footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary" data-act="import.confirm">Replace my records</button>`
    })
  });
  ACTIONS['import.confirm'] = async () => {
    const ok = await askConfirm({ title: 'Replace all records on this device?', message: `<p>${plural(info.incomingCounts.workouts, 'workout')}, ${plural(info.incomingCounts.foodEntries, 'food entry', 'food entries')} and the rest of the file will replace what is here now (${plural(info.currentCounts.workouts, 'workout')}, ${plural(info.currentCounts.foodEntries, 'food entry', 'food entries')}).</p>`, confirmLabel: 'Replace', danger: true });
    if (!ok) return;
    const r = applyImport(info.incoming, info.meta); closeAllSheets(); render();
    toast(r.ok ? (r.safety ? 'Backup imported. The previous records can be restored from Settings.' : 'Backup imported. No undo copy could be stored (device storage is full).') : 'Imported, but this device could not store it. Do not close the app; free some space and export a backup.', { ms: 7000 });
  };
}
ACTIONS['data.import'] = () => pickBackupFile();
ACTIONS['import.undo'] = async () => {
  const ok = await askConfirm({ title: 'Restore the records from before the last import?', message: '<p>This swaps your current records with the copy kept before that import. The current records are kept so you can swap back.</p>', confirmLabel: 'Restore', danger: true });
  if (!ok) return;
  try { restoreBeforeImport(); render(); toast('Earlier records restored.'); } catch (e) { toast(e.message || 'Could not restore.'); }
};
ACTIONS['data.reset'] = async () => {
  const b = backupStatus();
  const ok = await askConfirm({ title: 'Delete all VERTFORM data on this device?', message: `<p>This removes every record, the pre-upgrade and pre-import copies, and your settings. It cannot be undone.</p><p>${b.never ? '<b>You have not exported a backup.</b>' : `Last backup exported ${b.daysSince === 0 ? 'today' : plural(b.daysSince, 'day') + ' ago'}.`}</p>`, confirmLabel: 'Delete everything', danger: true });
  if (!ok) return;
  try { [KEY, KEY_PREMIGRATE, KEY_BEFOREIMPORT, KEY_TIMER].forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
  location.reload();
};

/* ---------- delegated events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act]; if (!fn) { console.warn('No action', el.dataset.act); return; }
  try { const r = fn(el, e); if (r && r.catch) r.catch(err => console.error(err)); } catch (err) { console.error(err); toast('Something went wrong with that action.'); }
});
const seenInput = new WeakMap();
function onInput(e) {
  const el = e.target.closest('[data-in]'); if (!el) return;
  const fn = INPUTS[el.dataset.in]; if (!fn) return;
  // A text box already reported each keystroke; the 'change' on blur would repeat that and could re-render a list under a tap in progress.
  if (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=date]):not([type=time]), textarea')) {
    if (e.type === 'input') seenInput.set(el, el.value); else if (seenInput.get(el) === el.value) return;
  }
  try { fn(el, e); } catch (err) { console.error(err); }
}
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('#dialog-root .dialog')) { ACTIONS['dialog.cancel'](); e.preventDefault(); return; }
    if (sheetOpen()) { closeSheet(); e.preventDefault(); return; }
  }
  if (e.key === 'Tab') {
    const box = $('#dialog-root .dialog') || (sheetOpen() && $('#sheet-root .sheet')); if (!box) return;
    const f = [...box.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (!box.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
    else if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-enter]')) { e.preventDefault(); ACTIONS[e.target.dataset.enter]?.(e.target, e); } });

/* ---------- persistence hygiene ---------- */
window.addEventListener('pagehide', () => { try { flushSave(); } catch (e) { /* ignore */ } });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { try { flushSave(); } catch (e) { /* ignore */ } }
  else { const d = todayISO(); if (ui.lastDay && ui.lastDay !== d && !sheetOpen() && !$('#wk-root .wk')) { render(); maybeAskReadiness(); } ui.lastDay = d; }
});
window.addEventListener('storage', e => {
  if (e.key === KEY && !storageBlocked && !$('#wk-root .wk') && !sheetOpen()) { try { const { data: d } = normaliseData(JSON.parse(e.newValue)); data = d; render(); toast('Updated from another VERTFORM tab.'); } catch (_) { /* ignore */ } }
});

/* ---------- boot ---------- */
function boot() {
  loadState(); loadTimer(); trackViewport(); ui.lastDay = todayISO(); ui.page = homePage();
  render();
  if (data.user.onboarded) setTimeout(maybeAskReadiness, 350); else startOnboarding();
  if (typeof acctStart === 'function') setTimeout(acctStart, 250);
  if (data.draft && !storageBlocked && !data.draft.dismissed) { /* resume pill + banners are painted by render() */ }
  try { if (navigator.storage && navigator.storage.persist && !storageBlocked) navigator.storage.persist(); } catch (e) { /* ignore */ }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker not registered', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !updateReady) { updateReady = true; if (!$('#wk-root .wk')) render(); } });
  }
}
document.addEventListener('DOMContentLoaded', boot);

/* 2.15.2 — calm the leftover ALL-CAPS labels written into individual screens ("BREAKFAST", "LAST BACKUP FILE CREATED").
   Runs on whatever gets painted; leaves the wordmark, friend codes, units and abbreviations alone. */
(() => {
  const KEEP = new Set(['RPE', 'PB', 'PBS', 'AU', 'BW', 'VB', 'UK', 'AM', 'PM', 'KCAL', 'WK', 'ID', 'OK', 'TV', '1RM', 'GPS', 'PDF', 'CSV', 'JSON', 'VERTFORM']);
  const PROPER = /^(MON|TUE|WED|THU|FRI|SAT|SUN|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY|JANUARY|FEBRUARY|MARCH|APRIL|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|SESSION|VERT)$/;
  const SKIP = '.word,.vhTitle,.code,.wk-code,.lbc,.set-k,.ptext,.pbody,.phead,.pcm,.pclist,.lbname,.wkcard,.hist2,script,style,textarea,input,[data-keepcase]';
  const word = (w, first) => {
    const core = w.replace(/[^A-Z0-9]/g, '');
    if (!core || /\d/.test(core) || core.length === 1 || KEEP.has(core)) return w === 'KCAL' ? 'kcal' : w;
    if (first || PROPER.test(core)) return w.charAt(0) + w.slice(1).toLowerCase();
    return w.toLowerCase();
  };
  const soften = t => { let first = true; return t.replace(/[A-Za-z0-9'’\-]+/g, w => { const r = word(w, first); first = false; return r; }); };
  function walk(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 11) return;
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const hits = [];
    for (let n = it.nextNode(); n; n = it.nextNode()) { const v = n.nodeValue; if (v.length > 2 && /[A-Z]{3}/.test(v) && !/[a-z]/.test(v) && !n.parentElement?.closest(SKIP)) hits.push(n); }
    hits.forEach(n => { n.nodeValue = soften(n.nodeValue); });
  }
  const mo = new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(n => n.nodeType === 3 ? walk(n.parentElement) : walk(n)); });
  const start = () => { walk(document.body); mo.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
