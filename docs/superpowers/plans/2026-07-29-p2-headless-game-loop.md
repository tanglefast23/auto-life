# Auto Life P2 — Headless Game Loop Implementation Plan

> **Status: DRAFT, authored ahead of schedule.** The master plan's Definition of Ready (§3) says a phase plan is authored *after* the previous phase exits, against the tree that actually exists. This was drafted at Joe's request before P1 runs. It is therefore a **design contract, not an execution contract**: before any task here is worked, §0 must be re-run against the real P1 tree, and every code block treated as intent to be re-derived from the actual P1 exports — not pasted.
>
> **For agentic workers:** work one checked task at a time. Never checkpoint a red tree (master convention 1). Never `git add -A` (convention 2). Commits only if Joe has authorized them for this run.

**Goal:** a complete, deterministic, headless Auto Life — a full seven-day week that runs, plans, walks, and can be replayed exactly, with nothing rendered and nothing clicked.

**Owned by this phase** (master §5): top-level headless step · anchors/reactive/priority · queue ownership and suppression · adjacency · deterministic A*/travel timing · commitments DTO · forecaster · unattended golden · fairness/recovery/property harness.

**Exit evidence** (master §5, verbatim — not re-negotiable here): full unattended placeholder week including travel · replay diff tied to `ENGINE_VERSION` · forecast agrees with the real step path · queue invariants green.

---

## 0. Definition of Ready — run this before Task 1

Per master §3. Do not start until every line is checked and its answer recorded in the phase evidence file.

- [ ] P1 exited: `npm run verify` green on the current tree; P1's exact closure-day test passes; the mid-Meal JSON round-trip test passes.
- [ ] Read the real `src/sim/` — record the actual exported names of the P1 modules. Every signature quoted in this plan is P1's *intended* shape; where the tree differs, the tree wins.
- [ ] Confirm `ENGINE_VERSION` exists and its current value.
- [ ] Confirm `content/rates.json` and `content/activities.json` schemas as built, including whether `restoresOnlyFirstOfDay` and `startBelow` survived P1 review.
- [ ] Re-check current zod 4 and Jest guidance for anything this phase newly uses (master convention 8).
- [ ] **Answer the six blocking questions in §1.** Four of them change code structure, not just numbers. A plan that guesses here produces a planner nobody can debug.
- [ ] Confirm the §2 SPEC-clause traceability table is complete for every clause this phase owns (master convention 6).

---

## 1. Blocking questions — SPEC is silent or self-conflicting

**RULED — all six recommendations accepted as written (orchestration, 2026-07-29; recorded in SPEC §0aa).** Q2–Q5 are now normative SPEC rules (§7.4 AUTO-run sorting, §7.1 missed-window + once-per-day, §7.2 single-rest-card); Q6's procedure is §6.8's trace-status rule; Q1's ownership split is live in master §5 — so T2 ships all five adjacency pairs, and practice points store as integers ×100 (SPEC §8). The questions remain below as rationale for future readers.

**Q1 — Who owns Practice?** Master §5 lists Practice under **P5** ("full Practice progression"), but P4's minimum first-session slice requires "Practice with its time trade-off and block bonus," and P4 is a UI phase that may not contain sim math (master §4). Practice scoring is pure `sim/` arithmetic and its block bonus is a *queue-adjacency* property, which is this phase's.
→ **Recommendation: P2 owns Practice scoring, session curves, and the block bonus. P5 keeps levels, journal entries, goal wiring, and the pacing harness.** If accepted, update the master §5 P2 and P5 rows — a claim made only here is exactly the silent transfer master §3 forbids.

**Q2 — Interleaved PINNED cards split the AUTO run.** §7.4 says AUTO cards sort "within the contiguous AUTO run after any leading PINNED cards" — singular. For `[AUTO_a][PINNED_x][AUTO_b]`, is `AUTO_b` sorted, frozen, or merged with `AUTO_a`?
→ **Recommendation: sort each maximal AUTO run independently.** It is the only reading consistent with "never crosses a PINNED card," and it makes a pinned card a genuine barrier the player can use deliberately.

