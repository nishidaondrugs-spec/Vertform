'use strict';
/* VERTFORM 2.4 — barcode scanner built for small, curved, glossy UK supermarket packs.
   - Reads EAN-13 / EAN-8 / UPC-A only (what food uses), validates the check digit, so QR codes and misreads are ignored.
   - Uses the phone's own detector when it has one, plus a bundled ZXing engine (lib/) that works offline and on iPhone.
   - Asks for a high-resolution, continuously focusing camera; has torch, zoom and tap-to-focus; scans a centre strip, the full frame and a contrast-boosted strip.
   - Typed barcodes are checked live; products missing from Open Food Facts can be saved from the label and are remembered on this device. */

const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a'];
const scan = { on: false, stream: null, track: null, video: null, engines: [], tries: 0, started: 0, timer: 0, torch: false, locked: false };

function gtinValid(s) {
  if (!/^\d+$/.test(s) || ![8, 12, 13, 14].includes(s.length)) return false;
  const d = s.split('').map(Number), c = d.pop(); let t = 0;
  d.reverse().forEach((x, i) => { t += x * (i % 2 === 0 ? 3 : 1); });
  return (10 - (t % 10)) % 10 === c;
}
/* The same product can appear as 13 digits (EAN-13 with a leading 0) or 12 (UPC-A), so try both forms. */
function barcodeVariants(code) {
  const out = [code];
  if (code.length === 13 && code[0] === '0') out.push(code.slice(1));
  if (code.length === 12) out.push('0' + code);
  if (code.length === 14 && code[0] === '0') out.push(code.slice(1));
  return [...new Set(out)];
}
function normaliseBarcode(raw) {
  const t = String(raw || '').trim(); let m = t.match(/(?:^|[?&])01=(\d{14})(?:&|$)/) || t.match(/\/01\/(\d{14})(?:\/|$)/); if (m) return m[1];
  if (/^\d{8,14}$/.test(t)) return t; const hits = t.match(/\d{8,14}/g); return hits && hits.length === 1 ? hits[0] : '';
}

/* ---------- engines ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('Scanner engine could not load.')); }; document.head.appendChild(s); });
}
async function nativeEngine() {
  try {
    if (!('BarcodeDetector' in window)) return null;
    const sup = await BarcodeDetector.getSupportedFormats(); const formats = SCAN_FORMATS.filter(f => sup.includes(f));
    return formats.length ? { kind: 'phone', d: new BarcodeDetector({ formats }) } : null;
  } catch (_) { return null; }
}
let wasmEngineP = null;
function wasmEngine() {
  if (wasmEngineP) return wasmEngineP;
  wasmEngineP = (async () => {
    if (!window.BarcodeDetectionAPI) await loadScript('lib/barcode-detector.js');
    BarcodeDetectionAPI.setZXingModuleOverrides({ locateFile: (p, prefix) => (p.endsWith('.wasm') ? 'lib/' + p : prefix + p) });
    return { kind: 'zxing', d: new BarcodeDetectionAPI.BarcodeDetector({ formats: SCAN_FORMATS }) };
  })().catch(e => { wasmEngineP = null; throw e; });
  return wasmEngineP;
}

/* ---------- frame preparation: centre strip, full frame, contrast-boosted strip ---------- */
const scanCanvas = document.createElement('canvas');
function frameVariant(src, sw, sh, variant) {
  const full = variant === 1, slim = variant === 4, cw = full ? sw : Math.round(sw * 0.94), ch = full ? sh : Math.round(sh * (slim ? 0.28 : 0.5));
  const sx = Math.round((sw - cw) / 2), sy = Math.round((sh - ch) / 2), scale = Math.min(1, 1400 / cw);
  scanCanvas.width = Math.max(1, Math.round(cw * scale)); scanCanvas.height = Math.max(1, Math.round(ch * scale));
  const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
  try { ctx.filter = variant === 2 ? 'grayscale(1) contrast(1.7) brightness(1.05)' : variant === 3 ? 'grayscale(1) contrast(3) brightness(0.85)' : 'none'; } catch (_) { /* filter unsupported */ }
  ctx.drawImage(src, sx, sy, cw, ch, 0, 0, scanCanvas.width, scanCanvas.height);
  return scanCanvas;
}
async function detectIn(engine, src, sw, sh, variant) {
  const hits = await engine.d.detect(frameVariant(src, sw, sh, variant));
  for (const h of hits) { const v = String(h.rawValue || '').trim(); if (gtinValid(v)) return v; }
  return '';
}

