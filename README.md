# Kryvora Node Realm

A no-wallet, shared 3D browser simulation using the supplied Kryvora character, laboratory, cores, animations and audio.

## Run

```sh
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:3000/. Vite also runs the shared realm service. Other devices on the same network can use the network address printed by Vite, subject to existing firewall rules. This does not publish the game to the internet.

```sh
npm run lint
npm run test:realm
npm run build
npm run preview
```

Preview serves the built game with the shared realm service. The original registry backend remains in server.ts, but the new game does not connect a wallet or call chain APIs.

## Play

Choose a name, country guild and PC/mobile controls before entering a public or custom realm. Guilds: Colombia, India, Vietnam, Indonesia, Iran and Nigeria. Captain and Co-Captain positions await real character IDs.

- PC: WASD/arrows move; Shift runs; Space jumps; drag the scene to orbit; E interacts; I opens inventory; Escape opens settings.
- Mobile: left analog moves; drag the scene to look; Run, Jump and Hand buttons perform actions.
- Collect a core near the entrance, carry it visibly, then visit the reactor with two matching cores.
- Realm chat reaches everyone in the room. Guild chat reaches only players of your country in that room.
- Inventory supports carrying/stowing and explicitly labeled test supplies.

## Shared simulation boundaries

Live visitors share room membership, position, facing, animation, carried-core appearance and chat. Marked bots fill each room to twenty operators. Capacity applies to live connections (20, 24, 32 or 40). The server has been tested with twenty concurrent protocol clients, not twenty physical phones.

Rooms and chat are in server memory and reset on restart. Inventory and shards are local test data, not a secured multiplayer economy. No wallet, ownership gate, purchase or real-value transaction is active.

Provisional fusion rules:

| Upgrade | Success | Meltdown shards |
|---|---:|---:|
| Standard → Overclocked | 70% | 60 |
| Overclocked → Quantum | 45% | 100 |
| Quantum → Celestial | 20% | 200 |

Success upgrades the Primary and consumes the Catalyst. Meltdown consumes both selected cores.

## Assets and implementation

Current app: src/realm/. The earlier prototype is retained. Latest GLBs and FBXs: public/realm-v2/. scripts/prepare-realm.mjs extracts in-place clips into motions.json so browsers do not download every duplicate FBX mesh. User audio remains in public/game-assets/audio/.

The core loader preserves descriptive pivot metadata while avoiding incompatibility with newer Three.js pivot handling. Floor and stair navigation use measured native laboratory coordinates, not the lowest hose bounds.

The supplied logo is a solid lime panel rather than a usable emblem. This interface uses a text wordmark until a clean logo is supplied.

See REALM-V2-STATUS.md for verification evidence and remaining checks. Public hosting, production identity/security, and physical low-end-phone profiling are separate from this local simulation.
