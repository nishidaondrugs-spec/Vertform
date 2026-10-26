'use strict';
/* VERTFORM 2.9 — Post: a friends-only feed.
   Uses the same device secret as the leaderboard (see friends.js). You can post a short note and optionally attach your latest
   gym session or volleyball session (title, sets, time, effort — never notes, weight or food). Only you and the friends you
   added by code can see a post. Server side: vertform-posts.sql. */

const P_MAX = 280;
let pUi = { compose: false, day: '', rows: null, loading: false, err: '', at: 0, body: '', attach: '', photo: '', video: null, busy: false, stale: false, photoBusy: false, vidBusy: false, vidProg: 0, upMsg: '' };
const pPhotos = {};   /* post id -> JPEG data URL, kept in memory only */

const pErr = m => ({ offline: 'You seem to be offline. Try again when you have signal.', not_installed: 'The feed is not set up yet. Run vertform-posts.sql in Supabase first.',
  unauthorised: 'This device is no longer recognised. Open Leaderboard and rejoin.', rate_limit: 'That is the daily limit. Try again later.',
  too_long: `Keep it to ${P_MAX} characters.`, empty: 'Write something, add a photo or attach a session first.', bad_photo: 'That photo could not be used. Try another one.', bad_video: 'That video could not be used. Try a shorter one.', bad_day: 'Your phone date looks wrong. Check it and try again.', one_media: 'Add a photo or a video, not both.', video_big: 'That video is too large even after shrinking. Try a shorter clip.', video_unsupported: 'This browser cannot prepare videos. Try Chrome or Safari.', not_found: 'That post is gone.', bad_emoji: 'That reaction is not available.', bad_kind: 'Food posts need the food update. Run vertform-food.sql in Supabase, then try again.' }[m] || 'Something went wrong. Try again.');

