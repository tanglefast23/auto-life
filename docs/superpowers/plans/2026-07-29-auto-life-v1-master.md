# Auto Life v1 — Master Implementation Plan

> **Implementation contract:** Work one checked task at a time. A named agent skill may help execute a phase, but no unavailable skill is assumed. Every task ends with the relevant checks green; phase exits require the evidence defined below. Git initialization and commits happen only when Joe explicitly authorizes them for the implementation run.

**Goal:** Ship Auto Life v1 per `SPEC.md` v0.3: the autonomous life sim's home chapter, desktop web first.

**Architecture:** A deterministic, framework-free TypeScript domain core; an application layer that is the sole owner of the live tick loop; read-only snapshots for UI/rendering; typed commands back into the application; versioned, plain-data persistence. P0 proves the web platform. P1 proves the simulation arithmetic. Later implementation details are planned from the code that exists when each phase opens.

**Chosen stack:** Expo managed workflow + strict TypeScript · React Native Web static export · Vercel target · `@shopify/react-native-skia` (Atlas from the first real sprite renderer in P3) · Reanimated v4 · Zustand when the first UI consumer arrives · Zod 4 · `expo-sqlite` · `expo-audio` · Jest for the pure TypeScript rings.

**Fixed decision (C12):** P−1 is skipped and will not be reopened. Build order is P0 → P1 → P2 → P3 → P4 → **P4.5 external playtest, the sole fun gate** → P5 → P6. The response to that choice is a stronger, non-movable P4.5 protocol—not a disguised replacement prototype.

---

## 1. What this master locks

This file locks:

- phase ownership, order, entry/exit gates, and required evidence;
- domain boundaries, deterministic state seams, and tick meaning;
- which minimum playable systems must exist before P4.5;
- the failure/retest rule for the sole fun gate;
- cross-phase requirements that no later detailed plan may silently drop.

This file does **not** lock speculative filenames or write placeholder P2–P6 code. Exact files, APIs, and tests for a later phase are chosen from the then-current repository when that phase opens.

## 2. Plan index

| Phase | Detailed plan | Status / timing |
|---|---|---|
| P0 platform + P1 sim arithmetic | `2026-07-29-p0-p1-scaffold-sim-core.md` | **COMPLETED** — evidence/P0.md, evidence/P1.md |
| P2 headless game loop | `2026-07-29-p2-headless-game-loop.md` | **COMPLETED** (incl. P2.1 dual-audit stabilization, ENGINE_VERSION 5) — evidence/p2.md |
| A0 art-risk spike | authored after P2; must pass before the P3 plan is approved | **COMPLETED** — layer/anchor/offset strategy accepted with 3 documented simplifications; evidence/A0.md |
| P3 placeholder world + HUD | `2026-07-30-p3-placeholder-world-hud.md` | **COMPLETED** — 4 adversarial loops (self / codex 5.6-sol max / self / codex 5.6-sol max); evidence/P3.md |
| P4 queue UI + minimum first-session slice | authored only after P3 exits | **next** |
| P4.5 external playtest protocol | authored and frozen no later than P4 start; run after P4 exits | pending |
| P5 remaining v1 game/content/settings/saves | authored only after P4.5 passes | blocked by fun gate |
| P6 final art/audio/juice/performance | authored only after P5 exits | pending |

Writing detailed P2–P6 plans just in time is deliberate. A phase-index row alone is not the no-skip safeguard; the Definition of Ready and traceability rules below are.

## 3. Definition of Ready for every later phase

A phase may open only when all of these are true:

1. The previous phase's acceptance evidence exists and `npm run verify` is green on the current tree.
2. The current repository—not an imagined future tree—has been inspected.
3. The phase's owned `SPEC.md`, `design.md`, and `writing.md` clauses are mapped to implementation tasks and an automated or observed acceptance check.
4. Dependencies and current library/API assumptions are verified against official documentation.
5. Cross-phase inputs/outputs and any schema or `ENGINE_VERSION` effect are named.
6. Cut-line effects are explicit. A cut cannot remove something needed by a later gate.
7. The detailed phase plan has been audited before phase code starts.

