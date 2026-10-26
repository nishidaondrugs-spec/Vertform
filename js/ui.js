'use strict';
/* VERTFORM 2.0 — UI plumbing: sheets (modal stack), confirmation dialogs, toasts, viewport/keyboard handling */

const ui = {
  page: 'home', hub: false, panel: null, trainTab: 'gym', trainDate: null, fuelDate: todayISO(), planWeek: monday(todayISO()), metric: 'approachJump',
  fuelMeal: null, historyFilter: 'all', selectedDay: null
};
const ACTIONS = {};            // data-act="name" handlers
const INPUTS = {};             // data-in="name" handlers (input/change events)
const REDUCED_MOTION = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- sheets ---------- */
const sheetStack = [];
function openSheet(spec) { spec.opener = document.activeElement; sheetStack.push(spec); paintSheet(true); }
function replaceSheet(spec) { const old = sheetStack.pop(); spec.opener = old?.opener || document.activeElement; sheetStack.push(spec); paintSheet(true); }
function closeSheet() {
  const s = sheetStack.pop(); if (!s) return;
  try { s.onClose && s.onClose(); } catch (e) { console.error(e); }
  paintSheet(true, s.opener);
}
function closeAllSheets() { while (sheetStack.length) { const s = sheetStack.pop(); try { s.onClose && s.onClose(); } catch (e) { console.error(e); } } paintSheet(false); }
function topSheet() { return sheetStack[sheetStack.length - 1]; }
function sheetOpen() { return sheetStack.length > 0; }

function paintSheet(focus, returnTo) {
  const root = $('#sheet-root'); const s = topSheet();
  if (!s) { root.innerHTML = ''; document.body.classList.remove('sheet-open'); if (returnTo && document.contains(returnTo)) returnTo.focus({ preventScroll: true }); updateScrollLock(); return; }
  const prevScroll = $('.sheet-body', root)?.scrollTop || 0; const keepScroll = !focus;
  const r = s.render();
  root.innerHTML = `<div class="overlay sheet-layer"><div class="scrim" data-act="sheet.scrim"></div>
    <section class="sheet ${s.size ? 'sheet-' + s.size : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
      <header class="sheet-head"><div class="min0">${s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : ''}<h2 id="sheet-title">${esc(s.title)}</h2></div>
        <button type="button" class="iconbtn" data-act="sheet.close" aria-label="Close">${icon('close')}</button></header>
      <div class="sheet-body">${r.body}</div>
      ${r.footer ? `<footer class="sheet-foot">${r.footer}</footer>` : ''}
    </section></div>`;
  document.body.classList.add('sheet-open'); updateScrollLock();
  if (keepScroll) $('.sheet-body', root).scrollTop = prevScroll;
  if (focus) {
    const target = (s.autofocus && $(s.autofocus, root)) || $('.sheet', root);
    target.focus({ preventScroll: true });
  }
  s.onMount && s.onMount(root);
}
function refreshSheet() { if (topSheet()) paintSheet(false); }
function updateScrollLock() { document.body.classList.toggle('no-scroll', sheetOpen() || !!ui.panel || !!$('#wk-root .wk') || !!$('#dialog-root .dialog')); }

/* ---------- confirmation / choice dialogs (replace window.confirm) ---------- */
function askChoice({ title, message, choices, extra = '' }) {
  return new Promise(resolve => {
    const root = $('#dialog-root'); const opener = document.activeElement;
    root.innerHTML = `<div class="overlay dialog-layer"><div class="scrim" data-act="dialog.cancel"></div>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg" tabindex="-1">
        <h2 id="dlg-title">${esc(title)}</h2><div id="dlg-msg" class="dlg-msg">${message}</div>${extra}
        <div class="dialog-actions ${choices.length > 2 ? 'stack' : ''}">${choices.map((c, i) => `<button type="button" class="btn ${c.kind || 'ghost'}" data-act="dialog.choice" data-arg="${i}">${esc(c.label)}</button>`).join('')}</div></div></div>`;
    askChoice.done = v => { askChoice.done = null; root.innerHTML = ''; updateScrollLock(); if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); resolve(v); };
    askChoice.values = choices.map(c => c.value); updateScrollLock();
    $('.dialog', root).focus({ preventScroll: true });
  });
}
const askConfirm = ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, extra = '' }) =>
  askChoice({ title, message, extra, choices: [{ label: cancelLabel, value: false, kind: 'ghost' }, { label: confirmLabel, value: true, kind: danger ? 'critical' : 'primary' }] });
