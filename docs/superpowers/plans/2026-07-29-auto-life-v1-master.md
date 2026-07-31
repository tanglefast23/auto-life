# Auto Life v1 — Master Implementation Plan

> **Current art/UI correction (2026-07-31):** wherever this historical plan says
> “HFM-style” or “final art,” `design.md` v3 is the binding meaning: F82-derived
> extra-large expressive hero, HFM palette backbone, Track-B house props, and Track-A UI
> chrome across every player-facing surface.

> **Implementation contract:** Work one checked task at a time. A named agent skill may help execute a phase, but no unavailable skill is assumed. Every task ends with the relevant checks green; phase exits require the evidence defined below. Git initialization and commits happen only when Joe explicitly authorizes them for the implementation run.

**Goal:** Ship Auto Life v1 per `SPEC.md` v0.3: the autonomous life sim's home chapter, desktop web first.

**Architecture:** A deterministic, framework-free TypeScript domain core; an application layer that is the sole owner of the live tick loop; read-only snapshots for UI/rendering; typed commands back into the application; versioned, plain-data persistence. P0 proves the web platform. P1 proves the simulation arithmetic. Later implementation details are planned from the code that exists when each phase opens.

**Chosen stack:** Expo managed workflow + strict TypeScript · React Native Web static export · Vercel target · `@shopify/react-native-skia` (Atlas from the first real sprite renderer in P3) · Reanimated v4 · Zustand when the first UI consumer arrives · Zod 4 · `expo-sqlite` · `expo-audio` · Jest for the pure TypeScript rings.

**Fixed decision (C12):** P−1 is skipped and will not be reopened.

**Joe amendment — 2026-07-30:** the external playtest moves from immediately
after P4 to immediately after P5. Build order is now P0 → P1 → P2 → P3 → P4 →
P5 → **P4.5 external playtest, the sole fun gate** → P6. Joe will first run the
same questions himself as a diagnostic, then recruit at least three fresh friends
for the counted sessions. The six pass conditions remain unchanged; this changes
timing, not the standard.

**Joe amendment — 2026-07-31 (supersedes the placement above):** the external
playtest moves again, to **after P6**, and runs on the final-art build. Build
order is now P0 → P1 → P2 → P3 → P4 → P5 → P6 → **P4.5 external playtest, the
sole fun gate**.

*Reason.* Joe could not identify objects in the frozen P5 build — every one of
the fifteen is a flat coloured rectangle. §6's failure loop can only change "the
smallest implicated P2–P5 behaviour", and art is P6-owned, so a comprehension
failure caused by placeholders has **no legal remedy inside the loop**: the
protocol would record a failure it cannot act on and spend three irreplaceable
fresh testers doing it.

*What this costs, recorded rather than glossed.* The original placement existed
so a design failure would surface before the expensive polish phase. A failure
now lands on a finished P6. Two things bound the damage, and both are structural
rather than hopeful: P6 holds `ENGINE_VERSION` at 8 with byte-identical goldens,
so a mechanics retune happens in `sim/`/`game/`/`content/` — domains P6 never
touches — and P6's own Gate A puts an observable legibility checkpoint before
audio, juice, and performance are spent.

*The six pass conditions remain unchanged.* This changes timing and the failure
loop's remedy scope (§6), not the standard.

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
| P4 queue UI + minimum first-session slice | `2026-07-30-p4-queue-ui-first-session.md` | **COMPLETED 2026-07-30** — T0–T12, post-phase audit fix, evidence/P4.md |
| P5 remaining v1 game/content/settings/saves | `2026-07-30-p5-v1-systems-settings-saves.md` | **COMPLETE 2026-07-30; local verify and post-P5 freeze green, evidence/P5.md** |
| P6 final art/audio/juice/performance | `2026-07-30-p6-final-art-audio-juice-performance.md` | **IN PROGRESS** — opened 2026-07-31 under the amendment above; runs before the playtest |
| P4.5 external playtest protocol | `2026-07-30-p4.5-external-playtest-protocol.md` | Criteria **FROZEN 2026-07-30 by Joe**, unchanged; **runs after P6** on the final-art build (2026-07-31 amendment). Joe diagnostic, then three fresh-friend sessions. v1 does not ship until it passes. |

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
| **P4** | Full §7.4 queue interaction surface, forecasts/why-lines needed for comprehension, keyboard/mouse/touch-capable-web parity, **player-visible Practice integration using P2's math**, **§11.4 sleep-skip** (assigned 2026-07-30 — see below), plus the minimum first-session slice below | Every interaction passes; scripted queue replay added; a recorded P4 baseline contains the complete minimum slice |
| **P5** | Remaining goals 3–7, full wrinkle shapes/variants and storylets, **§7.4 blocked-object deferral, Quick-wash rerouting, and visitor behaviour beyond P4's Day-1 package** (ruled 2026-07-30 at P4 T0 — retaining them in P4 needed engine work outside its Q1/Q6/Q7 allowance), Practice levels/Prepared-Performer progression around the already-playable core, intentions, identity/preferences, journal, remaining recap, settings/autonomy, three-layer persistence, rotating saves/migrations, Day-8 letter | Mid-activity kill/resume; goals completable; scripted-player replay extended with Practice pacing, wrinkle exposure, Goal 6, suppression, and undo; authored-string gate current |
| **P6** | Final art per `design.md`, animation/juice, audio/music, desktop performance and ship pass. **Also owns SPEC §11.1's world bubbles** (assigned 2026-07-31 — see below) | **No placeholder art** (mechanically gated); a real file per declared audio cue, with final sound design and mix deferred to v1.1 (see below); 60 fps defined as p95 ≤ 16.7 ms and < 1% dropped over 600 frames at 1× and 4×, idle and mid-travel; desktop-web DoD; **P4.5 passes on the frozen post-P6 build** |
| **P4.5** | After **P6** (2026-07-31 amendment): Joe diagnostic self-test, then external test of comprehension **and enjoyment** using the unchanged frozen criteria below, on final art | Pass record from at least 3 fresh external testers; otherwise v1 does not ship and §6's failure loop runs |

