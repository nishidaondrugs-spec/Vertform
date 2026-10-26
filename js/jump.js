'use strict';
/* VERTFORM 2.17 — standing jump test from video (flight time), jump tracker and sharing.
   Height = g·t²/8 from the time between take-off and landing frames. The video never leaves the phone;
   only the number is saved (as a standing CMJ measurement) and, if you choose, shared. */

const JT_G = 9.81, JT_FPS = [24, 25, 30, 48, 50, 60, 90, 100, 120, 240];
let jt = null;
const jtNew = () => ({ step: 'pick', url: '', fps: 30, fpsSure: false, slow: 1, slowGuess: 0, t0: null, t1: null, dur: 0, attempts: jt?.attempts || [] });
const round1 = v => Math.round(v * 10) / 10;
const jtFlight = () => jt && jt.t0 !== null && jt.t1 !== null && jt.t1 > jt.t0 ? (jt.t1 - jt.t0) / jt.slow : null;
const jtHeight = t => t ? JT_G * t * t / 8 * 100 : null;
const jumpBest = () => { const v = entriesOf('cmj').map(e => Number(e.value)).filter(Number.isFinite); return v.length ? Math.max(...v) : null; };

function openJumpTest() {
  jt = jtNew(); jt.attempts = [];
  openSheet({ title: 'Standing jump test', size: 'tall', render: renderJT, onClose: () => { if (jt?.url) URL.revokeObjectURL(jt.url); jt = null; } });
}
function renderJT() {
  const tries = jt.attempts.length ? `<div class="jt-tries"><span class="tiny">This session</span>${jt.attempts.map((a, i) => `<b class="${a === Math.max(...jt.attempts) ? 'best' : ''}">${fmt(a, 1)}<small> cm</small></b>`).join('')}</div>` : '';
  const shareBox = typeof lbCfg === 'function' && lbCfg() ? `<label class="sharetog"><input type="checkbox" id="jtshare" ${data.settings.shareJumpPost === false ? '' : 'checked'}><span>Share to friends</span></label>` : '';
  if (jt.step === 'pick') return {
    body: `${tries}<ol class="jt-steps">
        <li>Prop the phone on the floor 2–3 m away, side-on, with your feet in shot.</li>
        <li>Use <b>slow-motion</b> if your camera has it. It's much more accurate.</li>
        <li>Hands on hips, dip and jump straight up.</li>
        <li>Land on your toes with straight legs, then bend.</li></ol>
      <div class="jt-pick"><label class="btn primary">${icon('camera')}Record a jump<input type="file" accept="video/*" capture="environment" data-in="jtfile" hidden></label>
      <label class="btn ghost">Choose a video<input type="file" accept="video/*" data-in="jtfile" hidden></label></div>
      <p class="tiny">The video stays on your phone. Only the height is saved.</p>`,
    footer: jt.attempts.length ? `${shareBox}<button type="button" class="btn ghost" data-act="sheet.close">Discard</button><button type="button" class="btn primary grow" data-act="jt.save">Save best (${fmt(Math.max(...jt.attempts), 1)} cm)</button>`
      : `<button type="button" class="btn ghost grow" data-act="jt.manual">Type a result instead</button>` };
  return {
    body: `<div class="jt-video"><video id="jtv" src="${jt.url}" playsinline muted preload="auto"></video></div>
      <input id="jtr" class="jt-range" type="range" min="0" max="${jt.dur || 1}" step="any" value="0" data-in="jtr" aria-label="Scrub through the video">
      <div class="jt-frames" role="group" aria-label="Step through frames">
        <button type="button" class="btn ghost" data-act="jt.step" data-arg="-5" aria-label="Back 5 frames">−5</button><button type="button" class="btn ghost" data-act="jt.step" data-arg="-1" aria-label="Back 1 frame">−1</button>
        <span class="jt-time mono" id="jttime">0.000 s</span>
        <button type="button" class="btn ghost" data-act="jt.step" data-arg="1" aria-label="Forward 1 frame">+1</button><button type="button" class="btn ghost" data-act="jt.step" data-arg="5" aria-label="Forward 5 frames">+5</button></div>
      <div class="jt-marks"><button type="button" class="jt-mark" id="jtm0" data-act="jt.mark" data-arg="0"><span>Take-off</span><b>Last frame on the floor</b></button><button type="button" class="jt-mark" id="jtm1" data-act="jt.mark" data-arg="1"><span>Landing</span><b>First frame back down</b></button></div>
      <div id="jtres" class="jt-res" aria-live="polite"></div>
      <div class="jt-meta"><label class="tiny">Frame rate <select id="jtfpssel" data-in="jtfps" aria-label="Video frame rate">${JT_FPS.map(f => `<option value="${f}" ${f === jt.fps ? 'selected' : ''}>${f} fps</option>`).join('')}</select></label><span class="tiny" id="jtfps"></span><span class="jt-slow" role="group" aria-label="Slow-motion speed">${[[1, 'Normal'], [4, 'Slow-mo ×4'], [8, 'Slow-mo ×8']].map(([k, n]) => `<button type="button" class="chip ${jt.slow === k ? 'on' : ''}" data-act="jt.slow" data-arg="${k}">${n}</button>`).join('')}</span></div>`,
    footer: `<button type="button" class="btn ghost" data-act="jt.back">Back</button><button type="button" class="btn primary grow" id="jtadd" data-act="jt.add" disabled>Add this jump</button>` };
}
/* only paint the parts that change, so the video keeps its position */
function jtPaint() {
  const v = $('#jtv'); if (!v || !jt) return;
  $('#jttime').textContent = `${v.currentTime.toFixed(3)} s`; const r = $('#jtr'); if (r && document.activeElement !== r) r.value = v.currentTime;
  [0, 1].forEach(i => { const t = i ? jt.t1 : jt.t0, b = $('#jtm' + i); if (!b) return; b.classList.toggle('set', t !== null); b.querySelector('b').textContent = t !== null ? `${t.toFixed(3)} s` : i ? 'First frame back down' : 'Last frame on the floor'; });
  $$('.jt-slow .chip').forEach(c => c.classList.toggle('on', Number(c.dataset.arg) === jt.slow));
  $('#jtfps').textContent = `${jt.fps} fps video${jt.fpsSure ? '' : ' (guessed)'}`;
  const fsel = $('#jtfpssel'); if (fsel && fsel.value !== String(jt.fps)) fsel.value = String(jt.fps);
  const t = jtFlight(), h = jtHeight(t), res = $('#jtres'), add = $('#jtadd'); let html = '', ok = false;
  if (jt.t0 !== null && jt.t1 !== null && jt.t1 <= jt.t0) html = '<p class="tiny warnText">Landing has to come after take-off.</p>';
  else if (h !== null) {
    if (jt.slow === 1 && jt.slowGuess) html = `<p class="tiny">${fmt(h, 0)} cm isn't possible, so this looks like a slow-motion video. <button type="button" class="linkbtn" data-act="jt.slow" data-arg="${jt.slowGuess}">Use slow-mo ×${jt.slowGuess}</button></p>`;
    else if (h < 5 || h > 120) html = `<p class="tiny warnText">${fmt(h, 1)} cm looks wrong. Check the take-off and landing frames, or the slow-motion setting.</p>`;
    else { ok = true; const err = jtHeight(t + 1 / jt.fps / jt.slow) - h; html = `<div class="jt-big"><b>${fmt(h, 1)}</b><span>cm</span></div><p class="tiny">Air time ${(t * 1000).toFixed(0)} ms · one frame either way is about ±${fmt(err, 1)} cm${err > 2 ? '. Slow-motion would make this sharper' : ''}.</p>`; }
  } else html = '<p class="tiny">Step to the last frame where your toes touch the floor and tap Take-off. Then find the first frame they touch again and tap Landing.</p>';
  res.innerHTML = html; if (add) add.disabled = !ok;
}
function jtGuessSlow() {
  jt.slowGuess = 0; const raw = jt.t0 !== null && jt.t1 > jt.t0 ? jt.t1 - jt.t0 : null; if (!raw || jt.slow !== 1 || jtHeight(raw) <= 120) return;
  jt.slowGuess = [8, 4, 2].find(k => { const h = jtHeight(raw / k); return h >= 8 && h <= 100; }) || 0;
}
/* Frame rate: watch a few frames go by and take the median gap (requestVideoFrameCallback), else assume 30 */
function jtDetectFps(v) {
  if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) { jtPaint(); return; }
  const ts = []; let done = false;
  const finish = () => { if (done) return; done = true; v.pause(); const d = ts.slice(1).map((t, i) => t - ts[i]).filter(x => x > 0).sort((a, b) => a - b);
    if (d.length >= 4) { const f = 1 / d[Math.floor(d.length / 2)]; jt.fps = JT_FPS.reduce((a, b) => Math.abs(b - f) < Math.abs(a - f) ? b : a); jt.fpsSure = true; }
    v.currentTime = 0; jtPaint(); };
  const cb = (_, m) => { if (done) return; ts.push(m.mediaTime); if (ts.length >= 16) finish(); else v.requestVideoFrameCallback(cb); };
  v.requestVideoFrameCallback(cb); v.play().catch(finish); setTimeout(finish, 2500);
}
INPUTS.jtfile = (el, e) => {
  const f = el.files?.[0]; if (!f || !jt || el._jtFile === f) return; el._jtFile = f;
  if (jt.url) URL.revokeObjectURL(jt.url);
  Object.assign(jt, jtNew(), { attempts: jt.attempts, step: 'mark', url: URL.createObjectURL(f) }); refreshSheet();
  const v = $('#jtv'); if (!v) return;
  v.addEventListener('loadedmetadata', () => { jt.dur = v.duration || 0; const r = $('#jtr'); if (r) r.max = jt.dur; if (!v.videoWidth) { const res = $('#jtres'); if (res) res.innerHTML = '<p class="tiny warnText">This phone&rsquo;s browser can&rsquo;t show this video. Try Samsung Internet or Firefox, or film at 1080p 60 fps and use that clip.</p>'; return; } jtDetectFps(v); }, { once: true });
  v.addEventListener('error', () => { const r = $('#jtres'); if (r) r.innerHTML = '<p class="tiny warnText">This video can\'t be read in this browser. Try Safari, or film in standard 1080p 30 or 60 fps and try again.</p>'; }, { once: true });
  v.addEventListener('seeked', jtPaint); v.addEventListener('timeupdate', jtPaint);
};
INPUTS.jtfps = el => { jt.fps = Number(el.value); jt.fpsSure = true; jtPaint(); };
INPUTS.jtr = el => { const v = $('#jtv'); if (v) { v.pause(); v.currentTime = Number(el.value); } };
ACTIONS['jt.step'] = el => { const v = $('#jtv'); if (!v) return; v.pause(); const d = jt.dur || v.duration; v.currentTime = clamp(v.currentTime + Number(el.dataset.arg) / jt.fps, 0, Number.isFinite(d) && d > 0 ? d : 1e6); };
ACTIONS['jt.mark'] = el => { const v = $('#jtv'); if (!v) return; jt[el.dataset.arg === '1' ? 't1' : 't0'] = v.currentTime; jtGuessSlow(); jtPaint(); };
ACTIONS['jt.slow'] = el => { jt.slow = Number(el.dataset.arg); jtGuessSlow(); jtPaint(); };
ACTIONS['jt.back'] = () => { if (jt.url) URL.revokeObjectURL(jt.url); Object.assign(jt, jtNew(), { attempts: jt.attempts }); refreshSheet(); };
ACTIONS['jt.add'] = () => { const h = jtHeight(jtFlight()); if (!h || h < 5 || h > 120) return; jt.attempts.push(round1(h)); jt.lastFps = jt.fps * jt.slow; ACTIONS['jt.back'](); toast(`${fmt(h, 1)} cm added. Do 2–3 jumps and the best counts.`); };
ACTIONS['jt.manual'] = () => { closeSheet(); ACTIONS['ms.add']({ dataset: { arg: 'cmj' } }); };
ACTIONS['jt.save'] = () => {
  if (!jt?.attempts.length) return; const best = Math.max(...jt.attempts), prev = jumpBest(), share = !!$('#jtshare')?.checked;
  if ($('#jtshare')) data.settings.shareJumpPost = share;
  data.metrics.push({ id: uid(), date: todayISO(), key: 'cmj', value: best, method: 'video', attempts: [...jt.attempts] });
  save(); const n = jt.attempts.length; closeSheet(); render();
  const pb = prev === null || best > prev;
  toast(pb && prev !== null ? `New best: ${fmt(best, 1)} cm` : `Saved ${fmt(best, 1)} cm`);
  if (typeof lbSync === 'function') lbSync(true);
  if (share) shareJump({ cm: best, n, pb: pb && prev !== null ? 1 : 0, prev: prev !== null ? round1(prev) : null });
};
async function shareJump(meta) {
  const c = typeof lbCfg === 'function' && lbCfg(); if (!c) return;
  try {
    await lbCall('vf_post_create', { p_id: c.id, p_secret: c.secret, p_body: '', p_kind: 'jump', p_meta: meta, p_photo: null, p_video: null, p_day: todayISO() });
    if (typeof pUi !== 'undefined') pUi.at = 0;
  } catch (e) { toast(e.message === 'bad_kind' ? 'Saved. To share jumps, run the updated vertform-posts.sql first.' : `Saved, but not shared: ${typeof pErr === 'function' ? pErr(e.message) : e.message}`); }
}
ACTIONS['jt.open'] = () => openJumpTest();

