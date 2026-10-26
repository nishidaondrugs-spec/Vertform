'use strict';
/* VERTFORM 2.18 — your 3D player: the look editor, small avatar portraits and the spinning profile stage.
   A look is { skin, hair, hairColor, shorts, shoes, number, build, height, kit } — small integers only.
   3D runs in player3d/*.html (three.js) so the main app never loads it until a player is shown. */

const LOOK_DEF = { skin: 2, hair: 2, hairColor: 0, shorts: 0, shoes: 1, number: 10, build: 1, height: 1, kit: 2, trim: 0, beard: 0, headband: 0, sleeve: 0, sleeveColor: 0, pads: 0, socks: 1, sockColor: 0, wrist: 0 };
const LOOK_MAX = { skin: 6, hair: 11, hairColor: 8, shorts: 10, shoes: 10, build: 3, height: 3, kit: 10, trim: 11, beard: 4, headband: 11, sleeve: 4, sleeveColor: 3, pads: 4, socks: 3, sockColor: 3, wrist: 3 };
const LK_SKIN = ['#f5d3b8', '#e8b894', '#d9a27c', '#b97a57', '#8d5a3b', '#5e3a26'];
const LK_HAIRC = ['#14110f', '#3a2518', '#7a4b25', '#c9a45c', '#b2432b', '#8a8a8a', '#e8e2d0', '#2f5fd1'];
const LK_KIT = ['#10131f', '#f2f4f8', '#1f3a8a', '#d23a3a', '#f07a2a', '#f4c542', '#2f9e5b', '#1aa6a6', '#8b5cf6', '#e86fa8'];
const LK_HAIR = ['Bald', 'Buzz', 'Short', 'Long', 'Ponytail', 'Bun', 'Afro', 'Mohawk', 'Curly top', 'High top', 'Spiky'];