### Final audio and mix — owner assigned to v1.1 (2026-07-31)

P6 ships the **complete audio system** and a **complete cue bank**: the real mixer behind
P5's `AudioBus` interface, day and evening beds with the 19:00 crossfade, four
level-dependent Practice riffs, room tone plus the rain variant, footsteps for all three
floor materials, eight activity loops, the six UI cues, and every slider and mute working.
SPEC §18's "audio mixes with working sliders" is genuinely met.

**The sound design itself is explicitly placeholder for v1** [DECIDED by Joe, 2026-07-31].
Cues are synthesized from authored TypeScript parameters (P6 plan §0b) rather than
composed or performed.

**This collides with P6's "no placeholders" exit, and the collision is resolved rather
than papered over:** that gate is scoped to **art** — design.md §12's domain, which is
what it was written for and what the mechanical validator covers. Audio keeps its own,
weaker but real gate: the bill of materials requires a genuine file on disk for every
declared cue, so nothing is silently missing, and the audio bank is diffed in CI exactly
as the atlas is.

**Owner for final sound design and mix: v1.1.** It may not be quietly dropped, and P4.5's
result must be read knowing the sound is placeholder.

### §11.1 world bubbles — owner assigned to P6 (2026-07-31)

§11.1's world line reads: *"thought bubbles (need <40, preferences, hints), progress ring
over the sim, ⚠ forecast pulses."* Audited against the tree, the ring shipped in P3 and
forecast warnings shipped on P4's queue cards — but **the need and hint bubbles exist
nowhere and were in no phase's owned list**, and P5's preference bubble is a panel element
rather than a bubble over the sim. Same class of hole as §11.4's sleep-skip below: each
plan assumed a neighbour had it.

**Why P6:** there is no later phase, so an unowned v1 clause either lands here or silently
becomes a cut nobody decided. It is also correct on the merits — `design.md` §8 already
specifies the recipe and §9 the icons, and P6 is the phase that draws both. A bubble over
the sim's head is how a player learns *why* she walked to the shower without opening a
panel, which is the same comprehension problem the 2026-07-31 order amendment is about.

