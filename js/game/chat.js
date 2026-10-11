// Chat: channels, system messages, slash commands. Bots and P2P peers post here too.
import { G, emit } from '../core/state.js';
import { L } from '../core/i18n.js';
import { escapeHtml } from '../core/util.js';

const EMOTES = { wave: 'wave', selam: 'wave', dance: 'dance', dans: 'dance', cheer: 'cheer', yay: 'cheer', bow: 'bow', egil: 'bow', point: 'point', laugh: 'laugh', gul: 'laugh', salute: 'salute', kneel: 'kneel', sit: 'sit', otur: 'sit' };

export const Chat = {
  system(text, ch = 'system') { emit('chat', { ch, text }); },
  post(from, text, ch = 'world', unit = null) {
    emit('chat', { ch, from, text });
    if (unit && (ch === 'say' || ch === 'zone' || ch === 'party' || ch === 'world') && unit.group) unit.chatBubble = { text: text.slice(0, 90), t: G.time + 5 };
  },
  send(raw, tab = 'all') {
    const p = G.player; if (!p) return;
    let text = raw, ch = tab === 'party' ? 'party' : tab === 'guild' ? 'guild' : 'world';
    if (text.startsWith('/')) {
      const [cmd, ...rest] = text.slice(1).split(' ');
      const arg = rest.join(' ');
      const c = cmd.toLowerCase();
      if (EMOTES[c]) { if (EMOTES[c] === 'sit') G.playerCtl.sit(); else { p.anim.emote = { type: EMOTES[c], t: 0, dur: 4 }; emit('emote', EMOTES[c]); G.net?.emote(EMOTES[c]); } return; }
      if (c === 'p' || c === 'party' || c === 'g') { ch = 'party'; text = arg; }
      else if (c === 'w' || c === 'world' || c === 'd') { ch = 'world'; text = arg; }
      else if (c === 'guild' || c === 'l' || c === 'lonca') { ch = 'guild'; text = arg; }
      else if (c === 's' || c === 'say') { ch = 'say'; text = arg; }
      else if (c === 'help' || c === 'yardim' || c === 'yardım') {
        this.system(L('Komutlar: /p (grup), /w (dünya), /l (lonca), /s (konuş), /wave /dance /cheer /bow /laugh /salute /sit, /who, /roll|Commands: /p (party), /w (world), /l (guild), /s (say), /wave /dance /cheer /bow /laugh /salute /sit, /who, /roll'));
        return;
      } else if (c === 'roll' || c === 'zar') { this.system(L(`${p.name} zar attı: ${1 + Math.floor(Math.random() * 100)} (1-100)|${p.name} rolls ${1 + Math.floor(Math.random() * 100)} (1-100)`)); return; }
      else if (c === 'who' || c === 'kim') { const n = G.world.units.filter(u => u.kind === 'bot' || u.kind === 'remote').length; this.system(L(`Bu bölgede ${n} maceracı var. Çevrimiçi (P2P): ${G.net?.peerCount?.() || 0}|${n} adventurers in this zone. Online (P2P): ${G.net?.peerCount?.() || 0}`)); return; }
      else { this.system(L('Bilinmeyen komut. /help yaz.|Unknown command. Type /help.')); return; }
    }
    if (!text) return;
    text = text.slice(0, 160);
    if (ch === 'party' && !G.party?.members().length) { this.system(L('Bir grupta değilsin.|You are not in a party.')); return; }
    if (ch === 'guild' && !G.account.guild) { this.system(L('Bir loncada değilsin.|You are not in a guild.')); return; }
    this.post(p.name, text, ch, p);
    p.chatBubble = { text: text.slice(0, 90), t: G.time + 5 };
    emit('playerChat', text, ch);
    G.net?.chat(text, ch);
  },
};
G.chat = Chat;
