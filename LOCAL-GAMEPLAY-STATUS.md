# Local gameplay milestone - 2026-09-25

The user's later instruction defers public online, wallet access and Lucky Box. This milestone is local gameplay, not production deployment.

Latest requested asset direction: the lab now uses `Kryvora_Reactor_Lab_Expanded.glb` and the lobby uses `Kryvora_Twin_Portal_Forest.glb`. Stair ascent/descent clips are no longer selected for movement; normal walk/run clips are used instead. Sky lighting and speech-bubble nameplates above characters are enabled. A Choose or create a server entry is restored; country guild assignment remains outside the start flow and Captain/Co-Captain IDs will be supplied later.

Lobby sky asset: `public/realm-v2/ui/global-lobby-sky.png` (aurora/night-ocean reference supplied 2026-09-26). It is applied as the WebGL background during Global Lobby gameplay; the main menu keeps the map-focused presentation.

## Implemented

- Play enters the shared Global Lobby using Twin_Portal_Sanctuary.glb. West Fusion Portal enters the dedicated Fusion Lab; its entrance portal returns to the lobby. East Mission Portal displays Coming Soon.
- Supplied textured avatar, shared animation clips, keyboard and touch movement, running, jumping, stairs, carrying and sitting.
- Horizontal/vertical drag camera orbit, wheel zoom and environment-aware camera clearance.
- Measured lobby floor navigation across stairs and both bridges, edge guards and heart-tree exclusion. Lab uses measured floors and collision proxies, not comprehensive per-object physics.
- Selected Primary and Catalyst appear in their respective front containment tubes. Carried selected items are not duplicated in the hand. Docking is menu-driven, not fully hand-aligned physical insertion.
- 4.2-second fusion charge with both models moving from tubes to reactor. Success reveals the upgraded model and plays Victory; meltdown shows red/orange shockwave/particles and plays Defeat.
- A 5.2-second outcome phase lets the supplied Victory (4.5 s) and Defeat (1.63 s) clips finish before opening the result panel. Success panel uses a lit rotating 3D core, with Fuse another pair and View inventory actions.
- All core tiers are prepared while loading the lab to prevent a blank first-success effect.
- Primary keeps its ID on upgrade; Catalyst is consumed. Meltdown consumes both. Rates 70/45/20% and shard returns 60/100/200 remain provisional simulation values.
- English UI, flags on nameplates, Vietnam-first lobby guild list and selector, supplied HUD SVG icons and text wordmark. The supplied lime rectangle is not claimed to be a finished logo symbol.
- Fixed six guild templates and reserved Captain/Co-Captain slots. Actual leadership assignments and invite/kick management are not implemented and require verified character IDs.
- Guild rule recorded for the next phase: guilds are not chosen or created from the start menu. After a Captain or Co-Captain has a verified character ID, they manage their assigned guild by inviting through a share link or adding a member by username, approving join requests, and kicking members. Regular members cannot approve requests, kick members, or create guilds. The guild UI and permissions are intentionally deferred for now.
- Same-origin live movement, carried cores, realm/guild chat; marked bots fill occupancy to 20. This does not mean 20 real users are online.
- Destination loading blocks controls. Failed room joins preserve the previous session.

## Verified

- TypeScript no-emit check and production build pass.
- 13 tests pass: 20 concurrent HTTP/SSE clients, capacity/chat/disconnect handling, all four core transforms, fusion invariants, lab route/collision, both lobby portal routes and 24 valid lobby spawns.
- Browser controls traversed the staircase and both bridges, entered Fusion Lab and returned through its floor portal. Mission interaction displayed Coming Soon without transferring.
- Browser success and meltdown tests completed. Standard 5cd4d became Overclocked 5cd4d; Catalyst 21fc5 was removed. An Overclocked meltdown awarded 100 shards.
- Docked cores, charge, meltdown feedback and the rotating result model were inspected. Drag orbit and wheel zoom changed the rendered view. Analog release stopped movement.
- Result panel and gameplay HUD fit the 390 x 844 test viewport; the result model and both actions remain visible.
- Earlier checks covered two-browser local chat, carried-core synchronization, reconnect, audio/muting and cross-tab inventory. These are historical checks, not 20-device performance benchmarks.

## Boundaries

- Preview binds to 127.0.0.1 only. Public online is deferred.
- Rooms/chat are in memory; inventory/shards are local browser test data, not a durable server-authoritative economy.
- No wallet login, Node Key ownership gate, mint, purchase, burn or real-value fusion is active.
- Production reference: Arbitrum One contract 0xCaf5Ddc61D1DfF5F1399D5EA961CD05223F6AE9d; mint destination https://node.kryvora.network/#node-center. Holding versus consuming two Node Keys must be clarified before transactions.
- Lucky Box and avatar collection remain deferred.
- Large assets/Three.js bundle still need optimization and testing on real low-end phones. Viewport checks are not physical-device benchmarks.
- The supplied FBX has vertices with more than four weights; Three.js trims extras. Browser logs also contain library deprecation/shader precision warnings, with no blocking error observed in these checks.

## Run

From this project directory:

```text
npm run build:realm
npm run preview:realm
```

Open http://localhost:3001/ . Port 3000 may show an older build/service.

The project-only build and TypeScript loader avoid ancestor-directory discovery failures in the restricted Windows runtime. No drive mapping is required; existing dist output is preserved.

```text
node --preserve-symlinks --preserve-symlinks-main node_modules/typescript/bin/tsc --noEmit
node --preserve-symlinks --preserve-symlinks-main --loader ./scripts/local-ts-loader.mjs --test tests/realm.test.ts tests/realm-network.test.ts
```