**Q3 — What makes an anchor "missed"?** §7.1 says a missed window is skipped for the day. Missed = not **started** by window end, or not **completed**? And is an unstarted anchor card removed at window end, or left in the queue?
→ **Recommendation: missed = not started by the window's end tick; the unstarted card is removed and a `anchorMissed` domain event fires** (P5's recap consumes it). A card already running at window end finishes normally — the planner never interrupts (§7.4).

**Q4 — Does suppression apply to anchors?** §7.4's 2-hour suppression is written against reactive AUTO cards. If the player deletes the lunch Meal at 12:30 with the window open until 15:00, the anchor's gate is still satisfied at 14:30 when suppression lapses.
→ **Recommendation: an anchor window fires at most once per day, and deleting its card counts as that firing.** Otherwise deleting an anchor card does nothing and the player learns their edits are ignored — the single worst outcome for a game whose pillar is "autonomy you steer."

**Q5 — There is no single-rest-card rule.** §7.2 states an explicit single-food-card rule (never both Snack and Meal). Nothing equivalent exists for rest, so at Energy 14 inside the Nap window both the Nap rule (<30) and the Urgent Sleep rule (<15) fire.
→ **Recommendation: mirror the food rule. One rest card at a time; Urgent Sleep supersedes and removes a queued-but-unstarted Nap.** Unit-test it beside the food-card test.

**Q6 — §6.8's traced numbers predate travel.** Every steady-state figure in §6.8 (Nutrition min ≈50, Movement trough 54, the morning-check readings) was traced with zero walking. This phase is the first with real travel time, so the golden will not reproduce those traces exactly.
→ **Analysis:** all four bars decay on wall-clock time, not on activity completion, so travel shifts *when* restores land by a few minutes without materially moving bar values — the Nutrition minimum should still read ≈50, a few minutes later. That is a prediction, not a fact.
→ **Recommendation: Task 16 records the travel-inclusive numbers first, then compares against §6.8. If any band moves more than its stated tolerance, §6.8 gets re-derived and `ENGINE_VERSION` is not implicated (no behavior changed — the earlier trace was simply incomplete).** Do not quietly widen a band to make a test pass.

---

## 2. SPEC-clause traceability (master convention 6)

Complete this table as tasks land. A phase cannot exit with an owned clause lacking a test or a named deferral.

| SPEC clause | Owned by task | Verified how |
|---|---|---|
| §6.7 adjacency pairs + lifecycle rules | T11 | unit per pair + lifecycle property tests |
| §6.8 daily budgets, steady-state facts | T16 | balance harness, travel-inclusive (see Q6) |
| §7.1 anchor windows, gates, missed-window, sleep window rules, chronotype offsets | T8 | unit per row + golden Day-1 order |
| §7.2 reactive triggers, windows, URGENT promotion, Movement-never-urgent | T9 | unit per row + single-rest/food-card tests |
| §7.3 two-stage priority, weights, common normalization, anchor blocks unscored | T7 | the all-bars-0 case + E14/N14 case + 6 mixed scenarios |
| §7.4 every queue rule row | T6, T10 | one test per row of the normative table |
| §7.5 forecaster, horizon, uncertainty, refresh triggers | T14 | forecast-vs-real-step agreement test |
| §7.6 commitments DTO | T13 | schema + round-trip only (v1 ships no UI) |
| §7.7 tick order | T12 | step-order test asserting the six master §4 stages |
| §8 Practice scoring, curves, block bonus | T12 (Q1 ruled: P2 owns it) | scattered-vs-block unit tests |
| §16.2 determinism | T3, T15 | JSON round-trip; replay reproducibility |
| §16.3 P2 subset (fairness, recovery, property, Day-1 order) | T16, T17 | balance harness |
| §10 home grid, interact points, A* | T4, T5 | pathfinding unit tests + travel timing |

Explicitly **not** P2, with owners named (master §3): scripted player edits and forecast-surfacing → P4 · Practice pacing bands, wrinkle exposure, adjacency-involving-Practice coverage, Goal 6 → P5 · every §11 UI clause → P3/P4.

---

## 3. Task list

### T1: Phase scaffold — evidence file and harness seams

**Files:** create `docs/superpowers/evidence/p2.md`; extend `package.json` scripts.

