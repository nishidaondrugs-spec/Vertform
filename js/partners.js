/* Training partners: "trained with" on a workout, counted per person (stored on-device only) */
function partnerStats() {
  const m = new Map();
  for (const l of data.logs) { if (l.completed === false) continue; for (const n of cleanWith(l.with)) { const k = n.toLowerCase(), r = m.get(k) || { name: n, n: 0, last: '' }; r.n++; if (l.date > r.last) { r.last = l.date; r.name = n; } m.set(k, r); } }
  return [...m.values()].sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1));
}
function withRow(w) {
  const p = cleanWith(w.with);
  return `<div class="field"><label>Trained with</label><button type="button" class="btn ghost full wkwith" data-act="wk.with">${icon('plus')}${p.length ? esc(p.join(', ')) : 'Add a training partner'}</button></div>`;
}
function withNames() {
  const mine = new Set(), out = [];
  const add = n => { n = String(n || '').trim(); const k = n.toLowerCase(); if (n && !mine.has(k)) { mine.add(k); out.push(n); } };
  partnerStats().forEach(r => add(r.name));
  (lbUi?.rows || []).filter(r => !r.me).forEach(r => add(r.nickname));
  return out;
}
let withDraftName = '';
ACTIONS['wk.with'] = () => openSheet({ title: 'Trained with', eyebrow: 'TRAINING PARTNERS', render: () => {
  const w = data.draft || {}, sel = cleanWith(w.with), selK = new Set(sel.map(s => s.toLowerCase()));
  const names = [...new Set([...sel, ...withNames()])];
  return { body: `<p class="note">Tap who you trained with. Each saved workout adds one to their count. Only you see this.</p>
    <div class="wkchips">${names.length ? names.map(n => `<button type="button" class="chip ${selK.has(n.toLowerCase()) ? 'on' : ''}" aria-pressed="${selK.has(n.toLowerCase())}" data-act="wkw.t" data-arg="${esc(n)}">${esc(n)}</button>`).join('') : '<span class="tiny">No one yet. Add a name below.</span>'}</div>
    <div class="field"><label for="wkwname">Add someone</label><div class="inline"><input id="wkwname" data-in="wkwname" maxlength="20" autocomplete="off" placeholder="Name" value="${esc(withDraftName)}"><button type="button" class="btn primary" data-act="wkw.add">Add</button></div></div>`,
    footer: `<button type="button" class="btn primary grow" data-act="wkw.done">Done</button>` };
} });
INPUTS.wkwname = el => { withDraftName = el.value; };
ACTIONS['wkw.t'] = el => {
  const w = data.draft; if (!w) return; const n = el.dataset.arg, k = n.toLowerCase(), cur = cleanWith(w.with);
  w.with = cur.some(x => x.toLowerCase() === k) ? cur.filter(x => x.toLowerCase() !== k) : cleanWith([...cur, n]); saveSoon(); refreshSheet();
};
ACTIONS['wkw.add'] = () => {
  const w = data.draft; const n = (withDraftName || $('#wkwname')?.value || '').trim().slice(0, 20); if (!w || !n) return;
  w.with = cleanWith([...(w.with || []), n]); withDraftName = ''; saveSoon(); refreshSheet();
};
ACTIONS['wkw.done'] = () => { withDraftName = ''; closeSheet(); refreshSheet(); };
function partnersCard() {
  const s = partnerStats(); if (!s.length) return '';
  return `<div class="ysec"><div class="yhead"><div class="yeye">TRAINING PARTNERS</div>${s.length > 3 ? '<button type="button" class="ylink" data-act="partners.all">See all</button>' : ''}</div><div class="yrows">${s.slice(0, 3).map(r => `<div class="yrow"><span class="yn">${esc(r.name)}</span><span class="ys">${r.n} ${r.n === 1 ? 'session' : 'sessions'}</span></div>`).join('')}</div></div>`;
}
ACTIONS['partners.all'] = () => openSheet({ title: 'Training partners', render: () => ({ body: `<ul class="hist2">${partnerStats().map(r => `<li><span>${esc(r.name)}</span><span class="h-s">${r.n} ${r.n === 1 ? 'session' : 'sessions'} · last ${esc(pretty(r.last))}</span></li>`).join('')}</ul>`, footer: `<button type="button" class="btn primary grow" data-act="sheet.close">Done</button>` }) });