function pWhen(iso) {
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ---------- what can be attached ---------- */
function pLatest() {
  const since = addDays(todayISO(), -7);
  const by = (a, b) => (b.completedAt || b.createdAt || b.date).localeCompare(a.completedAt || a.createdAt || a.date);
  const gym = data.logs.filter(l => l.completed !== false && l.date >= since).sort(by)[0] || null;
  const vb = data.vb.logs.filter(l => l.date >= since).sort(by)[0] || null;
  return { gym, vb };
}
const VB_KIND = { training: 'Training', match: 'Match', extra: 'Extra session' };
function pMeta(kind) {
  if (kind === 'food') return foodShareMeta(pUi.foodScope || 'day', pUi.foodMeal || 'Lunch');
  const l = pLatest();
  if (kind === 'gym' && l.gym) {
    return wkSummary(l.gym);
  }
  if (kind === 'vb' && l.vb) {
    const v = l.vb;
    return { k: v.kind, d: v.date, min: v.durationMin, rpe: v.rpe, opp: v.kind === 'match' ? String(v.opponent || '').slice(0, 30) : '', res: v.kind === 'match' ? String(v.result || '').slice(0, 20) : '' };
  }
  return null;
}
function pAttachHtml(kind, m) {
  if (!m || kind === 'note') return '';
  if (kind === 'food') return foodAttachHtml(m);
  if (kind === 'jump') {
    const cm = Number(m.cm), prev = Number(m.prev), n = Number(m.n) || 1; if (!(cm > 0)) return '';
    return `<div class="wkcard jpost"><span class="tiny">Standing jump</span><div class="jt-big"><b>${fmt(cm, 1)}</b><span>cm</span>${m.pb ? ' <i class="pbt">PB</i>' : ''}</div><small>${n > 1 ? `Best of ${n} · ` : ''}${prev > 0 ? `${cm - prev >= 0 ? '+' : '−'}${fmt(Math.abs(cm - prev), 1)} cm on previous best` : 'First test'}</small></div>`;
  }
  if (kind === 'gym') {
    const n = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null, list = Array.isArray(m.l) ? m.l.slice(0, 6) : [];
    const stats = [n(m.min) && ['Time', `${n(m.min)} min`], n(m.vol) && ['Volume', `${Math.round(n(m.vol)).toLocaleString('en-GB')} kg`], ['Sets', `${Number(m.s) || 0}`], n(m.pb) && ['PBs', `${n(m.pb)}`]].filter(Boolean);
    return `<div class="wkcard"><b class="wk-t">${esc(m.t)}</b><dl class="wk-stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${list.length ? `<ul class="wk-list">${list.map(r => `<li><span>${esc(r[0])}</span><span>${esc(r[1])}${r[2] ? ' <i class="pbt">PB</i>' : ''}</span></li>`).join('')}</ul>` : `<small>${plural(Number(m.ex) || 0, 'exercise')}${n(m.rpe) ? ` · RPE ${n(m.rpe)}` : ''}</small>`}</div>`;
  }
  const label = VB_KIND[m.k] || 'Volleyball';
  return `<div class="pattach"><span class="pk vb">VB</span><div class="grow min0"><b>${esc(label)}${m.opp ? ` vs ${esc(m.opp)}` : ''}${m.res ? ` · ${esc(m.res)}` : ''}</b><small>${m.min} min${m.rpe ? ` · ${esc(INTENSITY[intensityOfRpe(m.rpe)]?.label || 'RPE ' + m.rpe)}` : ''}</small></div></div>`;
}

/* ---------- loading ---------- */
async function postLoad() {
  const c = lbCfg(); if (!c || pUi.loading) return; pUi.loading = true; pUi.err = '';
  try { const t = todayISO(); pUi.rows = await lbCall('vf_feed', { p_id: c.id, p_secret: c.secret, p_from: addDays(t, -6), p_to: t }); pUi.day = t; Object.keys(rxCache).forEach(k => delete rxCache[k]); }
  catch (e) { pUi.err = pErr(e.message); }
  pUi.at = Date.now(); pUi.loading = false;
  if (ui.page === 'post') { if (document.activeElement?.id === 'pbody') pUi.stale = true; else render(); }
}

/* ---------- page ---------- */
/* 2.20: reactions. The keys are what the server stores; the emoji are only for display. */
const P_REACTS = [['fire', '🔥', 'Fire'], ['laugh', '😂', 'Laugh'], ['vb', '🏐', 'Volleyball'], ['flex', '💪', 'Strong'], ['heart', '❤️', 'Heart'], ['eyes', '👀', 'Eyes']];
function postCard(r) {
  const mine = !!r.mine, reacts = r.reacts || {};
  const who = mine || !r.pid
    ? `<button type="button" class="phlink" data-act="me.open" aria-label="Your profile">${avatarHTML(myLook(), r.nickname)}<span class="grow min0"><b>${esc(r.nickname)}${mine ? ' <i>you</i>' : ''}</b><small>${pWhen(r.created)}</small></span></button>`
    : `<button type="button" class="phlink" data-act="fr.open" data-id="${esc(r.pid)}" aria-label="${esc(r.nickname)}, open profile">${avatarHTML(lookFor(r.pid), r.nickname)}<span class="grow min0"><b>${esc(r.nickname)}</b><small>${pWhen(r.created)}</small></span></button>`;
  const hasMedia = !!(r.photo || r.video);
  /* camera reactions: small round selfies on the post (filled in by rxPaint); text-only posts show them in a row */
  const photoN = Number(reacts.photo) || 0;
  /* reactions always sit in their own row under the post, never over the picture */
  const rx = photoN ? `<div class="rxbubbles rxrow" data-id="${esc(r.id)}" data-n="${photoN}" aria-label="Camera reactions, ${photoN}"></div>` : '';
  /* with a photo or video, the caption sits over the picture (BeReal style); text-only posts show it large */
  const media = hasMedia
    ? `<div class="bmedia">${r.video ? `<video class="pvid" controls playsinline preload="metadata" src="${esc(pVideoUrl(r.video))}#t=0.1"></video>` : `<div class="pphoto" data-id="${esc(r.id)}" role="img" aria-label="Photo in post"></div>`}${r.body ? `<p class="bcap">${esc(r.body)}</p>` : ''}</div>`
    : `${r.body ? `<p class="pbody bbig">${esc(r.body)}</p>` : ''}`;
  /* a friend's post gets the quick camera reaction (BeReal style) */
  const cam = !mine && r.pid ? `<button type="button" class="rcam" data-act="rcam.open" data-id="${esc(r.id)}" aria-label="React with a photo">${icon('camera')}<span>React</span></button>` : '';
  return `<li class="pcard bm ${mine ? 'mine' : ''}">
    <div class="phead">${who}${mine ? `<button type="button" class="iconbtn" data-act="post.del" data-id="${esc(r.id)}" aria-label="Delete this post">${icon('trash')}</button>` : ''}</div>
    ${media}${pAttachHtml(r.kind, r.meta)}${rx}
    <div class="rbar">${cam}<button type="button" class="pcm" data-act="post.comments" data-id="${esc(r.id)}" aria-label="Comments, ${r.comments || 0}">${icon('post')}<b class="mono">${r.comments || ''}</b></button></div></li>`;
}
const P_KINDS = [
  { v: '', name: 'Text', ico: 'post', cls: 'k-txt', sub: () => 'Just words' },
  { v: 'gym', name: 'Gym', ico: 'train', cls: 'k-gym', sub: l => l.gym ? String(templates[l.gym.session]?.title || sName(l.gym.session)) : 'None this week', ok: l => !!l.gym },
  { v: 'vb', name: 'Volleyball', ico: 'ball', cls: 'k-vb', sub: l => l.vb ? `${VB_KIND[l.vb.kind] || 'Session'} · ${l.vb.durationMin} min` : 'None this week', ok: l => !!l.vb },
  { v: 'food', name: 'Food', ico: 'post', cls: 'k-food', sub: () => 'One meal, macros or the day', ok: () => foodsFor(todayISO()).length > 0 }
];
function postComposer() {
  const l = pLatest();
  const tiles = P_KINDS.map(k => { const ok = !k.ok || k.ok(l), on = pUi.attach === k.v;
    return `<button type="button" role="radio" aria-checked="${on}" class="ptile ${k.cls} ${on ? 'on' : ''}" data-act="post.attach" data-arg="${k.v}" ${ok ? '' : 'disabled'}><span class="pti">${icon(k.ico)}</span><b>${k.name}</b><small>${esc(k.sub(l))}</small></button>`; }).join('');
  const prev = pUi.attach ? pAttachHtml(pUi.attach, pMeta(pUi.attach)) : '';
  return `<section class="pcompose"><div class="between"><div class="eyebrow">NEW POST</div><button type="button" class="linkbtn" data-act="post.compose.close">Cancel</button></div><label class="vh" for="pbody">Write a post</label>
    <div class="ptext"><textarea id="pbody" data-in="pbody" rows="3" maxlength="${P_MAX}" placeholder="What did you train today?">${esc(pUi.body)}</textarea><span class="tiny mono pcount" id="pcount">${P_MAX - pUi.body.length}</span></div>
    <div class="eyebrow">ATTACH A SESSION</div>
    <div class="ptiles" role="radiogroup" aria-label="Attach a session">${tiles}</div>
    ${pUi.attach === 'food' ? foodPickHtml() : ''}
    ${prev}
    ${pUi.photo ? `<div class="pthumb"><img src="${pUi.photo}" alt="Your photo"><button type="button" class="pthumbx" data-act="post.photo.clear" aria-label="Remove photo">${icon('close')}</button></div>`
      : pUi.video ? `<div class="pthumb"><video src="${pUi.video.url}" controls playsinline preload="metadata"></video><button type="button" class="pthumbx" data-act="post.video.clear" aria-label="Remove video">${icon('close')}</button><span class="pvmeta mono">${Math.round(pUi.video.blob.size / 1024)} KB</span></div>`
      : pUi.vidBusy ? `<div class="pprep" role="status"><div class="pbar"><i style="width:${Math.round(pUi.vidProg * 100)}%"></i></div><span>Preparing video… ${Math.round(pUi.vidProg * 100)}%</span><button type="button" class="btn sm ghost" data-act="post.video.cancel">Cancel</button></div>`
      : `<div class="pmedia"><button type="button" class="padd" data-act="post.photo.pick" ${pUi.photoBusy ? 'disabled' : ''}>${icon('camera')}<span>${pUi.photoBusy ? 'Preparing…' : 'Photo'}</span></button><button type="button" class="padd vid" data-act="post.video.pick">${icon('play')}<span>Video</span></button></div>`}
    <input type="file" id="pphoto" data-in="pphoto" accept="image/*" hidden>
    <input type="file" id="pvideo" data-in="pvideo" accept="video/*" hidden>
    <button type="button" class="btn primary pgo" data-act="post.send" ${pUi.busy || pUi.photoBusy || pUi.vidBusy ? 'disabled' : ''}>${icon('check')}${pUi.busy ? (pUi.upMsg || 'Posting…') : 'Post'}</button>
    ${pUi.attach || pUi.photo || pUi.video ? '<p class="tiny">Shares the session title, sets, time and effort, and your photo or video, with your friends only. Never your notes, weight or food.</p>' : ''}</section>`;
}
/* shrink a photo to a small JPEG in the browser before it goes anywhere */
async function pShrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 960 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h); bmp.close?.();
  for (const q of [0.74, 0.64, 0.54, 0.44]) { const d = c.toDataURL('image/jpeg', q); if (d.length <= 330000) return d; }
  throw new Error('bad_photo');
}
INPUTS.pphoto = async el => {
  const f = el.files?.[0]; if (!f) return; pUi.body = $('#pbody')?.value ?? pUi.body;
  if (!/^image\//.test(f.type)) { toast('Choose a photo'); return; }
  pUi.photoBusy = true; render();
  try { pUi.photo = await pShrink(f); } catch (_) { toast(pErr('bad_photo')); }
  pUi.photoBusy = false; render();
};
ACTIONS['post.photo.pick'] = () => { pUi.body = $('#pbody')?.value ?? pUi.body; $('#pphoto')?.click(); };
ACTIONS['post.photo.clear'] = () => { pUi.body = $('#pbody')?.value ?? pUi.body; pUi.photo = ''; render(); };


/* ---------- video: shrink on the phone, then upload with a one-time ticket ---------- */
let pVidAbort = false;
const pVidMime = () => ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
async function pVideoPrep(file, onProg) {
  const MAXS = 30, MAXDIM = 640, MAXB = 8 * 1024 * 1024, mime = pVidMime();
  if (!mime || !HTMLCanvasElement.prototype.captureStream) throw new Error('video_unsupported');
  const url = URL.createObjectURL(file), v = document.createElement('video');
  v.src = url; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', '');
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('bad_video')); setTimeout(() => rej(new Error('bad_video')), 15000); });
  if (!v.videoWidth || !v.videoHeight) throw new Error('bad_video');
  const k = Math.min(1, MAXDIM / Math.max(v.videoWidth, v.videoHeight)), w = Math.round(v.videoWidth * k / 2) * 2, h = Math.round(v.videoHeight * k / 2) * 2;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  const limit = Math.min(Number.isFinite(v.duration) ? v.duration : MAXS, MAXS);
  const tracks = [...cv.captureStream(30).getVideoTracks()]; let ac = null;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); const src = ac.createMediaElementSource(v), dst = ac.createMediaStreamDestination(); src.connect(dst); tracks.push(...dst.stream.getAudioTracks()); ac.resume?.(); } catch (_) { ac = null; }
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 1200000, audioBitsPerSecond: 64000 }), chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(res => { rec.onstop = res; });
  const draw = () => { g.drawImage(v, 0, 0, w, h); onProg(Math.min(1, v.currentTime / limit)); };
  rec.start(500);
  try { await v.play(); } catch (_) { v.muted = true; await v.play(); }
  await new Promise(res => {
    const tick = () => { if (pVidAbort || v.ended || v.currentTime >= limit) return res(); draw(); (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick)); };
    v.onended = () => res(); tick(); setTimeout(res, (limit + 10) * 1000);
  });
  v.pause(); if (rec.state !== 'inactive') rec.stop(); await done; try { ac && ac.close(); } catch (_) { /* ignore */ }
  URL.revokeObjectURL(url);
  if (pVidAbort) throw new Error('cancelled');
  const type = mime.split(';')[0], blob = new Blob(chunks, { type });
  if (!blob.size) throw new Error('bad_video'); if (blob.size > MAXB) throw new Error('video_big');
  return { blob, type, url: URL.createObjectURL(blob) };
}
INPUTS.pvideo = async el => {
  const f = el.files?.[0]; el.value = ''; if (!f) return; pUi.body = $('#pbody')?.value ?? pUi.body;
  if (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)) { toast('Choose a video'); return; }
  pVidAbort = false; pUi.vidBusy = true; pUi.vidProg = 0; pUi.photo = ''; render();
  let last = 0;
  try { pUi.video = await pVideoPrep(f, p => { if (p - last >= 0.02) { last = p; pUi.vidProg = p; const b = $('.pprep span'); if (b) b.textContent = `Preparing video… ${Math.round(p * 100)}%`; const i = $('.pbar i'); if (i) i.style.width = Math.round(p * 100) + '%'; } }); }
  catch (e) { if (e.message !== 'cancelled') toast(pErr(e.message === 'video_big' || e.message === 'video_unsupported' ? e.message : 'bad_video')); }
  pUi.vidBusy = false; render();
};
ACTIONS['post.video.pick'] = () => { pUi.body = $('#pbody')?.value ?? pUi.body; $('#pvideo')?.click(); };
ACTIONS['post.video.cancel'] = () => { pVidAbort = true; };
ACTIONS['post.video.clear'] = () => { pUi.body = $('#pbody')?.value ?? pUi.body; if (pUi.video) URL.revokeObjectURL(pUi.video.url); pUi.video = null; render(); };
function pUpload(path, blob, type) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open('POST', `${LB_URL}/storage/v1/object/vf-media/${path}`);
    x.setRequestHeader('apikey', LB_KEY); x.setRequestHeader('Content-Type', type); x.setRequestHeader('x-upsert', 'false'); x.setRequestHeader('cache-control', 'max-age=31536000');
    x.upload.onprogress = e => { if (e.lengthComputable) { pUi.upMsg = `Uploading ${Math.round(e.loaded / e.total * 100)}%`; const b = $('.pgo'); if (b) b.lastChild.textContent = pUi.upMsg; } };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(x.status === 404 || x.status === 400 && /bucket/i.test(x.responseText) ? 'not_installed' : 'bad_video')));
    x.onerror = () => reject(new Error('offline')); x.send(blob);
  });
}
const pVideoUrl = path => `${LB_URL}/storage/v1/object/public/vf-media/${path}`;

