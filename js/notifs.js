/* In-app notifications: the bell on Home. Built from what's already here (friends' feed, reactions on your posts, your recap),
   plus the push-notification switch. "Seen" is remembered on this device only. */
const NSEEN_KEY = 'vertform.nseen';
const nSeen = () => { try { const o = JSON.parse(localStorage.getItem(NSEEN_KEY) || '{}'); return { at: typeof o.at === 'string' ? o.at : '', rx: o.rx && typeof o.rx === 'object' ? o.rx : {}, recap: o.recap || '' }; } catch (_) { return { at: '', rx: {}, recap: '' }; } };
const nSave = o => { try { localStorage.setItem(NSEEN_KEY, JSON.stringify(o)); } catch (_) { /* ignore */ } };
const rxTotal = r => Object.values(r.reacts || {}).reduce((a, v) => a + (Number(v) || 0), 0) + (Number(r.comments) || 0);

function notifItems() {
  const seen = nSeen(), items = [], t = todayISO(), dow = (parseDate(t).getDay() + 6) % 7;
  const first = !seen.at;   /* first time: start counting from now so old posts don't flood the bell */
  if ([5, 6].includes(dow) && (data.logs.length || data.vb.logs.length)) items.push({ id: 'recap:' + monday(t), icon: 'trophy', title: 'Your week is ready', sub: 'See and share your weekly recap card', act: 'recap.open', fresh: seen.recap !== monday(t), at: '' });
  (Array.isArray(pUi.rows) ? pUi.rows : []).forEach(r => {
    if (r.mine) {
      const n = rxTotal(r), was = Number(seen.rx[r.id]) || 0;
      if (n > 0) items.push({ id: 'my:' + r.id, icon: 'heart', title: `Your post got ${n} reaction${n === 1 ? '' : 's'} and comments`, sub: pWhen(r.created), act: 'post.open', at: r.created, fresh: !first && n > was });
    } else items.push({ id: 'fr:' + r.id, icon: 'post', title: `${r.nickname} posted${r.kind && r.kind !== 'note' ? ' a ' + ({ gym: 'gym session', vb: 'volleyball session', jump: 'jump test', food: 'food log' }[r.kind] || 'post') : ''}`, sub: pWhen(r.created), act: 'post.open', at: r.created, fresh: !first && r.created > seen.at });
  });
  return items.sort((a, b) => (b.fresh - a.fresh) || String(b.at).localeCompare(String(a.at))).slice(0, 25);
}
const notifCount = () => notifItems().filter(i => i.fresh).length;

function paintBell() {
  const b = $('#bell'); if (!b) return;
  document.body.classList.toggle('has-bell', ['post', 'home'].includes(ui.page));
  const n = notifCount();
  if (!b.dataset.k) { b.dataset.k = '1'; b.innerHTML = icon('bell') + '<i class="belldot" hidden></i>'; }
  b.querySelector('.belldot').hidden = !n; b.setAttribute('aria-label', n ? `Notifications, ${n} new` : 'Notifications');
  /* keep the friends feed fresh enough for the dot: at most every 3 minutes, only on Home */
  if (['post', 'home'].includes(ui.page) && typeof lbCfg === 'function' && lbCfg() && !pUi.loading && Date.now() - (pUi.at || 0) > 180000) postLoad().then(paintBell).catch(() => {});
}

function notifSheetBody() {
  const items = notifItems(), perm = pushSupported() ? Notification.permission : 'unsupported', on = pushPrefs().on && perm === 'granted';
  const row = i => `<li><button type="button" class="nrow ${i.fresh ? 'new' : ''}" data-act="notif.go" data-arg="${i.act}"><span class="nic">${icon(i.icon)}</span><span class="min0"><b>${esc(i.title)}</b><small>${esc(i.sub)}</small></span>${i.fresh ? '<i class="ndot" aria-label="New"></i>' : ''}</button></li>`;
  const push = pushSupported() ? (on ? `<p class="tiny nfoot">Push notifications are on. <button type="button" class="linkbtn" data-act="notif.settings">Settings</button></p>`
    : perm === 'denied' ? `<p class="tiny nfoot">Notifications are blocked for this app in your phone settings.</p>`
    : `<button type="button" class="btn ghost nenable" data-act="push.enable">Turn on push notifications</button>`) : '';
  return { body: `${items.length ? `<ul class="nlist">${items.map(row).join('')}</ul>` : `<div class="nempty"><div class="nic big">${icon('bell')}</div><b>You're all caught up</b><p class="tiny">Friends' posts, reactions on yours and your weekly recap show up here.</p></div>`}${push}` };
}
ACTIONS['notif.open'] = () => {
  const fresh = notifItems();
  openSheet({ title: 'Notifications', eyebrow: 'ACTIVITY', size: 'tall', render: notifSheetBody });
  /* mark everything as seen once it has been shown */
  const seen = { at: new Date().toISOString(), rx: {}, recap: monday(todayISO()) };
  (Array.isArray(pUi.rows) ? pUi.rows : []).filter(r => r.mine).forEach(r => { seen.rx[r.id] = rxTotal(r); });
  nSave(seen); paintBell(); void fresh;
  if (typeof lbCfg === 'function' && lbCfg() && !pUi.loading && Date.now() - (pUi.at || 0) > 20000) postLoad().then(() => { refreshSheet(); const s2 = nSeen(); (pUi.rows || []).filter(r => r.mine).forEach(r => { s2.rx[r.id] = rxTotal(r); }); s2.at = new Date().toISOString(); nSave(s2); paintBell(); }).catch(() => {});
};
ACTIONS['notif.go'] = el => { const a = el.dataset.arg; closeAllSheets(); if (a === 'post.open') go('post'); else if (ACTIONS[a]) ACTIONS[a](el); };
ACTIONS['notif.settings'] = () => { closeAllSheets(); go('settings'); };
