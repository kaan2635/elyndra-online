// In-game HUD: unit frames, minimap, tracker, action bars, mobile controls, chat, xp.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { clamp, fmtNum, fmtCd, dist2, fmtGold } from '../core/util.js';
import { h, icon, UI, skillIcon, uiIcon, themeOf } from './ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { SKILLS } from '../data/skills.js';
import { CLASSES, RES, xpNeed, MAX_LEVEL } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { skillCost, skillRange } from '../game/skillsys.js';
import { countItem, itemIconOpts } from '../game/items.js';
import { Audio } from '../audio.js';

const BAR_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
const BAR_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function bar(cls, withLag = true) {
  const el = h('div.bar.' + cls, withLag ? h('i.lag') : null, h('i.v'), h('b'));
  el._v = el.querySelector('i.v'); el._lag = el.querySelector('i.lag'); el._t = el.querySelector('b');
  return el;
}
function setBar(el, cur, max, text) {
  const p = clamp(max > 0 ? cur / max : 0, 0, 1);
  const k = Math.round(p * 1000);
  if (el._k !== k) { el._k = k; el._v.style.transform = `scaleX(${p})`; if (el._lag) el._lag.style.transform = `scaleX(${p})`; }
  if (text !== undefined && el._txt !== text) { el._txt = text; el._t.textContent = text; }
}