/* feed photos load one at a time, only when they scroll near the screen */
let pIO = null, pQueue = [], pFetching = 0;
function pPaint() {
  rxPaint();
  $$('.pphoto[data-id]').forEach(el => {
    const id = el.dataset.id, src = pPhotos[id];
    if (src) { if (!el.firstElementChild) { const im = new Image(); im.alt = 'Photo in post'; im.src = src; im.decoding = 'async'; el.appendChild(im); el.classList.add('ready'); } }
    else if ('IntersectionObserver' in window) { pIO = pIO || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { pIO.unobserve(e.target); pFetch(e.target.dataset.id); } }), { rootMargin: '300px' }); pIO.observe(el); }
    else pFetch(id);
  });
}
async function pFetch(id) {
  if (pPhotos[id] || pQueue.includes(id)) return; pQueue.push(id); pPump();
}
async function pPump() {
  const c = lbCfg(); if (!c) return;
  while (pFetching < 2 && pQueue.length) {
    const id = pQueue.shift(); pFetching++;
    lbCall('vf_photo', { p_id: c.id, p_secret: c.secret, p_post: id }).then(d => { if (typeof d === 'string' && d.startsWith('data:image/')) pPhotos[id] = d; }).catch(() => {})
      .finally(() => { pFetching--; if (ui.page === 'post') pPaint(); pPump(); });
  }
}