- [ ] Record the §0 answers and the §1 rulings in the evidence file. This is the phase's audit trail.
- [ ] Add `"harness": "jest --runTestsByPath src/sim/__tests__/harness/*.test.ts"` so long balance runs can be invoked separately from the fast unit suite. `npm run verify` still runs everything.
- [ ] Verify: `npm run verify` green (nothing has changed yet — this is the baseline the phase is measured from).

### T2: `content/` files for the planner

**Files:** create `content/anchors.json`, `content/reactive.json`, `content/adjacency.json`, `content/practice.json`; extend `src/sim/content-schemas.ts` and the content validation test.

All times are **offsets in minutes from `wakeTarget`**, never absolute clock times (SPEC §9.2 round-2 rule). The baseline `wakeTarget` is 420, so an offset of 0 reads 07:00 in the traces and 06:30 for an early bird — the data never changes, only the target does.

- [ ] `anchors.json` — SPEC §7.1, five windows:

```json
{ "anchors": [
  { "id": "wake",    "opensAt": 0,   "closesAt": 60,  "targetAt": 0,
    "block": ["toilet", "brush", "shower", "meal"], "gate": null },
  { "id": "lunch",   "opensAt": 300, "closesAt": 480, "targetAt": 360,
    "block": ["meal"], "gate": { "bar": "nutrition", "below": 90, "noMealWithinMin": 180 } },
  { "id": "workout", "opensAt": 570, "closesAt": 780, "targetAt": 630,
    "block": ["__preferredWorkout"], "gate": { "bar": "movement", "below": 70 } },
  { "id": "dinner",  "opensAt": 660, "closesAt": 840, "targetAt": 720,
    "block": ["meal"], "gate": { "bar": "nutrition", "below": 90, "noMealWithinMin": 180 } },
  { "id": "bedtime", "opensAt": 930, "closesAt": 960, "targetAt": 960,
    "block": ["brush", "sleep"], "gate": null }
] }
```

> Offsets check against the §7.1 table at `wakeTarget` 420: lunch 300→720 = 12:00, closes 480→900 = 15:00, targets 360→780 = 13:00 ✓ · workout 570→990 = 16:30, closes 780→1200 = 20:00 ✓ · dinner 660→1080 = 18:00 ✓ · bedtime opens 930→1350 = 22:30, target 960→1380 = 23:00 ✓. `__preferredWorkout` resolves to `weights` or `treadmill` per §9.2 preference; the sentinel keeps the preference rule in code and the schedule in data.

- [ ] `reactive.json` — SPEC §7.2 triggers, windows (also wake-relative), and the §7.3 weights:

```json
{
  "weights": { "energy": 4, "nutrition": 3, "hygiene": 2, "movement": 1 },
  "urgentThreshold": 15,
  "neverUrgent": ["movement"],
  "rules": [
    { "id": "snack",       "bar": "nutrition", "below": 35, "activity": "snack",  "window": null,
      "supersededBelow": { "value": 20, "activity": "meal" }, "exclusiveGroup": "food" },
    { "id": "nap",         "bar": "energy",    "below": 30, "activity": "nap",    "window": [60, 780],
      "exclusiveGroup": "rest" },
    { "id": "urgentSleep", "bar": "energy",    "below": 15, "activity": "sleep",  "window": null,
      "exclusiveGroup": "rest", "supersedesGroup": true },
    { "id": "shower",      "bar": "hygiene",   "below": 40, "activity": "shower", "window": null },
    { "id": "stretch",     "bar": "movement",  "below": 35, "activity": "stretch","window": [60, 840] }
  ]
}
```

> `exclusiveGroup` is the generalization of §7.2's single-food-card rule and the answer to Q5 — one card per group, `supersedesGroup` lets Urgent Sleep evict a queued Nap. Nap's window `[60, 780]` is 08:00–20:00 at baseline ✓; Stretch's `[60, 840]` is 08:00–21:00 ✓.

