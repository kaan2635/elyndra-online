# Asset credits

Elyndra Online uses the following third-party art. Thank you to these artists for sharing their work.

| Asset | Author | License | Used for |
|---|---|---|---|
| [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) | Kay Lousberg | CC0 1.0 | Heroes, NPCs, weapons, shared character animations |
| [KayKit Character Pack: Skeletons](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) | Kay Lousberg | CC0 1.0 | Undead enemies, skeleton weapons, animation library |
| [KayKit Medieval Hexagon Pack](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) | Kay Lousberg | CC0 1.0 | Town buildings, walls, fences, props |
| [KayKit Dungeon Remastered](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0) | Kay Lousberg | CC0 1.0 | Dungeon walls, floors, furniture |
| [KayKit Halloween Bits](https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0) | Kay Lousberg | CC0 1.0 | Graves, lanterns, dead trees |
| [KayKit Forest Nature Pack](https://kaylousberg.itch.io/kaykit-forest) (free tier, itch.io) | Kay Lousberg | CC0 1.0 | Trees, rocks, bushes and grass in temperate zones |
| [Ultimate Nature Pack](https://quaternius.com) | Quaternius | CC0 1.0 | Snowy trees and rocks, palms, cacti, plants, stumps |
| [Ultimate Animated Animals / Ultimate Monsters](https://quaternius.com) (via [poly.pizza](https://poly.pizza/u/Quaternius)) | Quaternius | CC0 1.0 | Animals, mounts and monsters |
| [RPG Items / Medieval Weapons / Survival packs](https://quaternius.com) | Quaternius | CC0 1.0 | Extra weapons (bows, hammers, scythes), tents |
| [game-icons.net](https://game-icons.net) | Lorc, Delapouite, Skoll, Sbed, Carl Olsen, Lucas, Willdabeast, Darkzaitzev, Faithtoken and others | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | All interface, skill and item icons |

Libraries: [three.js](https://threejs.org) (MIT), [Trystero](https://github.com/dmotz/trystero) (MIT), [meshoptimizer](https://github.com/zeux/meshoptimizer) (MIT, decoder).

## Audio (itch.io)

| Asset | Author | License | Used for |
|---|---|---|---|
| [Music Loop Bundle](https://tallbeard.itch.io/music-loop-bundle) (Troubadeck + earlier loops) | Abstraction / Tallbeard Studios | CC0 1.0 | Zone, town, dungeon, boss and title music |
| [Swords & Blades Sound Pack](https://thesoundrack.itch.io/swords-blades-sound-pack) | Leonardo Calvo | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Sword swings, hits and impacts |
| [Archery Sound Pack](https://thesoundrack.itch.io/archery-sound-pack) | Leonardo Calvo | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Bow shots and arrow impacts |
| [Medieval Combat SFX Free](https://heyheythere.itch.io/medieval-combat-sfx-free) | heyheythere | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Flesh / plate hits, shield blocks, body falls, anvil, war horn, sword draw |
| [Fantasy UI SFX Free](https://heyheythere.itch.io/fantasy-ui-sfx-free) | heyheythere | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Interface clicks, pages, coins, potions, quests, level up |
| [Footsteps SFX Free](https://heyheythere.itch.io/footsteps-sfx-free) | heyheythere | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Footsteps on grass, stone, sand, snow, wood and water |
| [Basic / Healing / Druid Spell Impacts](https://lentikula.itch.io/) | lentikula | CC0 1.0 | Fire, ice, lightning, healing, nature and earth spell impacts |
| [Warrior / Mage / Orc Voice Packs](https://johncarroll.itch.io/) | John Carroll | CC0 (royalty free) | Hero battle cries, hurt and death voices, monster cries |
| [Rain and Thunder](https://cluckfox.itch.io/rain-and-thunder) | CluckFox | CC0 1.0 | Rain ambience |

Sounds without a recording, ambience beds and the fallback music are synthesised in code; terrain, water, sky and visual effects are generated in code.

The optimised model files in `assets/models` are rebuilt from the original packs with `node tools/build-assets.mjs`; icons with `node tools/build-icons.mjs`; audio with `node tools/build-audio.mjs` (from the itch.io downloads cached in `tools/_src/itch`).