/* =============== tracker (Training log → Jump) =============== */
function jumpChart(rows) {
  if (rows.length < 2) return '';
  const W = 320, H = 140, L = 34, R = 10, T = 12, B = 22, vs = rows.map(r => r.v);
  let lo = Math.min(...vs), hi = Math.max(...vs); const step = [1, 2, 5, 10].find(s => s * 2 >= Math.max(hi - lo, 2) / 1.4) || 10; lo = Math.max(0, Math.floor(lo / step) * step); hi = Math.ceil(hi / step) * step; if (hi === lo) hi += step;
  const x = i => L + (W - L - R) * i / (rows.length - 1), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  return `<figure class="pchart" aria-label="Standing jump over ${rows.length} tests, from ${fmt(vs[0], 1)} to ${fmt(vs.at(-1), 1)} cm"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <g class="pc-grid">${[hi, (hi + lo) / 2, lo].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v, 1)}</text>`).join('')}</g>
    <path class="pc-line" d="${rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.v).toFixed(1)}`).join('')}"/><g class="pc-dots">${rows.map((r, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(r.v).toFixed(1)}" r="${i === rows.length - 1 ? 4.5 : 3}"><title>${esc(pretty(r.d))}: ${fmt(r.v, 1)} cm</title></circle>`).join('')}</g>
    <text class="pc-x" x="${L}" y="${H - 5}">${esc(pretty(rows[0].d))}</text><text class="pc-x" x="${W - R}" y="${H - 5}" text-anchor="end">${esc(pretty(rows.at(-1).d))}</text></svg></figure>`;
}
function trainJump() {
  const all = entriesOf('cmj').filter(e => Number(e.value) > 0), best = jumpBest(), last = all.at(-1);
  const head = `<div class="quick"><button type="button" class="btn primary" data-act="jt.open">${icon('camera')}Jump test</button><button type="button" class="btn ghost" data-act="ms.add" data-arg="cmj">Type a result</button></div>`;
  if (!all.length) return `${head}${emptyBox('Film a standing jump and tap the take-off and landing frames. VERTFORM works out the height from your time in the air.')}`;
  const first = Number(all[0].value), diff = Number(last.value) - first, yr = todayISO().slice(0, 4);
  return `<section class="jcard"><div><span class="tiny">Best standing jump</span><b>${fmt(best, 1)}<small> cm</small></b></div><div class="jc-side"><span class="tiny">Latest</span><b>${fmt(Number(last.value), 1)} cm</b>${all.length > 1 ? `<span class="pc-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '+' : ''}${fmt(diff, 1)} cm since ${esc(pretty(all[0].date))}</span>` : ''}</div></section>
    ${jumpChart(all.map(e => ({ d: e.date, v: Number(e.value) })))}${head}
    <ul class="hist2 jlist">${[...all].reverse().slice(0, 30).map(e => `<li><button type="button" class="jl-row" data-act="ms.edit" data-id="${esc(e.id)}"><span class="h-d">${esc(e.date.slice(0, 4) === yr ? pretty(e.date) : prettyY(e.date))}${e.method === 'video' ? ' · video' : ''}</span><span class="h-s">${fmt(Number(e.value), 1)} cm${Number(e.value) === best ? ' <i class="pbt">Best</i>' : ''}${e.attempts?.length > 1 ? ` <small class="tiny">best of ${e.attempts.length}</small>` : ''}</span></button></li>`).join('')}</ul>`;
}
