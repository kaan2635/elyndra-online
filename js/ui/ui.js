// UI core: DOM helpers, window manager, tooltips, modals, toasts, banners.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { isTouch, clamp, escapeHtml } from '../core/util.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { Audio } from '../audio.js';

// ------------------------------------------------------------ DOM helpers
export function h(tag, attrs, ...kids) {
  // tag syntax: "div#id.class1.class2"
  const [t0, ...cls] = tag.split('.');
  const hi = t0.indexOf('#');
  const el = document.createElement((hi >= 0 ? t0.slice(0, hi) : t0) || 'div');
  if (hi >= 0) el.id = t0.slice(hi + 1);
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      const ev = k.slice(2).toLowerCase();
      if (ev === 'click') el.addEventListener('click', e => { Audio.sfx('ui_click', { vol: 0.5 }); v(e); });
      else el.addEventListener(ev, v);
    }
    else if (k === 'data') for (const d in v) el.dataset[d] = v[d];
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat(5)) { if (k == null || k === false) continue; el.append(k instanceof Node ? k : document.createTextNode(String(k))); }
  return el;
}
export function icon(name, opts = {}, cls = 'ico') {
  const o = { size: opts.size || 64, ...opts }; delete o.cls;
  const img = h('img.' + cls, { src: iconURL(name, o), alt: '', draggable: 'false' });
  return img;
}
export const themeOf = name => ICON_THEMES[name] || ICON_THEMES.ui;
export function skillIcon(sk, extra = {}) { const th = themeOf(sk.theme); return iconURL(sk.icon, { size: 64, fill: th.fill, bg: th.bg, glow: th.glow, frame: sk.ult ? '#ffd24a' : th.frame, ...extra }); }
export const uiIcon = (name, extra = {}) => iconURL(name, { size: 64, ...ICON_THEMES.ui, ...extra });

