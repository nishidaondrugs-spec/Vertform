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
