// Settings window (works on the title screen and in game).
import { G, emit } from '../core/state.js';
import { L, t, getLang, setLang } from '../core/i18n.js';
import { h, UI } from './ui.js';
import { Audio } from '../audio.js';

UI.register('settings', {
  title: () => t('settings'), icon: 'gear', w: 460, anyMode: true,
  build(w) {
    const S = G.settings;
    const save = () => { G.save.save(); };
    const row = (lab, ctrl) => h('div.opt-row', { style: { margin: '7px 0' } }, h('span.lab', { style: { minWidth: '150px' } }, lab), ctrl);
    const toggle = (k, onChange) => { const i = h('input', { type: 'checkbox', checked: S[k] ? 'checked' : null }); i.addEventListener('change', () => { S[k] = i.checked; onChange?.(i.checked); save(); }); return i; };
    const slider = (k, onChange, min = 0, max = 1, step = 0.05) => { const i = h('input', { type: 'range', min, max, step, value: S[k] }); i.style.width = '150px'; i.addEventListener('input', () => { S[k] = parseFloat(i.value); onChange?.(S[k]); }); i.addEventListener('change', save); return i; };
    const vol = () => Audio.setVolumes({ master: S.master, music: S.music, sfx: S.sfx, ambient: S.ambient });
    w.tab = w.tab || 'game';
    UI.setTabs(w, [['game', L('Oyun|Game')], ['gfx', L('Grafik|Graphics')], ['audio', L('Ses|Audio')], ['data', L('Kayıt|Data')]], w.tab, k => { w.tab = k; UI.refresh('settings'); });
    const b = w.body;
    if (w.tab === 'game') {
      const langSel = h('select.txt-in', { style: { width: '150px', height: '34px' } }, h('option', { value: 'tr', selected: getLang() === 'tr' ? 'selected' : null }, 'Türkçe'), h('option', { value: 'en', selected: getLang() === 'en' ? 'selected' : null }, 'English'));
      langSel.addEventListener('change', () => { setLang(langSel.value); UI.confirm(L('Dil değişikliği için sayfa yenilensin mi?|Reload the page to apply the language?'), () => { if (G.mode === 'game') { G.endSession(); } location.reload(); }); });
      b.append(row(t('set_lang'), langSel));
      b.append(row(t('set_dmgnum'), toggle('dmgNumbers')));
      b.append(row(t('set_names'), toggle('nameplates')));
      b.append(row(t('set_camshake'), toggle('camShake')));
      b.append(row(t('set_autoloot'), toggle('autoLoot')));
      b.append(row(t('set_bots'), toggle('bots', v => { if (!v) G.bots?.clearWorld?.(); })));
      b.append(row(t('set_online'), toggle('online', v => G.net?.setEnabled?.(v))));
      if (UI.touch) b.append(row(t('set_joystick'), toggle('fixedJoy', v => { G.input.fixedJoy = v; })));
      b.append(row(t('set_uiscale'), slider('uiScale', () => UI.applyScale(), 0.7, 1.3, 0.05)));
      if (G.mode === 'game') {
        b.append(h('hr.sep'), h('div.row.wrap',
          h('button.btn', { onclick: () => { UI.close('settings'); G.endSession(); G.title.show(); G.title.screen = 'select'; G.title.render(); } }, t('set_quit')),
          h('button.btn.ghost', { onclick: () => UI.info(L('Kısayollar|Key Bindings'), keyHelp()) }, L('Kısayollar|Key Bindings'))));
      }
    } else if (w.tab === 'gfx') {
      const q = h('div.row', ...['low', 'med', 'high', 'ultra'].map(k => h('button.btn.small' + (S.quality === k ? '.primary' : '.ghost'), { onclick: () => { S.quality = k; G.engine.setQuality(k); save(); UI.refresh('settings'); } }, t('set_' + k))));
      b.append(row(t('set_quality'), q));
      b.append(h('div.muted', { style: { fontSize: '12px' } }, L('Düşük: en iyi pil ömrü ve performans. Yüksek/Ultra: gölgeler, daha uzun görüş mesafesi ve keskin görüntü.|Low: best battery and performance. High/Ultra: shadows, longer view distance and sharper image.')));
      const fps = h('div.row', ...[[0, L('Sınırsız|Unlimited')], [60, '60'], [30, '30']].map(([v, l]) => h('button.btn.small' + ((S.fpsCap || 0) === v ? '.primary' : '.ghost'), { onclick: () => { S.fpsCap = v; save(); UI.refresh('settings'); } }, l)));
      b.append(row(L('Kare hızı sınırı|Frame rate cap'), fps));
      b.append(row(L('Işıltı ve renk efektleri|Bloom & colour effects'), toggle('post')));
      b.append(row(t('set_fps'), toggle('showFps')));
      b.append(row(t('set_fullscreen'), h('button.btn.small', { onclick: () => { const d = document.documentElement; if (!document.fullscreenElement) (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d)?.catch?.(() => { }); else document.exitFullscreen?.(); try { screen.orientation?.lock?.('landscape').catch(() => { }); } catch (e) { } } }, '⛶')));
    } else if (w.tab === 'audio') {
      b.append(row(t('set_master'), slider('master', vol)));
      b.append(row(t('set_music'), slider('music', vol)));
      b.append(row(t('set_sfx'), slider('sfx', vol)));
      b.append(row(t('set_ambient'), slider('ambient', vol)));
    } else {
      b.append(h('div.muted', { style: { fontSize: '12.5px', lineHeight: '1.5' } }, L('Tüm ilerlemen bu tarayıcıda saklanır. Başka bir cihaza taşımak için kaydını dışa aktar, diğer cihazda içe aktar.|All progress is stored in this browser. Export your save to move it to another device and import it there.')));
      b.append(h('div.row.wrap', { style: { marginTop: '10px' } },
        h('button.btn', { onclick: () => { const s = G.save.exportString(); UI.prompt(t('set_export'), s, () => { }, { multiline: true, okText: t('close') }); try { navigator.clipboard?.writeText(s); UI.toast('check', L('Panoya kopyalandı|Copied to clipboard'), '#8affb0'); } catch (e) { } } }, t('set_export')),
        h('button.btn', { onclick: () => { const blob = new Blob([G.save.exportString()], { type: 'text/plain' }); const a = h('a', { href: URL.createObjectURL(blob), download: 'elyndra-save.txt' }); document.body.append(a); a.click(); a.remove(); } }, L('Dosya Olarak İndir|Download as File')),
        h('button.btn', { onclick: () => UI.prompt(t('set_import'), '', v => { if (!v) return; try { G.save.importString(v); UI.toast('check', L('Kayıt yüklendi, yenileniyor…|Save imported, reloading…')); setTimeout(() => location.reload(), 600); } catch (e) { UI.error(L('Geçersiz kayıt|Invalid save')); } }, { multiline: true }) }, t('set_import'))));
      b.append(h('hr.sep'), h('button.btn.red.small', { onclick: () => UI.confirm(L('TÜM karakterler ve ilerleme silinecek. Bu geri alınamaz!|ALL characters and progress will be deleted. This cannot be undone!'), () => { G.save.wipe(); location.reload(); }, { danger: true }) }, L('Tüm Verileri Sil|Delete All Data')));
    }
  },
});