- [ ] `adjacency.json` — SPEC §6.7's five pairs, all authorable. Brush→Sleep is now **Minty-fresh** (+15% points on the first Practice session started before the morning check) — resolved in SPEC v0.3.1 §0aa; the old `+0.1 m_speed` form was clamped dead by the 1.5 cap. **Two of the five pairs (Minty-fresh, Shower→Practice) therefore scale Practice points, so they cannot be authored or tested until Q1 is ruled.** If Q1 sends Practice to P5, these two rows go with it and this task ships three pairs, with the deferral recorded per master §3.
- [ ] Effects vocabulary must cover `scalePoints` for the two Practice-facing pairs, and the resolver must apply Well-fed × Minty-fresh × Shower→Practice **multiplicatively** — §6.7's "never stack" means a bonus never stacks with *itself*; different bonuses compound. §8's verified eat-first (≈119/day) vs shower-first (≈112/day) figures are the regression target once Practice scoring exists.
- [ ] `practice.json` — SPEC §8: `basePoints: 25`, scattered curve `[1.0, 0.7, 0.4, 0.2]`, block curve `[1.0, 0.85, 0.7, 0.5]`, `maxCountedSessionsPerDay: 4`, levels `[100, 300, 700]`. (Pending Q1.)
- [ ] Schemas + validation tests for all four, following the P0 `validate-content.test.ts` pattern.
- [ ] Verify: `npm test -- validate-content` green.

### T3: `state.ts` — the serializable state and the snapshot seam

**Files:** create `src/sim/state.ts`, `src/sim/__tests__/state.test.ts`.

This is the master §4 seam. Everything downstream of `sim/` reads the snapshot and nothing else.

- [ ] Failing test first: a fully-populated `SimState` survives `JSON.parse(JSON.stringify(x))` with deep equality, and a state captured mid-Meal resumes to an identical completion (the P1 round-trip test extended to the queue).
- [ ] Implement. Constraints, all testable: no closures, no class instances, no `Date`, no embedded content definitions — activities are referenced by `id` and resolved against validated content at use time. Active work stores the activity id plus the values **sampled at start** (`durationTicks`, `fillStartTick`, granted-so-far per bar), because §6.6 samples multipliers at start and resume must not re-sample.
- [ ] The snapshot is derived, never stored: `toSnapshot(state, content)` returns the immutable read-model. It carries display values the UI needs (health, predicted starts once T14 lands) and never a reference into `state`.
- [ ] Verify: round-trip and mid-activity resume tests green.

### T4: `content/home-map.json` + `content/objects.json`

**Files:** create both; extend schemas and the validation test.

- [ ] The 24×14 grid from SPEC §10 as walkability rows, plus room ids.
- [ ] Objects per §10: id, room, footprint, `interactPoint` tile, facing, activity ids, and a dormant `upgradeTrack` field (v4) plus `decorationSlots` (P5). Include the guitar and rug.
- [ ] Validation test asserts every `interactPoint` is walkable, every activity id in `activities.json` has exactly one object, and every object's footprint is inside the grid. **These three assertions catch the entire class of "the sim can't reach the shower" bugs at build time rather than at tick 4,000.**
- [ ] Verify: `npm test -- validate-content` green.

### T5: `travel.ts` — deterministic A* and travel timing

**Files:** create `src/sim/travel.ts`, `src/sim/__tests__/travel.test.ts`.

- [ ] Failing tests: a known bedroom→bathroom path has an exact tile count; the path is identical across runs and across serialization boundaries; a blocked-object path returns `null` rather than throwing.
- [ ] Implement 4-directional A*. **Determinism requires a total order on ties** — equal-`f` nodes must break by a fixed rule (lowest index, then lowest `g`), never by insertion order into a `Set` or by object iteration. Add a test that shuffles the neighbour-expansion order and asserts an identical path; that test is the one that catches the bug three phases later.
- [ ] Travel duration: tiles ÷ `tilesPerMinute`, where §6.5 gives `tiles/min = 3 × (0.75 + Movement/200)`. Compute it in the same integer style as P1's `durationTicks` — Movement is an ×6000 integer, so the rate is exactly `(3 × (150000 + movementFixed)) / 1200000` tiles per minute; derive ticks by integer ceil-division and never by float.
- [ ] Verify: travel tests green, including the shuffled-expansion determinism test.

### T6: `queue.ts` — the queue model and its invariants

**Files:** create `src/sim/queue.ts`, `src/sim/__tests__/queue.test.ts`.

