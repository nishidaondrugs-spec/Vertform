'use strict';
/* VERTFORM 2.6 — friends & weekly leaderboard.
   Online, no login: each device creates a random secret, the server keeps only its hash. Friends join by a 6-character code.
   Only these are shared: nickname, gym sessions this week, your own weekly target, target-streak, volleyball sessions, best jump (optional).
   Never body weight, food or notes. Tables are locked; the app can only call the vf_* functions in vertform-friends.sql. */

const LB_URL = VF_CONFIG.url, LB_KEY = VF_CONFIG.key;
const lbCfg = () => data.settings.lb;
let lbUi = { tab: 'week', rows: null, loading: false, err: '', nick: '', code: '', at: 0, syncAt: 0, syncedHash: '', busy: false };

async function lbCall(fn, body) {
  let r;
  try { r = await fetch(`${LB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: LB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (_) { throw new Error('offline'); }
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (_) { /* keep null */ }
  if (!r.ok) { const m = j?.message || ''; throw new Error(/relation|function .* does not exist|schema cache|Could not find/i.test(m) ? 'not_installed' : m || 'failed'); }
  return j;
}
const lbErrText = m => ({ offline: 'You seem to be offline. Try again when you have signal.', not_installed: 'The friends tables are not set up yet. Run vertform-friends.sql in Supabase first.', not_found: 'No one has that code. Check it and try again.', self: 'That is your own code.', bad_nick: 'Pick a nickname of 2 to 20 characters.', unauthorised: 'This device is no longer recognised. Leave and rejoin to get a new code.' }[m] || 'Something went wrong. Try again in a moment.');

/* ---------- your best lifts (estimated 1RM, Epley), shared only if you allow it ---------- */
const liftKey = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function lbLifts() {
  const m = new Map();
  data.logs.filter(l => l.completed !== false).forEach(l => (l.exercises || []).forEach(e => {
    if (!e.load) return; const k = liftKey(e.name); if (!k) return;
    const o = m.get(k) || { n: String(e.name).trim().slice(0, 30), k: 0, w: 0, r: 0, c: 0 }; let seen = false;
    (e.sets || []).forEach(s => {
      const w = parseFloat(s.load), r = parseFloat(s.reps);
      if (!s.done || s.wu || !(w > 0 && w <= 600) || !(r >= 1 && r <= 12)) return;
      seen = true; const est = r === 1 ? w : w * (1 + r / 30); if (est > o.k) { o.k = est; o.w = w; o.r = Math.round(r); }
    });
    if (seen) { o.c++; m.set(k, o); }
  }));
  return [...m.values()].sort((a, b) => b.c - a.c || b.k - a.k).slice(0, 12).map(o => ({ n: o.n, k: Math.round(o.k * 2) / 2, w: Math.round(o.w * 2) / 2, r: o.r }));
}
const lbSharesLifts = () => lbCfg()?.shareLifts !== false;

/* ---------- what gets shared ---------- */
function lbStats() {
  const today = todayISO(), mon = monday(today), target = activeSessions().length;
  const gymWeek = m => data.logs.filter(l => l.completed !== false && l.date >= m && l.date < addDays(m, 7)).length;
  const vbWeek = data.vb.logs.filter(l => l.date >= mon && l.date < addDays(mon, 7)).length;
  const sessions = gymWeek(mon);
  let streak = 0;
  for (let i = sessions >= target ? 0 : 1; i < 520; i++) { const m = addDays(mon, -7 * i); if (m < addDays(monday(data.user.startDate || today), -7 * 52)) break; if (gymWeek(m) >= target) streak++; else break; }
  const cm = entriesOf('cmj').map(e => Number(e.value)).filter(Number.isFinite), aj = latestMetric('approachJump');
  const best = cm.length ? Math.max(...cm) : null; void aj;
  return { week: mon, sessions: Math.min(14, sessions), target, vb: Math.min(14, vbWeek), streak, jump: data.settings.shareJump === false || best === null || best < 5 || best > 150 ? null : Math.round(best * 10) / 10, lifts: lbSharesLifts() ? lbLifts() : [] };
}
async function lbSync(force) {
  const c = lbCfg(); if (!c || lbUi.busy) return;
  const s = lbStats(), h = JSON.stringify(s);
  if (!force && h === lbUi.syncedHash && Date.now() - lbUi.syncAt < 30 * 60e3) return;
  lbUi.busy = true;
  const body = { p_id: c.id, p_secret: c.secret, p_week: s.week, p_sessions: s.sessions, p_target: s.target, p_vb: s.vb, p_streak: s.streak, p_jump: s.jump };
  try { try { await lbCall('vf_sync', { ...body, p_lifts: s.lifts }); } catch (e) { if (e.message !== 'not_installed') throw e; await lbCall('vf_sync', body); /* lifts SQL not run yet */ } lbUi.syncedHash = h; lbUi.syncAt = Date.now(); }
  catch (e) { if (e.message === 'unauthorised') { lbUi.err = lbErrText('unauthorised'); lbUi.stale = true; } }
  finally { lbUi.busy = false; }
}
/* Called from render(): quietly keeps your stats current after you log a session. Cheap and throttled. */
let lbAutoAt = 0;
function lbAuto() { if (!lbCfg() || Date.now() - lbAutoAt < 4000) return; lbAutoAt = Date.now(); lbSync(false); if (typeof lookSyncOnce === 'function') lookSyncOnce(); }

/* repaint wherever the board is showing: the Friends sheet, the Leaderboard page or a friend's profile */
function lbRepaint() {
  const t = topSheet(); if (t) { if (t.title === 'Friends') refreshSheet(); return; }
  if (ui.page === 'board' || ui.page === 'friend') render();
}
async function lbLoad() {
  const c = lbCfg(); if (!c) return; lbUi.loading = true; lbUi.err = ''; lbRepaint();
  try { await lbSync(true); lbUi.rows = await lbCall('vf_board', { p_id: c.id, p_secret: c.secret }); lbUi.at = Date.now(); }
  catch (e) { lbUi.err = lbErrText(e.message); }
  lbUi.loading = false; lbRepaint();
}

/* ---------- board ---------- */
const TABS_LB = [['week', 'This week'], ['vb', 'Volleyball'], ['jump', 'Jump']];
const fireTag = n => n > 0 ? `<span class="lbfire" title="${n} week streak" aria-label="${n} week streak"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="#ff8a3d" d="M12 2c1 4-2 5-2 8a3 3 0 0 0 6 0c0-1-.5-2-1-3 3 2 5 5 5 8a8 8 0 0 1-16 0c0-4 3-6 4-9 .5 1 1 1.5 2 1.5 0-2 0-4 2-5.5z"/></svg><b>${n}</b></span>` : '';
function lbRowsFor(tab) {
  const cur = monday(todayISO()), rows = (lbUi.rows || []).map(r => ({ ...r, s: r.week === cur ? r.sessions : 0, v: r.week === cur ? r.vb : 0, streakNow: r.week && daysBetween(r.week, cur) <= 7 ? r.streak : 0 }));
  const key = { week: r => r.s + (r.target ? Math.min(r.s / r.target, 1) / 10 : 0), streak: r => r.streakNow, jump: r => r.jump ?? -1, vb: r => r.v }[tab];
  return rows.sort((a, b) => key(b) - key(a) || a.nickname.localeCompare(b.nickname));
}
const lbVal = (r, tab) => tab === 'week' ? `<b class="mono">${r.s}</b><small>${r.target ? `of ${r.target}` : 'sessions'}</small>` : tab === 'streak' ? `<b class="mono">${r.streakNow}</b><small>${r.streakNow === 1 ? 'week' : 'weeks'}</small>` : tab === 'jump' ? (r.jump != null ? `<b class="mono">${fmt(r.jump, 1)}</b><small>cm</small>` : '<b class="dim">–</b><small>not shared</small>') : `<b class="mono">${r.v}</b><small>${r.v === 1 ? 'session' : 'sessions'}</small>`;
function lbHeadline(rows, tab) {
  if (rows.length < 2) return 'Add a friend with their code to start a board.';
  const top = rows[0], val = tab === 'week' ? top.s : tab === 'streak' ? top.streakNow : tab === 'vb' ? top.v : top.jump;
  if (!val) return tab === 'jump' ? 'No jumps shared yet.' : 'Nobody has logged anything yet. Be first.';
  const me = rows.findIndex(r => r.me);
  return top.me ? `You lead${rows[1] && (tab === 'week' ? rows[1].s : 0) === val ? ' (tied)' : ''}. Keep it up.` : `${top.nickname} leads. You are ${me + 1}${['st', 'nd', 'rd'][me] || 'th'}.`;
}
function renderLb() {
  const c = lbCfg();
  if (!c) return { body: `<p class="note">Compare your week with friends. Create a nickname, get a 6-character code, and swap codes with the people you train with.</p>
    <div class="tip"><b>What friends can see:</b> your nickname, gym sessions this week against your own target, your streak of weeks hitting it, volleyball sessions, your best lifts and best standing jump (you can turn those off), and any posts you write. <b>Never</b> your weight or notes. Food only when you choose to share it.</div>
    ${typeof acctOn === 'function' && acctOn() && !signedIn() ? `<button type="button" class="btn primary" data-act="acct.in">Sign in to bring back your profile</button><p class="tiny center">or start a new one</p>` : ''}
    <div class="field"><label for="lbnick">Nickname</label><input id="lbnick" data-in="lbnick" maxlength="20" autocomplete="off" placeholder="2 to 20 characters" value="${esc(lbUi.nick)}"></div>
    ${lbUi.err ? `<div class="status warn" role="alert">${esc(lbUi.err)}</div>` : ''}`, footer: `<button type="button" class="btn primary block" data-act="lb.join">Create my friend code</button>` };
  const rows = lbRowsFor(lbUi.tab);
  return { body: `<div class="lbcode"><div><div class="eyebrow">YOUR FRIEND CODE</div><b class="mono lbc">${esc(c.code)}</b></div><div class="quick"><button type="button" class="btn sm ghost" data-act="lb.share">${icon('upload')}Share</button><button type="button" class="btn sm ghost" data-act="lb.copy">Copy</button></div></div>
    <div class="seg lbtabs" role="tablist">${TABS_LB.map(([k, l]) => `<button type="button" role="tab" aria-selected="${lbUi.tab === k}" class="${lbUi.tab === k ? 'on' : ''}" data-act="lb.tab" data-arg="${k}">${l}</button>`).join('')}</div>
    ${lbUi.err ? `<div class="status warn" role="alert">${esc(lbUi.err)}</div>` : ''}
    ${lbUi.stale ? `<button type="button" class="btn primary block" data-act="lb.reset">Start again with a new code</button>` : ''}
    ${lbUi.rows === null ? `<p class="note">${lbUi.loading ? 'Loading…' : 'Pull to refresh with the button below.'}</p>` : `<p class="tiny lbhead">${esc(lbHeadline(rows, lbUi.tab))}</p>
    <ol class="lbrows">${rows.map((r, i) => `<li class="lbrow ${r.me ? 'me' : ''}"><span class="lbrank mono">${i + 1}</span>${avatarHTML(r.me ? myLook() : r.look, r.nickname, 'sm')}${r.me ? `<button type="button" class="lbname lbtap" data-act="me.open"><span class="lbnrow"><span class="lbn">${esc(r.nickname)}</span><span class="tag slate">YOU</span>${fireTag(r.streakNow)}</span></button>` : `<button type="button" class="lbname lbtap" data-act="fr.open" data-id="${esc(r.id)}" aria-label="${esc(r.nickname)}, open profile"><span class="lbnrow"><span class="lbn">${esc(r.nickname)}</span>${fireTag(r.streakNow)}</span><small>Profile ${icon('chev')}</small></button>`}<span class="lbval">${lbVal(r, lbUi.tab)}</span>${r.me ? '' : `<button type="button" class="iconbtn lbx" data-act="lb.remove" data-id="${esc(r.id)}" data-arg="${esc(r.nickname)}" aria-label="Remove ${esc(r.nickname)}">${icon('close')}</button>`}</li>`).join('')}</ol>`}
    <div class="field"><label for="lbcode">Add a friend</label><div class="inline"><input id="lbcode" data-in="lbcode" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="Their code" value="${esc(lbUi.code)}"><button type="button" class="btn primary" data-act="lb.add">Add</button></div></div>
    <p class="tiny">You both need to add each other's code.</p>
    <details class="explain"><summary>Settings</summary>
      <label class="switch"><span>Share my best lifts with friends</span><input type="checkbox" data-in="lbshare" ${lbSharesLifts() ? 'checked' : ''}></label>
      <label class="switch"><span>Share my best standing jump</span><input type="checkbox" data-in="lbjump" ${data.settings.shareJump === false ? '' : 'checked'}></label>
      <div class="quick"><button type="button" class="btn sm ghost" data-act="lb.rename">Change nickname (${esc(c.nick)})</button><button type="button" class="btn sm ghost warnText" data-act="lb.leave">Leave &amp; delete my data</button></div></details>`,
    footer: `<button type="button" class="btn ghost block" data-act="lb.refresh">${lbUi.loading ? 'Refreshing…' : 'Refresh'}</button>` };
}
function openFriends() { lbUi.err = ''; openSheet({ title: 'Friends', eyebrow: 'LEADERBOARD', size: 'tall', render: renderLb }); if (lbCfg()) lbLoad(); }
ACTIONS['lb.open'] = openFriends;
/* the leaderboard as its own page (home orb) */
function viewBoard() { const s = renderLb(); return `${pageHead('', 'Leaderboard')}<div class="lbpage">${s.body}</div>${s.footer ? `<div class="lbpagefoot">${s.footer}</div>` : ''}`; }
ACTIONS['board.open'] = () => { lbUi.err = ''; go('board'); if (lbCfg()) lbLoad(); };
INPUTS.lbnick = el => { lbUi.nick = el.value; };
INPUTS.lbcode = el => { lbUi.code = el.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (el.value !== lbUi.code) el.value = lbUi.code; };
INPUTS.lbshare = el => { if (lbCfg()) { lbCfg().shareLifts = el.checked; save(); lbSync(true).then(lbLoad); } };
ACTIONS['lb.tab'] = el => { lbUi.tab = el.dataset.arg; lbRepaint(); };
ACTIONS['lb.refresh'] = () => lbLoad();
function lbSecret() { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); }
ACTIONS['lb.join'] = async () => {
  const nick = (lbUi.nick || '').trim(); if (nick.length < 2 || nick.length > 20) { lbUi.err = lbErrText('bad_nick'); lbRepaint(); return; }
  lbUi.err = ''; const secret = lbSecret();
  try { const r = await lbCall('vf_join', { p_nick: nick, p_secret: secret }); data.settings.lb = { id: r.id, secret, nick, code: r.code, shareLifts: true }; save(); lbUi.rows = null; lbUi.syncedHash = ''; lbRepaint(); lbLoad(); toast('You are on the board'); }
  catch (e) { lbUi.err = lbErrText(e.message); lbRepaint(); }
};
ACTIONS['lb.add'] = async () => {
  const c = lbCfg(), code = lbUi.code.trim(); if (!c || code.length !== 6) { lbUi.err = lbErrText('not_found'); lbRepaint(); return; }
  try { const r = await lbCall('vf_add_friend', { p_id: c.id, p_secret: c.secret, p_code: code }); lbUi.code = ''; toast(`${r.nickname} added`); lbLoad(); }
  catch (e) { lbUi.err = lbErrText(e.message); lbRepaint(); }
};
ACTIONS['lb.remove'] = async el => {
  const ok = await askChoice({ title: `Remove ${el.dataset.arg}?`, message: '<p>You will both stop seeing each other. You can add each other again with codes.</p>', choices: [{ label: 'Cancel', value: false }, { label: 'Remove', kind: 'primary', value: true }] }); if (!ok) return;
  try { await lbCall('vf_remove_friend', { p_id: lbCfg().id, p_secret: lbCfg().secret, p_friend: el.dataset.id }); lbLoad(); } catch (e) { lbUi.err = lbErrText(e.message); lbRepaint(); }
};
ACTIONS['lb.rename'] = async () => {
  const c = lbCfg();
  lbUi.err = ''; lbUi.nick = c.nick; replaceSheet({ title: 'Nickname', eyebrow: 'FRIENDS', render: () => ({ body: `<div class="field"><label for="lbnick">Nickname</label><input id="lbnick" data-in="lbnick" maxlength="20" autocomplete="off" value="${esc(lbUi.nick)}"></div>${lbUi.err ? `<div class="status warn" role="alert">${esc(lbUi.err)}</div>` : ''}`, footer: `<button type="button" class="btn primary block" data-act="lb.rename.save">Save</button>` }) });
};
ACTIONS['lb.rename.save'] = async () => {
  const c = lbCfg(), nick = lbUi.nick.trim();
  try { await lbCall('vf_rename', { p_id: c.id, p_secret: c.secret, p_nick: nick }); c.nick = nick; save(); replaceSheet({ title: 'Friends', eyebrow: 'LEADERBOARD', size: 'tall', render: renderLb }); lbLoad(); }
  catch (e) { lbUi.err = lbErrText(e.message); lbRepaint(); }
};
/* 2.23.1: the saved code belongs to another project (or was removed). Forget it on this phone and join again. */
ACTIONS['lb.reset'] = () => { data.settings.lb = null; save(); lbUi.rows = null; lbUi.err = ''; lbUi.stale = false; lbRepaint(); render(); toast('Pick a nickname to join again'); };
ACTIONS['lb.leave'] = async () => {
  const ok = await askChoice({ title: 'Leave and delete?', message: '<p>Your nickname, code and shared stats are deleted from the server and you disappear from friends’ boards. Your training data on this device is not touched.</p>', choices: [{ label: 'Cancel', value: false }, { label: 'Leave & delete', kind: 'primary', value: true }] }); if (!ok) return;
  const c = lbCfg();
  try { await lbCall('vf_leave', { p_id: c.id, p_secret: c.secret }); } catch (e) { if (e.message !== 'unauthorised') { lbUi.err = lbErrText(e.message); lbRepaint(); return; } }
  data.settings.lb = null; save(); lbUi.rows = null; lbUi.err = ''; lbRepaint(); toast('Removed from the leaderboard');
};
const lbInvite = () => `Join my VERTFORM leaderboard: open Friends and add code ${lbCfg().code}`;
ACTIONS['lb.copy'] = async () => { try { await navigator.clipboard.writeText(lbCfg().code); toast('Code copied'); } catch (_) { toast(`Your code: ${lbCfg().code}`); } };
ACTIONS['lb.share'] = async () => { try { if (navigator.share) await navigator.share({ text: lbInvite() }); else { await navigator.clipboard.writeText(lbInvite()); toast('Invite copied'); } } catch (_) { /* cancelled */ } };

/* entry card on Progress */
function friendsCard() {
  const c = lbCfg();
  return `${sectionHead('FRIENDS', 'Weekly leaderboard')}<div class="goalcard"><p class="tiny">${c ? `You are on the board as <b>${esc(c.nick)}</b>, code <span class="mono">${esc(c.code)}</span>.` : 'Compare your week with friends. Opt-in, nickname only, no weight or food shared.'}</p><button type="button" class="btn ${c ? 'ghost' : 'primary'}" data-act="lb.open">${c ? 'Open board' : 'Set up friends'}</button></div>`;
}


/* ---------- friend profile: this week + lift comparison ---------- */
ACTIONS['fr.open'] = el => { ui.friendId = el.dataset.id; go('friend'); if (!lbUi.rows || Date.now() - lbUi.at > 120000) lbLoad(); };
const kgTxt = v => `${fmt(v, v % 1 ? 1 : 0)} kg`;
function liftCompare(mine, theirs, nick) {
  const tmap = new Map(theirs.map(l => [liftKey(l.n), l])), common = mine.filter(l => tmap.has(liftKey(l.n)));
  const onlyThey = theirs.filter(l => !mine.some(m => liftKey(m.n) === liftKey(l.n)));
  let youLead = 0, theyLead = 0;
  const rows = common.map(m => {
    const t = tmap.get(liftKey(m.n)), max = Math.max(m.k, t.k) || 1, d = Math.round((m.k - t.k) * 2) / 2; if (d > 0) youLead++; else if (d < 0) theyLead++;
    const tot = (m.k + t.k) || 1, py = Math.max(4, Math.min(96, m.k / tot * 100)), win = d > 0 ? 'you' : d < 0 ? 'them' : '';
    return `<li class="lcmp ${win}"><div class="between"><b>${esc(m.n)}</b><span class="lcd ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d === 0 ? 'Level' : d > 0 ? `You +${kgTxt(d)}` : `${esc(nick)} +${kgTxt(-d)}`}</span></div>
      <div class="lvs"><div class="lside you"><small>YOU</small><b class="mono">${fmt(m.k, m.k % 1 ? 1 : 0)}<em>kg</em></b><span>${kgTxt(m.w)} × ${m.r}</span></div><div class="lside them"><small>${esc(nick).toUpperCase()}</small><b class="mono">${fmt(t.k, t.k % 1 ? 1 : 0)}<em>kg</em></b><span>${kgTxt(t.w)} × ${t.r}</span></div></div>
      <div class="lsplit"><i class="y" style="width:${py}%"></i><i class="t" style="width:${100 - py}%"></i></div></li>`; });
  return { rows, common: common.length, youLead, theyLead, onlyThey };
}
function meRow() {
  const c = lbCfg(), b = (lbUi.rows || []).find(x => x.me), st = lbStats();
  return { ...(b || {}), id: c?.id || 'me', me: true, nickname: c?.nick || 'You', week: st.week, sessions: st.sessions, target: st.target, vb: st.vb, streak: st.streak, jump: jumpBest(), lifts: lbLifts(), look: myLook() };
}
function profileTags(r, streak) {
  const top = (Array.isArray(r.lifts) ? r.lifts : []).slice().sort((a, b) => b.k - a.k)[0];
  const tags = [r.jump ? ['Jump', `${fmt(Number(r.jump), 1)} cm`] : null, streak ? ['Streak', `${streak} wk`] : null, top ? [top.n.length > 14 ? top.n.slice(0, 13) + '…' : top.n, kgTxt(top.k)] : null].filter(Boolean);
  return tags.map(([k, v], i) => `<div class="ptag t${i}"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('');
}
/* ---------- body map: which part of the body each lift works, and who leads there ---------- */
const PART_NAMES = { shoulders: 'Shoulders', chest: 'Chest', back: 'Back', arms: 'Arms', core: 'Core', legs: 'Legs' };
const PART_RULES = [
  ['core', /crunch|plank|sit.?up|\bab\b|\babs\b|core|leg raise|russian twist|wheel/],
  ['shoulders', /shoulder|overhead|\bohp\b|military|lateral raise|front raise|delt|arnold|face pull|shrug|upright/],
  ['arms', /curl|tricep|bicep|skull|hammer|pushdown|kickback|preacher/],
  ['legs', /romanian|\brdl\b|squat|leg|lunge|calf|calves|hip thrust|glute|hamstring|step.?up|quad|split/],
  ['back', /row|pull.?up|chin|pulldown|\blat\b|deadlift|back ext|hyperext/],
  ['chest', /bench|chest|fly|flye|push.?up|\bdip|pec|press/]
];
const liftPart = n => { const k = liftKey(n); const r = PART_RULES.find(([, re]) => re.test(k)); return r ? r[0] : null; };
function partData(mine, theirs, nick) {
  const out = {};
  Object.keys(PART_NAMES).forEach(p => {
    const m = mine.filter(l => liftPart(l.n) === p), t = theirs.filter(l => liftPart(l.n) === p), c = liftCompare(m, t, nick);
    const tmap = new Map(t.map(l => [liftKey(l.n), l]));
    out[p] = { ...c, they: c.theyLead, state: !c.common ? 'none' : c.youLead > c.theyLead ? 'you' : c.youLead < c.theyLead ? 'them' : 'lvl', mineOnly: m.filter(l => !tmap.has(liftKey(l.n))), theirOnly: c.onlyThey.filter(l => liftPart(l.n) === p) };
  });
  return out;
}
function partSheet(part, pd, nick) {
  const d = pd[part]; if (!d) return '';
  const head = `<div class="psh-head"><span class="psh-dot"></span><b>${PART_NAMES[part].toUpperCase()}</b><small>${d.common ? `${d.common} shared ${d.common === 1 ? 'lift' : 'lifts'}` : 'no shared lifts'}</small><button type="button" class="psh-x" data-act="part.clear" aria-label="Close">&times;</button></div>`;
  if (!d.common) {
    const only = d.theirOnly.length ? `<div class="eyebrow mt">Only ${esc(nick)} has</div><ul class="lothers">${d.theirOnly.map(l => `<li><span>${esc(l.n)}</span><b class="mono">${kgTxt(l.k)}</b><small>${kgTxt(l.w)} × ${l.r}</small></li>`).join('')}</ul>` : '';
    return `${head}<div class="psh-empty"><b>Nothing to compare yet</b><p class="tiny">Log a ${PART_NAMES[part].toLowerCase()} lift and it will show here next to ${esc(nick)}'s.</p></div>${only}`;
  }
  return `${head}<div class="lscore"><span class="${d.state === 'you' ? 'lead' : ''}"><small>YOU</small><b>${d.youLead}</b></span><i>lifts led</i><span class="${d.state === 'them' ? 'lead' : ''}"><small>${esc(nick).toUpperCase()}</small><b>${d.they}</b></span></div><ul class="lcmps">${d.rows.join('')}</ul>`;
}
let partFor = null;   // friend id the selected part belongs to
function partCtx() {
  const r = (lbUi.rows || []).find(x => x.id === ui.friendId); if (!r || ui.page !== 'friend' || ui.friendId === 'me') return null;
  return { r, pd: partData(lbLifts(), Array.isArray(r.lifts) ? r.lifts : [], r.nickname) };
}
function partPush() {
  const c = partCtx(), f = $('.pstage-3d'); if (!c || !f) return;
  const states = {}; Object.keys(c.pd).forEach(p => { states[p] = c.pd[p].state; });
  try { f.contentWindow.postMessage({ type: 'vf3d:regions', states, sel: ui.part || null }, location.origin); } catch (_) { /* frame not ready */ }
}
function partPaint() {
  const c = partCtx(), box = $('#partsheet'); if (!c || !box) return;
  const sel = ui.part && c.pd[ui.part] ? ui.part : null; ui.part = sel;
  box.innerHTML = sel ? partSheet(sel, c.pd, c.r.nickname) : '';
  box.hidden = !sel; $('#pstage')?.classList.toggle('sel', !!sel);
  $$('.pface button').forEach(b => b.classList.toggle('on', b.dataset.face === (ui.pface || 'front')));
  partPush();
}
ACTIONS['part.clear'] = () => { ui.part = null; partPaint(); };
ACTIONS['part.face'] = el => { ui.pface = el.dataset.face; const f = $('.pstage-3d'); try { f.contentWindow.postMessage({ type: 'vf3d:face', face: ui.pface }, location.origin); } catch (_) { /* ignore */ } partPaint(); };
addEventListener('message', e => {
  if (e.origin !== location.origin) return; const m = e.data || {}; if (ui.page !== 'friend' || ui.friendId === 'me') return;
  if (m.type === 'vf3d:part') { ui.part = typeof m.part === 'string' ? m.part : null; partPaint(); }
  else if (m.type === 'vf3d:shown') setTimeout(partPush, 50);
});

function viewFriend() {
  const isMe = ui.friendId === 'me', r = isMe ? meRow() : (lbUi.rows || []).find(x => x.id === ui.friendId);
  if (!r) return `${pageHead('', 'Profile')}${banners()}<p class="note">${lbUi.rows === null ? 'Loading…' : 'This friend is not on your board any more.'}</p>`;
  const cur = monday(todayISO()), thisWk = r.week === cur, sessions = thisWk ? r.sessions : 0, vb = thisWk ? r.vb : 0, streak = r.week && daysBetween(r.week, cur) <= 7 ? r.streak : 0;
  const theirs = Array.isArray(r.lifts) ? r.lifts : [], mine = lbLifts(), cmp = liftCompare(mine, theirs, r.nickname), look = cleanLook(r.look);
  const stat = (v, l) => `<div class="fstat"><b class="mono">${v}</b><small>${l}</small></div>`;
  const posts = (pUi.rows || []).filter(p => isMe ? p.mine : p.pid === r.id);
  if (pUi.rows === null && lbCfg() && !pUi.loading) setTimeout(postLoad, 0);
  setTimeout(pPaint, 0);
  const heroTags = profileTags(r, streak) + (isMe ? '' : `<div class="pface" role="group" aria-label="Turn the player"><button type="button" data-act="part.face" data-face="front" class="on">Front</button><button type="button" data-act="part.face" data-face="back">Back</button></div><div class="phint">Tap a body part to compare</div>`);
  if (partFor !== r.id) { ui.part = null; ui.pface = 'front'; partFor = r.id; }
  setTimeout(partPaint, 0);
  const hero = look ? stageHTML(look, `${r.nickname}'s player`, heroTags, isMe ? '' : '&parts=1')
    : isMe ? `<div class="pstage empty"><div class="pempty"><b>Make your player</b><p class="tiny">Pick a look, colours and shirt number. Friends see it on your profile and next to your posts.</p><button type="button" class="btn primary" data-act="lk.open">Create player</button></div></div>`
      : `<div class="pstage empty"><div class="pempty"><span class="pav xl" aria-hidden="true">${esc(r.nickname.slice(0, 1).toUpperCase())}</span><p class="tiny">${esc(r.nickname)} hasn't made a player yet.</p></div></div>`;
  const right = isMe && look ? `<button type="button" class="btn sm ghost" data-act="lk.open">Edit player</button>` : '';
  return `${pageHead('', esc(r.nickname) + (look ? ` <span class="pnum">#${look.number}</span>` : ''), right)}${banners()}
    ${hero}
    ${isMe ? '' : '<div id="partsheet" class="psheet" hidden></div>'}
    <div class="fstats">${stat(`${sessions}${r.target ? `<i> / ${r.target}</i>` : ''}`, 'gym this week')}${stat(`${streak}`, streak === 1 ? 'week streak' : 'weeks streak')}${stat(`${vb}`, 'volleyball')}</div>
    ${isMe ? (theirs.length ? `${sectionHead('', 'Best lifts')}<ul class="lothers">${theirs.map(l => `<li><span>${esc(l.n)}</span><b class="mono">${kgTxt(l.k)}</b><small>${kgTxt(l.w)} × ${l.r}</small></li>`).join('')}</ul>` : '')
    : `<details class="explain liftdd"><summary><span>Compare lifts with ${esc(r.nickname)}</span>${cmp.common ? `<b class="mono">${cmp.common}</b>` : ''}</summary>
    ${!lbSharesLifts() ? `<div class="status warn">You are not sharing your lifts, so ${esc(r.nickname)} cannot see yours. Turn it on in the leaderboard settings.</div>` : ''}
    ${!theirs.length ? `<p class="note">${esc(r.nickname)} has not shared any lifts yet.</p>`
      : `${cmp.common ? `<div class="lscore"><span class="${cmp.youLead > cmp.theyLead ? 'lead' : ''}"><small>YOU</small><b>${cmp.youLead}</b></span><i>lifts led</i><span class="${cmp.theyLead > cmp.youLead ? 'lead' : ''}"><small>${esc(r.nickname).toUpperCase()}</small><b>${cmp.theyLead}</b></span></div><p class="tiny lbhead lnote">Estimated one-rep max from each best set.</p><ul class="lcmps">${cmp.rows.join('')}</ul>` : ''}
      ${cmp.onlyThey.length ? `<div class="eyebrow mt">Their other lifts</div><ul class="lothers">${cmp.onlyThey.map(l => `<li><span>${esc(l.n)}</span><b class="mono">${kgTxt(l.k)}</b><small>${kgTxt(l.w)} × ${l.r}</small></li>`).join('')}</ul>` : ''}`}`}</details>
    ${posts.length ? `${sectionHead('', 'Recent posts')}<ul class="pfeed">${posts.map(postCard).join('')}</ul>` : ''}`;
}
ACTIONS['me.open'] = () => { ui.friendId = 'me'; go('friend'); if (lbCfg() && (!lbUi.rows || Date.now() - lbUi.at > 120000)) lbLoad(); };

INPUTS.lbjump = el => { data.settings.shareJump = !!el.checked; save(); lbSync(true).then(() => lbLoad && lbLoad()); };
