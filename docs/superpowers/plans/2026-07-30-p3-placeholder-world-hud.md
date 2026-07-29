# Auto Life P3 — Placeholder World & HUD

> **Implementation contract:** one checked task at a time; focused failing check → minimal implementation → green → wider checks. Never checkpoint a red tree (master convention 1). Stage only task-owned paths; never `git add -A` (convention 2).

**Goal:** the sim becomes visible. A complete placeholder day, watchable at 1×/2×/4×, with the HUD reading true and the simulation outcome unchanged by playback speed.

**Owned by this phase** (master §5, verbatim): placeholder home scene · rendering/interpolation · visible travel/actions · HUD/clock/speeds · pause/background behavior · desktop scaling baseline.

**Exit evidence** (master §5, verbatim — not re-negotiable here): a complete placeholder day is watchable at 1×/2×/4× · sim result is speed-independent · desktop frame/scaling evidence recorded.

**Entry gate:** A0 passed (evidence/A0.md) — master §9 requires it before this plan is approved.

---

## 0. Definition of Ready — recorded 2026-07-30

Per master §3. All seven checked against the tree, not from memory.

| # | Check | Result |
|---|---|---|
| 1 | Prior evidence + green tree | P2 COMPLETED (evidence/p2.md, ENGINE_VERSION 5); A0 COMPLETED (evidence/A0.md). `validate:content` + `tsc --noEmit` + `jest` → 198 tests / 22 suites green at `731f846`. |
| 2 | Repository inspected | Full sweep done. `src/` = sim (25 files), render (palette, sprite-spec, sprites/a0), persistence (kv adapter), application (ProofScreen only). **No loop driver, no scene, no HUD, no `src/ui/` at all.** |
| 3 | Owned clauses mapped | §2 traceability table below. |
| 4 | Library assumptions verified | Against the installed tree, not docs: `@shopify/react-native-skia@2.6.2` exports `Atlas` taking `{image: SkImage \| null, sprites: SkRect[], transforms: SkRSXform[], colors?, colorBlendMode?, sampling?}`; `useRSXformBuffer(size, modifier)` and `useImageAsTexture(source)` live in the reanimated integration; `canvaskit-wasm` declares `drawAtlas` and Skia's `JsiSkCanvas` (web) implements it. **`react-native-reanimated`, `zustand`, and `nativewind` are NOT installed** — P0 deliberately deferred them to their first consumer, which is this phase. |
| 5 | Cross-phase effects named | `SimSnapshot` gains read-model fields (T3). **No `ENGINE_VERSION` bump**: the snapshot is derived output, no simulated behaviour changes, and the golden digest is unaffected. Asserted in T3. |
| 6 | Cut-line effects | §11.5 phone/fractional scaling is explicitly v1.1 (SPEC §11.5, master §9) — P3 ships the **desktop** baseline only. Nothing else in P3 is cuttable: it is the only phase that makes the sim visible, and P4's playtest slice sits on top of it. |
| 7 | Plan audited before code | Adversarial loops 1–4 run after implementation per Joe's instruction (loops 2 and 4 via `codex exec`, gpt-5.6-sol at reasoning max). |

---

## 1. Blocking questions

**Q1 — Snapshot extension: additive, no version bump.** `SimSnapshot` today is `{minuteOfDay, day, health, bars, queueIds, currentLabel, processed, practicePoints}`. A renderer cannot draw the sim from that: **there is no position, no facing, no travel path, no activity progress, and no `m_speed`.** Master §4 names "snapshots and interpolation data" as render's input but never defines the second half. T3 defines it.
→ **Ruling taken: extend `SimSnapshot` with a `render` block. Read-model only, no `ENGINE_VERSION` bump, golden digest unchanged (asserted).**