const pDayLabel = (d, today) => d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday' : `${weekdayShort(d)} ${parseDate(d).getDate()}`;
function pHero(todayRows) {
  const friends = new Set(todayRows.filter(r => !r.mine).map(r => r.pid || r.nickname)).size, mine = todayRows.filter(r => r.mine).length;
  const sub = friends ? `${plural(friends, 'friend')} posted today` : 'No friends have posted yet';
  return `<button type="button" class="phero" data-act="post.compose"><span class="phorb" aria-hidden="true">${icon('plus')}</span><span class="phtx"><b>${mine ? 'Post again' : 'Post today'}</b><small>${sub}</small></span>${icon('chev')}</button>`;
}
function viewPost() {
  const c = lbCfg(), today = todayISO();
  const right = `<div class="phbtns"><button type="button" class="btn sm ghost" data-act="lb.open">Leaderboard</button></div>`;
  if (!c) return `${pageHead('', 'Post', right)}${banners()}
    <div class="goalcard"><b>See what your friends are training</b><p class="tiny">Posts are visible only to you and friends you add by code. Choose a nickname, swap codes, and your feed starts here. No account or email needed.</p>
    <button type="button" class="btn primary" data-act="lb.open">Set up friends</button></div>`;
  if (!pUi.loading && (pUi.rows === null || pUi.day !== today || Date.now() - pUi.at > 90000)) setTimeout(postLoad, 0);
  setTimeout(pPaint, 0);
  const rows = pUi.rows || [], isToday = r => (r.day || today) === today;
  const todayRows = rows.filter(isToday), earlier = rows.filter(r => !isToday(r));
  const days = [...new Set(earlier.map(r => r.day))].sort().reverse();
  const nothingYet = pUi.rows !== null && !rows.length;
  return `${pageHead('', 'Post', right)}${banners()}
    ${pUi.compose ? postComposer() : pHero(todayRows)}
    <div class="sechead"><div class="min0"><div class="eyebrow">TODAY</div><h2>Friends and you</h2></div><button type="button" class="btn sm ghost" data-act="post.refresh" ${pUi.loading ? 'disabled' : ''}>${pUi.loading ? 'Loading…' : 'Refresh'}</button></div>
    ${pUi.err ? `<div class="status warn" role="alert">${esc(pUi.err)}</div>` : ''}
    ${todayRows.length ? `<ul class="pfeed">${todayRows.map(postCard).join('')}</ul>` : `<p class="tiny">${pUi.rows === null ? 'Loading your feed…' : 'Nothing posted today yet. Be the first.'}</p>`}
    ${nothingYet || (pUi.rows && rows.every(r => r.mine)) ? `<div class="goalcard"><p class="tiny">Add a friend with their code to see their posts here.</p><button type="button" class="btn ghost" data-act="lb.open">Add a friend</button></div>` : ''}
    ${days.length ? `<details class="explain earlier"><summary><span>Earlier this week</span><b class="mono">${earlier.length}</b></summary>${days.map(d => `<div class="eyebrow pday">${esc(pDayLabel(d, today).toUpperCase())}</div><ul class="pfeed">${earlier.filter(r => r.day === d).map(postCard).join('')}</ul>`).join('')}</details>` : ''}`;
}