// ------------------------------------------------------------ the UI manager
export const UI = {
  defs: {}, wins: {}, z: 30,
  touch: isTouch(),
  init() {
    this.root = document.getElementById('ui');
    if (this.touch) document.body.classList.add('touch');
    this.tipEl = h('div#tip.panel'); document.body.append(this.tipEl);
    this.bannerEl = h('div#banner', h('div.b1'), h('div.b2')); this.root.append(this.bannerEl);
    this.errEl = h('div#errors'); this.root.append(this.errEl);
    this.toastEl = h('div#toasts'); this.root.append(this.toastEl);
    this.emoteEl = h('div#bossemote'); this.root.append(this.emoteEl);
    this.loadEl = h('div#loading', h('div.logo', 'ELYNDRA'), h('div.zn'), h('div.loadbar', h('i')), h('div.tip')); document.body.append(this.loadEl);
    this.applyScale();
    window.addEventListener('resize', () => this.applyScale());
    G.ui = this;
    // hide tooltip on any touch start
    window.addEventListener('pointerdown', e => { if (!e.target.closest?.('[data-tip]')) this.hideTip(); }, true);
  },
  applyScale() {
    const W = window.innerWidth, H = window.innerHeight;
    // automatic scale from the viewport, multiplied by the user's preference
    const land = W >= H;
    const auto = this.touch ? clamp(land ? Math.min(W / 844, H / 390) : Math.min(W / 390, H / 760), 0.72, 1.3) : clamp(Math.min(W / 1366, H / 768), 0.6, 1.15);
    const s = auto * (G.settings?.uiScale ?? 1);
    this.scale = s;
    document.documentElement.style.setProperty('--ui', s);
    const hud = document.getElementById('hud');
    if (hud) { hud.style.transform = `scale(${s})`; hud.style.width = (100 / s) + '%'; hud.style.height = (100 / s) + '%'; }
    const ms = document.getElementById('mskills');
    if (ms) ms.style.transform = `scale(${s * (land ? 1 : 0.92)})`;
    document.body.classList.toggle('portrait', !land);
  },
  register(id, def) { this.defs[id] = def; },
  isOpen(id) { return !!this.wins[id]; },
  toggle(id, ...a) { if (this.wins[id]) this.close(id); else this.open(id, ...a); },
  open(id, ...args) {
    const def = this.defs[id]; if (!def) return null;
    if (G.mode !== 'game' && !def.anyMode) return null;
    let w = this.wins[id];
    if (!w) {
      const el = h('div.win.panel', { 'data-win': id });
      const titleEl = h('div.title');
      const head = h('div.wh', def.icon ? icon(def.icon, ICON_THEMES.ui, 'ico s') : null, titleEl, h('button.x', { onclick: () => this.close(id), 'aria-label': 'close' }, '✕'));
      const tabs = h('div.tabs');
      const body = h('div.wb');
      el.append(head, tabs, body);
      this.root.append(el);
      w = { id, el, body, tabs, head, titleEl, def, args, listeners: [] };
      this.wins[id] = w;
      this.place(w);
      this.drag(w);
      el.addEventListener('pointerdown', () => this.front(w));
      for (const ev of def.listen || []) w.listeners.push(G.events.on(ev, () => this.refresh(id)));
      Audio.sfx('ui_open', { vol: 0.5 });
      if (def.modal) el.style.zIndex = 61;
    }
    w.args = args;
    this.front(w);
    this.refresh(id);
    emit('winOpened', id);
    return w;
  },
  refresh(id) {
    const w = this.wins[id]; if (!w) return;
    const scroll = w.body.scrollTop;
    w.titleEl.textContent = typeof w.def.title === 'function' ? w.def.title(...w.args) : L(w.def.title);
    w.tabs.innerHTML = ''; w.tabs.style.display = 'none';
    w.body.innerHTML = '';
    try { w.def.build(w, ...w.args); } catch (e) { console.error('window', id, e); w.body.append(h('div.bad', 'UI error: ' + e.message)); }
    w.body.scrollTop = scroll;
  },
  setTabs(w, tabs, cur, onPick) {
    w.tabs.style.display = 'flex'; w.tabs.innerHTML = '';
    for (const [k, label] of tabs) w.tabs.append(h('div.tab' + (k === cur ? '.on' : ''), { onclick: () => { Audio.sfx('ui_tab', { vol: 0.5 }); onPick(k); } }, label));
  },
  close(id) {
    const w = this.wins[id]; if (!w) return;
    w.def.onClose?.(w);
    for (const off of w.listeners) off();
    w.el.remove(); delete this.wins[id];
    this.hideTip();
    Audio.sfx('ui_close', { vol: 0.4 });
    emit('winClosed', id);
  },
  closeAll() { for (const id of Object.keys(this.wins)) this.close(id); this.closeDialog?.(); },
  anyOpen() { return Object.keys(this.wins).length > 0; },
  front(w) { w.el.style.zIndex = ++this.z; },
  place(w) {
    const el = w.el, def = w.def;
    const W = window.innerWidth, H = window.innerHeight;
    const s = G.settings?.uiScale ?? 1;
    const mobile = this.touch || W < 720;
    const ww = Math.min(def.w || 420, W - 16);
    el.style.width = ww + 'px';
    if (mobile && (W < 900 || H < 520)) {
      el.style.left = '8px'; el.style.right = '8px'; el.style.width = 'auto';
      el.style.top = 'calc(8px + var(--safe-t))'; el.style.bottom = 'calc(8px + var(--safe-b))'; el.style.maxHeight = 'none';
      if (W > H && def.w && def.w < W * 0.6) { el.style.left = 'auto'; el.style.width = Math.min(def.w + 40, W - 16) + 'px'; el.style.right = 'calc(8px + var(--safe-r))'; }
    } else {
      const saved = G.account?.winPos?.[w.id];
      let x = saved ? saved[0] : (def.side === 'left' ? 20 : def.side === 'right' ? W - ww - 20 : (W - ww) / 2);
      let y = saved ? saved[1] : Math.max(20, H * 0.08);
      el.style.left = clamp(x, 0, W - 80) + 'px'; el.style.top = clamp(y, 0, H - 60) + 'px';
      if (def.h) el.style.height = Math.min(def.h, H - 40) + 'px';
    }
    void s;
  },
  drag(w) {
    let sx, sy, ox, oy, on = false;
    w.head.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || this.touch && window.innerWidth < 900) return;
      on = true; sx = e.clientX; sy = e.clientY; ox = w.el.offsetLeft; oy = w.el.offsetTop; w.head.setPointerCapture(e.pointerId);
    });
    w.head.addEventListener('pointermove', e => { if (!on) return; w.el.style.left = (ox + e.clientX - sx) + 'px'; w.el.style.top = Math.max(0, oy + e.clientY - sy) + 'px'; });
    w.head.addEventListener('pointerup', () => {
      if (!on) return; on = false;
      if (G.account) { G.account.winPos = G.account.winPos || {}; G.account.winPos[w.id] = [w.el.offsetLeft, w.el.offsetTop]; }
    });
  },

  // ------------------------------------------------------------ feedback
  error(msg) {
    if (!msg) return;
    if (this._lastErr === msg && performance.now() - this._lastErrT < 900) return;
    this._lastErr = msg; this._lastErrT = performance.now();
    const d = h('div', msg); this.errEl.append(d);
    setTimeout(() => d.remove(), 1700);
    while (this.errEl.children.length > 3) this.errEl.firstChild.remove();
    Audio.sfx('ui_error', { vol: 0.4 });
  },
  toast(iconName, text, color, iconOpts) {
    const el = h('div.toast.panel', iconName ? icon(iconName, iconOpts || ICON_THEMES.gold, 'ico s') : null, h('span', { style: { color: color || 'var(--ink)' } }, text));
    this.toastEl.append(el);
    setTimeout(() => el.remove(), 3900);
    while (this.toastEl.children.length > 6) this.toastEl.firstChild.remove();
  },
  banner(a, b = '', dur = 3.2) {
    this.bannerEl.querySelector('.b1').textContent = a;
    this.bannerEl.querySelector('.b2').textContent = b;
    this.bannerEl.classList.add('on');
    clearTimeout(this._bt); this._bt = setTimeout(() => this.bannerEl.classList.remove('on'), dur * 1000);
  },
  bossEmote(text) {
    this.emoteEl.textContent = text; this.emoteEl.classList.add('on');
    clearTimeout(this._et); this._et = setTimeout(() => this.emoteEl.classList.remove('on'), 3500);
    G.chat?.system(text, 'event');
  },
  loading(on, name) {
    if (on) {
      this.loadEl.querySelector('.zn').textContent = name || '';
      const tips = TIPS(); this.loadEl.querySelector('.tip').textContent = L(tips[Math.floor(Math.random() * tips.length)]);
      const bar = this.loadEl.querySelector('.loadbar > i'); bar.style.width = '10%'; setTimeout(() => bar.style.width = '85%', 30);
      this.loadEl.classList.add('on');
    } else { this.loadEl.querySelector('.loadbar > i').style.width = '100%'; setTimeout(() => this.loadEl.classList.remove('on'), 150); }
  },

  // ------------------------------------------------------------ tooltip
  tip(el, fn) {
    el.dataset.tip = '1';
    if (!this.touch) {
      el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') this.showTip(fn(), e.clientX, e.clientY); });
      el.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.moveTip(e.clientX, e.clientY); });
      el.addEventListener('pointerleave', () => this.hideTip());
    } else {
      let timer;
      el.addEventListener('pointerdown', e => { const x = e.clientX, y = e.clientY; timer = setTimeout(() => { this.showTip(fn(), x, y); el._tipShown = true; }, 380); });
      const cancel = () => { clearTimeout(timer); setTimeout(() => { if (el._tipShown) { el._tipShown = false; } }, 50); };
      el.addEventListener('pointerup', cancel); el.addEventListener('pointercancel', cancel); el.addEventListener('pointerleave', cancel);
    }
    return el;
  },
  showTip(content, x, y) {
    if (!content) return;
    this.tipEl.innerHTML = '';
    this.tipEl.append(content instanceof Node ? content : h('div', { html: content }));
    this.tipEl.classList.add('on');
    this.moveTip(x, y);
  },
  moveTip(x, y) {
    const el = this.tipEl, W = window.innerWidth, H = window.innerHeight;
    const r = el.getBoundingClientRect();
    let lx = x + 16, ly = y + 16;
    if (lx + r.width > W - 6) lx = x - r.width - 12;
    if (ly + r.height > H - 6) ly = H - r.height - 6;
    el.style.left = Math.max(6, lx) + 'px'; el.style.top = Math.max(6, ly) + 'px';
  },
  hideTip() { this.tipEl?.classList.remove('on'); },

  // ------------------------------------------------------------ modals
  modal(build, opts = {}) {
    const bg = h('div.modal-bg');
    const box = h('div.modal.panel', { style: opts.w ? { maxWidth: opts.w + 'px' } : null });
    bg.append(box);
    const close = () => { bg.remove(); opts.onClose?.(); };
    bg.addEventListener('pointerdown', e => { if (e.target === bg && !opts.sticky) close(); });
    build(box, close);
    document.body.append(bg);
    return close;
  },
  confirm(text, onYes, opts = {}) {
    return this.modal((box, close) => {
      box.append(h('h3', opts.title || L('Emin misin?|Are you sure?')), h('div', { style: { lineHeight: '1.5' } }, text),
        h('div.row', h('button.btn.ghost', { onclick: () => { close(); opts.onNo?.(); } }, opts.no || t('cancel')), h('button.btn.' + (opts.danger ? 'red' : 'primary'), { onclick: () => { close(); onYes(); } }, opts.yes || t('confirm'))));
    });
  },
  prompt(title, def, onOk, opts = {}) {
    return this.modal((box, close) => {
      const inp = h(opts.multiline ? 'textarea.txt-in' : 'input.txt-in', { value: def || '', maxlength: opts.max || 200, placeholder: opts.placeholder || '' });
      if (opts.multiline) { inp.style.height = '120px'; inp.style.padding = '8px'; inp.value = def || ''; }
      const ok = () => { const v = inp.value.trim(); close(); onOk(v); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !opts.multiline) ok(); e.stopPropagation(); });
      box.append(h('h3', title), opts.text ? h('div.muted', opts.text) : null, inp, h('div.row', h('button.btn.ghost', { onclick: close }, t('cancel')), h('button.btn.primary', { onclick: ok }, opts.okText || t('ok'))));
      setTimeout(() => { inp.focus(); if (opts.select) inp.select(); }, 50);
    });
  },
  info(title, content) {
    return this.modal((box, close) => { box.append(h('h3', title), content instanceof Node ? content : h('div', { style: { lineHeight: '1.55' }, html: content }), h('div.row', h('button.btn.primary', { onclick: close }, t('ok')))); });
  },
};