**Q2 — Sleep-skip (§11.4) is unowned, and P3 is where it becomes visible.** Master §5 gives P4 "the first-night recap" and P5 "remaining recap"; §11.4's dissolve-to-morning is in neither row. Measured on the current engine: a steady-state day is **493 sleep minutes = 4.1 real minutes at 1×**, against a 12-minute day.
→ **Ruling taken: P3 does not build it** (not in P3's owned list, and the phase plan may not claim scope). P3's evidence records the measurement and names §11.4 as still unowned, so it cannot vanish silently (master §3). The day is watchable without it; it is just a dull third of the watch.

**Q3 — NativeWind is in SPEC §3 but absent from the master's chosen stack.** The master lists Skia, Reanimated, Zustand, Zod, expo-sqlite, expo-audio, Jest — no NativeWind.
→ **Ruling taken: do not install it in P3.** The HUD is a handful of bars and a clock; plain `StyleSheet` costs nothing and avoids adding a Tailwind build step to the web export path that P0 fought to stabilise. P4 owns the decision when the queue strip brings real styling volume. Recorded as a deviation from SPEC §3 with P4 as owner.

**Q4 — Interpolation is mandatory, not decorative.** SPEC §5: "the renderer interpolates ticks to 60 fps." Travel is coarse by design — `travelTicks` compresses a 10-tile path into ~3 ticks, so the sim's authoritative position jumps ~3.5 tiles per tick, and at 1× a tick is 500 ms. Drawing raw per-tick positions would teleport the sim across the room three times a second.
→ **Ruling taken: the renderer lerps along `render.travelPath` using a fractional tick clock. The sim is never consulted for sub-tick state.**

**Q5 — "Sim result is speed-independent" means bit-identical.** Interpreting it as "roughly the same" would make the assertion untestable.
→ **Ruling taken: drive the same seed through the loop at 1×, 2×, and 4× and assert the resulting `SimState` digests are identical.** A fixed-timestep accumulator makes this true by construction; the test is what proves the accumulator is right.

---

## 2. SPEC-clause traceability (master convention 6)

| Clause | Task | Verified how |
|---|---|---|
| §5 speeds, real-time-per-tick, clock display, tick→60fps interpolation | T4, T6, T7 | speed-independence test; interpolation unit test; clock-format test |
| §5 background/close → hard pause | T4 | visibility-change unit test on the loop |
| §10 home scene grid, rooms, objects, interact points | T5, T6 | scene builds from `home-map.json` + `objects.json`; snapshot test of tile classification |
| §11.1 Health block, four sub-bars, per-bar display bands, Energy's custom bands | T7 | band-selection unit test incl. the Energy exception |
| §11.1 clock block + speed controls | T7 | render test |
| §11.3 walk/act tempo tracks `m_speed` | T6 | animation-rate unit test |
| §11.5 desktop scaling (reserve UI, DPR half-steps, 1×-DPR laptops at 1×) | T8 | scale-solver unit test at the three verified viewports |
| design.md §6 face/hair layers load-bearing for facing (A0 finding) | T5, T6 | atlas contains face+hair layers; facing test |
| master §4 render ring never mutates sim truth | T3, T6 | snapshot is frozen; no sim import writes |

**Not P3, owners named:** §11.2 queue strip, §11.6 keyboard/a11y, §11.7 pause menu + settings, §11.8 bindings → **P4**. §11.4 sleep-skip → **unowned, flagged (Q2)**. §11.5 phone/fractional → **v1.1**. Real art → **P6** (master convention 7: placeholders only).

---

## 3. Tasks

### T1 — Install P3's first-consumer dependencies

- [ ] `npx expo install react-native-reanimated` (Expo SDK 57 resolves the correct v4 line; do not pin by hand). Add the Reanimated Babel plugin per current Expo guidance — verify the exact plugin name against the installed package's docs before editing `babel.config.js`.
- [ ] `npm install zustand` (master: "Zustand when the first UI consumer arrives" — that is this phase).
- [ ] Do **not** install NativeWind (Q3).
- [ ] Verify: `npx tsc --noEmit` and `npm test` still green; `npm run export:web` still succeeds. Reanimated touches the Babel/Metro path, so a green export here is the real check.

### T2 — Atlas-on-exported-web proof (do this before building anything on it)

P0's lesson was that "the API exists" and "it works in the exported build" are different claims — expo-sqlite's web driver was alpha and hung, which is why `persistence/kv` exists. `drawAtlas` is a different CanvasKit path from the `Rect` P0 proved.

- [ ] Extend the proof screen (or add a temporary route) to draw ≥2 sprites from one texture via `<Atlas>` with hand-built `sprites`/`transforms`.
- [ ] Verify in `npm run export:web` + `npm run serve:dist`: both sprites visible, correct sub-rects, no console errors, `crossOriginIsolated` still true.
- [ ] Record the observation in evidence. **If Atlas does not render on exported web, stop and report** — the rendering approach, not the plan, is what changes.

### T3 — Extend `SimSnapshot` with the render read-model

- [ ] Failing test first: a snapshot from a travelling sim exposes enough to draw it — position, facing, path, and progress.
- [ ] Add to `SimSnapshot`:

```ts
render: {
  /** Authoritative tile position at the end of this tick. */
  position: { x: number; y: number };
  /** Facing for sprite selection. Derived from travel delta; holds last value when still. */
  facing: 'down' | 'up' | 'left' | 'right';
  /** Present only while travelling — the renderer lerps along it (Q4). */
  travel: { path: readonly { x: number; y: number }[]; elapsedTicks: number; totalTicks: number } | null;
  /** 0..1 for the progress ring over the sim (§11.1). Null when idle or sleeping. */
  activityProgress: number | null;
  /** §11.3 — animation tempo tracks this. */
  mSpeed: number;
}
```

- [ ] Facing derivation belongs in `sim/` (it is a pure function of the path) so the renderer stays a consumer.
- [ ] Assert **no `ENGINE_VERSION` bump is needed**: re-run the golden week and confirm the digest snapshot is byte-identical (Q1/DoR #5).
- [ ] Verify: new tests green; `golden-week` snapshot unchanged.

### T4 — The application loop (master §4: `application/` owns the live loop)

- [ ] Failing test: a fixed-timestep accumulator advances exactly N ticks for a given elapsed-ms and speed, and **the same seed at 1×/2×/4× produces identical state digests** (Q5).
- [ ] Implement `src/application/loop.ts`, pure and injectable — it takes elapsed milliseconds, never reads a clock itself, so it is testable without timers and keeps `Date.now` out of the deterministic path.
  - speed multipliers 0 (pause) / 1 / 2 / 4 → 500 / 250 / 125 ms per tick per §5
  - accumulator carries the remainder; never drops or doubles a tick
  - a **catch-up cap** (e.g. ≤ 8 ticks per frame) so a stalled tab does not fast-forward the sim on return — the sim is paused on background anyway (§5, C1), and the cap is the belt to that braces
- [ ] Wire a Zustand store that holds the latest snapshot + speed and exposes `setSpeed`. UI mirrors snapshots; the sim owns truth (SPEC §3).
- [ ] Background/close → hard pause via the visibility API (§5, C1). Unit-test the transition; note in evidence that no time passes while hidden.
- [ ] Verify: loop tests green including speed-independence.

### T5 — Build the placeholder atlas

Master convention 7: placeholders only, no dependency on final sprites.

- [ ] Extend the art pipeline to emit one texture containing: the tile set (floor per room, wall, door) as flat palette boxes, one box per object footprint, and the **A0 character frames including the face and hair layers** — A0's accepted limitation makes those load-bearing for facing, so they cannot be dropped as a "placeholder simplification."
- [ ] Emit a JSON sprite index (`name → {x, y, w, h}`) alongside the PNG so the scene never hard-codes sub-rects.
- [ ] Reuse `validate-palette` on the generated sheet — the CI gate covers placeholders too.
- [ ] Verify: sheet builds, validator green, index round-trips.

### T6 — The Skia scene

- [ ] Tilemap from `home-map.json`, objects from `objects.json`, drawn via a **single `<Atlas>`** (master §9: Atlas is mandatory from the first sprite renderer — never one component per sprite).
- [ ] `useRSXformBuffer` for the transform buffer so per-frame work stays off the JS thread.
- [ ] Sim sprite: facing from `render.facing`, walk-loop frame from a fractional tick clock, tempo scaled by `render.mSpeed` (§11.3).
- [ ] Interpolate travel along `render.travel.path` (Q4). Unit-test the interpolator directly — given a path and a fractional progress it returns the expected sub-tile point — so the maths is verified without a renderer.
- [ ] Progress ring over the sim from `render.activityProgress` (§11.1).
- [ ] Verify: scene renders in dev web and in the exported build; a full placeholder day is watchable.

### T7 — HUD (§11.1)

- [ ] Health block: large Health bar + four sub-bars with icons. **Display bands come from `rates.json`**, including the Energy exception (edge tick <30, red <15) — a hard-coded band here would re-create the "cries red every healthy evening" bug the SPEC calls out. Unit-test band selection per bar.
- [ ] Non-colour urgency signal alongside the red pulse (§11.1 → §11.6): the icon changes shape, not just colour.
- [ ] Clock block: `Day 3 · Wed · 14:32` + pause/1×/2×/4× controls. Unit-test the format against §5.
- [ ] Practice counter beneath the health block (§11.1). The permanent HUD stays capped at §11.1's list — no additions.
- [ ] Verify: HUD tests green; values track the snapshot.

### T8 — Desktop scaling baseline (§11.5)

- [ ] Pure scale solver: reserve UI first (~48 px HUD + 72 px queue), then pick the largest `S` where `S × devicePixelRatio` is an integer and 768×448 fits the remainder.
- [ ] Unit-test the three verified cases: MacBook Air 13 at DPR 2 → 1.5× legal; 1366×768 at DPR 1 → 1×; and a case where nothing fits, which must degrade predictably rather than throw.
- [ ] Phone/fractional path is explicitly **not** built (v1.1, DoR #6).
- [ ] Verify: solver tests green; observed scaling recorded in evidence.

### T9 — Phase exit evidence

- [ ] Watch a complete placeholder day at 1×, then at 2× and 4×. Record what was observed, not what was intended.
- [ ] Record: frame timing on the exported desktop build, the scaling actually chosen, the speed-independence digest comparison, and the Atlas-on-web observation from T2.
- [ ] Record the **P3 watch findings** — the things only a rendered day reveals. Known going in, from the v5 engine trace: 79% of waking minutes are idle (expected: Practice is player-only and there is no queue yet), sleep is 4.1 real minutes at 1× (§11.4 unowned, Q2), and there is a 1-tick gap between consecutive activities that will read as a half-second freeze at 1×.
- [ ] Complete the §2 traceability table; name every deferral's owner (master §3).

---

## 4. What P3 deliberately does not do

Named so no later phase can claim they were forgotten:

- **No queue interaction of any kind** — no strip, no drag, no card menus, no palette, no undo. §11.2/§11.6/§11.8 are P4's. The only input P3 accepts is pause and speed.
- **No forecast surfacing.** The headless forecaster exists; its start-times/why-lines/conflict UI is P4's (master §9).
- **No sleep-skip** (Q2), no recap (P4/P5), no goals, wrinkles, intentions, or identity (P5).
- **No persistence wiring.** The kv adapter exists from P0; P3 does not save or restore. Three-layer persistence is P5.
- **No real art** (P6) and **no phone/fractional scaling** (v1.1).
- **No sim behaviour changes.** If P3 needs the sim to behave differently, that is a finding to report, not a fix to make here — it would bump `ENGINE_VERSION` and re-record a golden that P2 signed off.