/* =============== tag friends on a workout, and "Log yours" for the people tagged =============== */
let finishTags = [];
function tagPickHtml() {
  const names = (typeof lbUi !== 'undefined' && lbUi.rows || []).filter(r => !r.me && r.nickname).map(r => String(r.nickname)).slice(0, 12);
  if (!names.length) return '';
  return `<div class="field"><label>Tag friends <span class="tiny">${finishTags.length ? finishTags.length + ' tagged' : 'optional'}</span></label><div class="tagrow">${names.map(n => `<button type="button" class="chip ${finishTags.includes(n) ? 'on' : ''}" aria-pressed="${finishTags.includes(n)}" data-act="wk.tag" data-arg="${esc(n)}">${esc(n)}</button>`).join('')}</div><p class="tiny">They get a nudge and a button to log the same session with their own numbers.</p></div>`;
}
ACTIONS['wk.tag'] = el => {
  const n = el.dataset.arg, i = finishTags.indexOf(n); if (i >= 0) finishTags.splice(i, 1); else if (finishTags.length < 8) finishTags.push(n);
  refreshSheet();
};
const tagMe = m => { const me = String(data.settings.lb?.nick || '').toLowerCase(); return !!me && Array.isArray(m?.tg) && m.tg.some(x => String(x).toLowerCase() === me); };
const tagLogged = m => data.logs.some(l => l.completed && l.date === m.d);
function logYoursHtml(r) {
  const m = r.meta; if (r.mine || r.kind !== 'gym' || !m || !m.t || !tagMe(m) || tagLogged(m)) return '';
  return `<div class="logyours"><span>Tagged in this one. Did yours?</span><button type="button" class="btn primary" data-act="post.logyours" data-id="${esc(r.id)}">Log yours</button></div>`;
}
ACTIONS['post.logyours'] = async el => {
  const r = (pUi.rows || []).find(x => String(x.id) === el.dataset.id), m = r && r.meta; if (!m || !m.t) return;
  const date = isISO(m.d) && m.d <= todayISO() ? m.d : todayISO(), nick = String(r.nickname || '').slice(0, 20);
  const k = Object.keys(templates).find(x => !(data.mySessions.some(s => s.key === x && s.deleted)) && String(templates[x]?.title || '').toLowerCase() === String(m.t).toLowerCase() && allExercises(x).length);
  if (k) await startWorkout(k, date);
  else {
    const list = Array.isArray(m.l) ? m.l : []; if (!list.length) { toast('Nothing to copy from this post. Log it from Train'); return; }
    const key = adhocKey(); if (!key) { toast('You already have 12 sessions of your own. Delete one first'); return; }
    if (data.draft && !await askConfirm({ title: 'You have an unfinished workout', message: `<p>${esc(sName(data.draft.session))} from ${esc(pretty(data.draft.date))} is still open. Starting this will discard it.</p>`, confirmLabel: 'Discard it and start', cancelLabel: 'Cancel', danger: true })) return;
    const exs = list.slice(0, 12).map(x => {
      const t = String(x[1] || ''), sets = Math.min(10, Math.max(1, parseInt(t, 10) || 3)), reps = (t.match(/×\s*(\d+)/) || [])[1] || '8', load = /kg/.test(t);
      const e = { id: 'day-' + uid(), name: String(x[0]).slice(0, 40), sets, reps, unit: 'reps', load, hint: '', optional: false, rest: 0, dist: '' };
      const ld = load ? String(latestLoad(e, date)) : '';
      return { ...e, sets: Array.from({ length: sets }, () => ({ load: ld, reps: parseReps(reps), done: false })) };
    });
    data.draft = { id: uid(), date, session: key, completed: false, startedAt: new Date().toISOString(), rpe: '', notes: '', exercises: exs };
    wkIndex = 0; save(); showWorkout();
  }
  if (nick && data.draft && data.draft.date === date && !data.draft.completed) { data.draft.with = cleanWith([...(data.draft.with || []), nick]); saveSoon(); }
};