/* ---------- actions ---------- */
INPUTS.pbody = el => { pUi.body = el.value.slice(0, P_MAX); const n = $('#pcount'); if (n) n.textContent = P_MAX - pUi.body.length; };
ACTIONS['post.compose'] = () => { pUi.compose = true; render(); setTimeout(() => $('#pbody')?.focus(), 60); };
ACTIONS['post.compose.close'] = () => { pUi.body = $('#pbody')?.value ?? pUi.body; pUi.compose = false; render(); };
ACTIONS['post.attach'] = el => { pUi.attach = pUi.attach === el.dataset.arg && el.dataset.arg ? '' : el.dataset.arg; pUi.body = $('#pbody')?.value ?? pUi.body; render(); };
ACTIONS['post.refresh'] = () => { pUi.at = 0; pUi.rows = pUi.rows; postLoad(); render(); };
ACTIONS['post.send'] = async () => {
  const c = lbCfg(); if (!c || pUi.busy) return;
  pUi.body = ($('#pbody')?.value ?? pUi.body).trim().slice(0, P_MAX);
  const kind = pUi.attach || 'note', meta = kind === 'note' ? {} : pMeta(kind);
  if (kind !== 'note' && !meta) { toast('Nothing to attach yet'); return; }
  if (!pUi.body && kind === 'note' && !pUi.photo && !pUi.video) { toast(pErr('empty')); return; }
  pUi.busy = true; render();
  try {
    let vpath = null;
    if (pUi.video) { const t = await lbCall('vf_media_ticket', { p_id: c.id, p_secret: c.secret, p_ext: pUi.video.type === 'video/mp4' ? 'mp4' : 'webm' }); pUi.upMsg = 'Uploading 0%'; render(); await pUpload(t.path, pUi.video.blob, pUi.video.type); vpath = t.path; }
    const r = await lbCall('vf_post_create', { p_id: c.id, p_secret: c.secret, p_body: pUi.body, p_kind: kind, p_meta: meta, p_photo: pUi.photo || null, p_video: vpath, p_day: todayISO() });
    (r?.purged || []).forEach(f => fetch(`${LB_URL}/storage/v1/object/vf-media/${f}`, { method: 'DELETE', headers: { apikey: LB_KEY } }).catch(() => {}));
    if (pUi.photo && r?.id) pPhotos[r.id] = pUi.photo;
    if (pUi.video) URL.revokeObjectURL(pUi.video.url); pUi.body = ''; pUi.attach = ''; pUi.photo = ''; pUi.video = null; pUi.upMsg = ''; pUi.compose = false; pUi.busy = false; pUi.err = ''; toast('Posted'); pUi.loading = false; pUi.at = 0; await postLoad();
  } catch (e) { pUi.busy = false; pUi.upMsg = ''; pUi.err = pErr(e.message); render(); }
};
/* one reaction per person: the same one again removes it, another one swaps it. Updates at once, then checks with the server. */
ACTIONS['post.react'] = async el => {
  const c = lbCfg(), r = (pUi.rows || []).find(x => x.id === el.dataset.id), k = el.dataset.arg; if (!c || !r || !k) return;
  const was = { mine: r.myreact || null, reacts: { ...(r.reacts || {}) } }, next = { ...was.reacts };
  if (was.mine) next[was.mine] = Math.max(0, (next[was.mine] || 0) - 1);
  if (was.mine !== k) next[k] = (next[k] || 0) + 1;
  r.myreact = was.mine === k ? null : k; r.reacts = next; render();
  try { const j = await lbCall('vf_react', { p_id: c.id, p_secret: c.secret, p_post: r.id, p_emoji: k }); r.myreact = j.mine || null; r.reacts = j.reacts || {}; }
  catch (e) { r.myreact = was.mine; r.reacts = was.reacts; toast(pErr(e.message)); }
  render();
};
ACTIONS['post.del'] = async el => {
  const c = lbCfg(); if (!c) return;
  const ok = await askChoice({ title: 'Delete this post?', message: '<p>It disappears for you and your friends.</p>', choices: [{ label: 'Cancel', value: false }, { label: 'Delete', kind: 'primary', value: true }] });
  if (!ok) return;
  try { const vp = await lbCall('vf_post_delete', { p_id: c.id, p_secret: c.secret, p_post: el.dataset.id }); if (typeof vp === 'string' && vp) fetch(`${LB_URL}/storage/v1/object/vf-media/${vp}`, { method: 'DELETE', headers: { apikey: LB_KEY } }).catch(() => {}); pUi.rows = (pUi.rows || []).filter(x => x.id !== el.dataset.id); render(); toast('Post deleted'); }
  catch (e) { toast(pErr(e.message)); }
};

