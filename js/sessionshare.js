/* Share a session: it becomes a short code (also a link). Whoever gets it pastes it into "Add a shared session" and previews it first.
   Only the session itself is shared: name, icon, exercises, sets and reps. Never your weights, notes or logs. */
const SS_PREFIX = 'VF1:';
const ssB64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ssUnB64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))));

function ssPack(k) {
  const t = templates[k]; if (!t) return null;
  const my = data.mySessions.find(s => s.key === k), mins = my ? my.minutes : parseInt((String(t.duration || '').match(/\d+/) || [0])[0]) || 0;
  return { v: 1, t: t.title, e: t.emoji || '', y: my ? my.type : '', m: mins || 0, h: isHeavy(k) ? 1 : 0,
    x: allExercises(k).map(e => [e.name, e.sets, e.reps, e.unit || 'reps', e.load ? 1 : 0, e.hint || '', e.rest || 0, e.dist || '']) };
}
const ssCode = k => { const p = ssPack(k); return p ? SS_PREFIX + ssB64(JSON.stringify(p)) : ''; };
const ssLink = k => location.origin + location.pathname + '#s=' + ssCode(k).slice(SS_PREFIX.length);

/* Reads a code, a link, or text that contains one. Returns a clean session record or null. */
function ssParse(text) {
  const m = String(text || '').match(/(?:VF1:|#s=)([A-Za-z0-9_-]{20,})/), raw = m ? m[1] : null; if (!raw) return null;
  let o; try { o = JSON.parse(ssUnB64(raw)); } catch (_) { return null; }
  if (!o || o.v !== 1 || !Array.isArray(o.x) || !o.x.length) return null;
  const rec = { key: 'E', title: String(o.t || '').slice(0, 40), emoji: String(o.e || ''), type: String(o.y || '').slice(0, 30), minutes: Number(o.m) || 0, heavy: !!o.h, deleted: false,
    exercises: o.x.slice(0, 25).map(r => ({ id: 'cx-' + uid(), name: String(r[0] || ''), sets: Number(r[1]) || 3, reps: String(r[2] || '8'), unit: ['reps', 'seconds', 'metres'].includes(r[3]) ? r[3] : 'reps', load: !!r[4], hint: String(r[5] || '').slice(0, 140), rest: Number(r[6]) || 0, dist: ['m', 'km'].includes(r[7]) ? r[7] : '', optional: false })) };
  const clean = cleanMySessions([rec])[0]; return clean && clean.exercises.length ? clean : null;
}

ACTIONS['ses.share'] = async el => {
  const k = el.dataset.arg, t = templates[k]; if (!t) return;
  const url = ssLink(k), text = `${t.title} · ${allExercises(k).length} exercises. Open VERTFORM → Gym → Sessions → Add a shared session, and paste this code:\n${ssCode(k)}`;
  try { if (navigator.share) { await navigator.share({ title: t.title, text: text + '\n' + url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Copied. Send it to a friend'); } catch (_) { prompt('Copy this and send it to a friend', text); }
};

let ssDraft = null, ssText = '', ssErr = '';
function ssSheetBody() {
  if (!ssDraft) return { body: `<p class="tiny">Paste a session code or link a friend sent you.</p><textarea id="sstext" class="ssbox" data-in="sstext" rows="4" placeholder="VF1:…" aria-label="Session code">${esc(ssText)}</textarea>${ssErr ? `<div class="status warn" role="alert">${esc(ssErr)}</div>` : ''}`, footer: `<button type="button" class="btn primary" data-act="ss.read">Preview session</button>` };
  const s = ssDraft, iosWeb = typeof pushIOSWeb === 'function' && pushIOSWeb();
  return { body: `<div class="sspre"><div class="ssname">${s.emoji ? `<span class="ssemo">${esc(s.emoji)}</span>` : ''}<h3>${esc(s.title)}</h3></div><p class="tiny">${plural(s.exercises.length, 'exercise')}${s.minutes ? ` · ~${s.minutes} min` : ''}${s.type ? ` · ${esc(s.type)}` : ''}</p>
    <ul class="sslist">${s.exercises.map(e => `<li><b>${esc(e.name)}</b><small>${e.sets} × ${esc(e.reps)}${e.unit !== 'reps' ? ' ' + esc(e.unit) : ''} · ${e.load ? 'weighted' : 'no weight'}</small></li>`).join('')}</ul>
    ${iosWeb ? '<p class="tiny">You opened this in the browser. If you use VERTFORM from your Home Screen, copy the code and paste it there instead.</p>' : ''}${ssErr ? `<div class="status warn" role="alert">${esc(ssErr)}</div>` : ''}</div>`,
    footer: `<button type="button" class="btn ghost" data-act="ss.back">Back</button><button type="button" class="btn primary" data-act="ss.add">Add to my sessions</button>` };
}
INPUTS.sstext = el => { ssText = el.value; };
ACTIONS['ses.import'] = () => { ssDraft = null; ssText = ''; ssErr = ''; openSheet({ title: 'Add a shared session', eyebrow: 'FROM A FRIEND', size: 'tall', render: ssSheetBody }); };
ACTIONS['ss.read'] = () => { ssText = $('#sstext')?.value ?? ssText; const s = ssParse(ssText); if (!s) { ssErr = 'That does not look like a session code. Paste the whole code or link.'; refreshSheet(); return; } ssDraft = s; ssErr = ''; refreshSheet(); };
ACTIONS['ss.back'] = () => { ssDraft = null; ssErr = ''; refreshSheet(); };
ACTIONS['ss.add'] = () => {
  const s = ssDraft; if (!s) return;
  const key = nextKey(); if (!key) { ssErr = 'You have reached the limit of 12 own sessions. Delete one first.'; refreshSheet(); return; }
  data.mySessions.push({ ...s, key });
  data.mySessions = cleanMySessions(data.mySessions); syncCustomSessions(data.mySessions, data.user.hideBuiltin);
  const act = activeSessions().filter(k => k !== key); data.user.gymSessions = SESSION_KEYS.filter(k => act.includes(k));
  if (!data.user.gymSessions.length) data.user.gymSessions = SESSION_KEYS.slice();
  save(); closeAllSheets(); ssDraft = null; render(); toast(`“${s.title}” added. Switch it on in your week if you want it planned`);
};
/* a link opened in the app or browser */
function ssBoot() {
  const m = location.hash.match(/#s=([A-Za-z0-9_-]{20,})/); if (!m) return;
  const s = ssParse(SS_PREFIX + m[1]); try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* ignore */ }
  if (!s) { toast('That session link could not be read'); return; }
  ssDraft = s; ssText = ''; ssErr = ''; openSheet({ title: 'Add a shared session', eyebrow: 'FROM A FRIEND', size: 'tall', render: ssSheetBody });
}
window.addEventListener('load', () => setTimeout(ssBoot, 900));
