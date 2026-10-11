// Mastery: endless progression after level 60. XP → mastery levels → points into small permanent bonuses.
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { fmtNum } from '../core/util.js';
import { xpNeed } from '../data/classes.js';
import { refreshHero } from './hero.js';
import { h, UI } from '../ui/ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { Audio } from '../audio.js';

export const MASTERY = {
  power: { name: 'Kudret|Might', desc: '+%1 güç|+1% power', icon: 'fist', st: { powerPct: 1 }, max: 50 },
  vitality: { name: 'Canlılık|Vitality', desc: '+%1 can|+1% health', icon: 'heart', st: { hpPct: 1 }, max: 50 },
  precision: { name: 'İsabet|Precision', desc: '+%0.5 kritik şans|+0.5% critical chance', icon: 'mark', st: { crit: 0.5 }, max: 30 },
  ferocity: { name: 'Vahşet|Ferocity', desc: '+%2 kritik hasar|+2% critical damage', icon: 'crit', st: { critDmg: 2 }, max: 30 },
  swiftness: { name: 'Süratlilik|Swiftness', desc: '+%0.5 hız|+0.5% haste', icon: 'hourglass', st: { haste: 0.5 }, max: 30 },
  grace: { name: 'Zarafet|Grace', desc: '+%1 iyileştirme|+1% healing', icon: 'heal_hand', st: { healPct: 1 }, max: 30 },
  fortune: { name: 'Talih|Fortune', desc: '+%2 altın & sihirli eşya bulma|+2% gold & magic find', icon: 'coins', st: { goldPct: 2, mf: 2 }, max: 25 },
  bulwark: { name: 'Siper|Bulwark', desc: '-%0.5 alınan hasar|-0.5% damage taken', icon: 'shield', st: { dmgTakenPct: -0.5 }, max: 30 },
};
export const Mastery = {
  need(l) { return Math.round(xpNeed(59) * (0.6 + l * 0.03)); },
  get m() { const ch = G.char; ch.mastery = ch.mastery || { lvl: 0, xp: 0, pts: {} }; ch.mastery.pts = ch.mastery.pts || {}; return ch.mastery; },
  spent() { return Object.values(this.m.pts).reduce((a, b) => a + b, 0); },
  addXp(x) {
    const m = this.m;
    m.xp += x;
    G.overlay?.text(G.player, '+' + fmtNum(x) + ' ' + L('Ustalık|Mastery'), { color: '#ffb0ff', small: true });
    while (m.xp >= this.need(m.lvl)) { m.xp -= this.need(m.lvl); m.lvl++; Audio.sfx('levelup', { vol: 0.6 }); G.ui.toast('star', L(`Ustalık seviyesi ${m.lvl}! Bir puan kazandın.|Mastery level ${m.lvl}! You earned a point.`), '#ffb0ff'); G.vfx?.levelUp(G.player); emit('masteryLevel', m.lvl); }
  },
  apply(u) {
    const st = {};
    const m = u.char?.mastery; if (!m?.pts) { u.masteryStats = null; return; }
    for (const id in m.pts) { const d = MASTERY[id]; if (!d) continue; for (const k in d.st) st[k] = (st[k] || 0) + d.st[k] * m.pts[id]; }
    u.masteryStats = st;
  },
  panel(box) {
    const m = this.m, left = m.lvl - this.spent();
    box.append(h('hr.sep'), h('div.row', h('img.ico.l', { src: iconURL('star', { size: 64, ...ICON_THEMES.arcane }) }), h('div', h('div.title', L('Ustalık|Mastery') + ' ' + m.lvl), h('div.muted', `${fmtNum(m.xp)} / ${fmtNum(this.need(m.lvl))} · ` + L('Harcanabilir puan: |Points: ') + left))));
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '6px', marginTop: '8px' } });
    for (const [id, d] of Object.entries(MASTERY)) {
      const r = m.pts[id] || 0;
      grid.append(h('div.card.row', h('img.ico.s', { src: iconURL(d.icon, { size: 48, ...ICON_THEMES.arcane }) }), h('div', { style: { flex: 1, fontSize: '12.5px' } }, h('b', L(d.name) + ` ${r}/${d.max}`), h('div.muted', L(d.desc))),
        h('button.btn.small' + (left > 0 && r < d.max ? '.primary' : '.disabled'), { onclick: () => { m.pts[id] = r + 1; this.apply(G.player); refreshHero(G.player); emit('talentsChanged'); } }, '+')));
    }
    box.append(grid, h('button.btn.small.ghost', { style: { marginTop: '6px' }, onclick: () => { m.pts = {}; this.apply(G.player); refreshHero(G.player); emit('talentsChanged'); } }, L('Ustalık puanlarını sıfırla|Reset mastery points')));
  },
};
G.mastery = Mastery;
on('sessionStart', () => { Mastery.apply(G.player); refreshHero(G.player); });
