'use strict';
/* VERTFORM 2.40 — new home layout: Feed (friends) first, You second, a centre post button, then Gym and Fuel.
   Switch back to the classic hub any time in Settings → Appearance. */

ICONS.me = '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>';
ICONS.feed = '<path d="M4 5h16v6H4zM4 14h16v5H4z"/>';

const NAV2_TOP = ['post', 'home', 'train', 'fuel'];
const navNew = () => data.settings.nav !== 'hub';
const isTopPage = p => navNew() ? NAV2_TOP.includes(p) : p === 'home';
const homePage = () => navNew() ? 'post' : 'home';

function tabsHTML() {
  const b = (p, n, i) => `<button type="button" class="${p === ui.page ? 'active' : ''}" data-act="nav" data-arg="${p}" aria-current="${p === ui.page ? 'page' : 'false'}">${icon(i)}<span>${n}</span></button>`;
  return `${b('post', 'Feed', 'feed')}${b('home', 'You', 'me')}<div class="tabpost"><button type="button" class="postfab" data-act="nav.snap" aria-label="Post a photo">${icon('camera')}</button></div>${b('train', 'Gym', 'train')}${b('fuel', 'Fuel', 'fuel')}`;
}
function railTabs() { return [['post', 'Feed', 'feed'], ['home', 'You', 'me'], ['train', 'Gym', 'train'], ['fuel', 'Fuel', 'fuel']]; }

ACTIONS['nav.snap'] = () => {
  if (ui.page !== 'post') go('post');
  if (!lbCfg()) return;                       // not on the friends feed yet: the page shows the setup card
  ACTIONS['post.compose']();
  if (!pUi.photo && !pUi.video) $('#pphoto')?.click();   // same tap, so phones allow the camera / photo picker to open
};
ACTIONS['nav.layout'] = el => { data.settings.nav = el.dataset.arg === 'hub' ? 'hub' : 'feed'; save(); ui.page = homePage(); ui.hub = false; navStack.length = 0; render(); window.scrollTo(0, 0); };

function layoutSection() {
  const cur = navNew() ? 'feed' : 'hub';
  return `<div class="chip-row" role="group" aria-label="Home layout">${[['feed', 'Feed and tabs'], ['hub', 'Classic hub']].map(([k, n]) => `<button type="button" class="chip ${cur === k ? 'on' : ''}" aria-pressed="${cur === k}" data-act="nav.layout" data-arg="${k}">${n}</button>`).join('')}</div>
    <p class="tiny">Feed and tabs opens on your friends' posts, with You, a post button, Gym and Fuel along the bottom. The classic hub is the original circle menu. Your records are the same either way.</p>`;
}

/* swipe sideways between Feed and You */
(function () {
  let sx = 0, sy = 0, t0 = 0, on = false;
  const blocked = t => t.closest && t.closest('input,textarea,select,iframe,video,.sheet,.dialog,#wk-root,.wk,[data-noswipe],table,.chip-row,.seg,pre');
  addEventListener('touchstart', e => {
    on = false; if (!navNew() || e.touches.length !== 1 || !['post', 'home'].includes(ui.page) || ui.panel || sheetOpen() || blocked(e.target)) return;
    const t = e.touches[0]; if (t.clientX < 30) return;   // the left edge belongs to swipe-back
    on = true; sx = t.clientX; sy = t.clientY; t0 = Date.now();
  }, { passive: true });
  addEventListener('touchend', e => {
    if (!on) return; on = false; const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (Math.abs(dx) < 80 || dy > 50 || dy > Math.abs(dx) / 1.6 || Date.now() - t0 > 700) return;
    if (dx < 0 && ui.page === 'post') go('home'); else if (dx > 0 && ui.page === 'home') go('post');
  }, { passive: true });
})();
