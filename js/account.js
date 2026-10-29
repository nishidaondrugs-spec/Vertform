'use strict';
/* VERTFORM 2.19 — Google sign-in (Supabase Auth over plain REST, no extra library), cloud backup,
   multi-device sync and keeping your friend identity on a new phone.
   Only active when VF_CONFIG.auth is true. Records still live on the device first; the cloud copy follows. */

const ACCT_KEY = 'vertform.auth', SYNC_KEY = 'vertform.sync';
const acct = { session: null, me: null, busy: false, pushing: false, err: '', quiet: false, pullAt: 0 };
const syncState = { rev: null, dirty: false, at: null };
const acctOn = () => typeof VF_CONFIG !== 'undefined' && !!VF_CONFIG.auth;
const signedIn = () => !!acct.session?.refresh_token;
const deviceName = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Browser'; };

function acctLoad() { try { acct.session = JSON.parse(localStorage.getItem(ACCT_KEY) || 'null'); } catch (_) { acct.session = null; } try { Object.assign(syncState, JSON.parse(localStorage.getItem(SYNC_KEY) || '{}')); } catch (_) {} }
function acctSave() { try { if (acct.session) localStorage.setItem(ACCT_KEY, JSON.stringify(acct.session)); else localStorage.removeItem(ACCT_KEY); localStorage.setItem(SYNC_KEY, JSON.stringify(syncState)); } catch (_) {} }

/* Coming back from Google: Supabase puts the session in the address after '#'. Read it, then tidy the address. */
(function readRedirect() {
  acctLoad();
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (h.get('access_token') && h.get('refresh_token')) {
    acct.session = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Date.now() + (Number(h.get('expires_in')) || 3600) * 1000, user: null };
    acct.justIn = true; acct.recovery = h.get('type') === 'recovery'; acctSave();
  } else if (h.get('error_description')) acct.err = h.get('error_description');
  if (h.get('access_token') || h.get('error')) try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
})();

async function authFetch(path, opts = {}) {
  let r; try { r = await fetch(`${VF_CONFIG.url}${path}`, { ...opts, headers: { apikey: VF_CONFIG.key, 'Content-Type': 'application/json', ...(opts.headers || {}) } }); } catch (_) { throw new Error('offline'); }
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
  if (!r.ok) { const m = j?.message || j?.error_description || j?.msg || ''; const e = new Error(/relation|function .* does not exist|schema cache|Could not find/i.test(m) ? 'not_installed' : m || `http_${r.status}`); e.status = r.status; throw e; }
  return j;
}
async function acctToken() {
  const s = acct.session; if (!s) return null;
  if (s.expires_at - Date.now() > 60000) return s.access_token;
  try {
    const j = await authFetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) });
    acct.session = { ...s, access_token: j.access_token, refresh_token: j.refresh_token || s.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 }; acctSave(); return acct.session.access_token;
  } catch (e) { if (e.status === 400 || e.status === 401) { acct.session = null; acctSave(); } throw e; }
}
async function acctCall(fn, body = {}) {
  const tok = await acctToken(); if (!tok) throw new Error('signed_out');
  return authFetch(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) });
}
async function acctUser() { const tok = await acctToken(); if (!tok) return null; const u = await authFetch('/auth/v1/user', { headers: { Authorization: `Bearer ${tok}` } }); const m = u?.user_metadata || {};
  acct.session.user = { id: u.id, email: u.email || '', name: m.full_name || m.name || '' }; acctSave(); return acct.session.user; }

/* 2.22: sign in with email and password (see the sheet at the end of this file) */
function acctSignIn() {
  if (!acctOn()) return; flushSave();
  acUi = { mode: 'in', email: acUi.email, pass: '', busy: false, err: '', msg: '' };
  openSheet({ title: 'Your account', eyebrow: 'VERTFORM CLOUD', autofocus: '#acEmail', render: acPanel });
}
async function acctSignOut() {
  const ok = await askConfirm({ title: 'Sign out?', message: '<p>Your records stay on this phone. They stop backing up until you sign in again.</p>', confirmLabel: 'Sign out' }); if (!ok) return;
  try { const tok = await acctToken(); if (tok) await authFetch('/auth/v1/logout', { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }); } catch (_) { /* signed out locally anyway */ }
  acct.session = null; acct.me = null; syncState.rev = null; syncState.dirty = false; acctSave(); render(); toast('Signed out');
}

