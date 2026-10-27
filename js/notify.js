/* Notifications: friend posts, mentions, and a "session today" reminder (Web Push through the friends database) */
const PUSHPREF_KEY = 'vertform.push';
function pushPrefs() {
  let p = {}; try { p = JSON.parse(localStorage.getItem(PUSHPREF_KEY) || '{}'); } catch (_) { /* none */ }
  return { posts: p.posts !== false, mentions: p.mentions !== false, remind: !!p.remind, fuel: p.fuel !== false, remind_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(p.remind_time || '') ? p.remind_time : '08:00', on: !!p.on, plan: p.plan || '' };
}
function pushSavePrefs(p) { try { localStorage.setItem(PUSHPREF_KEY, JSON.stringify(p)); } catch (_) { /* ignore */ } }
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushIOSWeb = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
const b64u = s => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const pushTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'; } catch (_) { return 'Europe/London'; } };
const pushPayload = p => ({ posts: p.posts, mentions: p.mentions, remind: p.remind, remind_time: p.remind_time, tz: pushTz() });
let pushBusy = false;

async function pushCurrentSub() { try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (_) { return null; } }

function pushPlan() {
  const out = {}, t = todayISO();
  for (let i = 0; i < 10; i++) {
    const d = addDays(t, i); let s; try { s = plannedFor(d); } catch (_) { continue; }
    if (s === 'RECOVERY' || !s) continue;
    out[d] = s === 'MATCH' ? 'Match day' : s === 'TEAM' ? 'Volleyball training' : (templates[s]?.title || sName(s));
  }
  if (pushPrefs().fuel && typeof matchFuelPlan === 'function') { const f = matchFuelPlan(); if (f.length) out._fuel = f; }
  return out;
}
async function pushPlanSync(force) {
  const c = lbCfg(), p = pushPrefs(); if (!c || !p.on || !pushSupported() || Notification.permission !== 'granted') return;
  const plan = pushPlan(), h = JSON.stringify(plan); if (!force && h === p.plan) return;
  try { await lbCall('vf_push_plan', { p_id: c.id, p_secret: c.secret, p_plan: plan }); p.plan = h; pushSavePrefs(p); } catch (_) { /* try again next open */ }
}

ACTIONS['push.enable'] = async () => {
  const c = lbCfg(); if (!c) { toast('Set up friends first, so there is someone to hear from'); return; }
  if (!pushSupported()) { toast(pushIOSWeb() ? 'On iPhone, add VERTFORM to your Home Screen first, then open it from there' : 'This browser cannot do notifications'); return; }
  if (pushBusy) return; pushBusy = true;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifications are blocked. Allow them in your phone settings for VERTFORM'); return; }
    const key = await lbCall('vf_push_key', {}); const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
    const j = sub.toJSON(), p = { ...pushPrefs(), on: true };
    await lbCall('vf_push_save', { p_id: c.id, p_secret: c.secret, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_prefs: pushPayload(p) });
    pushSavePrefs(p); await pushPlanSync(true); toast('Notifications are on');
  } catch (e) { toast(e.message === 'offline' ? 'You seem to be offline' : 'Could not turn notifications on. Try again'); }
  finally { pushBusy = false; render(); }
};
ACTIONS['push.off'] = async () => {
  const c = lbCfg(), p = pushPrefs();
  try { const sub = await pushCurrentSub(); if (sub) { if (c) await lbCall('vf_push_off', { p_id: c.id, p_secret: c.secret, p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); } } catch (_) { /* ignore */ }
  pushSavePrefs({ ...p, on: false }); toast('Notifications are off'); render();
};
ACTIONS['push.pref'] = async el => {
  const p = pushPrefs(); p[el.dataset.arg] = !!el.checked; pushSavePrefs(p);
  const c = lbCfg(); if (c && p.on) { try { await lbCall('vf_push_prefs_set', { p_id: c.id, p_secret: c.secret, p_prefs: pushPayload(p) }); if (el.dataset.arg === 'remind' || el.dataset.arg === 'fuel') pushPlanSync(true); } catch (_) { toast('Could not save that. Check your signal'); } }
  render();
};
INPUTS.pushtime = el => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(el.value)) return; const p = pushPrefs(); p.remind_time = el.value; pushSavePrefs(p); clearTimeout(ntfTimer); ntfTimer = setTimeout(() => { const c = lbCfg(); if (c && p.on) lbCall('vf_push_prefs_set', { p_id: c.id, p_secret: c.secret, p_prefs: pushPayload(p) }).catch(() => {}); }, 600); };
let ntfTimer = 0;

function pushSettings() {
  const p = pushPrefs(), perm = pushSupported() ? Notification.permission : 'unsupported';
  const live = p.on && perm === 'granted';
  let head;
  if (!lbCfg()) head = `<p class="tiny">Notifications come through your friends list, so set that up first.</p>`;
  else if (perm === 'unsupported') head = `<p class="tiny">${pushIOSWeb() ? 'On iPhone, add VERTFORM to your Home Screen (Share, then Add to Home Screen) and open it from there. Then come back here.' : 'This browser cannot show notifications.'}</p>`;
  else if (perm === 'denied') head = `<p class="tiny">Notifications are blocked for VERTFORM. Allow them in your phone settings, then come back.</p>`;
  else head = live ? '' : `<p class="tiny">Get pinged when a friend posts or tags you. Nothing else. Nothing is shown from the post itself.</p><button type="button" class="btn primary" data-act="push.enable">Turn on notifications</button>`;
  const sw = (k, label) => `<label class="switch"><span>${label}</span><input type="checkbox" data-act="push.pref" data-arg="${k}" ${p[k] ? 'checked' : ''}></label>`;
  const body = live ? `${sw('posts', 'A friend posts')}${sw('mentions', 'Someone @mentions you')}${sw('remind', 'Remind me on session days (optional)')}${sw('fuel', 'Match-day fuel reminders (carbs, honey)')}
    ${p.remind ? `<div class="field inline-field"><label for="pushtime">Remind me at</label><input id="pushtime" type="time" data-in="pushtime" value="${esc(p.remind_time)}"></div>` : ''}
    <button type="button" class="btn ghost" data-act="push.off">Turn off on this phone</button>` : '';
  return head + body;
}
const pushSummary = () => { const p = pushPrefs(); return pushSupported() && Notification.permission === 'granted' && p.on ? 'On' : 'Off'; };

/* tag a friend in a post: tap a name to add @name */
ACTIONS['post.tag'] = el => {
  const t = $('#pbody'); if (!t) return; const v = t.value, add = `@${el.dataset.arg} `;
  t.value = (v && !/\s$/.test(v) ? v + ' ' : v) + add; t.value = t.value.slice(0, P_MAX); pUi.body = t.value; const n = $('#pcount'); if (n) n.textContent = P_MAX - pUi.body.length; t.focus();
};
function tagChips() {
  const names = (lbUi?.rows || []).filter(r => !r.me).map(r => r.nickname).slice(0, 8);
  return names.length ? `<div class="tagrow" role="group" aria-label="Tag a friend"><span class="tiny">Tag</span>${names.map(n => `<button type="button" class="chip" data-act="post.tag" data-arg="${esc(n)}">@${esc(n)}</button>`).join('')}</div>` : '';
}

setTimeout(() => { try { pushPlanSync(); } catch (_) { /* ignore */ } }, 5000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { try { pushPlanSync(); } catch (_) { /* ignore */ } } });