A phase may not close with an owned SPEC clause silently deferred. A deliberate deferral must name its new phase owner in this master plan and in the phase evidence.

## 4. Locked domain seams

### Ownership and dependency direction

- `src/sim/`: deterministic minute-by-minute mechanics. No React Native, Expo, Skia, ambient clock, storage, `Math.random`, or `Date.now`.
- `src/game/`: deterministic goals, wrinkles, progression, and chapter rules. It may depend on `sim/`; it remains framework-free.
- `src/application/`: composition root. Owns the live loop, applies commands, calls the domain step, coordinates persistence, and publishes immutable snapshots.
- `src/render/`: consumes snapshots and interpolation data. It never mutates simulation truth.
- `src/ui/`: consumes snapshots and dispatches typed commands. It never writes domain state directly.
- `src/persistence/`: stores and restores versioned plain-data snapshots. It does not import UI or rendering code.
- `content/`: player-facing balance values, authored content, and data-defined objects/rules likely to be tuned. Mathematical invariants and structural constants such as the fixed-point scale and minutes per day stay in code.

The concrete file list below is a starting map, not a locked promise:

```text
/
  content/
    rates.json
    activities.json
    adjacency.json
    anchors.json
    reactive.json
    practice.json
    objects.json
    home-map.json
    wrinkles.json
    goals.json
    strings/*.json
  src/
    sim/
    game/
    application/
    render/
    ui/
    persistence/
  scripts/
  docs/
    superpowers/plans/
    superpowers/evidence/     # created as phases execute, not as placeholders
  SPEC.md
  design.md
  writing.md
```

### Simulation seam

The later P2 plan must preserve one conceptual API:

```text
step(serializableState, commandsForThisBoundary, validatedContent)
  -> { nextSerializableState, domainEvents, immutableSnapshot }
```

- The state contains no closures, class instances, framework objects, or embedded copies of content definitions.
- Active work stores IDs plus sampled values needed for deterministic resume.
- The forecaster deep-clones plain state and invokes the same step path; it never advances live PRNG state.
- Renderer interpolation never feeds values back into the domain.

### Tick meaning and bar writes

`state.clock` names the game-minute that is about to run. A tick:

1. applies commands accepted at that minute boundary;
2. evaluates windows/triggers for that displayed minute;
3. starts the next activity if needed;
4. collects passive, activity, travel, and temporary-effect deltas;
5. lets the application/domain reducer sum and clamp each bar **once**;
6. advances the clock by one minute and emits events/snapshot.

This makes the Day-1 07:00 wake window observable on the first step. Leaf systems calculate named signed deltas; they do not mutate bars independently. Sleep and an effective Nap suppress passive Energy for that tick, while other passive decay continues.

## 5. Phase ownership and acceptance