/* ---------- what goes to the cloud: everything except this device's friend key ---------- */
function cloudPayload() { const d = deepCopy(data); if (d.settings) delete d.settings.lb; return JSON.stringify(d); }
function applyCloud(text, note) {
  const { incoming } = inspectBackup(text); incoming.settings.lb = data.settings.lb;   // keep this device's friend key
  acct.quiet = true; try { applyImport(incoming, null); } finally { acct.quiet = false; }
  if (data.user.onboarded && $('#onb-root')?.children.length && typeof closeOb === 'function') closeOb();
  render(); if (note) toast(note);
}
const hasRecords = () => recordTotal(countsOf(data)) > 0;
function onSaved() { if (acct.quiet || !acctOn() || !signedIn()) return; syncState.dirty = true; acctSave(); acctPushSoon(); }
let pushTimer = 0;
function acctPushSoon(ms = 12000) { clearTimeout(pushTimer); pushTimer = setTimeout(() => acctPush(), ms); }

async function acctPush(force) {
  if (!signedIn() || acct.pushing || (!syncState.dirty && !force)) return;
  acct.pushing = true;
  try {
    const rev = await acctCall('vf_backup_put', { p_data: cloudPayload(), p_base: syncState.rev, p_device: deviceName() });
    syncState.rev = rev; syncState.dirty = false; syncState.at = new Date().toISOString(); acctSave(); acctPaint();
  } catch (e) {
    if (e.message === 'conflict') await acctConflict();
    else if (e.message === 'too_big') toast('Your records are too big to back up in one go. Remove old photos or the custom logo and try again.');
    else if (e.message !== 'offline') acct.err = e.message;
  } finally { acct.pushing = false; }
}
/* Another device saved since this one last synced */
async function acctConflict() {
  const b = await acctCall('vf_backup_get'); if (!b) { syncState.rev = null; return acctPush(true); }
  if (!syncState.dirty) { syncState.rev = b.rev; acctSave(); applyCloud(b.data, `Updated from your ${b.device || 'other device'}`); return; }
  const c = await askChoice({ title: 'Changes on two devices', message: `<p>Your ${esc(b.device || 'other device')} saved changes since this one last synced. Which version do you want to keep?</p><p class="tiny">The one you don't keep is saved on this phone, so you can undo it in Settings → Backup.</p>`,
    choices: [{ label: `Use ${b.device || 'the other device'}'s`, value: 'cloud', kind: 'primary' }, { label: 'Keep this device\'s', value: 'local', kind: 'ghost' }] });
  if (c === 'cloud') { syncState.rev = b.rev; syncState.dirty = false; acctSave(); applyCloud(b.data, 'Using the other device\'s records'); }
  else if (c === 'local') { syncState.rev = b.rev; acctSave(); return acctPush(true); }
}
async function acctPull() {
  if (!signedIn() || Date.now() - acct.pullAt < 20000) return; acct.pullAt = Date.now();
  try {
    acct.me = await acctCall('vf_me'); const b = acct.me?.backup;
    if (!b) { if (hasRecords()) { syncState.rev = null; await acctPush(true); } return; }
    if (b.rev === syncState.rev) { if (syncState.dirty) await acctPush(); return; }
    if (syncState.rev === null && !hasRecords()) { const g = await acctCall('vf_backup_get'); syncState.rev = g.rev; syncState.dirty = false; syncState.at = new Date().toISOString(); acctSave(); applyCloud(g.data, 'Your records are back'); return; }
    if (syncState.rev === null) return acctFirstMerge(b);
    if (syncState.dirty) return acctConflict();
    const g = await acctCall('vf_backup_get'); syncState.rev = g.rev; syncState.at = new Date().toISOString(); acctSave(); applyCloud(g.data, syncState.at && g.device ? `Updated from your ${g.device}` : '');
  } catch (e) { if (e.message === 'signed_out') { acct.session = null; acctSave(); } else if (e.message === 'not_installed') acct.err = 'not_installed'; }
  finally { acctPaint(); }
}
/* First sign-in on a phone that already has records, and the account already has a backup */
async function acctFirstMerge(b) {
  const when = b.updated ? new Date(b.updated).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const c = await askChoice({ title: 'You have a backup already', message: `<p>Your account has records saved from your ${esc(b.device || 'other device')}${when ? ` (${esc(when)})` : ''}, and this phone has its own.</p><p class="tiny">Whichever you don't choose is kept on this phone so you can undo it in Settings → Backup.</p>`,
    choices: [{ label: 'Use my backup', value: 'cloud', kind: 'primary' }, { label: 'Keep this phone\'s and back it up', value: 'local', kind: 'ghost' }] });
  if (c === 'cloud') { const g = await acctCall('vf_backup_get'); syncState.rev = g.rev; syncState.dirty = false; acctSave(); applyCloud(g.data, 'Backup restored'); }
  else if (c === 'local') { syncState.rev = b.rev; syncState.dirty = true; acctSave(); await acctPush(true); toast('This phone\'s records are now your backup'); }
}