/* ---- tag friends on a post you already made ---- */
let ptagUi = { id: '', sel: [] };
ACTIONS['post.opts'] = async el => {
  const r = (pUi.rows || []).find(x => x.id === el.dataset.id); if (!r) return;
  if (!lbUi.rows) { toast('Loading your friends…'); await lbLoad(); }
  const friends = (lbUi.rows || []).filter(f => !f.me && f.nickname);
  const c = await askChoice({ title: 'Your post', message: '', choices: [
    ...(friends.length ? [{ label: 'Tag friends', kind: 'primary', value: 'tag' }] : []),
    { label: 'Delete post', kind: 'critical', value: 'del' }, { label: 'Cancel', kind: 'ghost', value: null }] });
  if (c === 'del') return ACTIONS['post.del'](el);
  if (c !== 'tag') return;
  const body = String(r.body || '').toLowerCase();
  ptagUi = { id: r.id, sel: friends.map(f => String(f.nickname)).filter(n => (Array.isArray(r.meta?.tg) ? r.meta.tg : []).some(t => String(t).toLowerCase() === n.toLowerCase()) || body.includes('@' + n.toLowerCase())) };
  openSheet({ title: 'Tag friends', eyebrow: 'ON THIS POST', render: () => ({ body: `<div class="tagrow">${friends.map(f => { const n = String(f.nickname), on = ptagUi.sel.includes(n); return `<button type="button" class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-act="ptag.t" data-arg="${esc(n)}">${esc(n)}</button>`; }).join('')}</div><p class="tiny">${r.kind === 'gym' ? 'Tagged friends get a "Log yours" button on this workout. ' : ''}Tags added now do not send a notification.</p>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="ptag.save">Save tags</button>` }) });
};
ACTIONS['ptag.t'] = el => { const n = el.dataset.arg, i = ptagUi.sel.indexOf(n); if (i >= 0) ptagUi.sel.splice(i, 1); else if (ptagUi.sel.length < 8) ptagUi.sel.push(n); refreshSheet(); };
ACTIONS['ptag.save'] = async () => {
  const c = lbCfg(), r = (pUi.rows || []).find(x => x.id === ptagUi.id); if (!c || !r) return;
  try {
    await lbCall('vf_post_tag', { p_id: c.id, p_secret: c.secret, p_post: r.id, p_tags: ptagUi.sel });
    ptagUi.sel.forEach(n => { if (!String(r.body || '').toLowerCase().includes('@' + n.toLowerCase())) r.body = (String(r.body || '') + ' @' + n).trim().slice(0, 280); });
    if (r.meta && r.meta.t) r.meta = { ...r.meta, tg: ptagUi.sel.slice() };
    closeAllSheets(); render(); toast(ptagUi.sel.length ? 'Tags saved' : 'Tags cleared');
  } catch (e) { toast(typeof pErr === 'function' ? pErr(e.message) : e.message); }
};

/* "Noshida with Ravi, Sam" on the post header */
function postWith(r) {
  const tg = Array.isArray(r?.meta?.tg) ? r.meta.tg : []; if (!tg.length) return '';
  const me = String(data.settings.lb?.nick || '').toLowerCase();
  const names = tg.slice(0, 4).map(n => String(n).toLowerCase() === me ? 'you' : esc(String(n))), more = tg.length - names.length;
  return ` <span class="pwith">with ${names.join(', ')}${more > 0 ? ` +${more}` : ''}</span>`;
}