| Phase | Owned systems | Exit evidence |
|---|---|---|
| **P0** | Safe scaffold, strict TS, package lock, test/content commands, CI workflow, current Skia web loading, exported-build persistence proof (persistence adapter per the kill-gate ruling) | Clean-install verification; exported page visibly draws Skia; `crossOriginIsolated` is true; **persistence criterion satisfied via the kv-adapter ruling** (2026-07-29: expo-sqlite web is alpha and hung — web=localStorage, native=expo-sqlite; SPEC §15, evidence/P0.md) — counter survives hard reload and fresh context, with browser close/reopen carried as a recorded NOT VERIFIED deferral; CI actually runs green when a remote runner is available |
| **P1** | `ENGINE_VERSION`, fixed arithmetic, constant-time serializable PRNG streams, clock/tick semantics, initial bars, passive deltas, health and multipliers, walk-speed math, typed activity content, serializable timed activity state, phases, signed pro-rata cross-effects, Sleep/effective-Nap semantics | SPEC-to-test table complete for owned §5–§6 rules; exact closure-day test green; JSON round-trip mid-Meal produces identical completion |
| **P2** | Top-level headless step, anchors/reactive/priority, queue ownership and suppression, adjacency, deterministic A*/travel timing, **Practice scoring/curves/block-bonus math**, commitments DTO, forecaster, unattended golden, fairness/recovery/property harness | Full unattended placeholder week including travel; Practice math/unit pacing green; replay diff tied to `ENGINE_VERSION`; forecast agrees with real step path; queue invariants green |
| **A0** | One four-direction walk, seated action, hair layer, and outfit on average + offset-derived slim bodies | Reviewed rendered evidence at target scales; anchors/layers accepted or simplified **before P3 planning** |
| **P3** | Placeholder home scene, rendering/interpolation, visible travel/actions, HUD/clock/speeds, pause/background behavior, desktop scaling baseline | A complete placeholder day is watchable at 1×/2×/4×; sim result is speed-independent; desktop frame/scaling evidence recorded |
| **P4** | Full §7.4 queue interaction surface, forecasts/why-lines needed for comprehension, keyboard/mouse/touch-capable-web parity, **player-visible Practice integration using P2's math**, **§11.4 sleep-skip** (assigned 2026-07-30 — see below), plus the minimum first-session slice below | Every interaction passes; scripted queue replay added; a frozen build contains the complete P4.5 slice |
| **P4.5** | External test of comprehension **and enjoyment** using the frozen protocol below | Pass record from at least 3 fresh external testers; otherwise P5/P6 remain closed |
| **P5** | Remaining goals 3–7, full wrinkle shapes/variants and storylets, Practice levels/Prepared-Performer progression around the already-playable core, intentions, identity/preferences, journal, remaining recap, settings/autonomy, three-layer persistence, rotating saves/migrations, Day-8 letter | Mid-activity kill/resume; goals completable; scripted-player replay extended with Practice pacing, wrinkle exposure, Goal 6, suppression, and undo; authored-string gate current |
| **P6** | Final art per `design.md`, animation/juice, audio/music, desktop performance and ship pass | No placeholders; desktop-web DoD and re-run playtest criteria pass |

### §11.4 sleep-skip — owner assigned to P4 (2026-07-30)

§11.4's dissolve-to-morning was in no phase's owned list: P3's list did not contain it, P4 was given "the first-night recap" and P5 "remaining recap", and the *skip* is neither. Master §3 requires a deferral to name an owner, so this closes that gap.

**Why P4 and not "later":** measured on the shipped engine, a night is ~493 game-minutes — **4.1 real minutes at 1×, a third of a 12-minute day of dead air**. P4.5 is the external fun gate. If the skip is missing then, three fresh testers either sit through the night or someone builds it mid-P4 with no owner and no plan. It also belongs beside the first-night recap, which P4 already owns: the skip is what gets you *to* the recap.

Scope is small and deliberately bounded (SPEC §11.4): on night-sleep start, with no URGENT queued and no input for 10 s, dissolve to `wakeTarget`. **Daytime urgent sleep never skips** — its cost is meant to be felt.

### Minimum first-session slice required before P4.5

P4.5 must test the game the spec claims is fun, not only a queue editor. The frozen P4 build must include, in placeholder art:

- the full autonomous routine and editable queue;
- forecast start times, cap-waste, conflicts, and plain-language why-lines;
- Practice with its time trade-off and block bonus;
- the scripted Day-1 package wrinkle;
- Goals 1–2;
- one visible decoration reward;
- the first-night recap;
- a deterministic test-session reset; the decoration remains visible for the rest of that run (full disk persistence remains P5).

The minimal forecast UI and this slice are not cuttable or movable past P4.5. P5 expands them; it does not create the first fun-testable version.

## 6. P4.5 — frozen external playtest protocol

The detailed protocol is written and approved by P4 start, before results can influence its criteria.

**Session controls**