/* ---------- live camera ---------- */
async function stopScanner() {
  scan.on = false; scan.locked = false; clearTimeout(scan.timer);
  try { scan.stream?.getTracks().forEach(t => t.stop()); } catch (_) { /* ignore */ }
  if (scan.video) { try { scan.video.srcObject = null; } catch (_) { /* ignore */ } }
  scan.stream = null; scan.track = null; scan.torch = false;
}
function setScanMsg(html, tone) { const m = $('#scanmsg'); if (m) { m.className = 'status' + (tone ? ' ' + tone : ''); m.innerHTML = html; } }

function openScanner() {
  pendingProduct = null;
  const insecure = location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname);
  openSheet({ title: 'Scan barcode', eyebrow: 'PACKAGED FOOD', size: 'tall', onClose: stopScanner, onMount: () => { if (!insecure) ACTIONS['scan.start'](); }, render: () => ({
    body: `${insecure ? `<div class="status warn"><b>Camera needs a secure website.</b> Open VERTFORM from its https address in Safari or Chrome. You can still type the barcode below.</div>` : ''}
      <div class="scan-stage"><video id="scanvideo" playsinline muted autoplay></video><div class="scan-reticle" aria-hidden="true"><i></i></div><div class="scan-tools" id="scantools" hidden>
        <button type="button" class="chip" id="scantorch" data-act="scan.torch" hidden>Torch</button>
        <label class="scanzoom" id="scanzoomwrap" hidden>Zoom<input type="range" id="scanzoom" data-in="scanzoom" min="1" max="4" step="0.1" value="1"></label></div></div>
      <div id="scanmsg" class="status" aria-live="polite">Starting camera…</div>
      <ul class="plain bullets tiny"><li>Hold the pack flat, about 15–20 cm away, so the bars fill the strip. Tap the picture to refocus.</li><li>Glossy or curved pack (many own-brand lines)? Tilt it slightly to lose the glare, or switch the torch on.</li></ul>
      <div class="scan-launch"><button type="button" class="btn ghost" data-act="scan.start">Restart camera</button><button type="button" class="btn ghost" data-act="scan.file">Scan from photo</button></div>
      <input id="scanphoto" type="file" accept="image/*" capture="environment" aria-label="Barcode photo" hidden>
      <div class="field"><label for="manualcode">Or type the number under the bars</label><input id="manualcode" data-in="manualcode" inputmode="numeric" autocomplete="off" maxlength="32" placeholder="e.g. 5000000000000"><div class="hint" id="manualhint">8, 12 or 13 digits. The last digit is a check digit, so typos are caught.</div></div>`,
    footer: `<button type="button" class="btn ghost" data-act="scan.search">Search by name</button><button type="button" class="btn primary grow" data-act="scan.lookup">Look up barcode</button>` }) });
}
INPUTS.manualcode = el => {
  const v = el.value.replace(/\D/g, ''), h = $('#manualhint'); if (!h) return;
  if (!v) { h.textContent = '8, 12 or 13 digits. The last digit is a check digit, so typos are caught.'; h.className = 'hint'; return; }
  if (![8, 12, 13, 14].includes(v.length)) { h.textContent = `${v.length} digits so far…`; h.className = 'hint'; return; }
  const ok = gtinValid(v); h.textContent = ok ? 'Check digit is correct.' : 'Check digit does not match. A digit may be mistyped.'; h.className = 'hint ' + (ok ? 'okText' : 'warnText');
};
INPUTS.scanzoom = el => { try { scan.track?.applyConstraints({ advanced: [{ zoom: Number(el.value) }] }); } catch (_) { /* ignore */ } };
ACTIONS['food.scan'] = () => openScanner();
ACTIONS['scan.search'] = () => { openFoodSearch(searchState.meal); };
ACTIONS['scan.file'] = () => $('#scanphoto')?.click();
ACTIONS['scan.lookup'] = () => {
  const raw = ($('#manualcode')?.value || '').replace(/\D/g, ''), code = normaliseBarcode(raw);
  if (!code) { toast('Enter the 8–13 digit barcode'); return; }
  if (!gtinValid(code) && !confirmedBadCheck) { confirmedBadCheck = true; setScanMsg('That barcode’s check digit does not match, so a digit may be mistyped. Tap Look up again to try it anyway.', 'warn'); return; }
  confirmedBadCheck = false; lookupBarcode(code);
};
let confirmedBadCheck = false;
ACTIONS['scan.torch'] = async () => {
  if (!scan.track) return; scan.torch = !scan.torch;
  try { await scan.track.applyConstraints({ advanced: [{ torch: scan.torch }] }); $('#scantorch')?.classList.toggle('on', scan.torch); } catch (_) { scan.torch = false; toast('Torch is not available on this camera'); }
};

