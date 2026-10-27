'use strict';
/* VERTFORM 2.53 — profile photos. Your picture is cropped to a small square, kept on this phone and shared with friends
   through the friends database (vf_avatar_* functions). Friends' pictures are fetched once and cached. */
const FACE_KEY = 'vertform.faces'; let faceMem = null, faceTimer = null; const faceQ = new Set(), faceTried = {};
const faceLoad = () => { if (faceMem) return faceMem; try { faceMem = JSON.parse(localStorage.getItem(FACE_KEY) || '{}') || {}; } catch (_) { faceMem = {}; } return faceMem; };
const faceSave = () => { try { const ks = Object.keys(faceMem); while (ks.length > 60) delete faceMem[ks.shift()]; localStorage.setItem(FACE_KEY, JSON.stringify(faceMem)); } catch (_) { /* full or blocked: photos are fetched again next time */ } };
const myPhoto = () => data.settings.photo || '';
function facePhoto(pid) { const c = lbCfg(); if (c && pid === c.id) return myPhoto(); return pid ? (faceLoad()[pid] || '') : ''; }
/* a round picture for a person: their photo, else their 3D player, else a letter */
function faceHTML(pid, look, name, cls = '') {
  const ph = facePhoto(pid);
  if (ph) return `<img class="vav fphoto ${cls}" src="${ph}" alt="" aria-hidden="true">`;
  const c = lbCfg();
  if (pid && c && pid !== c.id && !faceTried[pid]) { faceQ.add(pid); clearTimeout(faceTimer); faceTimer = setTimeout(faceFetch, 200); }
  return avatarHTML(look, name, cls);
}
async function faceFetch() {
  const c = lbCfg(); if (!c || !faceQ.size) return;
  const ids = [...faceQ].slice(0, 40); ids.forEach(i => { faceQ.delete(i); faceTried[i] = 1; });
  try {
    const got = await lbCall('vf_avatars', { p_id: c.id, p_secret: c.secret, p_ids: ids });
    let n = 0; if (got && typeof got === 'object') Object.entries(got).forEach(([k, v]) => { if (typeof v === 'string' && v.startsWith('data:image/jpeg;base64,') && /^[0-9a-f-]{36}$/.test(k)) { faceLoad()[k] = v; n++; } });
    if (n) { faceSave(); if (['post', 'home', 'friend'].includes(ui.page)) render(); }
  } catch (_) { /* the photo functions may not be set up yet: letters stay */ }
}
async function phUpload() {
  const c = lbCfg(), ph = myPhoto(); if (!c || !ph) return;
  try { await lbCall('vf_avatar_set', { p_id: c.id, p_secret: c.secret, p_img: ph }); data.settings.photoUp = ph.length; save(); } catch (_) { /* tried again next start */ }
}
async function phTake(f) {
  if (!f) return;
  try {
    const url = URL.createObjectURL(f), im = new Image();
    await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url; });
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const s = Math.min(im.naturalWidth, im.naturalHeight);
    cv.getContext('2d').drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, S, S);
    URL.revokeObjectURL(url);
    let q = 0.82, out = cv.toDataURL('image/jpeg', q);
    while (out.length > 60000 && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
    data.settings.photo = out; data.settings.photoUp = 0; save(); render(); toast('Photo set');
    phUpload();
  } catch (_) { toast('Could not read that photo'); }
}
ACTIONS['ph.pick'] = () => {
  let i = $('#phfile');
  if (!i) { i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.id = 'phfile'; i.hidden = true; i.setAttribute('aria-label', 'Profile photo'); document.body.appendChild(i); }
  i.value = ''; i.onchange = () => phTake(i.files && i.files[0]); i.click();
};
ACTIONS['ph.clear'] = async () => {
  data.settings.photo = ''; data.settings.photoUp = 0; save(); render(); toast('Photo removed');
  const c = lbCfg(); if (c) lbCall('vf_avatar_clear', { p_id: c.id, p_secret: c.secret }).catch(() => {});
};
setTimeout(() => { if (myPhoto() && lbCfg() && data.settings.photoUp !== myPhoto().length) phUpload(); }, 4000);

/* your own banner picture for gym cards: chosen from your phone, kept on this phone only (never uploaded, never part of the app) */
function bnApply() {
  const b = data.settings.banner, r = document.documentElement;
  if (b) { r.style.setProperty('--vbart', `url("${b}")`); r.classList.add('has-banner'); } else { r.style.removeProperty('--vbart'); r.classList.remove('has-banner'); }
}
async function bnTake(f) {
  if (!f) return;
  try {
    const url = URL.createObjectURL(f), im = new Image();
    await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url; });
    const W = 900, H = 520, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), sw = W / k, sh = H / k;
    cv.getContext('2d').drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H);
    URL.revokeObjectURL(url);
    let q = 0.8, out = cv.toDataURL('image/jpeg', q);
    while (out.length > 300000 && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
    data.settings.banner = out; save(); bnApply(); render(); toast('Banner set');
  } catch (_) { toast('Could not read that picture'); }
}
ACTIONS['bn.pick'] = () => {
  let i = $('#bnfile');
  if (!i) { i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.id = 'bnfile'; i.hidden = true; i.setAttribute('aria-label', 'Banner picture'); document.body.appendChild(i); }
  i.value = ''; i.onchange = () => bnTake(i.files && i.files[0]); i.click();
};
ACTIONS['bn.clear'] = () => { data.settings.banner = ''; save(); bnApply(); render(); toast('Banner reset'); };
bnApply();