- One frozen build, seed, and starting state; version/hash recorded.
- At least 3 people who have not played or watched development and are not Joe.
- No coaching from the observer beyond what the game itself says.
- Observe from the moment queue control is granted through at least the first recap; offer one additional game day.
- Record behavior and exact player wording, not the observer's interpretation.

**Pass conditions**

1. Every tester makes a meaningful queue choice within 60 seconds of receiving control.
2. Every tester can point to what they expect one edit to change, then observes a visible consequence within roughly 3 minutes.
3. Every tester can state, unprompted, one decision they made and why.
4. Across the sessions, at least two distinct viable approaches appear (for example, protecting Practice versus protecting bars); neither creates an unexplained dead end.
5. Every tester notices at least one lasting change or reward by the first recap.
6. At least 2 of 3 choose to play the offered extra day and can say what they want to try or see.

**Failure loop**

- Classify each failure as discoverability, comprehension, agency, consequence visibility, pacing, or desire-to-continue.
- P5 and P6 stay closed.
- Change the smallest implicated P2–P4 behavior, record the change, freeze a new build, and rerun the unchanged protocol with fresh testers.
- Criteria cannot be weakened, waived, or moved without Joe's explicit decision.

## 7. Staged replay and harness ownership

The full §16.3 suite cannot truthfully exist in P2 because some player-dependent systems arrive later:

- **P2:** unattended seven-day golden; fairness, recovery, travel-inclusive timing, pin/property invariants; replay command format.
- **P4:** scripted queue edits, stop/remove/undo/suppression, forecast agreement.
- **P2:** Practice scoring/curve/block-bonus unit coverage.
- **P5:** week-scale Practice pacing, wrinkle-band exposure, adjacency involving Practice, Goal 6.

Each extension uses the same deterministic replay format. Any behavior-changing code or balance-data change requires an explicit `ENGINE_VERSION` decision and reviewed golden diff.

## 8. Conventions binding every phase plan

1. **Green checkpoints:** write a focused failing test, observe the intended failure, implement minimally, run it green, then run the relevant wider checks. Never checkpoint or commit an expected-red tree.
2. **Conditional Git:** if commits are authorized, review staged paths and commit only task-owned files. Never use blind `git add -A` in this pre-existing folder.
3. **Determinism:** fixed integers, direct serializable PRNG state, no ambient randomness/time, no framework imports in `sim/` or `game/`, no runtime object that cannot survive JSON round-trip.
4. **One bar commit per tick:** systems emit named signed deltas; one reducer combines and clamps. Debug checks target illegal sources, especially passive Energy during Sleep/effective Nap.
5. **Content-first without configuration soup:** player-facing balance/content likely to be tuned belongs in validated JSON. Structural invariants remain typed code.
6. **Traceability:** every owned normative SPEC clause maps to a test or observed gate. Claims such as “§6 covered” require the table.
7. **Placeholder-first art:** P0–P5 cannot depend on final sprites. A0 is the only early art exception.
8. **Current docs:** re-check official library guidance when a phase first uses or upgrades an external package.
9. **Evidence:** phase exit records exact commands/results, manual device/browser observations, unresolved risks, and any accepted deferral. A local export is not a deployment, and a local check is not CI.
10. **Authored prose:** before the first authored-string batch, verify the exact `humanizer` skill is available. Every changed batch receives that pass, then the deterministic `writing.md` checklist; reviewed file hashes/IDs and rewrites are recorded. A drafting/editing fallback may help rewrite, but does not satisfy the mandatory humanizer pass.

## 9. Known source-contract reconciliations for later plans

- Desktop web is the v1 release gate. P4/P6 plans must not silently restore iPhone as a v1 blocker; native verification belongs to the v1.1 mobile pass.
- P0 proves that Skia works on exported web; P3 is where Atlas becomes mandatory from the first sprite renderer.
- A0 is a P3 entry gate, not “any time before P6.”
- The headless forecaster is never cut. Its minimum visible start-time/why/conflict presentation is required for P4.5; only post-gate forecast polish may move.