/* ---------- friend identity: link this phone's, or bring the account's to this phone ---------- */
async function acctIdentity() {
  const me = acct.me || (acct.me = await acctCall('vf_me')), c = lbCfg();
  if (c && (!me.player || me.player.id !== c.id)) {
    try { await acctCall('vf_link', { p_id: c.id, p_secret: c.secret }); acct.me = await acctCall('vf_me'); return; }
    catch (e) {
      if (e.message === 'has_other') {
        const ch = await askChoice({ title: 'Two friend profiles', message: `<p>This phone is <b>${esc(c.nick)}</b> (${esc(c.code)}) but your account is <b>${esc(me.player.nick)}</b> (${esc(me.player.code)}).</p>`,
          choices: [{ label: `Use ${me.player.nick}`, value: 'acct', kind: 'primary' }, { label: `Keep ${c.nick} on this phone`, value: 'keep', kind: 'ghost' }] });
        if (ch !== 'acct') return;
      } else if (e.message === 'taken') { toast('This phone\'s friend profile belongs to another account.'); return; }
      else throw e;
    }
  }
  if (me.player && (!c || c.id !== me.player.id)) {
    const k = await acctCall('vf_device_key');
    data.settings.lb = { ...(c || {}), id: k.id, secret: k.secret, nick: k.nick, code: k.code }; acct.quiet = true; try { save(); } finally { acct.quiet = false; }
    if (typeof lbLoad === 'function') lbLoad(); toast(`Signed in as ${k.nick}`);
  }
}
async function acctStart() {
  if (!acctOn() || !signedIn()) return;
  try {
    if (acct.justIn || !acct.session.user) await acctUser();
    if (acct.justIn) { acct.justIn = false; acct.pullAt = 0; acct.me = await acctCall('vf_me'); await acctIdentity(); }
    await acctPull();
  } catch (e) { acct.err = e.message; }
  if (acct.recovery) { acct.recovery = false; acctNewPasswordSheet(); }
  render();
}
document.addEventListener('visibilitychange', () => { if (!acctOn() || !signedIn()) return; if (document.hidden) { flushSave(); if (syncState.dirty) acctPush(); } else acctPull(); });

/* ---------- Settings → Account ---------- */
function syncText() {
  if (acct.pushing) return 'Backing up…';
  if (syncState.dirty) return 'Changes waiting to back up';
  if (!syncState.at) return 'Not backed up yet';
  const m = Math.round((Date.now() - Date.parse(syncState.at)) / 60000);
  return `Backed up ${m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : pretty(syncState.at.slice(0, 10))}`;
}
function accountGroup() {
  if (!acctOn()) return '';
  if (!signedIn()) return setGroup('Account', 'Sign in to back up and use VERTFORM on any device', `<p class="tiny">Your records back up automatically and come back on a new phone. Your friend profile comes with you too.</p>
    <button type="button" class="btn primary" data-act="acct.in">Sign in or create account</button>${acct.err && acct.err !== 'not_installed' ? `<p class="tiny warnText">${esc(acct.err)}</p>` : ''}`, false);
  const u = acct.session.user || {};
  return setGroup('Account', esc(u.email || 'Signed in with Google'), `<div class="acctrow"><span class="tiny" id="acctsync">${esc(syncText())}</span><button type="button" class="btn sm ghost" data-act="acct.sync">Back up now</button></div>
    ${acct.err === 'not_installed' ? '<div class="status warn">Cloud backup is not set up on the server yet (vertform-setup.sql).</div>' : ''}
    <div class="quick"><button type="button" class="btn sm ghost" data-act="acct.out">Sign out</button><button type="button" class="btn sm ghost warnText" data-act="acct.forget">Delete cloud backup</button></div>`, false);
}
function acctPaint() { const s = $('#acctsync'); if (s) s.textContent = syncText(); }
const googleG = () => '<svg class="gg" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
ACTIONS['acct.in'] = () => acctSignIn();
ACTIONS['acct.out'] = () => acctSignOut();
ACTIONS['acct.sync'] = async () => { syncState.dirty = true; await acctPush(true); acctPaint(); if (!syncState.dirty) toast('Backed up'); };
ACTIONS['acct.forget'] = async () => {
  if (!await askConfirm({ title: 'Delete your cloud backup?', message: '<p>The copy of your records in the cloud is deleted and your friend profile is unlinked from your Google account. Everything on this phone stays.</p>', confirmLabel: 'Delete cloud backup', danger: true })) return;
  try { await acctCall('vf_account_forget'); syncState.rev = null; syncState.at = null; syncState.dirty = false; acctSave(); toast('Cloud backup deleted'); render(); } catch (e) { toast(e.message === 'offline' ? 'You seem to be offline.' : 'Could not delete it. Try again.'); }
};