- [ ] Model: an ordered array of cards, each `{ id, activityId, owner: 'AUTO' | 'PINNED', urgent, source: 'anchor' | 'reactive' | 'player', blockId?, enqueuedTick }`. Anchor blocks share a `blockId` — that is what makes §7.4's "one expandable card" and "hold their fixed internal order" both expressible without a nested structure.
- [ ] One test per row of §7.4's normative table. Write them all before implementing any:
  - ownership: a planner pass over a queue containing PINNED cards produces an identical PINNED subsequence
  - AUTO ordering, including **each maximal AUTO run sorted independently** (Q2)
  - urgent rises to the front of its unpinned segment and never crosses a PINNED card
  - auto-cleanup at `trigger + 10` for unstarted AUTO cards only
  - planner dedup (max one AUTO per activity type) while player duplicates are allowed
  - remove → 2-hour type suppression; stop → 1-hour; urgency overrides both
  - object-click promotes an existing queued card rather than inserting a second
  - **queue cap: the player may hold 10; anchor blocks and urgent cards live outside the cap** (§7.4 round-2 rule) — assert a queue of 10 player cards still admits the bedtime block and an urgent card
  - cross-midnight persistence
- [ ] Implement to make them pass. Keep every mutation a pure function `(queue, args) => queue` — the reducer in T12 needs to compose them.
- [ ] Verify: all §7.4 rows green.

### T7: `priority.ts` — the two-stage scorer

**Files:** create `src/sim/planner/priority.ts` and its test.