function cleanLook(l) {
  if (!l || typeof l !== 'object') return null; const o = { ...LOOK_DEF };
  Object.keys(LOOK_MAX).forEach(k => { const v = Math.floor(Number(l[k])); if (v >= 0 && v < LOOK_MAX[k]) o[k] = v; });
  const n = Math.floor(Number(l.number)); if (n >= 0 && n <= 99) o.number = n; return o;
}
const myLook = () => cleanLook(data.settings.look);
const lookKey = l => { const c = cleanLook(l); return c ? Object.keys(LOOK_DEF).map(k => c[k]).join('.') : ''; };
const lookB64 = l => btoa(JSON.stringify(cleanLook(l) || LOOK_DEF)).replace(/\+/g, '-').replace(/\//g, '_');
const lookUrl = (l, extra = '') => `player3d/look.html?look=${lookB64(l)}&kit=${(cleanLook(l) || LOOK_DEF).kit}${extra}`;
/* whose look is this: you, or a friend from the board */
function lookFor(pid, mine) { if (mine || (lbCfg() && pid === lbCfg().id)) return myLook(); const r = (lbUi.rows || []).find(x => x.id === pid); return cleanLook(r?.look); }

/* ---------- avatar portraits: made once per look by one hidden helper, kept in local storage ---------- */
const AV_KEY = 'vertform.avatars', avMem = new Map(); let avStore = null, avFrame = null, avReady = false, avOff = false, avBusy = false; const avQueue = [];
function avLoad() { if (avStore) return avStore; try { avStore = JSON.parse(localStorage.getItem(AV_KEY) || '{}') || {}; } catch (_) { avStore = {}; } return avStore; }
function avSave() { try { const ks = Object.keys(avStore); while (ks.length > 40) delete avStore[ks.shift()]; localStorage.setItem(AV_KEY, JSON.stringify(avStore)); } catch (_) { /* full or blocked: memory only */ } }
const avGet = k => avMem.get(k) || avLoad()[k] || '';
function avPump() {
  if (avOff || avBusy || !avQueue.length) return;
  if (!avFrame) { avFrame = document.createElement('iframe'); avFrame.src = 'player3d/snap.html'; avFrame.title = ''; avFrame.setAttribute('aria-hidden', 'true'); avFrame.tabIndex = -1; avFrame.style.cssText = 'position:fixed;left:-400px;top:0;width:160px;height:160px;border:0;opacity:0;pointer-events:none'; document.body.appendChild(avFrame); return; }
  if (!avReady) return;
  const k = avQueue.shift(); if (avGet(k)) { avPump(); return; }
  avBusy = true; const look = cleanLook(Object.fromEntries(Object.keys(LOOK_DEF).map((f, i) => [f, Number(k.split('.')[i])])));
  avFrame.contentWindow.postMessage({ type: 'vf3d:snap', id: k, look, kit: look.kit }, location.origin);
  setTimeout(() => { if (avBusy) { avBusy = false; avPump(); } }, 4000);
}
/* 3D frames start invisible and fade in once their first frame is drawn, so you never see the blank (white) page while it loads */
function frameIn(win) { $$('iframe.f3d').forEach(f => { if (f.contentWindow === win) f.classList.add('is-in'); }); }
addEventListener('message', e => {
  if (e.origin !== location.origin) return; const m = e.data || {};
  if ((m.type === 'vf3d:shown' || m.type === 'vf3d:unavailable') && e.source) frameIn(e.source);
  if (m.type === 'vf3d:ready' && avFrame && e.source === avFrame.contentWindow) { avReady = true; avPump(); }
  else if (m.type === 'vf3d:unavailable' && avFrame && e.source === avFrame.contentWindow) { avOff = true; avQueue.length = 0; }
  else if (m.type === 'vf3d:snapped' && typeof m.id === 'string') {
    avBusy = false;
    if (typeof m.img === 'string' && m.img.startsWith('data:image/')) { avMem.set(m.id, m.img); avLoad()[m.id] = m.img; avSave(); $$(`[data-avk="${m.id}"]`).forEach(el => { el.outerHTML = avImg(m.id, el.dataset.avc || '', el.getAttribute('aria-hidden') !== 'true'); }); }
    avPump();
  }
});
const avImg = (k, cls, label) => `<img class="vav ${cls}" src="${avGet(k)}" alt=""${label ? '' : ' aria-hidden="true"'}>`;
/* the little round picture: your/their player if they made one, else their initial */
function avatarHTML(look, name, cls = '') {
  const l = cleanLook(look), init = esc(String(name || '?').trim().slice(0, 1).toUpperCase() || '?');
  if (!l || avOff) return `<span class="pav ${cls}" aria-hidden="true">${init}</span>`;
  const k = lookKey(l); if (avGet(k)) return avImg(k, cls);
  if (!avQueue.includes(k)) { avQueue.push(k); setTimeout(avPump, 0); }
  return `<span class="pav ${cls}" data-avk="${k}" data-avc="${esc(cls)}" aria-hidden="true">${init}</span>`;
}

/* ---------- the spinning stage (profiles) ---------- */
const stageHTML = (look, label, tags = '', extra = '') => `<div class="pstage${extra ? ' parts' : ''}" id="pstage"><iframe class="pstage-3d f3d" data-keep="stage:${lookKey(look)}${extra}" title="${esc(label)}" src="${lookUrl(look, '&soft=1' + extra)}" loading="lazy"></iframe>${tags}</div>`;

/* ---------- look editor ---------- */
let lkDraft = null;
function lookRow(field, label, items) {
  return `<div class="field lkrow"><label>${label}</label><div class="lkopts" role="radiogroup" aria-label="${label}">${items.map((it, i) => `<button type="button" role="radio" aria-checked="${lkDraft[field] === i}" class="${it.sw ? `lksw${it.none ? ' none' : ''}` : 'chip'} ${lkDraft[field] === i ? 'on' : ''}" data-act="lk.set" data-f="${field}" data-arg="${i}" ${it.sw ? `style="--sw:${it.sw}" aria-label="${esc(it.n)}"` : ''}>${it.sw ? '' : esc(it.n)}</button>`).join('')}</div></div>`;
}
const LK_NONE = { sw: 'transparent', n: 'None', none: 1 };
const lkSw = (arr, what) => arr.map((c, i) => ({ sw: c, n: `${what} ${i + 1}` }));
const LK_TABS = [['kit', 'Kit', 'upper'], ['hair', 'Hair', 'head'], ['body', 'Body', 'full'], ['extras', 'Extras', 'legs']];
let lkTab = 'kit';
function lkTabBody() {
  const t = lkTab;
  if (t === 'body') return lookRow('skin', 'Skin', lkSw(LK_SKIN, 'Skin tone')) + lookRow('build', 'Build', ['Slim', 'Standard', 'Strong'].map(n => ({ n }))) + lookRow('height', 'Height', ['Shorter', 'Standard', 'Taller'].map(n => ({ n })));
  if (t === 'hair') return lookRow('hair', 'Hair', LK_HAIR.map(n => ({ n }))) + lookRow('hairColor', 'Hair colour', lkSw(LK_HAIRC, 'Hair colour'))
    + lookRow('beard', 'Facial hair', ['None', 'Stubble', 'Moustache', 'Beard'].map(n => ({ n }))) + lookRow('headband', 'Headband', [LK_NONE, ...lkSw(LK_KIT, 'Headband colour')]);
  if (t === 'kit') return lookRow('kit', 'Shirt', lkSw(LK_KIT, 'Shirt colour')) + lookRow('trim', 'Trim', [LK_NONE, ...lkSw(LK_KIT, 'Trim colour')])
    + `<div class="field lkrow"><label for="lknum">Number</label><input id="lknum" class="lknum" type="number" inputmode="numeric" min="0" max="99" data-in="lknum" value="${lkDraft.number}"></div>`
    + lookRow('shorts', 'Shorts', lkSw(LK_KIT, 'Shorts colour')) + lookRow('shoes', 'Shoes', lkSw(LK_KIT, 'Shoe colour'))
    + lookRow('socks', 'Socks', ['Ankle', 'Crew', 'High'].map(n => ({ n }))) + lookRow('sockColor', 'Sock colour', ['White', 'Black', 'Match shirt'].map(n => ({ n })));
  return lookRow('pads', 'Knee pads', ['None', 'Black', 'White', 'Match shirt'].map(n => ({ n }))) + lookRow('sleeve', 'Arm sleeve', ['None', 'Left', 'Right', 'Both'].map(n => ({ n })))
    + lookRow('sleeveColor', 'Sleeve colour', ['Black', 'White', 'Match shirt'].map(n => ({ n }))) + lookRow('wrist', 'Wristbands', ['None', 'One', 'Both'].map(n => ({ n })));
}
function openLookEditor() {
  lkDraft = { ...(myLook() || LOOK_DEF) }; lkTab = 'kit';
  openSheet({ title: 'Your player', size: 'tall', render: () => ({
    body: `<div class="lkstage"><iframe id="lkframe" class="f3d" title="Your player preview" src="${lookUrl(lkDraft, '&soft=1&editor=1')}"></iframe>
      <div class="lktools"><button type="button" class="lktool" data-act="lk.random" aria-label="Random look">🎲 Random</button><button type="button" class="lktool" data-act="lk.reset">Reset</button></div>
      <div class="lktabs" role="tablist">${LK_TABS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${lkTab === k}" class="${lkTab === k ? 'on' : ''}" data-act="lk.tab" data-arg="${k}">${n}</button>`).join('')}</div></div>
      <div id="lkbody">${lkTabBody()}</div>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="lk.save">Save player</button>` }) });
  const f = $('#lkframe'); if (f) f.addEventListener('load', () => { lkView(); lkSend(); setTimeout(lkView, 300); });
}
function lkView() { const v = LK_TABS.find(t => t[0] === lkTab)?.[2] || 'full'; try { $('#lkframe')?.contentWindow?.postMessage({ type: 'vf3d:view', view: v }, location.origin); } catch (_) {} }
function lkBody() { const bd = $('#lkbody'); if (!bd) return; bd.innerHTML = lkTabBody(); bd.querySelectorAll('.lkopts .on').forEach(o => { const row = o.parentElement; row.scrollLeft = Math.max(0, o.offsetLeft - row.clientWidth / 2 + o.offsetWidth / 2); }); }
ACTIONS['lk.tab'] = el => { lkTab = el.dataset.arg; $$('.lktabs button').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); lkBody(); lkView(); };
ACTIONS['lk.random'] = () => { const keepNo = lkDraft.number; Object.keys(LOOK_MAX).forEach(k => { lkDraft[k] = Math.floor(Math.random() * LOOK_MAX[k]); }); lkDraft.number = keepNo; lkBody(); lkSend(); };
ACTIONS['lk.reset'] = () => { lkDraft = { ...(myLook() || LOOK_DEF) }; lkBody(); lkSend(); };

function lkSend() { const f = $('#lkframe'); try { f?.contentWindow?.postMessage({ type: 'vf3d:look', look: cleanLook(lkDraft), kit: lkDraft.kit }, location.origin); } catch (_) {} }
ACTIONS['lk.open'] = () => openLookEditor();
ACTIONS['lk.set'] = el => {
  const f = el.dataset.f; lkDraft[f] = Number(el.dataset.arg);
  $$(`[data-act="lk.set"][data-f="${f}"]`).forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  lkSend();
};
INPUTS.lknum = el => { const n = Math.floor(Number(el.value)); if (n >= 0 && n <= 99) { lkDraft.number = n; lkSend(); } };
ACTIONS['lk.save'] = async () => {
  data.settings.look = cleanLook(lkDraft); save(); closeSheet(); render(); toast('Player saved');
  const c = lbCfg(); if (!c) return;
  try { await lbCall('vf_set_look', { p_id: c.id, p_secret: c.secret, p_look: data.settings.look }); data.meta.lookSynced = lookKey(data.settings.look); saveSoon(); }
  catch (e) { if (e.message === 'not_installed') toast('Saved here. Run vertform-looks.sql so friends can see it.'); }
};
/* first sync after an update, so friends see a look made before the SQL existed */
async function lookSyncOnce() {
  const c = lbCfg(), l = myLook(); if (!c || !l || data.meta.lookSynced === lookKey(l)) return;
  try { await lbCall('vf_set_look', { p_id: c.id, p_secret: c.secret, p_look: l }); data.meta.lookSynced = lookKey(l); saveSoon(); } catch (_) { /* try again next time */ }
}
/* safety net: if a frame never reports in, show it anyway shortly after it loads */
document.addEventListener('load', e => { const f = e.target; if (f?.tagName === 'IFRAME' && f.classList.contains('f3d')) setTimeout(() => f.classList.add('is-in'), 2500); }, true);