/* ---------- 2.22: email and password sign-in (Supabase Auth). Creating an account, signing in, and resetting a password. ---------- */
let acUi = { mode: 'in', email: '', pass: '', busy: false, err: '', msg: '' };
const acRedirect = () => location.origin + location.pathname;
function acMsgFor(m) {
  m = String(m || '');
  if (/invalid login|invalid credentials/i.test(m)) return 'That email and password don\'t match.';
  if (/not confirmed/i.test(m)) return 'Confirm your email first. The link is in your inbox.';
  if (/already (registered|been registered|exists)/i.test(m)) return 'There is already an account with that email. Sign in instead.';
  if (/rate limit|too many/i.test(m)) return 'Too many emails sent. Wait a few minutes and try again.';
  if (/password/i.test(m) && /least|short|weak|characters/i.test(m)) return 'Use at least 8 characters for your password.';
  if (m === 'offline') return 'You seem to be offline. Try again when you have signal.';
  return m || 'Something went wrong. Try again.';
}
/* the session from a sign-in, sign-up or confirmed email, stored the same way as before */
function acStore(j) {
  acct.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: null };
  acct.justIn = true; acct.pullAt = 0; acctSave();
}
/* Google: only shown once the provider is switched on in Supabase (the project's public settings say so). */
let gOn = null;
async function acctGoogleCheck() {
  if (gOn !== null || !acctOn()) return; gOn = false;
  try { const r = await fetch(`${VF_CONFIG.url}/auth/v1/settings`, { headers: { apikey: VF_CONFIG.key } }); const j = await r.json(); gOn = !!j?.external?.google; if (gOn && typeof refreshSheet === 'function' && sheetOpen()) refreshSheet(); } catch (_) { gOn = false; }
}
ACTIONS['acct.google'] = () => { flushSave(); location.href = `${VF_CONFIG.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(location.origin + location.pathname)}`; };
function acPanel() {
  acctGoogleCheck();
  const m = acUi.mode, btn = m === 'up' ? 'Create account' : m === 'reset' ? 'Send reset link' : 'Sign in';
  const note = acUi.err ? `<div class="status warn" role="alert">${esc(acUi.err)}</div>` : acUi.msg ? `<div class="status" role="status">${esc(acUi.msg)}</div>` : '';
  return {
    body: `<p class="tiny">${m === 'up' ? 'Your records back up to this account and come back on any device. Use an email you can get to, for password resets.' : m === 'reset' ? 'We\'ll email you a link to choose a new password.' : 'Sign in to back up your records and use them on another device.'}</p>
      ${m === 'reset' || !gOn ? '' : `<button type="button" class="btn ghost full gbtn" style="background:#fff!important;color:#000!important;border:0!important" data-act="acct.google">${googleG()}<span style="color:#000!important">Continue with Google</span></button><div class="acor"><span>or use email</span></div>`}
      <div class="field"><label for="acEmail">Email</label><input id="acEmail" type="email" inputmode="email" autocomplete="email" data-in="acEmail" value="${esc(acUi.email)}"></div>
      ${m === 'reset' ? '' : `<div class="field"><label for="acPass">Password</label><input id="acPass" type="password" autocomplete="${m === 'up' ? 'new-password' : 'current-password'}" data-in="acPass" value="${esc(acUi.pass)}" placeholder="At least 8 characters"></div>`}
      ${note}`,
    footer: `<button type="button" class="btn primary grow" data-act="acct.submit" ${acUi.busy ? 'disabled' : ''}>${acUi.busy ? 'Please wait…' : btn}</button>
      <div class="acctlinks">${m === 'in' ? `<button type="button" class="linkbtn" data-act="acct.mode" data-arg="up">Create an account</button><button type="button" class="linkbtn" data-act="acct.mode" data-arg="reset">Forgot password?</button>` : `<button type="button" class="linkbtn" data-act="acct.mode" data-arg="in">I already have an account</button>`}</div>`
  };
}
INPUTS.acEmail = el => { acUi.email = el.value; };
INPUTS.acPass = el => { acUi.pass = el.value; };
ACTIONS['acct.mode'] = el => { acUi.mode = el.dataset.arg; acUi.err = ''; acUi.msg = ''; refreshSheet(); };
ACTIONS['acct.submit'] = async () => {
  if (acUi.busy) return;
  const email = acUi.email.trim().toLowerCase(), pass = acUi.pass;
  acUi.err = ''; acUi.msg = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { acUi.err = 'Enter a valid email address.'; return refreshSheet(); }
  if (acUi.mode !== 'reset' && pass.length < 8) { acUi.err = 'Use at least 8 characters for your password.'; return refreshSheet(); }
  acUi.busy = true; refreshSheet();
  try {
    if (acUi.mode === 'in') {
      const j = await authFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
      acUi.pass = ''; acStore(j); closeAllSheets(); await acctStart(); toast('Signed in');
    } else if (acUi.mode === 'up') {
      const j = await authFetch(`/auth/v1/signup?redirect_to=${encodeURIComponent(acRedirect())}`, { method: 'POST', body: JSON.stringify({ email, password: pass }) });
      acUi.pass = '';
      if (j && j.access_token) { acStore(j); closeAllSheets(); await acctStart(); toast('Account created'); }
      else { acUi.mode = 'in'; acUi.msg = 'Check your email for a confirmation link, then sign in here.'; }
    } else {
      await authFetch(`/auth/v1/recover?redirect_to=${encodeURIComponent(acRedirect())}`, { method: 'POST', body: JSON.stringify({ email }) });
      acUi.mode = 'in'; acUi.msg = 'If that email has an account, a reset link is on its way.';
    }
  } catch (e) { acUi.err = acMsgFor(e.message); }
  acUi.busy = false; refreshSheet();
}
/* the reset link brings you back signed in; choose the new password here */
function acctNewPasswordSheet() {
  acUi = { mode: 'new', email: acUi.email, pass: '', busy: false, err: '', msg: '' };
  openSheet({ title: 'Choose a new password', eyebrow: 'VERTFORM CLOUD', autofocus: '#acPass', render: () => ({
    body: `<p class="tiny">Pick a new password for your account. You'll stay signed in on this phone.</p>
      <div class="field"><label for="acPass">New password</label><input id="acPass" type="password" autocomplete="new-password" data-in="acPass" value="${esc(acUi.pass)}" placeholder="At least 8 characters"></div>
      ${acUi.err ? `<div class="status warn" role="alert">${esc(acUi.err)}</div>` : ''}`,
    footer: `<button type="button" class="btn primary grow" data-act="acct.setpass" ${acUi.busy ? 'disabled' : ''}>${acUi.busy ? 'Saving…' : 'Save password'}</button>` }) });
}
ACTIONS['acct.setpass'] = async () => {
  if (acUi.busy) return;
  if (acUi.pass.length < 8) { acUi.err = 'Use at least 8 characters for your password.'; return refreshSheet(); }
  acUi.busy = true; acUi.err = ''; refreshSheet();
  try {
    const tok = await acctToken(); if (!tok) throw new Error('signed_out');
    await authFetch('/auth/v1/user', { method: 'PUT', headers: { Authorization: `Bearer ${tok}` }, body: JSON.stringify({ password: acUi.pass }) });
    acUi.pass = ''; acUi.busy = false; closeAllSheets(); toast('Password saved');
  } catch (e) { acUi.busy = false; acUi.err = acMsgFor(e.message); refreshSheet(); }
};