/* ---------- comments ---------- */
let pcUi = { id: null, rows: null, body: '', busy: false, err: '' };
const pcPost = () => (pUi.rows || []).find(x => x.id === pcUi.id);
ACTIONS['post.comments'] = el => {
  const r = (pUi.rows || []).find(x => x.id === el.dataset.id); if (!r) return;
  pcUi = { id: r.id, rows: null, body: '', busy: false, err: '' };
  openSheet({ title: 'Comments', eyebrow: `${String(r.nickname || '').toUpperCase()}'S POST`, size: 'tall', render: renderComments }); pcLoad();
};
async function pcLoad() {
  const c = lbCfg(); if (!c || !pcUi.id) return;
  try { pcUi.rows = await lbCall('vf_comments', { p_id: c.id, p_secret: c.secret, p_post: pcUi.id }); pcUi.err = ''; const r = pcPost(); if (r) r.comments = pcUi.rows.length; }
  catch (e) { pcUi.err = pErr(e.message); if (pcUi.rows === null) pcUi.rows = []; }
  if (topSheet()?.title === 'Comments') refreshSheet();
  if (ui.page === 'post' || ui.page === 'friend') { if (document.activeElement?.id !== 'pbody') render(); }
}
function renderComments() {
  const r = pcPost(), rows = pcUi.rows;
  /* BeReal style: the post's picture (if it has one) and caption sit at the top, then the replies as a chat */
  const thumb = r && (r.photo || r.video) ? (document.querySelector(`.pphoto[data-id="${r.id}"] img`)?.getAttribute('src') || '') : '';
  const snippet = r ? `<div class="bcsnip">${thumb ? `<img class="bcthumb" src="${thumb}" alt="">` : `<span class="bcthumb ph" aria-hidden="true">${icon(r.video ? 'play' : 'post')}</span>`}<div class="bcsn-tx"><b>${esc(r.nickname)}</b><p>${r.body ? esc(r.body.length > 140 ? r.body.slice(0, 140) + '…' : r.body) : (r.photo ? 'Photo' : r.video ? 'Video' : 'Session')}</p></div></div>` : '';
  const list = rows === null ? '<p class="note">Loading…</p>' : rows.length ? `<ul class="bclist" aria-label="Replies">${rows.map(c => `<li class="bcrow ${c.mine ? 'mine' : ''}">${avatarHTML(lookFor(c.pid, c.mine), c.nickname, 'sm')}<div class="bcbub"><div class="bch"><b>${esc(c.nickname)}${c.mine ? ' <i>you</i>' : ''}</b><small>${pWhen(c.created)}</small></div><p>${esc(c.body)}</p></div>${c.mine || (r && r.mine) ? `<button type="button" class="bcdel" data-act="post.comment.del" data-id="${esc(c.id)}" aria-label="Delete comment">${icon('trash')}</button>` : ''}</li>`).join('')}</ul>` : '<p class="note bcempty">No replies yet. Say something about this.</p>';
  return { body: `${snippet}${pcUi.err ? `<div class="status warn" role="alert">${esc(pcUi.err)}</div>` : ''}${list}`,
    footer: `<div class="bcin">${avatarHTML(myLook(), lbCfg()?.nick || 'You', 'sm')}<input id="pcbody" data-in="pcbody" maxlength="200" autocomplete="off" enterkeyhint="send" placeholder="Reply to ${esc(r ? r.nickname : 'this post')}…" aria-label="Add a comment" value="${esc(pcUi.body)}"><button type="button" class="bcsend" data-act="post.comment.send" ${pcUi.busy ? 'disabled' : ''} aria-label="Send comment">${icon('chev')}</button></div>` };
}
INPUTS.pcbody = el => { pcUi.body = el.value.slice(0, 200); };
ACTIONS['post.comment.send'] = async () => {
  const c = lbCfg(); if (!c || pcUi.busy) return; pcUi.body = ($('#pcbody')?.value ?? pcUi.body).trim(); if (!pcUi.body) return;
  pcUi.busy = true; refreshSheet();
  try { await lbCall('vf_comment_add', { p_id: c.id, p_secret: c.secret, p_post: pcUi.id, p_body: pcUi.body }); pcUi.body = ''; pcUi.err = ''; pcUi.busy = false; await pcLoad(); setTimeout(() => $('#pcbody')?.focus(), 50); }
  catch (e) { pcUi.busy = false; pcUi.err = pErr(e.message); refreshSheet(); }
};
ACTIONS['post.comment.del'] = async el => {
  const c = lbCfg(); if (!c) return;
  try { await lbCall('vf_comment_delete', { p_id: c.id, p_secret: c.secret, p_comment: el.dataset.id }); await pcLoad(); }
  catch (e) { toast(pErr(e.message)); }
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'pcbody') { e.preventDefault(); ACTIONS['post.comment.send'](); } });

