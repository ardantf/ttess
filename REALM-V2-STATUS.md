# Kryvora Node Realm — shared simulation

> Historical milestone notes. For the current implementation, verification, limitations and port 3001 run instructions, use [LOCAL-GAMEPLAY-STATUS.md](LOCAL-GAMEPLAY-STATUS.md). The older room browser, deployment commands and planned features below do not describe the current UI.

Guild product rule recorded for the next phase: remove guild choice from the start menu. Captains and Co-Captains will invite via share link or username, approve join requests, and kick members; regular members cannot manage guild membership. Implementation is deferred.

Current entry point: `src/realm/RealmApp.tsx`. The original prototype and source assets remain available; this version uses the newly supplied assets in `public/realm-v2`.

## Implemented

- No-wallet entry with operator name, country guild and PC/mobile choice.
- Six country realms (Indonesia, Colombia, India, Vietnam, Iran, Nigeria), plus shared custom realms with capacities 20/24/32/40.
- Same-server live player positions, facing direction, animation state and carried-core visibility via a same-origin simulation service.
- Realm chat and country-filtered guild chat. Session capacity, message limits, coordinate validation and same-origin write checks are enforced by the server.
- Clearly marked bots fill a room to twenty operators as live players enter or leave. This is not a claim of twenty real people being online.
- Supplied textured character, sixteen extracted animation clips, original laboratory and four core models.
- Measured floor/stair navigation, reactor/chamber collision proxies, keyboard movement and touch analog with pointer-release cleanup.
- Inventory, visibly carried cores, two-core fusion and shard recovery. Current success rates and shard values are explicitly provisional simulation rules.
- Country guilds are fixed official templates, not player-created guilds. Each country reserves Captain and Co-Captain assignments until the real character IDs are provided. Players may create rooms/servers, but they do not create or rename country guilds.
- Revised entry flow: the start menu has a single “Play Game” path into the Global Server rather than asking players to choose a room first. Profile setup creates the operator ID and selects the available avatar/template. Room sharding can remain an invisible backend concern as the global population grows.
- Captain management: once a Captain has a verified character ID, the Captain selects their assigned country guild, invites members by share link or username, and can remove members. Regular players cannot create guilds or change guild ownership.

## Verification to date

- `npm run lint`: pass.
- `npm run build`: pass; Three.js bundle remains large and is a performance optimization candidate.
- `npm run test:realm`: eleven passing tests, including twenty simultaneous HTTP/SSE clients, capacity overflow, shared chat, guild-history isolation, disconnect replacement, native model transforms, fusion invariants and a continuous entrance-to-gallery route.
- Browser: custom room created, rediscovered in a second session, joined by two simultaneous sessions; both show 2 live + 18 simulated operators.
- Browser: realm message sent from mobile session appears in desktop session; the other live avatar and carried core are visible.
- Browser: PC W input changes the player's actual minimap position; mobile analog moves the player into interaction range. Mobile fusion selection layout inspected at 390 × 844.
- Browser: Shift+W and E reach/open the reactor; a completed fusion upgraded Standard 1BBE4 to Overclocked and the inventory showed that upgraded ID with the Catalyst removed.
- Motion clips are parsed once and shared among all avatar instances. LAN HTTP character IDs have a secure-random fallback for browsers where randomUUID is unavailable.

## Important boundaries / remaining verification

- Rooms and chat are in server memory and reset on restart. Inventory remains local test data, not a server-authoritative economy.
- This is a local/LAN simulation, not a public internet deployment. A secure production hosting and identity plan is still required for public play.
- Twenty protocol clients were tested, not twenty physical phones or twenty simultaneously rendered browser windows. Low-end phone performance needs device testing.
- Fusion-result/return-to-inventory flow passed. Latest cross-tab storage protection and sitting/landing transitions still require a final browser check.
- Final QA: at 844 × 390, the mobile analog and action buttons are on screen, there is no horizontal overflow, and inventory scrolls within its panel. Music and ambience were observed playing with readyState 4 and advancing playback time; muting removed all audio elements. A QA server was stopped and restarted; the reconnect notice cleared automatically and a new chat message was successfully delivered afterward. Two QA tabs confirmed inventory changes propagate through browser storage events without overwriting the other tab.
- Latest lint, eleven tests and production build pass. Keyboard Shift now selects running footsteps through reported movement state, not only the mobile Run switch.
- The provided logo image appears as a solid lime rectangle. The interface intentionally uses a text wordmark, not a replacement claimed to be the user's original logo.
- No blockchain connection, ownership gate, purchase, or real-value fusion is active.