- [ ] Failing tests, exact values from §7.3:
  - all bars 0 → **Sleep 4.0 > Food 3.0 > Shower 2.0**, and Workout does not lead (the v0.1 formula's exact failure)
  - Energy 14 / Nutrition 14 → sleep outranks food (the per-trigger formula's exact failure; common normalization is the fix)
  - Stage 1 always outranks Stage 2 regardless of magnitudes
  - anchor-block cards are never scored: a block keeps its data order even when a member's bar is far worse than a sibling's
  - ties break by `enqueuedTick`
- [ ] Implement: Stage 1 `weight × (15 − bar) / 15`; Stage 2 `weight × (trigger − value) / trigger`. Scores are compared, never persisted — keep them floats and keep them out of `SimState` (master convention 3: nothing in state that cannot survive a round-trip meaningfully).
- [ ] Verify: green, including the six mixed scenarios §7.3 references.

### T8: `anchors.ts` — windows, blocks, missed-window, sleep rules

**Files:** create `src/sim/planner/anchors.ts` and its test.

- [ ] Failing tests, one per §7.1 row plus:
  - **Day 1 at `wakeTarget` produces exactly Toilet → Brush → Shower → Breakfast** (the golden's first assertion)
  - the `<90` meal gate fires at the §7.1 worst cases (82 lunch, 78 dinner, 84 at Health-0 durations)
  - snacks do not satisfy the 3-hour no-meal clause
  - a window that opens and closes without its card starting is skipped, emits `anchorMissed`, and does not roll over (Q3)
  - deleting an anchor card consumes that window for the day (Q4)
  - **sleep ends at `wakeTarget` regardless of start** — a 01:00 start yields a short night, never a shifted calendar
  - the continue-sleeping clause: urgent sleep reaching Energy ≥80 between `bedTarget` and `wakeTarget` keeps sleeping to `wakeTarget`
  - an early-bird and a night-owl produce identically-shaped days, offset by 30 minutes in both directions
- [ ] Implement window evaluation against `anchors.json` offsets plus the sim's own `wakeTarget`.
- [ ] Verify: green.

### T9: `reactive.ts` — triggers, exclusivity, suppression

**Files:** create `src/sim/planner/reactive.ts` and its test.

- [ ] Failing tests, one per §7.2 row plus:
  - single-food-card: at Nutrition 18, exactly one card exists and it is a Meal
  - **single-rest-card (Q5): at Energy 14 in the Nap window, exactly one rest card exists and it is Sleep**; a queued-unstarted Nap is evicted
  - Movement never receives URGENT even at Movement 0
  - suppression is respected on re-evaluation and overridden by urgency
  - reactive windows shift with chronotype
- [ ] Implement against `reactive.json`, including `exclusiveGroup` and `supersedesGroup`.
- [ ] Verify: green.

### T10: planner composition — ordering AUTO around blocks and PINNED

**Files:** create `src/sim/planner/index.ts` and its test.

- [ ] The pass that §7.7 calls `sortReactivesAroundBlocks`: score reactive singles (T7), keep blocks intact, slot both inside each maximal AUTO run (Q2), never cross a PINNED card, raise urgent to the front of its segment.
- [ ] Property test, 10k random edit sequences (§16.3): **the PINNED subsequence is invariant under any number of planner passes.** Generate edits from a seeded stream so a failure is reproducible — a property test that fails non-reproducibly is worse than no test.
- [ ] Verify: green.

### T11: `adjacency.ts`

**Files:** create `src/sim/adjacency.ts` and its test.

- [ ] Failing tests, one per authored pair, plus every §6.7 lifecycle rule as its own test: gap measured end-to-start **including travel** · any completed activity in between breaks it · no stacking, a re-trigger replaces · stopping either side cancels · no bonus pushes `m_speed` past 1.5.
- [ ] Implement bonuses as *typed effects* (`halveDuration`, `scaleDecay`, `scalePoints`, `addMSpeed`) rather than as one interpreted expression language. Four named effects are debuggable; a mini-DSL in `sim/` is not.
- [ ] Verify: green. SPEC v0.3.1 §6.7 now states this explicitly: **only Workout→Meal fires in the unattended run.** The other four are player-dependent, so the "every bonus delivers a nonzero effect" assertion belongs to the **scripted-player** golden (P4), not T15. Record in the evidence file which pairs T15 leaves uncovered and that P4 owns them — claiming that coverage here would be exactly the error round 2 split the goldens to fix.

### T12: `step.ts` — the top-level headless step

**Files:** create `src/sim/step.ts` and its test.

This is the master §4 seam and the phase's centre of gravity.

```ts
export function step(
  state: SimState,
  commands: readonly Command[],
  content: ValidatedContent,
): { next: SimState; events: readonly DomainEvent[]; snapshot: SimSnapshot }
```

- [ ] Failing tests for the six-stage tick order from master §4 — commands at the boundary, window/trigger evaluation for the displayed minute, start-next-if-needed, **collect named signed deltas**, one reducer sums and clamps each bar exactly once, clock advances and events emit.
- [ ] The single-writer check is an assertion over the collected deltas, not a convention: reject two deltas naming the same bar from the same source in one tick, and specifically reject a passive Energy delta while Sleep or an effective Nap runs.
- [ ] `state.clock` names the minute **about to run**, so the Day-1 wake window is observable on the very first `step()` — assert that directly.
- [ ] Practice scoring lands here if Q1 is accepted: session index resolved against the day's completed Practice sessions, scattered vs block curve chosen by whether the previous card was Practice with no intervening completion, `m_out` and any well-fed/adjacency multipliers applied at start. **Store points as scaled integers** (×100), never as `points += 25 * mOut` — a float accumulator drifts across hundreds of sessions and the drift lands in the save (P0/P1 open item 2).
- [ ] Verify: green.

### T13: `commitments.ts` — the DTO, and nothing else

**Files:** create `src/sim/commitments.ts`, extend schemas.

- [ ] SPEC §7.6's shape exactly: `{ ownerId, targetStart, earliestStart, latestStart, duration, location, travelMinutes, flexibility, source, status }`, zod-validated, JSON round-trippable.
- [ ] Materialization logic is **v2's**, not v1's. Ship the type, a validator, and a round-trip test. Do not write the two-hours-before-target scheduler; it has no caller and no way to be verified until work shifts exist.
- [ ] Verify: schema + round-trip green.

### T14: `forecast.ts` — the headless lookahead

**Files:** create `src/sim/forecast.ts` and its test.

- [ ] Implement by **cloning plain state and calling the same `step()` path** (master §4). Any second implementation of the tick would drift from the first, and the drift would surface as the forecast lying to the player.
- [ ] Horizon per §7.5: to the next `wakeTarget` or 12 hours, whichever is sooner. Refresh triggers: queue edit, commitment change, top of each game-hour.
- [ ] The uncertainty rule matters more than it looks: the forecaster **clones PRNG state and treats undealt wrinkles as absent**. Wrinkles arrive in P5, so encode the rule now with a test asserting a forecast never advances live stream state — otherwise P5 wires wrinkles in and the forecast starts spoiling them.
- [ ] The phase's headline test: **forecast agreement** — for a seeded state, the forecast's predicted start times and bar trajectory match what `step()` actually produces over the same window, tick for tick.
- [ ] Produce the data P4 will surface (predicted starts, why-lines, conflict flags where a bar would pass below 15, cap-waste at *projected* values per §6.7). Producing it headlessly here is what makes P4 a rendering job.
- [ ] Verify: agreement test green.

### T15: the unattended golden replay

**Files:** create `src/sim/__tests__/harness/golden-week.test.ts`, `src/sim/__tests__/harness/__snapshots__/`.

- [ ] Define the replay format first, and write it down in the evidence file: seed, `ENGINE_VERSION`, starting state, ordered commands (empty for this golden), and the recorded digest. P4 and P5 extend this same format (master §7) — a format invented twice is a format that diverges.
- [ ] Record a seven-day unattended run at the baseline chronotype with travel enabled. Digest per day: each bar at the morning check, min/max per bar over the day, activity completion count by type, total travel minutes, urgent-event count.
- [ ] Assert the digest matches, and that the recorded `ENGINE_VERSION` matches the current one. **A diff with an unchanged `ENGINE_VERSION` fails as a bug, not as a retune** — that is the whole point of the pin.
- [ ] Assert §7.1's Day-1 wake order exactly.
- [ ] Verify: green, and the run completes in a time you are willing to pay on every CI push. If it does not, move it behind `npm run harness` and run it as a separate CI job rather than trimming the week.

### T16: the balance harness — fairness and recovery

**Files:** create `src/sim/__tests__/harness/balance.test.ts`, `content/harness-bands.json`.

Bands live in data, not in the test file — see the master's retune-cost reasoning. Unit tests keep hard-coded values because they verify formulas; these verify tuning, and tuning is what P4.5 may invalidate.

- [ ] **Record before asserting (Q6).** Run the unattended week and print the travel-inclusive steady-state figures. Compare against §6.8's pre-travel traces. If a figure has moved beyond its tolerance, update §6.8 with the travel-inclusive number and record why in the evidence file. Do not widen a band to make a red test green.
- [ ] Then assert the §16.3 P2 subset:
  - every bar ≥65 at the morning check (`wakeTarget + 120`) from Day 2
  - zero URGENT events across the week
  - Nutrition **min over all ticks** = 50 ± 3, and it occurs pre-breakfast — never a wall-clock sample
  - dinner cap-waste ≤ 12
  - the reactive snack never fires
  - neglect: with the workout anchor disabled, Movement < 20 within 3 days
  - recovery: from all bars 0, unattended autopilot ends Day 2 with Health ≥ 70
- [ ] Verify: green, with the recorded figures in the evidence file.

### T17: phase exit

- [ ] `npm run verify` green; `npm run harness` green.
- [ ] Complete the §2 traceability table — every owned clause has a test id or a named deferral with a phase owner.
- [ ] Evidence file records: the §1 rulings, the travel-inclusive §6.8 figures, the replay format, which adjacency pairs remain uncovered and who owns them, and any `ENGINE_VERSION` decision.
- [ ] Confirm the four master §5 exit conditions in the evidence file, each with the command that proves it.

---

## 4. Sequencing notes

Content and state first (T2–T4), then the two pure calculators (T5 travel, T7 priority), then the queue (T6), then the three planner passes that compose them (T8–T10), then adjacency (T11), then the step that runs the whole thing (T12). The forecaster (T14) must come after `step()` because it *is* `step()`. The three harness tasks come last because every one of them is a claim about the finished system.

T13 (commitments) is order-independent and small — a good task to slot in when the planner work needs a break from itself.

## 5. What this phase deliberately does not do

Named here so no later phase can claim these were forgotten, per master §3:

- **No rendering, no UI, no input.** The queue is edited in tests by calling command constructors directly.
- **No scripted-player golden** — P4, once real edits exist.
- **No wrinkles, goals, journal, intentions, or identity** — P5. The forecaster's undealt-wrinkle rule is encoded now so P5 inherits it rather than inventing it.
- **No commitment materialization** — v2.
- **No Practice levels, journal entries, or pacing bands** — P5, even if Q1 puts Practice scoring here.
- **No persistence layer.** `SimState` is JSON-round-trippable and tested as such; writing it to sqlite is P5's three-layer split.