**Scope, bounded:** one bubble at a time, anchored to the character's head anchor, derived
only from state the engine already publishes (the `bandFor()` bands, P5's preference
reaction, P4's forecast warnings). No new domain state, no new event. Because bubbles are
*information*, they ship in P6's Milestone A and are part of Gate A — not with the juice.

### Rolling routine queue — adopted into v1 scope, `ENGINE_VERSION` 9 (2026-07-31)

The feature arrived from concurrent work, was swept into P6's commit `bf1a4cc` by a
`git add -A` that §8 convention 2 forbids, and was recorded in evidence/P6.md as a
contamination with an open question for Joe.

**Joe's ruling, 2026-07-31: the feature stays and ships in the build P4.5 runs against.**
It is now v1 scope, specified in SPEC §7.2a, and not an orphan.

What that ruling costs, stated plainly rather than left implicit:

1. **P6's golden pin is retired, not met.** The P6 plan's DoR row 5 and completion item 4
   required `ENGINE_VERSION` 8 with byte-identical goldens. The engine is at **9** and both
   goldens moved. P6's own work did not move them — `pose`, `materials`, `lamps`, `audio`,
   and the T11 motion wiring are all presentation-only and were verified byte-neutral — so
   the pin did its job: it proved the art phase stayed out of the domain. It is retired
   because the *reason* for it (no mechanics change beneath finished art before the fun
   gate) has been overridden by a deliberate decision, which is the one thing §7's version
   rules allow.
2. **It carries no P6 review.** Its correctness is asserted by its own six tests plus both
   re-recorded goldens and the balance harness. It was not reviewed as P6 work and this
   record says so.
3. **P4.5 tests it.** The rolling queue is the most visible mechanic on the queue rail, so
   the fun gate now judges it. If §6's loop fires on "the plan is noisy" or "I could not
   tell why she was reading", this feature is the first suspect.

### §11.4 sleep-skip — owner assigned to P4 (2026-07-30)

§11.4's dissolve-to-morning was in no phase's owned list: P3's list did not contain it, P4 was given "the first-night recap" and P5 "remaining recap", and the *skip* is neither. Master §3 requires a deferral to name an owner, so this closes that gap.

**Why P4 and not "later":** measured on the shipped engine, a night is ~493 game-minutes — **4.1 real minutes at 1×, a third of a 12-minute day of dead air**. P4.5 is the external fun gate. If the skip is missing then, three fresh testers either sit through the night or someone builds it mid-P4 with no owner and no plan. It also belongs beside the first-night recap, which P4 already owns: the skip is what gets you *to* the recap.

Scope is small and deliberately bounded (SPEC §11.4): on night-sleep start, with no URGENT queued and no input for 10 s, dissolve to `wakeTarget`. **Daytime urgent sleep never skips** — its cost is meant to be felt.

### Minimum first-session slice required before P4.5

P4.5 must test the game the spec claims is fun, not only a queue editor. The
post-P5 frozen build must preserve at least this P4-proven slice, in placeholder art:

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

**Failure loop** *(remedy scope rewritten 2026-07-31 for the post-P6 placement)*

- Classify each failure as discoverability, comprehension, agency, consequence visibility, pacing, or desire-to-continue.
- Then classify the **layer** it implicates, because the two have different remedies and mixing them is how a failed playtest gets the wrong fix:
  - **Mechanics** (rules, pacing, planner, balance, forecasts) → change the smallest implicated **P2–P5** behaviour. This may require an `ENGINE_VERSION` bump and re-pinned goldens under §7; that is expected, not a violation.
  - **Presentation** (legibility, art, audio, motion, copy placement) → change the smallest implicated **P6** behaviour. If objects, poses, or bubbles are implicated, **re-run P6's Gate A before re-freezing** — Gate A is the cheap check that exists for exactly this class.
  - **Both** → fix mechanics first, re-run Gate A, then re-freeze once.
- Record the change, freeze a new build, and rerun the unchanged protocol with **fresh** testers. A tester who has seen any earlier build is spent.
- Criteria cannot be weakened, waived, or moved without Joe's explicit decision.

*(The pre-2026-07-31 line "P6 stays closed" is retired: P6 now runs before the gate, so there is nothing left to hold closed. What replaces it is that **v1 does not ship** until the protocol passes — the gate's authority is unchanged, only its position moved.)*

## 7. Staged replay and harness ownership

The full §16.3 suite cannot truthfully exist in P2 because some player-dependent systems arrive later:

- **P2:** unattended seven-day golden; fairness, recovery, travel-inclusive timing, pin/property invariants; replay command format.
- **P4:** scripted queue edits, stop/remove/undo/suppression, forecast agreement, **and the four player-dependent adjacency pairs** (warmed-up, cramp, minty-fresh, fresh-mind) with per-pair nonzero-effect assertions.
- **P2:** Practice scoring/curve/block-bonus unit coverage.
- **P5:** week-scale Practice pacing, wrinkle-band exposure, **adjacency pairs beyond P4's four**, Goal 6.

**Ruling 2026-07-30 (P4 T0).** This line and evidence/p2.md contradicted each other: p2.md recorded the four player-dependent pairs as "P4 owner" while this list sent "adjacency involving Practice" to P5. Resolved in favour of p2.md — **P4 owns warmed-up, cramp, minty-fresh and fresh-mind**; P5 owns the rest. §6.7/§16.3's "every bonus delivers a nonzero effect at least once" is therefore P4's obligation for those four, asserted in P4's scripted-player golden.

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
8a. **Inherited failure modes:** [docs/lessons-from-hero-football-manager.md](../../lessons-from-hero-football-manager.md) is binding (SPEC §16.0). Auto Life shares HFM's stack and art direction, so it inherits HFM's mistakes by default. A phase touching rendering, artwork, typography, audio, or interaction feel names the rules it honours and how. Load-bearing ones: scan every use site rather than keeping a list; RN does not inherit `fontFamily` through a `View`; one completed action owns exactly one sound; design the audio lifecycle on day one; inspect worst cases, not averages, with a test that does not share the transform's assumption; profile before redesigning.
9. **Evidence:** phase exit records exact commands/results, manual device/browser observations, unresolved risks, and any accepted deferral. A local export is not a deployment, and a local check is not CI.
10. **Authored prose:** before the first authored-string batch, verify the exact `humanizer` skill is available. Every changed batch receives that pass, then the deterministic `writing.md` checklist; reviewed file hashes/IDs and rewrites are recorded. A drafting/editing fallback may help rewrite, but does not satisfy the mandatory humanizer pass.

## 9. Known source-contract reconciliations for later plans

- Desktop web is the v1 release gate. P4/P6 plans must not silently restore iPhone as a v1 blocker; native verification belongs to the v1.1 mobile pass.
- P0 proves that Skia works on exported web; P3 is where Atlas becomes mandatory from the first sprite renderer.
- A0 is a P3 entry gate, not “any time before P6.”
- The headless forecaster is never cut. Its minimum visible start-time/why/conflict presentation is required for P4.5. P5 may expand it before the gate but may not remove the P4-proven minimum.