function TIPS() {
  return [
    'İpucu: Takla atarak (Shift / ⤼) düşmanların yere çizdiği kırmızı alanlardan kaçabilirsin.|Tip: Roll (Shift / ⤼) to escape the red areas enemies draw on the ground.',
    'İpucu: Zindanlara NPC yoldaşlarınla tek başına girebilirsin.|Tip: You can enter dungeons solo with NPC companions.',
    'İpucu: Güçlendirme başarısız olursa eşyan asla kırılmaz; bir sonraki şansın artar.|Tip: Failed enhancements never break your item — your next chance increases.',
    'İpucu: Çevrimdışıyken dinlenmiş tecrübe biriktirirsin.|Tip: You accumulate rested experience while offline.',
    'İpucu: Yetenek ağacını istediğin zaman ücretsiz sıfırlayabilirsin.|Tip: You can reset your talents for free at any time.',
    'İpucu: Dünya patronları belirli aralıklarla ortaya çıkar; diğer maceracılar da yardıma gelir.|Tip: World bosses appear periodically, and other adventurers join the fight.',
    'İpucu: Balık tutmak, maden kazmak ve şifalı ot toplamak zanaatin temelidir.|Tip: Fishing, mining and herb gathering are the foundation of crafting.',
    'İpucu: Pazar\'da diğer oyunculardan eşya alıp satabilirsin.|Tip: Buy and sell items with other players at the Market.',
    'İpucu: Haftalık görevler birikir — kaçırmaktan korkma.|Tip: Weekly bounties accumulate — no fear of missing out.',
    'İpucu: Görev takipçisindeki "Git" düğmesi seni hedefe otomatik yürütür.|Tip: The "Go" button in the quest tracker auto-walks you to the objective.',
  ];
}
G.ui = UI;
G.iconURL = (name, opts = {}) => iconURL(name, { size: 64, ...ICON_THEMES.ui, ...opts });