function keyHelp() {
  const rows = [
    ['WASD / ←↑↓→', L('Hareket|Move')], [L('Fare sürükle|Mouse drag'), L('Kamerayı döndür|Rotate camera')], [L('Tekerlek|Wheel'), L('Yakınlaştır|Zoom')],
    ['1 – 0', L('Yetenekler / iksirler|Skills / potions')], ['Tab', L('Hedef değiştir|Cycle target')], ['Shift', L('Takla at (kaçınma)|Roll (dodge)')], ['Space', L('Zıpla|Jump')],
    ['F', L('Etkileşim|Interact')], ['R', L('Otomatik koşu|Auto-run')], ['T', L('Binek|Mount')], ['X', L('Otur|Sit')], ['Enter', L('Sohbet|Chat')],
    ['C', t('menuChar')], ['B / I', t('menuBag')], ['K / P', t('menuSkills')], ['N', t('menuTalents')], ['L', t('menuQuests')], ['M', t('menuMap')],
    ['J', t('menuCraft')], ['O / G', t('menuSocial')], ['H', t('menuDungeon')], ['U', t('menuMarket')], ['Y', t('menuAch')], ['V', t('menuCollect')], ['Esc', L('Kapat / Menü|Close / Menu')],
  ];
  return h('div.kv', ...rows.flatMap(([k, v]) => [h('div.k', h('span.kbd', k)), h('div.v', { style: { fontWeight: 600 } }, v)]));
}
