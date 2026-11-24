# STEAL THE MEMEVERSE

A 3D multiplayer tycoon-and-heist browser game built with **Three.js**, **React**, **TypeScript**, **Tailwind CSS**, **Zustand**, and a server-authoritative **Node.js + Express + Socket.IO** backend.

Collect bizarre original creatures called **Memelings** off a live dual-lane conveyor belt, generate passive income, expand and customize your personal base, lock your vault behind a laser shield, raid rival bases to steal unprotected Memelings, trade with other players, and rebirth your empire.

---

## Gameplay Features

- **Stylized 3D World**: Floating island archipelago with animated ocean water, drifting clouds, instanced trees, a central dual-lane conveyor belt, 8 personal base plots, Upgrade & Skin Shop pavilion, Rebirth Shrine, Lucky Block Zone, Leaderboard Monument, Trading Plaza, and a Sky Obby leading to a repeatable Sky Treasure Chest.
- **36 Original Memelings & 6 Mutations**: Procedural multi-part 3D creatures across 8 rarity tiers (*Common, Uncommon, Rare, Epic, Legendary, Mythic, Secret, Celestial*) and 6 variant mutations (*Standard, Shiny, Golden, Diamond, Rainbow, Cosmic*) with idle animations, accessories, and rarity aura rings.
- **Server-Authoritative Multiplayer**: Real-time movement, conveyor spawns, purchases, atomic stealing and delivery (anti-duplication), base shield timers, defender bonk recovery, duplicate fusion leveling, upgrades, rebirths, Lucky Blocks, two-sided player trading, and live chat—all validated on the server.
- **Rival Tycoons**: Up to 4 active server-managed rivals occupy open base plots so solo players can immediately raid, defend, and compete, seamlessly vacating plots as human players join.
- **World Events & Progression**: Rotating global events (*Golden Hour, Rainbow Storm, Meme Boom 2X, Lucky Frenzy, Meteor Shower, Cosmic Rift*), daily streak rewards, quests, permanent Rebirth income multipliers, and Sneak Cloak stealth raids.
- **Game Feel & Procedural Audio**: Web Audio API synthesized sound effects (with mute toggle), pooled 3D particle bursts, screen shake, floating feedback popups, and responsive desktop + mobile touch controls.

---

## Controls

### Desktop
| Key / Input | Action |
| --- | --- |
| `WASD` / Arrow Keys | Move character |
| Mouse Drag | Orbit 3D camera |
| Scroll Wheel | Zoom camera |
| `Space` | Jump / Climb Sky Obby |
| `Shift` | Sprint |
| `E` (or click prompt) | Buy off conveyor / Steal Memeling / Interact with landmarks |
| `L` | Activate Base Laser Shield |
| `B` | Teleport home to your base |
| `I` | Open Memeling Vault & Collection Index |
| `H` | Toggle HUD visibility (Zen mode) |
| `Esc` | Pause / Controls menu |

### Mobile & Touch
- **Left Virtual Thumbstick**: Move and sprint
- **Right Action Buttons**: Jump, Interact (`E`), and Lock Base (`L`)

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Three.js, Tailwind CSS, Zustand, Socket.IO Client, Lucide Icons
- **Backend**: Node.js, Express, Socket.IO (`server.ts` & `src/server/gameServer.ts`)
- **Persistence**: Local atomic JSON profile persistence (`data/memeverse-save.json`) out of the box, plus a PostgreSQL Prisma schema (`prisma/schema.prisma`) for external database deployments

---

## Project Structure

```text
├── server.ts                      # Express + Socket.IO + Vite full-stack server entry
├── prisma/
│   └── schema.prisma              # Production PostgreSQL / Prisma schema
├── tests/
│   └── gameEconomy.test.ts        # Automated roster, economy, and world geometry tests
└── src/
    ├── App.tsx                    # Full-viewport Game Shell
    ├── shared/
    │   ├── types.ts               # Shared multiplayer protocol & game state types
    │   ├── creatures.ts           # 36 original Memelings, 8 rarities, 6 mutations
    │   └── worldConfig.ts         # Base plots, conveyor lanes, upgrades, events, quests
    ├── server/
    │   └── gameServer.ts          # Authoritative real-time simulation & Socket.IO handlers
    ├── store/
    │   └── gameStore.ts           # Zustand client state & Socket.IO client actions
    ├── game/
    │   ├── MemeverseViewport.tsx  # Three.js renderer, physics, camera rig, entity sync
    │   ├── worldBuilder.ts        # 3D island, conveyor, bases, laser shields & landmarks
    │   ├── creatureModels.ts      # Procedural multi-part 3D Memeling & avatar builders
    │   ├── proceduralTextures.ts  # CanvasTexture generators for world surfaces & labels
    │   └── soundEngine.ts         # Procedural Web Audio synthesizer
    └── components/
        ├── TitleScreen.tsx        # Live-world title overlay with avatar customization
        ├── GameHUD.tsx            # Currencies, quests, leaderboard, alerts & bottom dock
        ├── GameModals.tsx         # Inventory, Shop, Rebirth, Lucky Blocks, Trade & Chat
        └── MobileControls.tsx     # Touch virtual joystick & action buttons
```

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm

### Installation & Local Development
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. To test live multiplayer raiding and player-to-player trading locally, open `http://localhost:3000` in a second browser tab or incognito window.

### Environment Variables
Copy `.env.example` to `.env` if customizing configuration:
```env
PORT="3000"
DATABASE_URL="postgresql://user:password@localhost:5432/memeverse?schema=public"
APP_URL="http://localhost:3000"
```
> When `DATABASE_URL` is not configured, player saves automatically persist locally in `data/memeverse-save.json`.

### Build, Type-Check & Tests
```bash
# Type-check TypeScript
npm run lint

# Build production client bundle
npm run build

# Run automated economy, roster, and world geometry tests
npx tsx tests/gameEconomy.test.ts
```

---

## API Endpoints
- `GET /api/health` — Server status and authoritative timestamp
- `GET /api/leaderboard` — Live ranked leaderboard snapshot