ACTIONS['scan.start'] = async () => {
  const video = $('#scanvideo'); if (!video) return;
  await stopScanner(); scan.video = video; scan.tries = 0; scan.started = Date.now(); scan.engines = [];
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('The camera needs an https web address and a supported browser.');
    scan.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 }, advanced: [{ focusMode: 'continuous' }] } });
    if (!$('#scanvideo')) { await stopScanner(); return; }
    video.srcObject = scan.stream; await video.play().catch(() => {});
    scan.track = scan.stream.getVideoTracks()[0];
    const caps = scan.track.getCapabilities ? scan.track.getCapabilities() : {};
    if (caps.torch) { $('#scantorch').hidden = false; }
    if (caps.zoom) { const z = $('#scanzoom'); z.min = caps.zoom.min; z.max = Math.min(caps.zoom.max, 5); z.step = caps.zoom.step || 0.1; const start = clamp(1.6, caps.zoom.min, Math.min(caps.zoom.max, 5)); z.value = start; INPUTS.scanzoom(z); $('#scanzoomwrap').hidden = false; }
    $('#scantools').hidden = !(caps.torch || caps.zoom);
    video.onclick = () => { try { scan.track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (_) { /* ignore */ } setScanMsg('Refocusing…'); setTimeout(() => scan.on && setScanMsg('<b>Scanning.</b> Keep the bars inside the strip.'), 700); };
    const phone = await nativeEngine(); if (phone) scan.engines.push(phone);
    if (!phone) scan.engines.push(await wasmEngine()); else wasmEngine().then(e => { if (scan.on) scan.engines.push(e); }).catch(() => {});
    scan.on = true; scan.locked = false; setScanMsg('<b>Scanning.</b> Keep the bars inside the strip.'); scanTick();
  } catch (err) {
    await stopScanner();
    setScanMsg('Camera unavailable: ' + esc(err?.message || 'permission denied or unsupported') + '. Use <b>Scan from photo</b> or type the number below.', 'warn');
  }
};
async function scanTick() {
  if (!scan.on || !scan.video) return;
  const v = scan.video, sw = v.videoWidth, sh = v.videoHeight;
  if (sw && sh && v.readyState >= 2 && !scan.locked) {
    const engine = scan.engines[scan.tries % scan.engines.length], variant = Math.floor(scan.tries / scan.engines.length) % 5; scan.tries++;
    try {
      const code = await detectIn(engine, v, sw, sh, variant);
      if (code && scan.on && !scan.locked) { scan.locked = true; try { navigator.vibrate?.(60); } catch (_) { /* ignore */ } await stopScanner(); lookupBarcode(code); return; }
    } catch (_) { /* a frame failed to decode; try the next */ }
    if (scan.tries === 60 && scan.on) setScanMsg('Still looking. Move a little closer or further back, tilt away from glare, or switch the torch on. You can also type the number.', 'warn');
  }
  scan.timer = setTimeout(scanTick, 70);
}