/* ---------- camera reactions (2.20): open the camera, take a selfie, send it as your reaction on a friend's post ---------- */
let rcUi = { id: null, facing: 'user', stream: null, shot: '', busy: false };
function rcStop() { try { rcUi.stream?.getTracks().forEach(t => t.stop()); } catch (_) { /* ignore */ } rcUi.stream = null; }
function rcSquare(src, w, h, mirror) {
  const side = Math.min(w, h), size = Math.min(480, side), c = document.createElement('canvas');
  c.width = c.height = size; const g = c.getContext('2d');
  g.save(); if (mirror) { g.translate(size, 0); g.scale(-1, 1); }
  g.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size); g.restore();
  for (const q of [0.72, 0.6, 0.5, 0.4]) { const d = c.toDataURL('image/jpeg', q); if (d.length <= 180000) return d; }
  return '';
}
function rcRender() {
  let el = $('#rcam');
  if (!el) { el = document.createElement('div'); el.id = 'rcam'; el.className = 'rcam-ov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Camera reaction'); document.body.appendChild(el); }
  const r = (pUi.rows || []).find(x => x.id === rcUi.id), who = r ? esc(r.nickname) : '', live = !rcUi.shot;
  el.innerHTML = `<div class="rcam-top"><button type="button" class="rcam-x" data-act="rcam.close" aria-label="Close">${icon('close')}</button><span class="rcam-who">React to ${who}</span>${live ? '<button type="button" class="rcam-x" data-act="rcam.flip" aria-label="Switch camera">Flip</button>' : '<span></span>'}</div>
    <div class="rcam-stage">${live
      ? `<video id="rcamv" autoplay playsinline muted class="${rcUi.facing === 'user' ? 'mir' : ''}"></video><input type="file" id="rcamfile" accept="image/*" capture="user" hidden data-in="rcamfile">`
      : `<img src="${rcUi.shot}" alt="Your reaction">`}</div>
    <div class="rcam-bar">${live
      ? `<button type="button" class="rcam-pick" data-act="rcam.pick" aria-label="Choose a photo instead">Photo</button><button type="button" class="rcam-shut" data-act="rcam.shot" aria-label="Take photo"></button><span class="rcam-pick" aria-hidden="true"></span>`
      : `<button type="button" class="btn ghost" data-act="rcam.retake">Retake</button><a class="btn ghost" href="${rcUi.shot}" download="vertform-reaction.jpg">Save</a><button type="button" class="btn primary" data-act="rcam.send" ${rcUi.busy ? 'disabled' : ''}>${rcUi.busy ? 'Sending…' : 'Send reaction'}</button>`}</div>`;
  const v = $('#rcamv'); if (v && rcUi.stream) { v.muted = true; v.srcObject = rcUi.stream; v.play().catch(() => {}); }
}
function rcFallback() { rcRender(); toast('Camera not available here. Choose a photo instead.'); }
async function rcStart() {
  rcStop();
  if (!navigator.mediaDevices?.getUserMedia) { rcFallback(); return; }
  try { rcUi.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: rcUi.facing, width: { ideal: 720 }, height: { ideal: 720 } }, audio: false }); rcRender(); }
  catch (_) { rcFallback(); }
}
ACTIONS['rcam.open'] = el => {
  const r = (pUi.rows || []).find(x => x.id === el.dataset.id); if (!r || r.mine) return;
  rcUi = { id: r.id, facing: 'user', stream: null, shot: '', busy: false };
  rcRender(); rcStart();
};
ACTIONS['rcam.close'] = () => { rcStop(); $('#rcam')?.remove(); rcUi = { id: null, facing: 'user', stream: null, shot: '', busy: false }; };
ACTIONS['rcam.shot'] = () => {
  const v = $('#rcamv'); if (!v || !v.videoWidth) return;
  const shot = rcSquare(v, v.videoWidth, v.videoHeight, rcUi.facing === 'user');
  if (!shot) { toast('Try that again'); return; }
  rcUi.shot = shot; rcStop(); rcRender();
};
ACTIONS['rcam.flip'] = () => { rcUi.facing = rcUi.facing === 'user' ? 'environment' : 'user'; rcStart(); };
ACTIONS['rcam.retake'] = () => { rcUi.shot = ''; rcStart(); };
ACTIONS['rcam.pick'] = () => $('#rcamfile')?.click();
INPUTS.rcamfile = async el => {
  const f = el.files?.[0]; el.value = ''; if (!f) return;
  if (!/^image\//.test(f.type)) { toast('Choose a photo'); return; }
  let shot = ''; try { const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); shot = rcSquare(bmp, bmp.width, bmp.height, false); bmp.close?.(); } catch (_) { /* unreadable */ }
  if (!shot) { toast(pErr('bad_photo')); return; }
  rcUi.shot = shot; rcStop(); rcRender();
};
ACTIONS['rcam.send'] = async () => {
  const c = lbCfg(); if (!c || !rcUi.shot || rcUi.busy) return;
  rcUi.busy = true; rcRender(); const id = rcUi.id;
  try {
    const j = await lbCall('vf_react_photo', { p_id: c.id, p_secret: c.secret, p_post: id, p_photo: rcUi.shot });
    const r = (pUi.rows || []).find(x => x.id === id); if (r) { r.myreact = 'photo'; r.reacts = j.reacts || {}; }
    delete rxCache[id];
    rcStop(); $('#rcam')?.remove(); rcUi = { id: null, facing: 'user', stream: null, shot: '', busy: false };
    toast('Reaction sent'); render();
  } catch (e) { rcUi.busy = false; toast(pErr(e.message)); rcRender(); }
};

