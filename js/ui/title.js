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

const STAGE = { x: 0, z: 84 }; // town plaza

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
      h('p', L('Elyndra, tarayıcıda ve telefonda oynanan, tamamen kodla üretilmiş 3B bir fantastik MMORPG\'dir. Tüm modeller, ikonlar, müzik ve ses efektleri prosedürel olarak oluşturulur.|Elyndra is a 3D fantasy MMORPG for browser and phone, generated entirely in code. All models, icons, music and sound effects are procedural.')),
      h('p', L('Diğer maceracılar dünyayı canlı tutar; aynı anda oyunda olan gerçek oyuncularla P2P bağlantısı üzerinden sohbet edebilir ve birbirinizi görebilirsiniz.|Other adventurers keep the world alive; real players online at the same time can see each other and chat over a P2P connection.')),
      h('p.muted', L('Kayıtların tarayıcında saklanır. Ayarlar menüsünden dışa aktarıp başka cihaza taşıyabilirsin.|Your saves are stored in your browser. Export them from Settings to move to another device.')),
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
    this.draft = { name: '', race, cls: choice(CLASS_IDS), body: Math.random() < 0.5 ? 0 : 1, skin: R.skins[1], hair: Math.floor(Math.random() * 8), hairColor: HAIR[Math.floor(Math.random() * 6)], beard: R.beardDefault, eyes: EYES[0] };
    this.step = 0;
  },
  renderCreate() {
    const d = this.draft;
    this.setPreview(d, true);
    const R = RACES[d.race], C = CLASSES[d.cls];
    const left = h('div.side.panel');
    const right = h('div.side.right.panel');
    // race
    left.append(h('div.title', { style: { fontSize: '17px' } }, t('charCreate')));
    left.append(h('div.lab.muted', t('race')));
    const rg = h('div.choice-grid', { style: { gridTemplateColumns: 'repeat(4,1fr)' } });
    for (const id of RACE_IDS) rg.append(h('div.choice' + (d.race === id ? '.on' : ''), { onclick: () => { d.race = id; d.skin = RACES[id].skins[1]; d.beard = RACES[id].beardDefault; this.render(); } }, h('img.ico', { src: iconURL(id === 'orc' ? 'fist' : id === 'elf' ? 'renew' : id === 'dwarf' ? 'hammer' : 'person', { size: 64, ...ICON_THEMES.ui }) }), L(RACES[id].name)));
    left.append(rg, h('div.muted', { style: { fontSize: '12px' } }, L(R.desc) + ' ', h('span.good', L(R.bonusText))));
    // class
    left.append(h('div.lab.muted', { style: { marginTop: '6px' } }, t('class')));
    const cg = h('div.choice-grid');
    for (const id of CLASS_IDS) { const c = CLASSES[id]; cg.append(h('div.choice' + (d.cls === id ? '.on' : ''), { onclick: () => { d.cls = id; this.render(); Audio.sfx('equip', { vol: 0.5 }); } }, h('img.ico', { src: iconURL(c.icon, { size: 64, ...ICON_THEMES.ui, frame: c.color }) }), h('span', { style: { color: d.cls === id ? c.color : '' } }, L(c.name)))); }
    left.append(cg);
    left.append(h('div.card', h('div.row', h('b', { style: { color: C.color } }, L(C.name)), h('span.chip', L(C.roleName)), h('span.spacer'), h('span.muted', { style: { fontSize: '12px' } }, L('Zorluk |Difficulty ') + '★'.repeat(C.difficulty) + '☆'.repeat(3 - C.difficulty))),
      h('div', { style: { fontSize: '12.5px', marginTop: '6px', lineHeight: '1.45', color: 'var(--ink2)' } }, L(C.desc)),
      h('div.row.wrap', { style: { marginTop: '8px', gap: '4px' } }, ...CLASS_SKILLS[d.cls].map(id => UI.tip(h('img.ico.s', { src: skillIcon(SKILLS[id]) }), () => h('div', h('div.tn', L(SKILLS[id].name)), h('div.ts', L('Seviye |Level ') + SKILLS[id].lvl), h('div.desc', SKILLS[id].desc({ level: 10, stats: { power: 40, crit: 5, healPct: 0, haste: 0 }, tal: () => 0 }, G.X))))))));
    // appearance
    const step = (lab, val, fn, n) => h('div.opt-row', h('span.lab', lab), h('div.stepper', h('button', { onclick: () => fn(-1) }, '‹'), h('span', val), h('button', { onclick: () => fn(1) }, '›')));
    const sw = (list, cur, fn) => h('div.swatches', ...list.map(c => h('div.swatch' + (c === cur ? '.on' : ''), { style: { background: '#' + c.toString(16).padStart(6, '0') }, onclick: () => fn(c) })));
    right.append(h('div.title', { style: { fontSize: '16px' } }, t('appearance')));
    right.append(step(t('body'), d.body ? L('Tip B|Type B') : L('Tip A|Type A'), () => { d.body = d.body ? 0 : 1; this.render(); }));
    right.append(h('div.opt-row', h('span.lab', t('skin')), sw(R.skins, d.skin, c => { d.skin = c; this.render(); })));
    const hairNames = ['Kısa|Short', 'Uzun|Long', 'At Kuyruğu|Ponytail', 'Mohikan|Mohawk', 'Topuz|Bun', 'Kel|Bald', 'Dikenli|Spiky', 'Örgülü|Braids'];
    right.append(step(t('hair'), L(hairNames[d.hair]), k => { d.hair = (d.hair + k + 8) % 8; this.render(); }));
    right.append(h('div.opt-row', h('span.lab', t('hairColor')), sw(HAIR, d.hairColor, c => { d.hairColor = c; this.render(); })));
    right.append(step(t('beard'), [L('Yok|None'), L('Kısa|Short'), L('Uzun|Long'), L('Örgülü|Braided')][d.beard], k => { d.beard = (d.beard + k + 4) % 4; this.render(); }));
    right.append(h('div.opt-row', h('span.lab', t('eyes')), sw(EYES, d.eyes, c => { d.eyes = c; this.render(); })));
    right.append(h('button.btn.small.ghost', { onclick: () => { const keep = { name: d.name, race: d.race, cls: d.cls }; this.newChar(); Object.assign(this.draft, keep); this.draft.skin = RACES[keep.race].skins[Math.floor(Math.random() * 6)]; this.render(); } }, '🎲 ' + t('random')));
    right.append(h('hr.sep'));
    const nameIn = h('input.txt-in', { value: d.name, maxlength: 14, placeholder: t('name') });
    nameIn.addEventListener('input', () => { d.name = nameIn.value; });
    nameIn.addEventListener('keydown', e => e.stopPropagation());
    right.append(h('div.lab.muted', t('name')), h('div.row', nameIn, h('button.btn', { onclick: () => { d.name = randomName(); nameIn.value = d.name; } }, '🎲')));
    const err = h('div.bad', { style: { fontSize: '12px', minHeight: '16px' } });
    right.append(err);
    const el = h('div.charsel', left, right,
      h('div.bottom',
        h('button.btn.ghost', { onclick: () => { this.screen = G.account.characters.length ? 'select' : 'title'; this.render(); } }, '← ' + t('back')),
        h('button.btn.primary.big', { onclick: () => this.create(nameIn.value, err) }, t('create'))));
    this.el = el; UI.root.append(el);
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
    const key = JSON.stringify([ch.race, ch.cls, ch.body, ch.skin, ch.hair, ch.hairColor, ch.beard, ch.eyes, ch.level, draft ? 0 : ch.id]);
    if (this._pk === key && this.preview.length) return;
    this._pk = key;
    this.clearPreview();
    const tmp = draft ? G.newCharacter({ ...ch, name: 'preview' }) : ch;
    const u = createHero(tmp, 'npc');
    u.team = 'neutral'; u.ai = null;
    u.pos.set(STAGE.x, 0, STAGE.z);
    u.yaw = 0;
    G.world.addUnit(u);
    u.anim.emote = { type: draft ? 'salute' : 'wave', t: 0, dur: 1.6 };
    this.preview.push(u);
    G.vfx.burst(u.pos, 'holy', { n: 20 });
  },
  update(dt) {
    this.t += dt;
    const E = G.engine;
    const u = this.preview[0];
    if (u) {
      u.update(dt);
      if (Math.random() < dt * 0.08 && !u.anim.emote) u.anim.emote = { type: choice(['wave', 'cheer', 'laugh', 'point', 'salute', 'dance']), t: 0, dur: 2.5 };
      // camera framing: character on screen center/right
      const c = E.cam;
      c.tDist = this.screen === 'title' ? 34 : 4.6;
      if (this.screen !== 'title') { c.pitch = clamp(c.pitch, 0.05, 0.5); }
      const focus = { x: u.pos.x, y: u.pos.y - (this.screen === 'title' ? 0 : 0.55), z: u.pos.z };
      if (this.screen === 'title') c.yaw += dt * 0.05;
      E.updateCamera(dt, focus);
      E.updateLighting(dt, focus);
    } else {
      const c = E.cam; c.tDist = 42; c.pitch = 0.42; c.yaw += dt * 0.04;
      const f = { x: 0, y: 2, z: 70 };
      E.updateCamera(dt, f); E.updateLighting(dt, f);
    }
    U.time.value = G.time;
    const w = G.world;
    if (w.glowMesh) w.glowMesh.material.color.setScalar(0.55 + (1 - (E.daylight ?? 1)) * 0.9);
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