/* ---------- photo ---------- */
document.addEventListener('change', async e => {
  if (e.target?.id !== 'scanphoto') return; const file = e.target.files?.[0]; if (!file) return;
  if (!/^image\//.test(file.type)) { toast('Choose a photo of a barcode'); return; }
  setScanMsg('Reading the photo…');
  try {
    await stopScanner(); const bmp = await createImageBitmap(file); const engines = [];
    const phone = await nativeEngine(); if (phone) engines.push(phone); engines.push(await wasmEngine());
    let code = '';
    for (const eng of engines) { for (const variant of [0, 1, 2, 3, 4]) { try { code = await detectIn(eng, bmp, bmp.width, bmp.height, variant); } catch (_) { /* next */ } if (code) break; } if (code) break; }
    if (!code) throw new Error('No readable food barcode in that photo');
    lookupBarcode(code);
  } catch (err) { setScanMsg('Could not read that photo: ' + esc(err?.message || 'unknown error') + '. Try again closer and in good light, or type the number.', 'warn'); }
  finally { e.target.value = ''; }
});

/* ---------- lookup, with saved-by-you products ---------- */
let lastLookup = null;
async function lookupBarcode(raw) {
  const code = normaliseBarcode(raw); if (!code) { toast('Enter a valid 8–14 digit barcode'); return; }
  await stopScanner(); const variants = barcodeVariants(code);
  for (const v of variants) { const cached = data.nutrition.productCache?.[v]; if (cached) { openProductSheet(cached, true, true); return; } }
  lastLookup = { code, name: '', brand: '' };
  replaceSheet({ title: 'Looking up food', eyebrow: 'OPEN FOOD FACTS', render: () => ({ body: `<div class="spinner" role="status" aria-label="Looking up"></div><p class="note center">Checking Open Food Facts for <span class="mono">${esc(code)}</span>… (needs internet)</p>` }) });
  let failure = 'Product not found';
  try {
    for (const v of variants) {
      const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(v)}?cc=gb&lc=en&product_type=food&app_name=VERTFORM&app_version=${APP_VERSION}&fields=${encodeURIComponent(OFF_FIELDS)}`;
      const r = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' });
      if (r.status === 404) continue;
      if (!r.ok) { failure = `Database request failed (${r.status})`; continue; }
      const j = await r.json(); if (!j.product) continue;
      const prod = productFromOff(v, j.product); lastLookup = { code, name: prod.name === 'Scanned food' ? '' : prod.name, brand: prod.brand };
      if (!productHasMacros(prod)) { failure = 'Found in the database, but it has no nutrition values'; continue; }
      data.nutrition.productCache[v] = prod; data.nutrition.productCache[code] = prod; save(); openProductSheet(prod, false, true); return;
    }
  } catch (err) { failure = (!navigator.onLine || /fetch|network|load failed/i.test(err?.message || '')) ? 'offline' : (err.message || 'Unable to look up this barcode'); }
  const offline = failure === 'offline' || !navigator.onLine;
  replaceSheet({ title: 'Not in the database', eyebrow: 'OPEN FOOD FACTS', render: () => ({ body: `<div class="empty"><b>${esc(offline ? 'You appear to be offline, or the food database could not be reached, and this barcode is not saved on this device yet.' : failure)}</b><br><br>${offline ? 'Lookups need internet the first time. Products you have scanned or saved before work offline.' : 'Many supermarket own-brand lines are missing or incomplete. Copy the per-100 g values from the label once and VERTFORM will remember this barcode.'}</div><div class="status">Barcode: <span class="mono">${esc(code)}</span></div>`,
    footer: `<button type="button" class="btn ghost" data-act="food.scan">Scan again</button><button type="button" class="btn primary grow" data-act="own.open" data-arg="${esc(code)}">Add from the label</button>` }) });
}

/* A product the person types in from the pack label, saved against its barcode. */
let own = null;
ACTIONS['own.open'] = el => {
  const code = el.dataset.arg; own = { code, name: lastLookup?.code === code ? lastLookup.name : '', brand: lastLookup?.code === code ? lastLookup.brand : '' };
  replaceSheet({ title: 'Add from the label', eyebrow: 'SAVED TO THIS DEVICE', size: 'tall', render: () => ({
    body: `<p class="note first">Use the <b>per 100 g</b> (or per 100 ml) column on the pack. Next time you scan <span class="mono">${esc(code)}</span> it loads straight away, even offline.</p>
      <div class="field"><label for="ownname">Product name</label><input id="ownname" maxlength="80" placeholder="e.g. Chicken breast fillets" value="${esc(own.name)}"></div>
      <div class="form-row"><div class="field"><label for="ownbrand">Brand (optional)</label><input id="ownbrand" maxlength="60" placeholder="e.g. Aldi" value="${esc(own.brand)}"></div><div class="field"><label for="ownserv">Serving size (g, optional)</label><input id="ownserv" type="number" inputmode="decimal" min="1" max="2000" placeholder="e.g. 125"></div></div>
      <div class="form-row"><div class="field"><label for="ownkcal">Calories per 100 g</label><input id="ownkcal" type="number" inputmode="decimal" min="0" max="900" step="any"></div><div class="field"><label for="ownp">Protein (g)</label><input id="ownp" type="number" inputmode="decimal" min="0" max="100" step="any"></div></div>
      <div class="form-row"><div class="field"><label for="ownc">Carbs (g)</label><input id="ownc" type="number" inputmode="decimal" min="0" max="100" step="any"></div><div class="field"><label for="ownf">Fat (g)</label><input id="ownf" type="number" inputmode="decimal" min="0" max="100" step="any"></div></div>
      <div class="hint">If the label only gives kJ, divide by 4.184 for kcal. Leave calories blank to calculate them from the macros.</div>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="own.save">Save product</button>` }) });
};
ACTIONS['own.save'] = () => {
  const n = ($('#ownname')?.value || '').trim(), num = id => { const v = $('#' + id)?.value; return v === '' || v === undefined ? null : Number(v); };
  const p = num('ownp'), c = num('ownc'), f = num('ownf'); let k = num('ownkcal'), s = num('ownserv');
  if (!n) { toast('Give the product a name'); return; }
  if ([p, c, f].some(x => x === null || !Number.isFinite(x) || x < 0 || x > 100)) { toast('Enter protein, carbs and fat per 100 g (0–100)'); return; }
  if (p + c + f > 105) { toast('Protein + carbs + fat cannot be more than 100 g per 100 g'); return; }
  if (k === null) k = Math.round(p * 4 + c * 4 + f * 9);
  if (!Number.isFinite(k) || k < 0 || k > 900) { toast('Calories per 100 g should be 0–900'); return; }
  if (s !== null && !(s >= 1 && s <= 2000)) s = null;
  const prod = { barcode: own.code, name: n.slice(0, 100), brand: ($('#ownbrand')?.value || '').trim().slice(0, 80), quantity: '', servingSize: s ? s + ' g' : '', servingQuantity: s, image: '', countries: [],
    per100: { kcal: k, protein: p, carbs: c, fat: f }, serving: { kcal: null, protein: null, carbs: null, fat: null }, source: 'Added by you' };
  for (const v of barcodeVariants(own.code)) data.nutrition.productCache[v] = prod;
  save(); openProductSheet(prod, true, true); toast('Saved — this barcode is now remembered');
};

/* =============== My foods: favourite scanned products you can pick quickly =============== */
const favs = () => (data.nutrition.favourites = data.nutrition.favourites || []);
const isFav = key => favs().some(f => f.key === key);
/* Foods you scan or log often (2+ times in 30 days) are suggested until you save or ignore them. */
function frequentScanned() {
  const cut = addDays(todayISO(), -30), c = {};
  for (const e of data.nutrition.entries) if (e.barcode && e.date >= cut) c[e.barcode] = (c[e.barcode] || 0) + 1;
  return Object.entries(c).filter(([k, n]) => n >= 2 && data.nutrition.productCache[k] && !isFav(k)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => ({ key: k, amount: null, unit: null, suggested: true }));
}
const myFoodList = () => [...favs().filter(f => data.nutrition.productCache[f.key]), ...frequentScanned()];
const shortName = s => (s.length > 24 ? s.slice(0, 23) + '…' : s);
function myFoodsChips() {
  const list = myFoodList().slice(0, 8); if (!list.length) return '';
  return `<div class="eyebrow mt">MY FOODS</div><div class="chip-row savedrow" aria-label="My foods">${list.map(f => { const p = data.nutrition.productCache[f.key]; return `<button type="button" class="chip" data-act="fav.open" data-id="${esc(f.key)}" aria-label="${esc(p.name)}${f.suggested ? ' (often scanned)' : ''}">${icon(f.suggested ? 'plus' : 'bookmark')}${esc(shortName(p.name))}</button>`; }).join('')}<button type="button" class="chip" data-act="fav.manage">Manage</button></div>`;
}
function refreshFavBtn() {
  const b = $('#favbtn'); if (!b || !pendingProduct) return; const on = isFav(pendingProduct.barcode);
  b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); b.innerHTML = `${icon('bookmark')}${on ? 'In My foods (tap to remove)' : 'Save to My foods'}`;
}
ACTIONS['fav.toggle'] = () => {
  if (!pendingProduct) return; const key = pendingProduct.barcode;
  if (isFav(key)) { data.nutrition.favourites = favs().filter(f => f.key !== key); toast('Removed from My foods'); }
  else { data.nutrition.productCache[key] = data.nutrition.productCache[key] || pendingProduct; favs().push({ key, amount: Number($('#scanportion')?.value) || null, unit: $('#scanunit')?.value || null }); toast('Saved to My foods'); }
  save(); refreshFavBtn(); render();
};
ACTIONS['fav.open'] = el => {
  const key = el.dataset.id, prod = data.nutrition.productCache[key]; if (!prod) { toast('That food is no longer saved'); return; }
  const f = favs().find(x => x.key === key); openProductSheet(prod, true, sheetOpen(), f && f.amount ? { amount: f.amount, unit: f.unit } : null);
};
ACTIONS['fav.manage'] = () => {
  const paint = () => { const l = myFoodList();
    return { body: l.length ? `<ul class="mlist">${l.map(f => { const p = data.nutrition.productCache[f.key]; return `<li><span class="code sm">${icon('bookmark')}</span><div class="grow"><b>${esc(p.name)}</b><small>${p.brand ? esc(p.brand) + ' · ' : ''}${f.suggested ? 'Scanned often' : (f.amount ? 'Usual: ' + esc(f.amount) + ' ' + esc(f.unit === 'g' ? 'g' : f.unit || '') : 'Saved')}</small></div>${f.suggested ? `<button type="button" class="btn sm ghost" data-act="fav.add" data-id="${esc(f.key)}">Keep</button>` : `<button type="button" class="iconbtn" data-act="fav.remove" data-id="${esc(f.key)}" aria-label="Remove ${esc(p.name)}">${icon('trash')}</button>`}</li>`; }).join('')}</ul><p class="note">Scan a food, then tap <b>Save to My foods</b>. Your usual portion is remembered each time you log it.</p>` : '<div class="empty">Nothing saved yet. Scan a food, then tap <b>Save to My foods</b>.</div>',
      footer: `<button type="button" class="btn primary grow" data-act="sheet.close">Done</button>` }; };
  openSheet({ title: 'My foods', eyebrow: 'QUICK PICKS', size: 'tall', render: paint });
};
ACTIONS['fav.add'] = el => { const key = el.dataset.id; if (!isFav(key)) favs().push({ key, amount: null, unit: null }); save(); refreshSheet(); render(); };
ACTIONS['fav.remove'] = el => { data.nutrition.favourites = favs().filter(f => f.key !== el.dataset.id); save(); refreshSheet(); render(); };