/* the camera reactions on one post */
let rpUi = { rows: null };
async function rpLoad(id) {
  const c = lbCfg(); if (!c) return;
  try { rpUi.rows = await lbCall('vf_react_photos', { p_id: c.id, p_secret: c.secret, p_post: id }); }
  catch (e) { rpUi.rows = []; toast(pErr(e.message)); }
  if (topSheet()?.title === 'Camera reactions') refreshSheet();
}
ACTIONS['react.photos'] = el => {
  rpUi = { rows: null };
  openSheet({ title: 'Camera reactions', size: 'tall', render: () => ({
    body: rpUi.rows === null ? '<p class="note">Loading…</p>'
      : rpUi.rows.length ? `<div class="rplist">${rpUi.rows.map(x => `<figure class="rpit"><img src="${x.img}" alt="${esc(x.nickname)}'s reaction"><figcaption>${esc(x.nickname)}${x.mine ? ' <i>you</i>' : ''}</figcaption>${x.mine ? `<a class="btn ghost sm rpsave" href="${x.img}" download="vertform-reaction-${new Date(x.created).toISOString().slice(0, 10)}.jpg">Save to phone</a>` : ''}</figure>`).join('')}</div>`
        : '<p class="note">No camera reactions yet.</p>',
    footer: '<button type="button" class="btn ghost" data-act="sheet.close">Close</button>' }) });
  rpLoad(el.dataset.id);
};

/* ---------- camera reaction bubbles (2.20.2): the newest few selfies show on the post, like BeReal ---------- */
const rxCache = {}; const rxQ = []; let rxBusy = 0;
function rxPaint() {
  $$('.rxbubbles[data-id]').forEach(el => {
    const id = el.dataset.id, n = Number(el.dataset.n) || 0;
    if (!n) { el.innerHTML = ''; return; }
    if (rxCache[id]) el.innerHTML = rxHTML(rxCache[id], n, id);
    else if (!rxQ.includes(id)) { rxQ.push(id); rxPump(); }
  });
}
function rxHTML(list, n, id) {
  const shown = list.slice(0, 3), more = n - shown.length;
  return shown.map(x => `<button type="button" class="rxb" data-act="react.photos" data-id="${esc(id)}" aria-label="${esc(x.nickname)}, camera reaction"><img src="${x.img}" alt=""></button>`).join('')
    + (more > 0 ? `<button type="button" class="rxb more" data-act="react.photos" data-id="${esc(id)}" aria-label="${more} more camera reactions">+${more}</button>` : '');
}
function rxPump() {
  const c = lbCfg(); if (!c) return;
  while (rxBusy < 2 && rxQ.length) {
    const id = rxQ.shift(); rxBusy++;
    lbCall('vf_react_photos', { p_id: c.id, p_secret: c.secret, p_post: id }).then(l => { rxCache[id] = Array.isArray(l) ? l : []; }).catch(() => { rxCache[id] = []; })
      .finally(() => { rxBusy--; rxPaint(); rxPump(); });
  }
}

/* ---------- share food (2.24): a meal, today's macros, or the full day. You pick what is shared. ---------- */
function foodShareMeta(scope, meal) {
  const day = todayISO(); let list = foodsFor(day);
  if (scope === 'meal') list = list.filter(f => f.meal === meal);
  if (!list.length) return null;
  const t = list.reduce((a, f) => { a.kcal += Number(f.kcal) || 0; a.p += Number(f.protein) || 0; a.c += Number(f.carbs) || 0; a.f += Number(f.fat) || 0; return a; }, { kcal: 0, p: 0, c: 0, f: 0 });
  const r = v => Math.round(v);
  const out = { sc: scope, t: scope === 'meal' ? meal : scope === 'day' ? 'Full day' : 'Today', d: day, kcal: r(t.kcal), p: r(t.p), c: r(t.c), f: r(t.f) };
  if (scope !== 'macros') out.n = list.slice(0, 12).map(x => [String(x.name || '').slice(0, 30), r(Number(x.kcal) || 0)]);
  return out;
}
function foodAttachHtml(m) {
  const r = v => Math.round(Number(v) || 0), items = Array.isArray(m.n) ? m.n.slice(0, 12) : [];
  const what = m.sc === 'meal' ? 'Meal' : m.sc === 'day' ? 'Full day' : 'Macros';
  return `<div class="wkcard fpost"><span class="tiny">${esc(what)} · ${esc(m.t)}</span>
    <div class="fp-macros"><div><b>${r(m.kcal)}</b><small>kcal</small></div><div><b>${r(m.p)}g</b><small>protein</small></div><div><b>${r(m.c)}g</b><small>carbs</small></div><div><b>${r(m.f)}g</b><small>fat</small></div></div>
    ${items.length ? `<ul class="wk-list">${items.map(x => `<li><span>${esc(x[0])}</span><span>${r(x[1])} kcal</span></li>`).join('')}</ul>` : ''}</div>`;
}
function foodPickHtml() {
  const sc = pUi.foodScope || 'day', meal = pUi.foodMeal || 'Lunch';
  const opt = (v, n) => `<button type="button" class="chip ${sc === v ? 'on' : ''}" data-act="post.food" data-arg="${v}" aria-pressed="${sc === v}">${n}</button>`;
  return `<div class="eyebrow">WHAT TO SHARE</div><div class="chip-row">${opt('macros', 'Today’s macros')}${opt('meal', 'One meal')}${opt('day', 'Full day')}</div>
    ${sc === 'meal' ? `<div class="chip-row">${MEALS.map(x => `<button type="button" class="chip ${meal === x ? 'on' : ''}" data-act="post.food.meal" data-arg="${x}" aria-pressed="${meal === x}">${x}</button>`).join('')}</div>` : ''}
    <p class="tiny">Friends see only the numbers and food names you pick here. Your targets, weight and notes stay private.</p>`;
}
ACTIONS['post.food'] = el => { pUi.body = $('#pbody')?.value ?? pUi.body; pUi.foodScope = el.dataset.arg; render(); };
ACTIONS['post.food.meal'] = el => { pUi.body = $('#pbody')?.value ?? pUi.body; pUi.foodMeal = el.dataset.arg; render(); };