## Next requested polish (not implemented yet)

- Replace the current high follow camera with a more natural third-person camera: mouse drag should freely orbit around the operator, with comfortable zoom and no forced top-down framing. Preserve touch drag for mobile.
- Give fusion a strong readable feedback sequence: reactor charge-up, energy/core effects, success or meltdown state, audio timing, and a result panel.
- On successful fusion, show the resulting upgraded core as a 3D preview in the reactor/result panel before returning it to inventory. Keep the existing tier model and inventory identity visible.
- Core insertion must be visible: while carried, the operator brings the core to a reactor docking bay, plays an insert/place animation, and the core remains visibly inside the tube. The reactor then uses the Primary and Catalyst tube contents for the fusion sequence instead of making the carried core disappear immediately.
- World structure: the current laboratory becomes a Fusion Lab dedicated to fusion. Players arrive in a shared lobby first, then use a Fusion Portal to enter this lab. A Mission Portal is visible in the lobby but locked with a clear “Coming Soon” state until mission gameplay is designed.

## Future avatar collection (design discussion)

- Add an Avatar Shop / Loot Box surface in the lobby UI. The production concept is a limited collection of 100 avatar characters, with rarity labels Common, Uncommon, Rare, Epic, Legendary, and Mythic.
- The current no-wallet simulation should mock the shop, rarity cards, previews, and ownership states only. Real Node Key ownership, minting, payment, and Arbitrum verification remain a later production phase.
- Each collectible avatar needs a compatible textured character model, a verified skeleton/rig, and a shared locomotion/action animation set. If all avatars share one skeleton, reuse the existing clips; unique rigs require retargeted or newly authored clips.
- Lucky Box / Avatar Shop is deferred and is not part of the current fusion milestone.

## Fusion ownership gate (production planning)

- Fusion requires the connected account to hold at least 2 Node Keys. The current simulation remains wallet-free and should represent this with a mock requirement only.
- Before implementing the real gate, the owner must provide the exact Arbitrum network (One or Sepolia), Node Key contract address, token standard (ERC-721 or ERC-1155), and the read method used to verify balance/ownership.
- Clarify whether the 2 Node Keys are only a holding requirement or are actually consumed/burned. Do not implement a burn or transaction until this rule is explicitly confirmed.
- Candidate contract supplied: Arbitrum One `0xCaf5Ddc61D1DfF5F1399D5EA961CD05223F6AE9d`. The attached ABI is ERC-721-shaped (`balanceOf`, `ownerOf`, `tokenURI`, `totalSupply`, ERC721 errors) and has no burn/consume function. It can support a read-only `balanceOf(wallet) >= 2` gate once the owner confirms this is the Node Key collection.
- Mint handoff: the game should not mint or sell Node Keys itself. The “Get Node Key” action should open the official [Kryvora Node Network](https://node.kryvora.network/#node-center) page; after minting, the player returns to the game and reconnects/checks the wallet balance.
- New lobby asset received: `Twin_Portal_Sanctuary.glb` (about 24.2 MiB). Treat it as the global-lobby portal asset; inspect its scale, materials, and portal separation before placing it in the scene.
- UI asset clarification: `wwa.png` is a lime side accent/background, not the logo mark. The supplied SVG icons are intended for Shards, Guild/Shield, Inventory, and Mute controls; the Kryvora wordmark remains text until a visible logo mark is supplied.

## Run

`npm run dev` runs both Vite and the same-origin shared realm service on port 3000. `npm run preview` also mounts that service for the built app. The legacy `npm run serve` mounts it before the original registry middleware.

When the sandboxed Windows Node runtime cannot resolve the user profile path, this session uses a temporary `Z:` mapping to the project. The currently running UI is the built preview on port 3000 (`npm run preview -- --port 3000 --host 0.0.0.0`), not the earlier Vite dev server. Rebuild and reload for frontend changes; restart the preview process for realm-service changes. Disabling Vite watching had cached older source modules, so checking only a reload of that earlier dev process was insufficient.