export const HUD = {
  build() {
    const root = h('div#hud');
    this.root = root;
    // ---- player frame
    this.pPortrait = h('div.portrait'); this.pLvl = h('div.lvl', '1');
    this.pName = h('div.nm'); this.pHp = bar('hp'); this.pRes = bar('mana'); this.pCombo = h('div.combo');
    for (let i = 0; i < 5; i++) this.pCombo.append(h('i'));
    this.pFrame = h('div#pframe.unitframe.panel', h('div', { style: { position: 'relative' } }, this.pPortrait, this.pLvl), h('div.bars', this.pName, this.pHp, this.pRes, this.pCombo));
    this.pFrame.addEventListener('click', () => G.playerCtl?.setTarget(G.player));
    this.pBuffs = h('div#pbuffs.buffs');
    // ---- target frame
    this.tPortrait = h('div.portrait'); this.tLvl = h('div.lvl');
    this.tName = h('div.nm'); this.tHp = bar('hp'); this.tCast = h('div.cast', bar('cast', false)); this.tBuffs = h('div#tbuffs.buffs');
    this.tFrame = h('div#tframe.unitframe.panel', h('div', { style: { position: 'relative' } }, this.tPortrait, this.tLvl), h('div.bars', this.tName, this.tHp, this.tCast), this.tBuffs);
    // ---- party
    this.partyEl = h('div#party');
    // ---- minimap
    this.mmCanvas = h('canvas', { width: 320, height: 320 });
    this.mmZone = h('div.zn'); this.mmInfo = h('div.info');
    this.mmBtns = h('div.mbtns');
    this.minimap = h('div#minimap', h('div.mm', { onclick: () => UI.toggle('map') }, this.mmCanvas), this.mmZone, this.mmInfo, this.mmBtns);
    // ---- tracker
    this.tracker = h('div#tracker');
    // ---- action bar
    this.castbar = h('div#castbar', bar('cast', false));
    this.abar = h('div.abar.panel');
    this.btns = [];
    for (let i = 0; i < 10; i++) {
      const b = this.makeBtn(i, BAR_LABELS[i]);
      this.btns.push(b); this.abar.append(b);
    }
    this.actionbar = h('div#actionbar', this.castbar, this.abar);
    this.xp = h('div#xpbar', h('i.rest'), h('i.cur'), h('b'));
    for (let i = 1; i < 10; i++) this.xp.append(h('div.tick', { style: { left: (i * 10) + '%' } }));
    // ---- menu: a few labelled primary buttons + one grouped main menu
    this.menubar = h('div#menubar');
    this.menuBtns = {};
    const PRIMARY = [['char', 'person', 'menuChar', 'C'], ['bag', 'backpack', 'menuBag', 'B'], ['skills', 'book_open', 'menuSkills', 'K'], ['quests', 'quest_exclaim', 'menuQuests', 'L'], ['map', 'map', 'menuMap', 'M']];
    for (const [id, ic, key, kb] of PRIMARY) {
      const dot = h('span.dot');
      const b = h('button.mb', { onclick: () => UI.toggle(id), title: t(key) + ' (' + kb + ')' }, h('img', { src: uiIcon(ic), alt: '' }), h('span.mbl', t(key)), dot);
      b._dot = dot; this.menuBtns[id] = b; this.menubar.append(b);
    }
    const menuBtn = h('button.mb.menu', { onclick: () => this.toggleMenuGrid(), title: L('Menü|Menu') + ' (Esc)' }, h('span.burger', h('i'), h('i'), h('i')), h('span.mbl', L('Menü|Menu')));
    this.menuBtns.menu = menuBtn; this.menubar.append(menuBtn);
    this.goldEl = h('div#goldline');
    // ---- chat
    this.chatLog = h('div.log');
    this.chatTabs = h('div.ctabs');
    this.chatInput = h('input', { placeholder: L('Mesaj yaz… (Enter)|Type a message… (Enter)'), maxlength: 160 });
    this.chatToggle = h('button.chat-toggle', { onclick: () => this.chat.classList.toggle('min'), title: L('Sohbeti aç/kapat|Toggle chat') }, '');
    this.chat = h('div#chat', h('div.chead', this.chatTabs, this.chatToggle), this.chatLog, h('div.cin', this.chatInput, h('button.send', { onclick: () => this.sendChat(), title: L('Gönder|Send') }, '➤')));
    this.chatInput.addEventListener('focus', () => { UI.chatFocused = true; });
    this.chatInput.addEventListener('blur', () => { UI.chatFocused = false; });
    this.chatInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { this.sendChat(); this.chatInput.blur(); } if (e.key === 'Escape') this.chatInput.blur(); });
    // ---- interact
    this.interactBtn = h('button#interact.btn.primary.big', { onclick: () => G.playerCtl?.interactNearest() });
    // ---- death
    this.death = h('div#deathscreen', h('h2', t('youDied')), h('div.muted', t('respawnHint')), h('button.btn.primary.big', { onclick: () => G.respawn?.() }, t('respawn')));
    this.fps = h('div#fps');
    root.append(this.pFrame, this.pBuffs, this.tFrame, this.partyEl, this.minimap, this.tracker, this.actionbar, this.xp, this.menubar, this.goldEl, this.chat, this.interactBtn);
    UI.root.append(root, this.death, this.fps);
    // ---- mobile controls
    this.buildMobile();
    UI.applyScale();
    // ui hooks
    UI.castBar = c => this.showCast(c);
    UI.setInteract = n => this.showInteract(n);
    UI.joystick = j => this.joy(j);
    G.events.on('barChanged', () => this.refreshBar());
    G.events.on('levelUp', () => this.refreshBar());
    G.events.on('chat', m => this.addChat(m));
    G.events.on('questsChanged', () => this.refreshTracker());
    G.events.on('bagChanged', () => { this._potDirty = true; });
    this.chatChannel = 'all';
    this.buildChatTabs();
    this.refreshBar();
    this.refreshTracker();
  },
  makeBtn(i, key) {
    const img = h('img'); const cd = h('div.cd'); const cdt = h('div.cdt'); const cnt = h('span.cnt');
    const b = h('button.abtn', img, cd, cdt, key ? h('span.key', key) : null, cnt);
    b._img = img; b._cd = cd; b._cdt = cdt; b._cnt = cnt; b._i = i;
    const fire = e => { e.preventDefault(); e.stopPropagation(); this.press(b._i); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); };
    b.addEventListener('pointerdown', fire);
    UI.tip(b, () => this.btnTip(b._i));
    return b;
  },
  btnTip(i) {
    const slot = G.char?.bar?.[i]; if (!slot) return null;
    if (slot.startsWith('item:')) { const id = this.resolvePotion(slot.slice(5)); return id ? h('div', h('div.tn', L(ITEMS[id].name)), h('div.ts', t('use'))) : null; }
    const sk = SKILLS[slot]; if (!sk) return null;
    const u = G.player;
    const cost = skillCost(u, sk);
    return h('div', h('div.tn', { style: { color: '#ffe08a' } }, L(sk.name)),
      h('div.ts', h('span', cost ? Math.round(cost) + ' ' + L(RES[u.resType].name) : t('free')), h('span', sk.cast ? sk.cast + L(' sn döküm| sec cast') : sk.channel ? L('Kanal|Channel') : L('Anında|Instant'))),
      h('div.ts', h('span', sk.range ? sk.range + 'm' : sk.melee ? L('Yakın|Melee') : ''), h('span', sk.cd ? L('Bekleme: |Cooldown: ') + sk.cd + L(' sn| sec') : '')),
      h('div.desc', sk.desc(u, G.X)));
  },
  press(i) {
    const slot = G.char?.bar?.[i];
    if (!slot) { UI.open('skills'); return; }
    if (slot.startsWith('item:')) { const id = this.resolvePotion(slot.slice(5)); if (id) G.inv?.useItemId(id); else UI.error(L('İksirin yok|No potions')); return; }
    if (SKILLS[slot] && SKILLS[slot].lvl > G.player.level) { UI.error(L(`Seviye ${SKILLS[slot].lvl} gerekli|Requires level ${SKILLS[slot].lvl}`)); return; }
    G.playerCtl?.cast(slot);
  },
  resolvePotion(kind) {
    const ch = G.char; if (!ch) return null;
    const order = kind === 'mp' ? ['mp4', 'mp3', 'mp2', 'mp1'] : kind === 'hp' ? ['hp4', 'hp3', 'hp2', 'hp1'] : [kind];
    for (const id of order) if (countItem(ch, id) > 0) return id;
    return null;
  },
  refreshBar() {
    const ch = G.char, u = G.player; if (!ch || !u) return;
    const all = [...this.btns, ...(this.mBtns || [])];
    for (const b of all) {
      const slot = ch.bar[b._i];
      b.classList.toggle('empty', !slot);
      if (this.mBtns?.includes(b)) b.style.display = slot || b === this.mBtns[0] ? '' : 'none';
      if (!slot) { b._img.src = uiIcon('plus', { dim: true }); b._img.style.opacity = 0.25; b._sk = null; continue; }
      b._img.style.opacity = 1;
      if (slot.startsWith('item:')) {
        const kind = slot.slice(5);
        b._img.src = iconURL(kind === 'mp' ? 'potion_blue' : kind === 'hp' ? 'potion_red' : (ITEMS[kind]?.icon || 'bag'), { size: 64, frame: '#6b5432' });
        b._sk = null; b._item = kind;
      } else {
        const sk = SKILLS[slot]; b._sk = sk; b._item = null;
        if (sk) b._img.src = skillIcon(sk);
      }
    }
    this._potDirty = true;
  },
  showCast(c) {
    if (!c) { this.castbar.classList.remove('on'); this.curCast = null; return; }
    this.curCast = c; this.castbar.classList.add('on');
  },
  showInteract(n) {
    const b = this.interactBtn;
    if (!n || G.player?.dead) { b.classList.remove('on'); if (this.mInteract) this.mInteract.style.display = 'none'; return; }
    let label;
    if (n.unit) label = n.unit.kind === 'npc' ? t('talkTo') + ': ' + n.unit.name : L('Ganimet|Loot');
    else label = (n.ia.verb || t('interact')) + ': ' + (n.ia.label || '');
    if (b._l !== label) { b._l = label; b.textContent = (UI.touch ? '' : '[F] ') + label; }
    b.classList.add('on');
  },
  joy(j) {
    if (!this.joyBase) return;
    if (!j || !j.active) { this.joyBase.style.display = 'none'; this.joyKnob.style.display = 'none'; this.joyHint.style.display = G.settings?.fixedJoy ? 'none' : 'flex'; return; }
    this.joyHint.style.display = 'none';
    this.joyBase.style.display = 'block'; this.joyKnob.style.display = 'block';
    this.joyBase.style.left = j.sx + 'px'; this.joyBase.style.top = j.sy + 'px';
    this.joyKnob.style.left = (j.sx + j.vx * 56) + 'px'; this.joyKnob.style.top = (j.sy + j.vy * 56) + 'px';
  },
  buildMobile() {
    const m = h('div#mobile');
    this.joyBase = h('div#joyBase'); this.joyKnob = h('div#joyKnob'); this.joyHint = h('div#joyHint', L('Hareket|Move'));
    const sk = h('div#mskills');
    this.mBtns = [];
    // main attack (slot 0) + arcs
    const main = this.makeBtn(0); main.classList.add('main'); sk.append(main); this.mBtns.push(main);
    const inner = [[100, 4], [96, 62], [62, 100], [6, 104]]; // [right, bottom] offsets for slots 1..4
    const outer = [[170, 6], [160, 76], [118, 132], [62, 168], [4, 172]]; // slots 5..9
    inner.forEach(([r, bt], i) => { const b = this.makeBtn(i + 1); b.style.right = r + 'px'; b.style.bottom = bt + 'px'; sk.append(b); this.mBtns.push(b); });
    outer.forEach(([r, bt], i) => { const b = this.makeBtn(i + 5); b.style.right = r + 'px'; b.style.bottom = bt + 'px'; b.style.width = '48px'; b.style.height = '48px'; sk.append(b); this.mBtns.push(b); });
    main.style.right = '0px'; main.style.bottom = '0px';
    const rb = (label, ic, fn, r, b, cls = '', theme = ICON_THEMES.ui) => { const e = h('button.mround' + cls, { style: { right: r + 'px', bottom: b + 'px' } }, ic ? h('img', { src: iconURL(ic, { size: 64, ...theme }) }) : label); e.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); Audio.sfx('ui_click', { vol: 0.4 }); fn(); }); sk.append(e); return e; };
    rb('', 'sprint', () => G.playerCtl?.dodge(), 236, 64, '.mr-dodge');
    rb('', 'arrow_up', () => G.playerCtl?.jump(), 236, 118, '.mr-jump');
    rb('', 'mark', () => G.playerCtl?.cycleTarget(), 214, 172, '.mr-target');
    this.mInteract = null;
    m.append(this.joyBase, this.joyKnob, this.joyHint, sk);
    UI.root.append(m);
    // mount / autorun quick buttons under minimap
    this.mmBtns.append(
      h('button.mbtn', { onclick: () => G.mounts?.toggle(), title: t('mount') + ' (T)' }, h('img', { src: uiIcon('horse') })),
      h('button.mbtn', { onclick: () => G.travel?.openWaystones(), title: t('waystone') }, h('img', { src: uiIcon('portal') })),
    );
    if (UI.touch) {
      this.mmBtns.prepend(h('button.mbtn.menu', { onclick: () => this.toggleMenuGrid(), title: L('Menü|Menu') }, h('span.burger', h('i'), h('i'), h('i'))));
      this.mmBtns.append(h('button.mbtn', { onclick: () => UI.toggle('bag'), title: t('menuBag') }, h('img', { src: uiIcon('backpack') })));
      this.mmBtns.append(h('button.mbtn', { onclick: () => { this.chat.classList.toggle('min'); }, title: 'Chat' }, h('img', { src: uiIcon('chat') })));
      this.chat.classList.add('min');
    }
  },

  toggleMenuGrid() {
    if (this.menuGrid) { this.menuGrid.remove(); this.menuGrid = null; return; }
    const GROUPS = [
      [L('Karakter|Character'), [['char', 'person', 'menuChar', 'C'], ['bag', 'backpack', 'menuBag', 'B'], ['skills', 'book_open', 'menuSkills', 'K'], ['talents', 'talent', 'menuTalents', 'N'], ['collect', 'horse', 'menuCollect', 'V'], ['ach', 'trophy', 'menuAch', 'Y']]],
      [L('Dünya|World'), [['quests', 'quest_exclaim', 'menuQuests', 'L'], ['map', 'map', 'menuMap', 'M'], ['dungeon', 'dungeon', 'menuDungeon', 'H'], ['arena', 'sword_cross', 'menuArena', 'Z'], ['home', 'house', 'menuHome', 'E']]],
      [L('Ekonomi & Sosyal|Economy & Social'), [['craft', 'hammer_anvil', 'menuCraft', 'J'], ['market', 'scales', 'menuMarket', 'U'], ['social', 'users', 'menuSocial', 'O']]],
    ];
    const close = () => { this.menuGrid?.remove(); this.menuGrid = null; };
    const tile = ([id, ic, key, kb]) => h('button.mtile', { onclick: () => { close(); UI.open(id); } }, h('img', { src: uiIcon(ic) }), h('span', t(key)), UI.touch ? null : h('kbd', kb));
    const ch = G.char;
    const box = h('div.mainmenu.panel',
      h('div.mm-head', h('div.title', L('Menü|Menu')), ch ? h('div.mm-gold', h('img', { src: iconURL('coins', { size: 32, ...ICON_THEMES.gold }) }), fmtGold(ch.gold)) : null, h('button.x', { onclick: close }, '✕')),
      ...GROUPS.map(([title, items]) => h('section', h('h4', title), h('div.mm-grid', ...items.map(tile)))),
      h('div.mm-foot',
        h('button.btn.ghost', { onclick: () => { close(); UI.open('settings'); } }, '⚙ ' + t('settings')),
        h('button.btn.ghost', { onclick: () => { close(); G.endSession?.(); G.title.worldReady = false; G.title.show(); G.title.screen = 'select'; G.title.render(); } }, L('Karakter Seçimine Dön|Back to Character Select'))));
    const bg = h('div.mainmenu-bg', { onpointerdown: e => { if (e.target === bg) close(); } }, box);
    UI.root.append(bg); this.menuGrid = bg;
  },

  // ------------------------------------------------------------ chat
  buildChatTabs() {
    this.chatTabs.innerHTML = '';
    for (const [k, l] of [['all', L('Tümü|All')], ['world', L('Dünya|World')], ['party', L('Grup|Party')], ['guild', L('Lonca|Guild')], ['system', L('Sistem|System')]]) {
      this.chatTabs.append(h('span.ctab' + (k === this.chatChannel ? '.on' : ''), { onclick: () => { this.chatChannel = k; this.buildChatTabs(); this.rebuildChat(); } }, l));
    }
  },
  addChat(m) {
    if (!this.chatMsgs) this.chatMsgs = [];
    this.chatMsgs.push(m); if (this.chatMsgs.length > 150) this.chatMsgs.shift();
    if (this.filterChat(m)) this.appendChat(m);
  },
  filterChat(m) {
    const c = this.chatChannel;
    if (c === 'all') return true;
    if (c === 'system') return ['system', 'loot', 'event'].includes(m.ch);
    if (c === 'world') return ['world', 'zone', 'online', 'say'].includes(m.ch);
    return m.ch === c || (c === 'party' && m.ch === 'whisper');
  },
  appendChat(m) {
    const log = this.chatLog;
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
    const chName = { world: L('Dünya|World'), zone: L('Bölge|Zone'), party: L('Grup|Party'), guild: L('Lonca|Guild'), whisper: L('Fısıltı|Whisper'), online: 'P2P', say: L('Konuş|Say') }[m.ch];
    const line = h('div.m.ch-' + m.ch, chName ? '[' + chName + '] ' : '', m.from ? h('span.who', { onclick: () => G.social?.clickName?.(m.from) }, m.from + ': ') : '', m.text);
    log.append(line);
    while (log.children.length > 120) log.firstChild.remove();
    if (atBottom) log.scrollTop = log.scrollHeight;
  },
  rebuildChat() { this.chatLog.innerHTML = ''; for (const m of this.chatMsgs || []) if (this.filterChat(m)) this.appendChat(m); this.chatLog.scrollTop = this.chatLog.scrollHeight; },
  sendChat() {
    const v = this.chatInput.value.trim(); this.chatInput.value = '';
    if (v) G.chat?.send(v, this.chatChannel);
  },
  focusChat() { this.chat.classList.remove('min'); this.chatInput.focus(); },

  // ------------------------------------------------------------ tracker
  refreshTracker() {
    const tr = this.tracker; tr.innerHTML = '';
    const Q = G.quests; if (!Q || !G.char) return;
    const list = Q.trackedList();
    if (!list.length) return;
    tr.append(h('div.th', { onclick: () => tr.classList.toggle('collapsed') }, h('span', t('menuQuests')), h('span.muted', String(list.length))));
    for (const q of list.slice(0, 5)) {
      const st = Q.state(q.id);
      const done = Q.isComplete(q.id);
      const qn = h('div.qn' + (done ? '.done' : ''), done ? '✔ ' : '', L(q.name));
      const go = h('span.goBtn', { onclick: e => { e.stopPropagation(); Q.autoPath(q.id); } }, L('Git|Go'));
      qn.append(go);
      const el = h('div.tq', { onclick: () => UI.open('quests', q.id) }, qn);
      if (done) el.append(h('div.ob', L('Teslim et: |Turn in: ') + (Q.turnInName(q) || '')));
      else q.obj.forEach((o, i) => { const n = st.p[i] || 0; el.append(h('div.ob' + (n >= (o.n || 1) ? '.ok' : ''), Q.objText(o) + (o.n > 1 || o.t !== 'talk' ? `  ${Math.min(n, o.n || 1)}/${o.n || 1}` : ''))); });
      tr.append(el);
    }
  },

  // ------------------------------------------------------------ per frame
  update(dt) {
    const u = G.player, ch = G.char; if (!u || !ch) return;
    const C = CLASSES[u.cls];
    // player frame
    if (this._pn !== u.name) { this._pn = u.name; this.pName.textContent = u.name; this.pPortrait.innerHTML = ''; this.pPortrait.append(G.portrait?.(u) || h('img', { src: iconURL(C.icon, { size: 64, ...ICON_THEMES.ui }) })); }
    if (this._pl !== u.level) { this._pl = u.level; this.pLvl.textContent = u.level; }
    setBar(this.pHp, u.hp, u.stats.maxHp, `${fmtNum(u.hp)} / ${fmtNum(u.stats.maxHp)}`);
    if (this.pRes._type !== u.resType) { this.pRes._type = u.resType; this.pRes.className = 'bar ' + u.resType; }
    setBar(this.pRes, u.res, u.stats.maxRes, `${Math.floor(u.res)} / ${Math.round(u.stats.maxRes)}`);
    this.pCombo.style.display = u.cls === 'rogue' ? 'flex' : 'none';
    if (u.cls === 'rogue') [...this.pCombo.children].forEach((e, i) => e.classList.toggle('on', i < u.combo));
    this.updBuffs(this.pBuffs, u, false);
    // target
    const tg = u.target;
    if (tg && !tg.removed) {
      this.tFrame.classList.add('on');
      if (this._tg !== tg) {
        this._tg = tg;
        this.tName.innerHTML = '';
        this.tName.append(h('span', { style: { color: u.isEnemy(tg) ? '#ff8a7a' : tg.kind === 'npc' ? '#ffe08a' : '#8affb0' } }, tg.name));
        if (tg.isBoss) this.tName.append(h('span.elite-tag.boss-tag', L('Patron|Boss'))); else if (tg.elite) this.tName.append(h('span.elite-tag', tg.rare ? L('Nadir Elit|Rare Elite') : L('Elit|Elite')));
        this.tPortrait.innerHTML = '';
        const ic = tg.cls ? CLASSES[tg.cls].icon : tg.kind === 'npc' ? 'person' : ({ beast: 'paw', undead: 'skull', elemental: 'crystal', demon: 'skull_crown', slime: 'potion_green', dragon: 'skull_crown', humanoid: 'sword', critter: 'paw', pet: 'paw' }[tg.data?.family] || 'skull');
        this.tPortrait.append(h('img', { src: iconURL(ic, { size: 64, ...(u.isEnemy(tg) ? ICON_THEMES.blood : ICON_THEMES.ui) }) }));
        this.tLvl.textContent = tg.level > u.level + 9 ? '??' : tg.level;
        const dl = tg.level - u.level;
        this.tLvl.style.color = !u.isEnemy(tg) ? 'var(--gold)' : dl >= 5 ? '#ff4040' : dl >= 3 ? '#ff9a2a' : dl >= -2 ? '#ffe040' : dl >= -6 ? '#5dd87a' : '#9a9a9a';
      }
      setBar(this.tHp, tg.dead ? 0 : tg.hp, tg.stats.maxHp, tg.dead ? L('Ölü|Dead') : `${fmtNum(tg.hp)} (${Math.ceil(tg.hp / tg.stats.maxHp * 100)}%)`);
      const c = tg.cast;
      if (c && !tg.dead) { this.tCast.classList.add('on'); setBar(this.tCast.firstChild, c.t, c.dur, c.name || (c.sk ? L(c.sk.name) : '')); }
      else this.tCast.classList.remove('on');
      this.updBuffs(this.tBuffs, tg, true);
    } else { this.tFrame.classList.remove('on'); this._tg = null; }
    // cast bar
    if (this.curCast) {
      const c = u.cast;
      if (!c) this.showCast(null);
      else setBar(this.castbar.firstChild, c.channel ? c.dur - c.t : c.t, c.dur, `${L(c.sk.name)}  ${(c.dur - c.t).toFixed(1)}`);
    }
    // action buttons
    this.updButtons(u);
    // xp
    const need = xpNeed(u.level);
    const xpEl = this.xp;
    const px = u.level >= MAX_LEVEL ? 1 : clamp(ch.xp / need, 0, 1);
    const rx = u.level >= MAX_LEVEL ? 0 : clamp((ch.xp + (ch.rested || 0)) / need, 0, 1);
    xpEl.children[1].style.width = (px * 100) + '%'; xpEl.children[0].style.width = (rx * 100) + '%';
    const xt = u.level >= MAX_LEVEL ? L('Ustalık|Mastery') + ' ' + (ch.mastery?.lvl || 0) : `${t('xp')} ${fmtNum(ch.xp)} / ${fmtNum(need)}  (${(px * 100).toFixed(1)}%)` + (ch.rested > 0 ? '  · ' + t('rested') : '');
    if (xpEl._t !== xt) { xpEl._t = xt; xpEl.children[2].textContent = xt; }
    // gold
    const gt = fmtGold(ch.gold);
    if (this._gold !== gt) { this._gold = gt; this.goldEl.innerHTML = ''; this.goldEl.append(h('img', { src: iconURL('coins', { size: 32, ...ICON_THEMES.gold }), style: { width: '18px', height: '18px' } }), h('span.gold', gt)); }
    // minimap (10 fps)
    this._mmT = (this._mmT || 0) - dt;
    if (this._mmT <= 0) { this._mmT = 0.1; this.drawMinimap(); this.updParty(); }
    // death screen
    this.death.classList.toggle('on', u.dead && !G.dungeons?.wipePending);
    // fps
    if (G.settings.showFps) { this._fc = (this._fc || 0) + 1; this._ft = (this._ft || 0) + dt; if (this._ft > 0.5) { this.fps.textContent = Math.round(this._fc / this._ft) + ' FPS · ' + G.engine.renderer.info.render.calls + ' dc'; this._fc = 0; this._ft = 0; } } else if (this.fps.textContent) this.fps.textContent = '';
  },
  updButtons(u) {
    const all = UI.touch ? this.mBtns : this.btns;
    const tg = u.target;
    for (const b of all) {
      const sk = b._sk;
      if (b._item) {
        const id = this.resolvePotion(b._item);
        const n = id ? countItem(G.char, id) : 0;
        if (b._n !== n) { b._n = n; b._cnt.textContent = n || ''; b.classList.toggle('nores', !n); }
        const pcd = G.inv?.potionCd || 0;
        this.setCd(b, pcd, 30);
        continue;
      }
      if (!sk) { if (b._cdt.textContent) { b._cdt.textContent = ''; b._cd.style.background = ''; } continue; }
      const locked = sk.lvl > u.level;
      b.classList.toggle('locked', locked);
      if (locked) { b._cdt.textContent = sk.lvl; continue; }
      const cd = Math.max(u.cds[sk.id] || 0, sk.gcd !== false ? u.gcd : 0);
      const total = (u.cds[sk.id] || 0) > u.gcd ? sk.cd : 1;
      this.setCd(b, cd, total);
      b.classList.toggle('nores', u.res < skillCost(u, sk) - 0.01);
      let oor = false;
      if (sk.target === 'enemy' && tg && u.isEnemy(tg) && !tg.dead) oor = u.edgeDist(tg) > skillRange(u, sk) + 0.3;
      b.classList.toggle('range', oor);
      b.classList.toggle('active', !!(u.cast && u.cast.sk === sk) || (sk.id === 'g_stealth' && u.hasBuff('stealth')));
    }
  },
  setCd(b, cd, total) {
    if (cd > 0.05) {
      const p = clamp(cd / Math.max(total, 0.01), 0, 1);
      const deg = Math.round(p * 360);
      if (b._deg !== deg) { b._deg = deg; b._cd.style.background = `conic-gradient(rgba(0,0,0,.72) ${deg}deg, transparent ${deg}deg)`; }
      const txt = cd > 1.5 ? fmtCd(cd) : '';
      if (b._cdt.textContent !== txt) b._cdt.textContent = txt;
    } else if (b._deg) { b._deg = 0; b._cd.style.background = ''; b._cdt.textContent = ''; }
  },
  updBuffs(el, u, onlyMine) {
    const list = u.buffs.filter(b => b.icon && (!onlyMine || b.debuff || u === G.player || !u.isEnemy?.(G.player))).slice(0, 16);
    const sig = list.map(b => b.id + (b.stacks || 1)).join(',');
    if (el._sig !== sig) {
      el._sig = sig; el.innerHTML = '';
      for (const b of list) {
        const th = b.debuff ? ICON_THEMES.blood : ICON_THEMES.ui;
        const e = h('div.buff' + (b.debuff ? '.deb' : ''), h('img', { src: iconURL(b.icon, { size: 48, fill: th.fill, bg: th.bg, frame: null }) }), h('span'), b.stacks > 1 ? h('em', String(b.stacks)) : null);
        e._b = b;
        UI.tip(e, () => h('div', h('div.tn', L(b.name || '')), b.debuff ? h('div.bad', L('Zararlı etki|Debuff')) : null, b.left !== Infinity && b.left < 9999 ? h('div.ts', Math.ceil(b.left) + L(' sn kaldı| sec left')) : null));
        el.append(e);
      }
    }
    for (const e of el.children) { const b = e._b; if (!b) continue; const s = e.querySelector('span'); const txt = b.left > 3600 || b.left === Infinity ? '' : b.left > 60 ? Math.ceil(b.left / 60) + 'm' : Math.ceil(b.left) + ''; if (s.textContent !== txt) s.textContent = txt; }
  },
  updParty() {
    const P = G.party; const el = this.partyEl;
    const ms = P ? P.members() : [];
    const sig = ms.map(m => m.id).join(',');
    if (el._sig !== sig) {
      el._sig = sig; el.innerHTML = '';
      for (const m of ms) {
        const hp = bar('hp sm', false), rs = bar('mana sm', false);
        const e = h('div.pmember.panel', { onclick: () => G.playerCtl?.setTarget(m) }, h('img.ic', { src: iconURL(CLASSES[m.cls].icon, { size: 48, ...ICON_THEMES.ui }) }), h('div.bars', h('div.nm', m.name + ' · ' + m.level), hp, rs));
        e._m = m; e._hp = hp; e._rs = rs;
        el.append(e);
      }
    }
    for (const e of el.children) {
      const m = e._m;
      setBar(e._hp, m.hp, m.stats.maxHp, '');
      if (e._rs._type !== m.resType) { e._rs._type = m.resType; e._rs.className = 'bar sm ' + m.resType; }
      setBar(e._rs, m.res, m.stats.maxRes, '');
      e.classList.toggle('dead', m.dead); e.classList.toggle('sel', G.player.target === m);
    }
  },
  drawMinimap() {
    const W = G.world, u = G.player; if (!W || !u) return;
    const cv = this.mmCanvas, c = cv.getContext('2d');
    const S = cv.width, R = S / 2;
    const span = 90; // world units across
    const scale = S / span;
    c.save(); c.clearRect(0, 0, S, S);
    c.beginPath(); c.arc(R, R, R, 0, Math.PI * 2); c.clip();
    c.fillStyle = W.dungeon ? '#141018' : '#1a2418'; c.fillRect(0, 0, S, S);
    const map = W.dungeon ? W.dungeon.mapCanvas : W.mapCanvas;
    const size = W.dungeon ? W.dungeon.size : W.terrain.size;
    if (map) {
      const k = map.width / size;
      const sx = (u.pos.x + size / 2 - span / 2) * k, sy = (u.pos.z + size / 2 - span / 2) * k;
      c.imageSmoothingEnabled = true;
      c.drawImage(map, sx, sy, span * k, span * k, 0, 0, S, S);
    }
    const toM = (x, z) => [R + (x - u.pos.x) * scale, R + (z - u.pos.z) * scale];
    // markers
    const dot = (x, z, col, r = 4) => { const [mx, my] = toM(x, z); if ((mx - R) ** 2 + (my - R) ** 2 > (R - 6) ** 2) return; c.fillStyle = col; c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 1.5; c.stroke(); };
    const edgeIcon = (x, z, txt, col) => {
      let [mx, my] = toM(x, z); const dx = mx - R, dy = my - R, d = Math.hypot(dx, dy);
      if (d > R - 12) { mx = R + dx / d * (R - 12); my = R + dy / d * (R - 12); }
      c.font = '900 22px Cinzel, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText(txt, mx, my); c.fillStyle = col; c.fillText(txt, mx, my);
    };
    for (const ia of W.interactables) {
      if (ia.kind === 'waystone') dot(ia.x, ia.z, '#6ad8ff', 6);
      else if (ia.kind === 'portal' || ia.kind === 'exit') dot(ia.x, ia.z, '#b86aff', 7);
      else if (ia.kind === 'dungeon') dot(ia.x, ia.z, '#ff6a3a', 7);
      else if (ia.kind === 'node' && !ia.hidden) dot(ia.x, ia.z, ia.col || '#c8a060', 3);
      else if (ia.kind === 'quest' && !ia.hidden) dot(ia.x, ia.z, '#ffd23a', 5);
    }
    for (const o of W.units) {
      if (o === u || o.removed) continue;
      const d2 = (o.pos.x - u.pos.x) ** 2 + (o.pos.z - u.pos.z) ** 2;
      if (d2 > (span * 0.7) ** 2) continue;
      if (o.kind === 'npc') { const mk = G.quests?.npcMarker(o); dot(o.pos.x, o.pos.z, mk ? '#ffd23a' : '#e8e0c0', mk ? 6 : 4); }
      else if (o.kind === 'monster' && !o.dead && !o.passive) dot(o.pos.x, o.pos.z, o.isBoss ? '#ff2a2a' : o.elite ? '#ff8a2a' : '#d84a3a', o.isBoss ? 7 : 3.5);
      else if ((o.kind === 'bot' || o.kind === 'remote') && !o.dead) dot(o.pos.x, o.pos.z, o.inParty ? '#5dd87a' : '#6ab4ff', 4);
    }
    // quest objective markers
    for (const m of G.quests?.mapMarkers() || []) edgeIcon(m.x, m.z, m.turnin ? '?' : '◆', m.turnin ? '#ffd23a' : '#ffb02a');
    // player arrow
    c.translate(R, R); c.rotate(-u.yaw + Math.PI);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, -13); c.lineTo(9, 10); c.lineTo(0, 5); c.lineTo(-9, 10); c.closePath(); c.stroke(); c.fill();
    c.restore();
    // camera direction wedge
    c.save(); c.translate(R, R); c.rotate(-G.engine.cam.yaw + Math.PI);
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); c.fill(); c.restore();
    // labels
    const z = G.zones?.current;
    const zn = z ? L(z.name) : '';
    if (this._zn !== zn) { this._zn = zn; this.mmZone.textContent = zn; }
    const ingame = G.engine.dayTime * 24;
    const hh = Math.floor(ingame), mm = Math.floor((ingame - hh) * 60);
    const info = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ·  ${Math.round(u.pos.x)}, ${Math.round(-u.pos.z)}`;
    if (this._mi !== info) { this._mi = info; this.mmInfo.textContent = info; }
  },
};
G.hud = HUD;