ACTIONS['dialog.choice'] = el => askChoice.done?.(askChoice.values[Number(el.dataset.arg)]);
ACTIONS['dialog.cancel'] = () => askChoice.done?.(askChoice.values.includes(false) ? false : null);
ACTIONS['sheet.close'] = () => closeSheet();
ACTIONS['sheet.scrim'] = () => closeSheet();

/* ---------- toasts ---------- */
let toastTimer = null;
function toast(msg, opts = {}) {
  const el = $('#toast-root');
  el.innerHTML = `<div class="toast" role="status">${esc(msg)}${opts.action ? ` <button type="button" class="toast-btn" data-act="toast.action">${esc(opts.action.label)}</button>` : ''}</div>`;
  toast.action = opts.action?.fn || null;
  clearTimeout(toastTimer);
  if (!opts.sticky) toastTimer = setTimeout(() => { el.innerHTML = ''; }, opts.ms || (opts.action ? 6500 : 3200));
}
ACTIONS['toast.action'] = () => { const f = toast.action; $('#toast-root').innerHTML = ''; f && f(); };

/* ---------- keyboard / visual viewport / safe areas ---------- */
function trackViewport() {
  const vv = window.visualViewport; const root = document.documentElement;
  const set = () => {
    const h = vv ? vv.height : window.innerHeight;
    root.style.setProperty('--vvh', Math.round(h) + 'px');
    root.style.setProperty('--vvt', Math.round(vv ? vv.offsetTop : 0) + 'px');
    const kb = !!vv && (window.innerHeight - vv.height) > 140 && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    document.body.classList.toggle('kb-open', kb);
  };
  vv && vv.addEventListener('resize', set); vv && vv.addEventListener('scroll', set);
  window.addEventListener('resize', set); window.addEventListener('orientationchange', set);
  document.addEventListener('focusin', e => {
    set();
    const t = e.target; if (!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (t.matches('input[type=number],input[type=text],input[type=search]') && t.closest('.set-row')) { try { t.select(); } catch (_) { /* ignore */ } }
    if (t.closest('.sheet-body,.wk-body')) setTimeout(() => { try { t.scrollIntoView({ block: 'center', behavior: REDUCED_MOTION() ? 'auto' : 'smooth' }); } catch (_) { /* ignore */ } }, 280);
  });
  document.addEventListener('focusout', () => setTimeout(set, 60));
  set();
}

/* ---------- small shared fragments ---------- */
const tag = (text, kind = '') => `<span class="tag ${kind}">${esc(text)}</span>`;
const btn = (label, act, o = {}) => `<button type="button" class="btn ${o.kind || ''} ${o.cls || ''}" data-act="${act}"${o.id !== undefined ? ` data-id="${esc(o.id)}"` : ''}${o.arg !== undefined ? ` data-arg="${esc(o.arg)}"` : ''}${o.attrs ? ' ' + o.attrs : ''}>${o.icon ? icon(o.icon) : ''}${label ? `<span>${label}</span>` : ''}</button>`;
const field = (label, id, inner, hint = '') => `<div class="field"><label for="${id}">${label}</label>${inner}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
const mealOptions = (sel) => ['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(m => `<option ${m === sel ? 'selected' : ''}>${m}</option>`).join('');
const guessMeal = () => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 18 ? 'Snack' : 'Dinner'; };
const emptyBox = (html) => `<div class="empty">${html}</div>`;
