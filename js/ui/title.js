// Title screen, character select and character creation with a live 3D preview.
import { G, emit } from '../core/state.js';
import { L, t, getLang, setLang } from '../core/i18n.js';
import { clamp, damp, choice, fmtTime } from '../core/util.js';
import { h, icon, UI, uiIcon, skillIcon } from './ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { CLASSES, RACES, CLASS_IDS, RACE_IDS, randomName } from '../data/classes.js';
import { SKILLS, CLASS_SKILLS } from '../data/skills.js';
import { HAIR, EYES } from '../gfx/models.js';
import { ZONES } from '../data/zones.js';
import { createHero, appearanceSpec } from '../game/hero.js';
import { Audio } from '../audio.js';
import { U } from '../gfx/materials.js';

const STAGE = { x: 3, z: 138, yaw: 0.12 }; // outside Dawnhollow's south gate, the village behind the hero

export const Title = {
  el: null, screen: 'title', preview: [], sel: 0, t: 0,
  show() {
    G.mode = 'title';
    if (!this.worldReady) {
      G.world.load(ZONES.vale);
      G.engine.setEnv(ZONES.vale.env);
      G.engine.dayTime = 0.72; // golden hour
      this.worldReady = true;
    }
    Audio.music('title'); Audio.ambient('town');
    this.screen = 'title';
    this.render();
  },
  clearUI() { if (this.el) this.el.remove(); this.el = null; },
  render() {
    this.clearUI();
    if (this.screen === 'title') this.renderTitle();
    else if (this.screen === 'select') this.renderSelect();
    else if (this.screen === 'create') this.renderCreate();
  },
  // ------------------------------------------------------------ title
  renderTitle() {
    this.clearPreview();
    const chars = G.account.characters;
    const el = h('div#title',
      h('div.top', h('div.logo', 'ELYNDRA', h('small', L('KADİM DİYARLAR · ONLINE|REALMS OF OLD · ONLINE')))),
      h('div.menu',
        h('button.btn.primary.big', { onclick: () => { this.screen = chars.length ? 'select' : 'create'; this.newChar(); this.render(); } }, chars.length ? t('play') : t('newChar')),
        chars.length ? h('button.btn.big', { onclick: () => { this.screen = 'create'; this.newChar(); this.render(); } }, t('newChar')) : null,
        h('button.btn', { onclick: () => UI.open('settings') }, t('settings')),
        h('button.btn.ghost', { onclick: () => this.about() }, t('credits')),
        h('div.row', { style: { justifyContent: 'center', gap: '6px', marginTop: '6px' } },
          h('button.btn.small' + (getLang() === 'tr' ? '.primary' : '.ghost'), { onclick: () => { setLang('tr'); location.reload(); } }, 'Türkçe'),
          h('button.btn.small' + (getLang() === 'en' ? '.primary' : '.ghost'), { onclick: () => { setLang('en'); location.reload(); } }, 'English')),
      ),
      h('div.foot', h('span', 'v' + G.version + ' · ' + L('Ücretsiz · Reklamsız · Kazan-için-öde yok|Free · No ads · No pay-to-win')), h('span', L('Telefon ve bilgisayarda oynanabilir|Playable on phone & desktop'))),
    );
    this.el = el; UI.root.append(el);
  },
  about() {
    UI.info('Elyndra Online', h('div', { style: { lineHeight: '1.6' } },
      h('p', L('Elyndra, tarayıcıda ve telefonda oynanan 3B bir fantastik MMORPG’dir. Müzik, ses efektleri, arazi ve büyü efektleri kodla üretilir.|Elyndra is a 3D fantasy MMORPG for browser and phone. Music, sound effects, terrain and spell effects are generated in code.')),
      h('p', L('Diğer maceracılar dünyayı canlı tutar; aynı anda oyunda olan gerçek oyuncularla P2P bağlantısı üzerinden sohbet edebilir ve birbirinizi görebilirsiniz.|Other adventurers keep the world alive; real players online at the same time can see each other and chat over a P2P connection.')),
      h('p.muted', L('Kayıtların tarayıcında saklanır. Ayarlar menüsünden dışa aktarıp başka cihaza taşıyabilirsin.|Your saves are stored in your browser. Export them from Settings to move to another device.')),
      h('p.muted', { style: { fontSize: '12.5px' } }, L('3B modeller: KayKit (Kay Lousberg) ve Quaternius — CC0. İkonlar: game-icons.net (Lorc, Delapouite ve diğerleri) — CC BY 3.0.|3D models: KayKit (Kay Lousberg) and Quaternius — CC0. Icons: game-icons.net (Lorc, Delapouite and others) — CC BY 3.0.')),
      h('p.muted', { style: { fontSize: '12.5px' } }, L('Müzik: Abstraction (Tallbeard Studios) — CC0. Ses efektleri: Leonardo Calvo, heyheythere — CC BY 4.0; lentikula, John Carroll, CluckFox — CC0.|Music: Abstraction (Tallbeard Studios) — CC0. Sound effects: Leonardo Calvo, heyheythere — CC BY 4.0; lentikula, John Carroll, CluckFox — CC0.')),
      h('p.muted', 'Three.js (MIT) · Trystero (MIT)')));
  },
  // ------------------------------------------------------------ character select
  renderSelect() {
    const chars = G.account.characters;
    if (!chars.length) { this.screen = 'create'; this.newChar(); this.render(); return; }
    if (this.sel >= chars.length) this.sel = 0;
    const lastIdx = chars.findIndex(c => c.id === G.account.lastChar);
    if (this._firstSel !== false && lastIdx >= 0) { this.sel = lastIdx; this._firstSel = false; }
    const ch = chars[this.sel];
    this.setPreview(ch);
    const list = h('div.list');
    chars.forEach((c, i) => {
      const C = CLASSES[c.cls];
      list.append(h('div.cs-card' + (i === this.sel ? '.sel' : ''), { onclick: () => { this.sel = i; this.render(); } },
        h('img.ico.l', { src: iconURL(C.icon, { size: 64, ...ICON_THEMES.ui }) }),
        h('div', { style: { flex: 1, minWidth: 0 } }, h('div.nm', c.name), h('div.sub', `${t('level')} ${c.level} ${L(RACES[c.race].name)} ${L(C.name)}`), h('div.sub', L(ZONES[c.zone]?.name || '') + ' · ' + fmtTime(c.playtime || 0)))));
    });
    const el = h('div.charsel',
      h('div.side.panel', h('div.title', { style: { fontSize: '18px' } }, t('selectChar')), list,
        h('button.btn', { onclick: () => { this.screen = 'create'; this.newChar(); this.render(); } }, '+ ' + t('newChar')),
        h('div.spacer'),
        h('button.btn.ghost.small', { onclick: () => { this.screen = 'title'; this.render(); } }, '← ' + t('back'))),
      h('div.bottom',
        h('button.btn.red', { onclick: () => UI.confirm(t('deleteConfirm', ch.name), () => { G.account.characters.splice(this.sel, 1); G.save.save(); this.sel = 0; this.render(); }, { danger: true, yes: t('delete') }) }, t('delete')),
        h('button.btn.primary.big', { onclick: () => this.enter(ch) }, t('enterWorld'))),
    );
    this.el = el; UI.root.append(el);
  },
  async enter(ch) {
    this.clearUI(); this.clearPreview();
    Audio.sfx('portal');
    this.worldReady = false;
    await G.startSession(ch);
    if (!ch.quests.done.q_awaken && !ch.quests.active.q_awaken && !ch._introShown) { ch._introShown = true; setTimeout(() => G.intro?.(), 1200); }
  },
  // ------------------------------------------------------------ creation
  newChar() {
    const race = choice(RACE_IDS), R = RACES[race];
    this.draft = { name: '', race, cls: choice(CLASS_IDS), body: 0, skin: R.skins[1], hair: 0, hairColor: HAIR[0], beard: R.beardDefault, eyes: EYES[0], outfit: null, outfitSat: null, outfitDark: 0, hideHelm: false, hideCape: false };
    this.tab = 'class';
    this.rot = 0; this.zoom = false;
  },
  renderCreate() {
    const d = this.draft;
    this.setPreview(d, true);
    const R = RACES[d.race], C = CLASSES[d.cls];
    const sec = (title, ...kids) => h('section.cc-sec', h('h3', title), ...kids);
    // --- identity: race + class
    const races = h('div.cc-grid.cc-races');
    for (const id of RACE_IDS) races.append(h('button.cc-opt' + (d.race === id ? '.on' : ''), { onclick: () => { d.race = id; d.skin = RACES[id].skins[1]; this.render(); } },
      h('img', { src: iconURL(id === 'orc' ? 'fist' : id === 'elf' ? 'moon' : id === 'dwarf' ? 'hammer' : 'person', { size: 64, ...ICON_THEMES.ui }) }), h('span', L(RACES[id].name))));
    const classes = h('div.cc-grid.cc-classes');
    for (const id of CLASS_IDS) {
      const c = CLASSES[id];
      classes.append(h('button.cc-opt' + (d.cls === id ? '.on' : ''), { style: { '--accent': c.color }, onclick: () => { d.cls = id; d.outfit = null; d.outfitSat = null; d.outfitDark = 0; this.render(); Audio.sfx('equip', { vol: 0.5 }); } },
        h('img', { src: iconURL(c.icon, { size: 64, ...ICON_THEMES.ui, frame: c.color }) }), h('span', L(c.name)), h('small', L(c.roleName))));
    }
    const classInfo = h('div.cc-info',
      h('div.cc-info-head', h('b', { style: { color: C.color } }, L(C.name)), h('span.chip', L(C.roleName)), h('span.cc-diff', '★'.repeat(C.difficulty) + '☆'.repeat(3 - C.difficulty))),
      h('p', L(C.desc)),
      h('div.cc-skills', ...CLASS_SKILLS[d.cls].slice(0, 6).map(id => UI.tip(h('img', { src: skillIcon(SKILLS[id]) }), () => h('div', h('div.tn', L(SKILLS[id].name)), h('div.ts', L('Seviye |Level ') + SKILLS[id].lvl), h('div.desc', SKILLS[id].desc({ level: 10, stats: { power: 40, crit: 5, healPct: 0, haste: 0 }, tal: () => 0 }, G.X)))))),
      h('p.cc-race', L(R.desc) + ' ', h('span.good', L(R.bonusText))));
    const identity = h('div.cc-panel.cc-left', sec(t('race'), races), sec(t('class'), classes), classInfo);
    // --- appearance
    const sw = (list, isOn, fn, css) => h('div.cc-swatches', ...list.map((c, i) => h('button.cc-sw' + (isOn(c, i) ? '.on' : ''), { style: { background: css(c) }, onclick: () => fn(c) })));
    const hex = c => '#' + c.toString(16).padStart(6, '0');
    const OUTFITS = [null, { h: 0, s: 1 }, { h: 24, s: 1 }, { h: 45, s: 0.85 }, { h: 100, s: 0.8 }, { h: 135, s: 0.8 }, { h: 178, s: 0.9 }, { h: 212, s: 1 }, { h: 250, s: 0.9 }, { h: 282, s: 0.9 }, { h: 322, s: 0.9 }, { h: 220, s: 0.15, d: 0.45 }, { h: 30, s: 0.12 }];
    const oCss = o => o ? `hsl(${o.h},${Math.round(Math.min(1, o.s) * 70)}%,${o.d ? 22 : o.s < 0.2 ? 82 : 46}%)` : 'conic-gradient(#c84a3a,#d8b04a,#4a9a4a,#3a6ab8,#8a4ab8,#c84a3a)';
    const pickOutfit = o => { d.outfit = o ? o.h : null; d.outfitSat = o ? o.s : null; d.outfitDark = o?.d || 0; };
    const appearance = h('div.cc-panel.cc-right',
      sec(t('skin'), sw(R.skins, c => c === d.skin, c => { d.skin = c; this.render(); }, hex)),
      sec(L('Kıyafet Rengi|Outfit Colour'), sw(OUTFITS, o => (o ? o.h === d.outfit && (o.d || 0) === (d.outfitDark || 0) : d.outfit == null), o => { pickOutfit(o); this.render(); }, oCss)),
      sec(L('Donanım|Gear'),
        h('label.cc-toggle', h('input', { type: 'checkbox', checked: d.hideHelm ? null : 'checked', onchange: e => { d.hideHelm = !e.target.checked; this.render(); } }), h('span', L('Başlığı göster|Show headgear'))),
        h('label.cc-toggle', h('input', { type: 'checkbox', checked: d.hideCape ? null : 'checked', onchange: e => { d.hideCape = !e.target.checked; this.render(); } }), h('span', L('Pelerini göster|Show cape')))),
      h('button.btn.ghost.small.cc-random', { onclick: () => { const r = choice(RACE_IDS); Object.assign(d, { race: r, skin: choice(RACES[r].skins), cls: choice(CLASS_IDS) }); pickOutfit(choice(OUTFITS)); this.render(); } }, '🎲 ' + t('random')));
    // --- name + create
    const err = h('div.cc-err');
    const nameIn = h('input.txt-in.cc-name', { value: d.name, maxlength: 14, placeholder: t('name') });
    nameIn.addEventListener('input', () => { d.name = nameIn.value; });
    nameIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.create(nameIn.value, err); });
    const bottom = h('div.cc-bottom',
      h('button.btn.ghost', { onclick: () => { this.screen = G.account.characters.length ? 'select' : 'title'; this.render(); } }, '← ' + t('back')),
      h('div.cc-namebox', nameIn, h('button.btn.icon-btn', { title: t('random'), onclick: () => { d.name = randomName(); nameIn.value = d.name; } }, '🎲')),
      h('button.btn.primary.big', { onclick: () => this.create(nameIn.value, err) }, t('create')), err);
    // --- view controls (rotate / zoom) over the character
    const view = h('div.cc-view',
      h('button.cc-vbtn', { title: L('Sola döndür|Rotate left'), onclick: () => { this.rot -= Math.PI / 4; } }, '⟲'),
      h('button.cc-vbtn' + (this.zoom ? '.on' : ''), { title: L('Yüze yakınlaştır|Zoom to face'), onclick: e => { this.zoom = !this.zoom; e.currentTarget.classList.toggle('on', this.zoom); } }, '⌕'),
      h('button.cc-vbtn', { title: L('Sağa döndür|Rotate right'), onclick: () => { this.rot += Math.PI / 4; } }, '⟳'),
      h('div.cc-hint', L('Döndürmek için karakteri sürükle|Drag the character to rotate')));
    // mobile: tabbed bottom sheet
    const TABS = [['class', L('Irk & Sınıf|Race & Class')], ['look', L('Görünüm|Appearance')]];
    const tabs = h('div.cc-tabs', ...TABS.map(([k, lab]) => h('button' + (this.tab === k ? '.on' : ''), { dataset: { k }, onclick: () => { this.tab = k; this.el.dataset.tab = k; this.el.querySelectorAll('.cc-tabs button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); } }, lab)));
    const el = h('div.cc', { dataset: { tab: this.tab } }, h('div.cc-title', t('charCreate')), identity, appearance, view, tabs, bottom);
    this.el = el; UI.root.append(el);
    this.bindDrag();
  },
  // drag on the 3D view rotates the preview character
  bindDrag() {
    if (this._drag) return;
    const gl = document.getElementById('gl');
    let down = null;
    gl.addEventListener('pointerdown', e => { if (G.mode === 'title' && this.screen !== 'title') down = { x: e.clientX, rot: this.rot }; });
    window.addEventListener('pointermove', e => { if (down) this.rot = down.rot + (e.clientX - down.x) * 0.012; });
    window.addEventListener('pointerup', () => { down = null; });
    gl.addEventListener('wheel', e => { if (G.mode === 'title' && this.screen !== 'title') this.zoom = e.deltaY < 0; }, { passive: true });
    this._drag = true;
  },
  create(name, errEl) {
    name = (name || '').trim().replace(/\s+/g, '');
    if (!/^[A-Za-zÇĞİÖŞÜçğıöşü0-9]{3,14}$/.test(name)) { errEl.textContent = t('nameInvalid'); UI.error(t('nameInvalid')); return; }
    if (G.account.characters.some(c => c.name.toLowerCase() === name.toLowerCase())) { errEl.textContent = t('nameTaken'); return; }
    const ch = G.newCharacter({ ...this.draft, name });
    G.account.characters.push(ch);
    G.save.save();
    Audio.sfx('levelup', { vol: 0.6 });
    this.sel = G.account.characters.length - 1;
    this.enter(ch);
  },
  // ------------------------------------------------------------ 3D preview
  clearPreview() { for (const u of this.preview) G.world.removeUnit(u, true); this.preview = []; },
  setPreview(ch, draft) {
    const key = JSON.stringify([ch.race, ch.cls, ch.skin, ch.outfit, ch.outfitSat, ch.outfitDark, ch.hideHelm, ch.hideCape, ch.level, draft ? 0 : ch.id]);
    if (this._pk === key && this.preview.length) return;
    this._pk = key;
    this.clearPreview();
    const tmp = draft ? G.newCharacter({ ...ch, name: 'preview' }) : ch;
    const u = createHero(tmp, 'npc');
    u.team = 'neutral'; u.ai = null;
    u.pos.set(STAGE.x, 0, STAGE.z);
    u.yaw = STAGE.yaw;
    G.world.addUnit(u);
    u.anim.emote = { type: 'cheer', t: 0, dur: 1.4 };
    this.preview.push(u);
    if (!draft) G.vfx.burst(u.pos, 'holy', { n: 20 });
  },
  update(dt) {
    this.t += dt;
    const E = G.engine;
    const u = this.preview[0];
    if (u) {
      u.update(dt);
      if (Math.random() < dt * 0.05 && !u.anim.emote && !u.anim.act) u.playAct(choice(['slash', 'cast', 'raise', 'block']), 1.1);
      // camera framing: title = slow orbit; creation/select = facing the character, drag to rotate
      const c = E.cam;
      let focus;
      if (this.screen === 'title') {
        c.tDist = 34; c.yaw += dt * 0.05;
        focus = { x: u.pos.x, y: u.pos.y, z: u.pos.z };
      } else {
        const wide = window.innerWidth > window.innerHeight;
        c.yaw = STAGE.yaw; c.pitch = damp(c.pitch, this.zoom ? 0.06 : 0.1, 6, dt);
        c.tDist = this.zoom ? 2.5 : (wide ? 3.7 : 6.2);
        // the character turns (drag/arrows) instead of the camera so the background stays put
        u.yaw = damp(u.yaw, c.yaw + (this.rot || 0), 10, dt);
        focus = { x: u.pos.x, y: u.pos.y + (this.zoom ? 0.05 : (wide ? -0.55 : -0.25)), z: u.pos.z };
        if (!wide) focus.y -= this.zoom ? 0.75 : 2.1; // portrait: keep the hero in the upper half above the sheet
      }
      E.updateCamera(dt, focus);
      E.updateLighting(dt, focus);
    } else {
      const c = E.cam; c.tDist = 42; c.pitch = 0.42; c.yaw += dt * 0.04;
      const f = { x: 0, y: 2, z: 70 };
      E.updateCamera(dt, f); E.updateLighting(dt, f);
    }
    U.time.value = G.time;
    if (u && this.screen !== 'title') { U.camPos.value.copy(G.camera.position); U.focus.value.set(u.pos.x, u.pos.y + 1, u.pos.z); U.occ.value = 1; } else U.occ.value = 0;
    const w = G.world;
    if (w.glowMesh) w.glowMesh.material.color.setScalar((0.55 + (1 - (E.daylight ?? 1)) * 0.9) * (E.q.post ? 1.9 : 1));
    if (w.water?.userData.setLight) w.water.userData.setLight(E.sun.position.clone().sub(E.sun.target.position).normalize(), 0.45 + 0.55 * (E.daylight ?? 1));
  },
};
G.title = Title;

// short intro shown on first login
G.intro = () => {
  UI.info(L('Elyndra\'ya Hoş Geldin|Welcome to Elyndra'), h('div', { style: { lineHeight: '1.6' } },
    h('p', L('Kadim Aether Kristali, Gölge Lordu Malakar tarafından paramparça edildi. Parçaları diyarlara saçıldı ve her biri bulunduğu toprağı yozlaştırıyor.|The ancient Aether Crystal was shattered by Malakar the Shadow Lord. Its shards scattered across the realms, each corrupting the land around it.')),
    h('p', L('Sen, bir kristal parçasının yanında uyanan bir Kristal Taşıyıcısın. Aydınköy Muhtarı Yusuf seninle konuşmak istiyor.|You are a Crystal Bearer who awoke beside a shard. Elder Yusuf of Dawnhollow wishes to speak with you.')),
    h('div.card', { style: { fontSize: '12.5px' } },
      UI.touch ? h('div', L('🕹️ Sol alttan sürükleyerek hareket et, ekranı sürükleyerek kamerayı çevir. Düşmana dokunarak hedef al, sağdaki büyük butonla saldır.|🕹️ Drag bottom-left to move, drag the screen to turn the camera. Tap an enemy to target it, use the big button on the right to attack.'))
        : h('div', L('⌨️ WASD hareket, sürükleyerek kamera, tıklayarak hedef/yürüme, 1-0 yetenekler, Shift takla, Space zıpla, F etkileşim, Tab hedef değiştir.|⌨️ WASD to move, drag to rotate camera, click to target/walk, 1-0 skills, Shift to roll, Space to jump, F to interact, Tab to cycle targets.')))));
};
