# Auto Life P4 — Queue UI & the Minimum First-Session Slice

> **Implementation contract:** one checked task at a time; focused failing check → minimal implementation → green → wider checks. Never checkpoint a red tree (master convention 1). Stage only task-owned paths; never `git add -A` (convention 2).

**Goal:** the player gets verbs. P3 made the sim visible; P4 makes it
*steerable* and assembles the complete minimum slice that P5 must preserve for
the later P4.5 playtest.

> **Post-exit timing amendment (Joe, 2026-07-30):** P4.5 now runs after P5.
> P4's acceptance and evidence remain closed; its recorded export is the P4
> completion baseline, not the eventual post-P5 playtest build.

**Owned by this phase** (master §5, verbatim): full §7.4 queue interaction surface · forecasts/why-lines needed for comprehension · keyboard/mouse/touch-capable-web parity · player-visible Practice integration using P2's math · **§11.4 sleep-skip** (assigned 2026-07-30) · plus the minimum first-session slice.

**Exit evidence** (master §5, verbatim — not re-negotiable here): every interaction passes · scripted queue replay added · a frozen build contains the complete P4.5 slice.

> **Revision 2 (2026-07-30)** — rewritten after a two-reviewer council audit (Codex `gpt-5.6-sol` xhigh + Claude Fable 5 max). Both reviewers independently found that T1 as originally written could not be built, that undo's payload was incomplete, that T10 hid engine work the plan forbade itself, and that the scripted replay had no owner. Task order now runs game-envelope-first. Changes are marked **[R2]**.
>
> **Revision 4 (2026-07-30)** — applied after the council's round cap. Fable approved at round 3; Codex held out with three items, of which one was already fixed. The other two were real and are applied here: several checkpoints claimed assertions over state or surfaces a later task introduces (T1's full reset contract, T5's §11.2 gate, T6's forecast accessibility and `G` binding, T10's Practice-before-hit-testing order), and T12's browser matrix covered only drag when the contract is the whole §7.4 surface. **These changes were not re-reviewed by either model.** Marked **[R4]**.
>
> **Revision 3 (2026-07-30)** — second council round. Both reviewers independently found that R2's anchor revert needed the same equality guard as its suppression revert, and that an unconditional restore re-opens the duplicate-anchor path the v5 fix closed. Also fixed: R2's own T4/T11 contradiction (the version path required a replay that did not exist yet), the sorter fact that makes T2's URGENT-front unreachable by insertion alone, goal-relevant actions that are not `DomainEvent`s, and an `Esc`/`G` reassignment R2 got wrong. Changes are marked **[R3]**.

---

## 0. Definition of Ready — recorded 2026-07-30

Per master §3, checked against the tree rather than from memory.

| # | Check | Result |
|---|---|---|
| 1 | Prior evidence + green tree | P3 COMPLETED (evidence/P3.md), 4 adversarial loops. `npm run verify` green at `ccb1d10`: content + atlas gate + typecheck + **316 tests / 32 suites** + web export. Independently re-run and confirmed by the council audit. |
| 2 | Repository inspected | `src/` = sim (23 files), render (7), ui (3), application (4), persistence (3). **No `src/game/` ring exists yet** — goals and wrinkles land here, and master §4 says that ring is framework-free. |
| 3 | Owned clauses mapped | §2 traceability table below. |
| 4 | Library assumptions verified | Nothing new is required. Reanimated 4.5.1 + Zustand 5.0.14 arrived in P3 and are proven in the exported build. Drag-and-drop uses RN's own `PanResponder`/Pressability rather than a new dependency — see Q5. **[R2] NativeWind ruling recorded:** SPEC §3 lists it and P3's deferral table named P4 as owner. **Decision: do not adopt. Continue with `StyleSheet`.** P3's export path is stable and a styling migration buys nothing this phase needs. Reassigned to v1.1 or never. |
| 5 | Cross-phase effects named | **[R2] `ENGINE_VERSION` will bump — driven by Q1 (undo) and Q7 (wrinkle command).** Q6's sleep-skip is presentation-only and does **not** itself bump; the earlier draft claimed it did, which contradicted Q6's own text. The golden week must be re-recorded and the diff reviewed. This is the first phase since P2 to touch sim behaviour, so the bump is expected, not a surprise. |
| 6 | Cut-line effects | Master §5: the minimum slice and the minimal forecast UI are **not cuttable or movable past P4.5**. Everything else in §11.2 polish may slip to P5. |
| 7 | Plan audited before code | **DONE 2026-07-30** — council audit (Codex xhigh + Fable max), both REVISE, findings folded in as Revision 2. Re-review pending. |
| 8 | **[R2] P4.5 protocol frozen** | **Blocking preflight, must clear before T0.** Master §2/§6 require the protocol authored and frozen *no later than P4 start*. Today only master §6's embedded text exists; no protocol file is in `docs/superpowers/plans/` and the index still reads pending. Checking this at T11 (as the previous draft did) means a failure invalidates the whole phase retroactively. |
| 9 | **[R2] `humanizer` skill available** | **Verified present** at `~/.claude/skills/humanizer`. Master convention 10 requires this check before authoring strings; it passes. (The Codex reviewer reported it missing — it cannot see the Claude Code skill registry. Recorded here so the false blocker is not re-raised.) |
| 10 | **[R2] Verify re-run on the implementation-start tree** | Required immediately before T0, not inherited from `ccb1d10`. |

---

## 1. Blocking questions

**[R2] Seven.** Five change code structure. A plan that guesses here produces a queue nobody can debug.

**Q1 — What exactly does Undo restore?** §7.4 promises a 5-second Undo toast on remove. Removing an AUTO card also **suppresses that activity type for 2 game-hours**.

→ **[R2] Recommendation: an engine-issued, serializable *removal receipt* — not a UI-authored card payload, and not a wholesale state rewind.** The previous draft said "restore the pre-removal state wholesale," which is unimplementable: the toast is 5 *real* seconds, which is 10–40 simulation ticks, so restoring prior state would rewind the clock, the bars, fired events and completed activities. SPEC §11.8 is also explicit that **stops are final and only removal is undoable**.

The receipt is issued by the engine at removal and carries:

- the **complete card** per the real schema — `id`, `activityId`, `owner`, `urgent`, `source`, `blockId`, `enqueuedTick` (the earlier draft omitted `activityId`, `urgent` and `enqueuedTick`);
- **index and both neighbours**, so re-insertion survives intervening edits;
- the **prior suppression entry** for that activity *and* the exact value the removal wrote. `removeCard` **overwrites** `suppression[activityId]` (`src/sim/queue.ts:54`), so "clear the suppression it created" would also erase an older, still-unexpired suppression. Restore the prior value **only if the current entry still equals what the removal wrote**; otherwise leave it alone — something newer owns it.
- the **anchor consequence**. Deleting a block card calls `consumeAnchor` (`src/sim/step.ts:159-162`). Left unreverted, `started === true` means the §7.1 missed-window sweep (`step.ts:186-196`) can never fire for the restored block: it lingers past window close and runs arbitrarily late with no `anchorMissed` event. `consumeAnchor` is monotonic (`Math.max`), so the revert must restore a **captured previous value**, never decrement.

  **[R3] The anchor revert needs the same equality guard as suppression — both reviewers found this independently, and an unconditional restore is a live regression.** Removal and activity start write the same day through `consumeAnchor` (`src/sim/step.ts:89`). Constructible failure: remove a stale `wake#N` member at 06:59 (receipt captures N) → `wake#N+1` enqueues and starts at 07:00 (consumes N+1) → undo at 07:01 restores the captured ≤N, erasing day N+1's consumption *while its block is running*. That re-opens the duplicate-anchor path the v5 `Math.max` fix closed (evidence/p2.md P2.1 item 2). **Revert the anchor entry only if it still equals what the removal wrote; otherwise void that part of the receipt.** Carry an anchor mutation generation on the receipt so the comparison is exact, and invalidate that part when the block starts, misses, or retires.

**Scope limits:** single-depth; expires after 5 s of *real* time (expiry lives in `application/`, never the sim); **the running card and any travel-target card use Stop and get no Undo toast** (§11.8). Player-card cap interaction — undo of a `source:'player'` card after the player has refilled to 10 — resolves as: the receipt is voided and the toast dismissed rather than exceeding the cap.

**[R3] Enforceability.** The canonical receipt lives in the engine; `undoLastRemove` accepts **only an opaque receipt id**. "Never a UI-authored payload" is otherwise a convention rather than a constraint — if the command takes a card shape, nothing stops a caller synthesising one.

**Correction to the earlier draft's reasoning:** it argued option (a) fails because "the planner still refuses to schedule it." That misstates the engine — a restored card is *queued*, and suppression only blocks planner **re-adds** (`evaluateReactive`, `src/sim/planner/reactive.ts:60`), not queued cards from running. The receipt design is still right, for the narrower reason that index, anchor state and prior suppression are otherwise lost. **Bumps `ENGINE_VERSION`.**

**Q2 — Where do why-lines live?** §7.5 wants `Added: Nutrition will pass 35 around 12:40`. That is authored prose, and **writing.md gates every authored string** with a mandatory humanizer pass (master convention 10).

→ **Recommendation: the sim emits structured *reasons* (`{kind: 'reactiveTrigger', bar, threshold, atMinute}`), and `content/strings/` holds the templates.** Keeps `sim/` free of prose, keeps the strings inside the gate, and makes the why-line translatable later. **[R2] Reasons must cover anchor and wrinkle-sourced cards too**, not only reactives — otherwise those cards have no why-line and the UI has to invent one. `humanizer` availability confirmed (DoR row 9).

**Q3 — Anchor blocks are one card in the UI and many in the engine.** §7.4: blocks render as one expandable card ("Morning routine ▸ ×4"). The engine stores four cards sharing a `blockId`.

→ **[R2] Recommendation: grouping is a pure function in `ui/`, and it groups only *maximal contiguous AUTO members* sharing a `blockId` — never every card with that id.** `moveCard` **retains `blockId` while flipping the card to PINNED** (`src/sim/queue.ts:103-116`). Grouping on `blockId` alone therefore makes a card the player just dragged out of a block visually snap back into it — the edit appears to have been rejected. The engine's per-card representation is what makes §7.3's ordering rules work and what `sortReactivesAroundBlocks` operates on; collapsing it in the model would break both. **Collapsed-block editing rule: expand before editing.** Whole-block drag and whole-block remove are out of scope this phase; if they are wanted, they need their own ruling.

**Q4 — What does "touch-capable-web parity" mean for the gate?** Master §5 says keyboard/mouse/touch-capable-web parity; §18's DoD is desktop-web only, and the v1.1 mobile pass owns devices.

→ **[R2] Recommendation: build on RN's responder system, and gate touch on an exported-browser emulation matrix — *not* "verified by construction."** The earlier draft claimed pointer events make touch correct for free. That is false against the installed tree: react-native-web's responder path is implemented on `touchstart` and `mousedown`, not `PointerEvent` (`node_modules/react-native-web/src/modules/useResponderEvents/ResponderSystem.js:20`). Jest also runs in Node, not a DOM (`jest.config.js:4`), so synthetic responder calls can prove reorder *mathematics* and nothing about web interaction. The gate is a recorded pass over the exported build covering **tap-vs-drag threshold, reorder, cancellation, horizontal overflow, drag-off removal, and Undo**, in mouse and in touch emulation — logged honestly as emulation, not a device.

**Q5 — Drag-and-drop: new dependency or hand-rolled?** The queue strip needs reorder-by-drag on web.

→ **Recommendation: hand-roll on RN's `PanResponder`.** `react-native-draggable-flatlist` and friends are native-first and historically weak on react-native-web, and P0 fought hard to stabilise this export path. §11.6 already requires **full keyboard + card-menu parity**, so dragging is the *third* input path onto the same commands, not the only one — which caps the cost of hand-rolling. **[R2] Treat the choice as provisional: prove it with an early browser spike, and build card menus and keyboard first** so that if `PanResponder` fails the export, every interaction is already reachable and drag is the only thing at risk.

**Q6 — Sleep-skip must not diverge the simulation.** §11.4: on night-sleep start, dissolve → `wakeTarget`. That is ~490 ticks.

→ **Recommendation: run every skipped tick through the same top-level tick, just without painting.** Jumping the clock would fork sim state from the replay and silently break the golden. At 12 µs/tick (measured in P3) 490 ticks is ~6 ms — a single frame.

**[R2] Two mechanical corrections.** First, this cannot ride `advance()`: `MAX_TICKS_PER_FRAME = 8` caps and **discards** backlog (`src/application/loop.ts:30,53-56`), so the skip needs a named `GameLoop` entry point or someone will later "fix" the cap and break it. Second, `runOneTick()` publishes **every snapshot and every event** (`src/application/loop.ts:184`) — so calling it ~490 times is not "without painting," and bypassing it with raw `step()` would drop goal and recap events. The batch must run the same top-level game tick, **consume every event in order**, suppress only *intermediate publication*, and publish one final snapshot.

**"No input for 10 s" is real-time presentation state and must live in `application/`, never in `SimState`** — the sim has no concept of the player being idle (`src/sim/state.ts` confirms none exists), and putting it there would make the replay depend on wall-clock. **Pause and background time must not count toward the idle gate.** A presentation-only skip does **not** bump `ENGINE_VERSION`.

**[R2] Q7 — What command expresses the Day-1 wrinkle, and what is the `game/` seam?** §7.4/§9.4 specify a doorbell-type wrinkle: **interrupt idle only; if mid-activity, the visitor card enters at URGENT-front.** No existing command can express that — the `Command` union (`src/sim/step.ts:25-30`) offers `insertPlayer` (appends PINNED at tail, consumes cap) and `objectClick` (targets the unpinned front). Neither is interrupt-idle-only, and neither can front-insert at URGENT. There is also no door object and no answer-door activity in content (verified: 14 objects, 13 activities).

→ **Recommendation: add a narrow engine command for wrinkle-sourced insertion, extend queue provenance, and design the `game/` seam explicitly before any of it is built.** Concretely:

- a command whose contract is *interrupt only if idle, else insert at URGENT-front* — narrow enough to be testable in isolation;
- `CardSource` gains a wrinkle provenance (today: `anchor | reactive | player`, `src/sim/queue.ts:9`);
- the **seam**: how `game/` injects commands into the loop, how goals consume `DomainEvent`s, and where day-summary/recap accumulation lives. All three are undesigned today and all three are load-bearing for T2, T9 and T10.

**[R3] Insertion alone cannot deliver URGENT-front.** The sorter assigns a non-reactive wrinkle card sort key `0` even when `urgent: true` (`src/sim/planner/index.ts:37`), so the card falls behind anchor blocks and scored reactives on the very tick it is inserted. **T2 must change and test generic urgent ordering**, and prove it holds after the same tick's sort, on the next tick, and across PINNED barriers. A command that inserts at index 0 and is immediately re-sorted away is the failure mode to test for, not to discover.

**[R3] Goal-relevant player actions are not `DomainEvent`s.** §12 requires "opened a why-line" (Goal 1) and "observed a forecast change" (Goal 2) — SPEC.md:603. Neither exists as an engine event, and neither should: they are UI observations. The seam therefore needs a **serializable `GameAction` / session-action path** alongside `DomainEvent` consumption, and it must be part of the scripted replay. **T1 decides and records the exact reducer order** (pre-sim → sim → post-event), typed command outcomes, and replay treatment — the plan names the decision as owed; it does not make it here.

**[R3] Wrinkle reason metadata.** "Wrinkle" provenance alone cannot identify *which* wrinkle, so it cannot select a why-line template. T1 decides where that metadata lives — on the card, in game state, or as a game-supplied annotation joined by `cardId` — and the receipt schema follows that decision.

**Bumps `ENGINE_VERSION`.** **[R2] §5's "no sim behaviour changes beyond Q1 and Q6" is amended to "beyond Q1, Q6 and Q7"** — the earlier wording made T10 forbidden by the plan's own rule.

---

## 2. SPEC-clause traceability (master convention 6)

**[R2] Master §3 requires SPEC, `design.md` and `writing.md` traceability — the previous table covered only SPEC.**

| Clause | Task | Verified how |
|---|---|---|
| §7.4 every queue rule row | T3, T5, T6 | one test per row, plus the scripted replay |
| §7.4 undo + suppression semantics | T4 | engine tests (Q1) |
| **[R2] §7.4 blocked-object deferral, Quick-wash rerouting, and visitor behaviour *beyond Q7's Day-1 scope*** | **[R3] T0** | **Decided at T0, not T5.** Default ruling: reassign to P5, recorded in the master plan — retaining them needs engine work outside the Q1/Q6/Q7 allowance. The Day-1 visitor path itself *is* P4, built by Q7/T2/T10c; only the variants beyond it move. |
| §7.5 predicted starts, why-lines, conflicts, cap-waste | T3, T7 | forecast-to-UI agreement test |
| **[R2] §7.5 responsible-card attribution, target object, refresh caching** | T3 | cache-invalidation test on each of the three triggers |
| **[R2] §0aa round-4 Q7 — pin-vs-next-wake-window conflict warning** | T7 | **recorded MUST** (also evidence/p2.md audit item 7): the queue UI must warn on any pin colliding with the next wake window, and the recap must name the missed routine. **Not covered by ordinary conflict chips** — forecaster conflicts are bar<15 crossings, and the horizon *ends at* `wakeTarget` (`src/sim/forecast.ts:33-34`) while the miss happens after wake. Detection is a pinned-chain duration crossing `wakeTarget`; design it, do not improvise it. |
| §11.2 queue strip: current card, upcoming, palette, card menus, undo toast | T5, T6 | interaction tests per element |
| §11.4 sleep-skip | T9 | tick-parity test (skipped run ≡ watched run) |
| **[R2] §11.4 recap contents, dismiss/expand, missed-routine wording, SR announcement** | T10 | one test per element — the previous table covered only the skip |
| §11.6 keyboard-complete editing, non-hover info, reduced motion, screen-reader labels | T6 | keyboard-only traversal test; a11y label assertions |
| **[R2] §11.6 non-colour urgency encoding, scalable HUD text, announcements** | T6 | assertion per item |
| §11.8 the fixed key set | T6 | **[R2]** one test per **P4-active** binding — see scoping note below |
| §8 Practice, player-visible | T10 | insert → points awarded → counter moves |
| **[R2] §6.7 armed-vs-earned chip placement** (chip on the Practice card, never the bedtime Brush) | T7 | placement assertion |
| **[R3] §6.7/§16.3 every bonus delivers a nonzero effect at least once** — the four adjacency pairs §2 assigns to P4 | T11 | nonzero-effect assertion per pair in the scripted-player golden |
| §9.4 Day-1 package wrinkle | T10 | scripted: wrinkle fires, is resolvable, grants the decoration |
| **[R2] §9.4 the two-decoration *choice*** | T10 | the package "contains a choice of one of two" — the earlier draft said "one decoration reward". This is the first real decision §12's 60-second target rests on. |
| §12 goals 1–2 | T10 | **[R2]** to the letter: **Goal 1 = three completions *plus* opening a why-line, unlocks Journal; Goal 2 = an edit *plus* an observed forecast change, grants the plant** |
| **[R2] §11.1 goal visibility surface** | T10 | goals need somewhere to be noticed or P4.5 cannot pass-condition on them; §11.1's goal chip is built by no phase. Minimal surface named in T10. |
| **[R2] §16.3 scripted-player golden** | T11 | second replay with fixed player edits and stops |
| **[R2] generic object clicks, incl. objects with multiple activities** | T10 | not only the guitar |
| **[R2] `design.md` queue / chip / motion requirements** | T5, T6, T7 | per-requirement assertion |
| **[R2] `writing.md` review-manifest requirements** | T7, T10 | reviewed string IDs recorded in evidence |
| master §5 minimum slice | T12 | the frozen build contains all nine items |

**[R3] §11.8 scoping — corrected.** R2 reassigned `Esc` and `G` to P5, which was wrong now that P4 builds panels and a goals surface. The actual split: **`Esc` closes P4 panels** (its pause-menu target is P5, §11.7, but the close behaviour is P4's) · **`G` opens the P4 goals surface** built in T10e · `M` → **P6** (no audio bus before then) · `W` → **v2+**. Test one per P4-active binding. `Tab` stays ordinary focus traversal, and all shortcuts are suppressed inside editable fields, contenteditable, and IME composition.

**[R2] Adjacency ownership conflict — resolve before T10.** evidence/p2.md records the four player-dependent adjacency pairs as "P4 owner"; master §7 sends "adjacency involving Practice" to P5. These contradict. Ruling: **P4 owns the four pairs p2.md names**, P5 owns the rest. Record the ruling in the master plan, don't leave it implicit.

**Not P4, owners named:** goals 3–7, wrinkle variety, intentions, identity, journal, settings, three-layer persistence, Day-8 letter → **P5** · real art, audio, juice → **P6** · phone/fractional scaling → **v1.1**.

---

## 3. Tasks

**[R2] Order changed.** The previous order started with the queue DTO and left the entire `game/` ring as one checkbox at T10. Both reviewers independently found that inverted: sleep-skip parity (T9) and the scripted replay (T11) must assert over *game* state — goals, recap aggregates, wrinkle state — none of which exists. Building them first means writing assertions against a shape that changes underneath them.

### T0 — Preflight (blocking; nothing starts until this clears)

- [x] **P4.5 protocol authored and FROZEN 2026-07-30 by Joe** — `2026-07-30-p4.5-external-playtest-protocol.md`, master §2 index updated. The operational half only; §6 remains the sole authority on criteria and nothing in it was altered. **T0 gate clear.**
- [x] `npm run verify` green on the implementation-start tree — content + atlas gate + typecheck + tests + web export, 2026-07-30 at `fc45b39`+plan edits.
- [x] NativeWind ruling recorded (DoR row 4 — decision is *no*).
- [x] `humanizer` availability confirmed (DoR row 9 — passes).
- [x] **[R3] §7.4 blocked-object / Quick-wash / visitor variants beyond Q7's Day-1 scope — decided 2026-07-30: reassigned to P5**, recorded in master §5's P5 row. The Day-1 visitor path itself stays P4 (Q7/T2/T10c).
- [x] **[R3] Adjacency ownership conflict decided** — master §7 now says P4 owns the four player-dependent pairs (warmed-up, cramp, minty-fresh, fresh-mind) and P5 owns the rest, resolving the contradiction with evidence/p2.md in p2.md's favour.

### T1 — The `game/` session envelope and deterministic reset

`src/game/` is created here — framework-free per master §4.

- [x] Serializable game/session state: goal progress, wrinkle state, decoration state, recap accumulation. → `src/game/session.ts`, zod `strictObject` mirroring `SimState`'s conventions.
- [x] A **top-level tick** that advances sim *and* game. → `advanceGame` in `src/game/tick.ts`, composed by `GameLoop.runOneTick` which folds events before publishing the snapshot.
- [x] **[R3] A serializable `GameAction` / session-action path** — `whyLineOpened` / `forecastChangeObserved`, folded into run-scoped `session.observations` which survive the day boundary (the recap does not).
- [x] **[R3] Reducer order decided and recorded** in `src/game/tick.ts`: pre-sim (game produces commands) → sim (`step()`) → post-event (game folds). Actions fold before sim events within the post-event phase. **Replay treatment:** `GameAction` is serializable precisely so T11's replay can carry it — a sim-command-only replay could never reproduce a goal that turns on looking at something.
- [x] **Completed with T2:** `step()` now returns one serializable, discriminated `CommandOutcome` per command in input order, and the top-level loop folds accepted wrinkle outcomes into `game/`. **Wrinkle reason metadata lives on the queue card** as `{kind:'wrinkle', wrinkleId}` — not in application state or a parallel lookup — so save/replay, reorder, T3's read-model and T4's full-card receipt all preserve it.
- [x] Deterministic session reset, scoped to the session/career namespace only — never a broad `localStorage` clear. — `resetSession()` in `src/game/session.ts`.
- [x] Verify: reset produces a byte-identical starting state for **the state that exists at T1**; the envelope round-trips through serialization. — **green**: 11 new tests across 3 suites; full `npm run verify` at **35 suites / 327 tests** + web export (was 32/316).
- [ ] **[R4] Reset's full contract is built incrementally, not asserted here.** Reset must eventually also clear pending commands, the loop accumulator and stats, the forecast cache, any live receipt and toast, the idle timer, and presentation selections — but most of those are introduced by T3–T9. **Each task that introduces resettable state extends the reset and its assertion in the same change**, and T12 carries the final end-to-end reset coverage. Asserting the whole contract at T1 would test state that does not exist yet.

### T2 — The wrinkle command (Q7)

- [x] The interrupt-idle-only / URGENT-front `insertWrinkle` command, plus `source:'wrinkle'` provenance and the on-card structured reason. Unknown activity IDs reject with a typed outcome before enqueueing; accepted outcomes distinguish `started` from `queued`.
- [x] **[R3] Generic urgent ordering changed with it.** `URGENT_TIER = 1000` is now shared by reactive scoring and unscored urgent units, so wrinkle cards sort above the 500 anchor-block tier instead of receiving key `0`. Need-based urgent reactives retain their weighted score above the tier floor.
- [x] Verify: idle starts the wrinkle in the same tick; mid-activity queues it at URGENT-front without interrupting. Ordering is asserted after that tick's sort, on the next tick, and on both sides of a PINNED barrier. **Full `npm run verify` green: 36 suites / 332 tests, snapshot unchanged, web export clean.**
- [x] **[R3] Behaviour-changing checkpoint — `ENGINE_VERSION` decision: YES, P4 must bump 5 → 6.** Per the consolidated path ruling, the literal and both reviewed golden diffs land together at T11 after T4. T2's unattended golden is byte-identical because that replay issues no wrinkle command.

### T3 — Publish an *intrinsic* queue DTO, then the forecast read-model beside it

**[R2] This task was the plan's original T1 and could not be built as written.** It put predicted start and cap-waste on `SimSnapshot.queue`, "derived per tick, exactly like `render`". But `buildSnapshot` is called **inside** `step()` (`src/sim/step.ts:397`) and `forecast()` **calls** `step()` (`src/sim/forecast.ts:46`) — so a forecast field on the snapshot is either infinite recursion or a 720-step lookahead every tick, which also violates §7.5's explicit refresh triggers.

- [x] **Sim DTO carries only intrinsic fields:** frozen card DTOs now publish `id`, `activityId`, `owner`, `urgent`, `source`, structured reason, `blockId`, `enqueuedTick`, and integer-exact duration at current `m_speed`; the snapshot also carries current-card id and progress. Duration math is shared with activity start, not reimplemented. **No `ENGINE_VERSION` bump:** this is derived/read-model state.
- [x] **Forecast annotations are a separate read-model**, cached by canonical schedule signature + commitment revision + game-hour in `application/forecast-cache.ts`, then joined to frozen cards by id in `application/snapshot.ts`. The signature reads engine state, not UI actions, so planner enqueue/cleanup, completion, stop, wrinkle insertion, removal and T4's later undo invalidate automatically. Ordinary bar/progress ticks inside an hour reuse the same forecast object. T3 also extends loop reset to clear this cache, pending commands, counters and accumulated time.
- [x] **[R2] Duplicate-card identity fixed:** `currentCardId` names the exact running card and `currentProgress` publishes its progress; two identical Practice activities are asserted separately.
- [x] Forecaster extended with structured anchor/reactive/wrinkle reasons, projected-start effects and cap-waste, responsible-card ids on conflicts, and target object id. Anchor `targetAt` is now consumed by the reason DTO rather than remaining dead data.
- [x] **Forecast-to-reality agreement:** existing tick-for-tick start agreement remains green; T3 adds real-`step()` agreement for projected cap-waste and conflict time/responsible-card attribution.
- [x] Verify: **full `npm run verify` green — 38 suites / 342 tests, golden snapshot unchanged, web export clean.** Cache tests prove each of the three refresh triggers and prove ordinary same-hour ticks do not refresh. `ENGINE_VERSION` remains 5 pending T11's consolidated 5 → 6 path.

### T4 — Engine: the removal receipt (Q1)

- [x] `undoLastRemove` accepts **only an opaque engine-issued receipt id** per Q1. The serializable receipt owns the complete card, original index + neighbours, suppression mutation and anchor mutation; each mutation has its own equality/ownership guard. JSON round-trip and reinsertion after an intervening queue edit are covered.
- [x] Running and travel-target cards Stop, with no toast (§11.8). Cap-refill voids the receipt.
- [x] Single-depth; 5 s real-time expiry lives in `application/`. Hidden browser time is handed to the presentation timer once on resume while simulation time remains hard-paused.
- [x] The restored block can still fire the §7.1 missed-window sweep. Suppression tests cover the matching restore plus both older and newer intervening writes surviving untouched.
- [x] **[R3] Wake-boundary anchor guard covered:** remove at 06:59, the next wake block consumes at 07:00, and Undo cannot erase that newer generation.
- [x] **[R3] Behaviour-changing checkpoint — `ENGINE_VERSION` decision: YES, P4 must bump 5 → 6.** The literal and both golden diffs remain intentionally consolidated at **T11**, once its scripted replay exists.
- [x] Verify: **full `npm run verify` green — 40 suites / 353 tests, existing golden snapshot unchanged, web export clean.**

### T5 — The queue strip and card menus (semantic input first)

- [x] Current card is 64 px with an eight-segment radial progress ring and always-reachable Stop; upcoming cards show pin/gear glyphs, an URGENT red pulse, and the forecast's predicted start. The `+` palette is grouped by room with live duration/effect summaries, and current/upcoming/collapsed-block cards all expose a `⋯` menu.
- [x] Anchor blocks render as one expandable card, grouping **maximal contiguous AUTO members** (Q3); editing requires expansion. Pure presenter tests prove both [R3] traps: the current-card id is excluded before grouping, and a PINNED member splits same-id AUTO members into two fragments.
- [x] Remove publishes T4's 5-second Undo toast; the UI passes only the opaque receipt id back. All T5 press targets are at least 44 px.
- [x] **Mount tests, not just logic tests:** five `react-test-renderer` interaction tests mount the real strip, open its local surfaces, invoke semantic callbacks, expand a block, and exercise the Undo action.
- [x] Verify: **full `npm run verify` green — 42 suites / 361 tests, existing golden snapshot unchanged, web export clean.** Headless Chromium smoke on that export at 1366×768 and 1024×768 covered the room palette, live Practice insertion, current/upcoming menus, block rendering, removal, paused real-time toast expiry, and clean console/page-error logs. T6/T7/T8/T12 retain their explicitly later accessibility, forecast-detail, drag, and full browser-matrix gates.

### T6 — Keyboard + accessibility (§11.6, §11.8)

§11.6 is v1 scope and explicitly never cut (SPEC §17's cut line). **[R2] It comes before drag** so every interaction is reachable even if `PanResponder` fails the export (Q5).

- [x] P4-active bindings **that have a surface at T6**; `Q`/`Tab` focus traversal; card menus as full drag parity; no hover-only information; reduced motion; screen-reader labels for bars and cards; non-colour urgency encoding; scalable HUD text. Urgency retains a visible `!` when motion is reduced, the Undo status is a polite live announcement, every speed target remains ≥44 px, and the world reservation grows with HUD text up to the 2× cap.
- [x] Shortcuts are suppressed in inputs, contenteditable, IME composition, and browser/assistive-technology modifier chords. `Tab`, `G`, `W`, and `M` remain unclaimed at T6. The exported-browser text-field probe typed `a` without opening the palette.
- [x] **[R4] Two items move to their feature-owning tasks**, because T6 precedes the surfaces they describe: **forecast accessibility** (labels and announcements for predicted starts, why-lines, conflict chips) is asserted by **T7**, and the **`G` binding plus goals-surface traversal** by **T10e**. Each ships its own accessibility with the surface rather than being promised here.
- [x] Verify: **full `npm run verify` green — 44 suites / 371 tests, existing golden snapshot unchanged, web export clean.** A real-keyboard path in the 1366×768 export covered Space/1, `A` + native Tab palette traversal and insertion, `Q` + arrows, Shift+arrow reorder, Enter/card-menu/Details, Escape with focus return, Delete + receipt-backed `U`, and `X` Stop with no toast. Exact one-tick advances kept the time-sensitive Undo sequence inside its 5-second window. Reduced-motion emulation and bar/card labels were observed; console and page-error logs were clean. The browser pass found and fixed Space/Enter double-activation at focused buttons by consuming both halves of handled key events. T12 re-runs the complete exported-build matrix.

### T7 — Surfacing the forecast

- [x] Predicted start on each card, why-line on AUTO/anchor/wrinkle cards, ⚠ conflict chips, adjacency chips, cap-waste in card Details, and §6.7 armed-vs-earned placement. Bonus annotations use the same exported adjacency matcher as `step()`; Minty is attached only when the real Practice DTO consumes it, never to Brush or Sleep. The consecutive-Practice curve is a separate structured bonus.
- [x] **[R2] §0aa Q7 pin-vs-wake-window warning** — the cached forecaster continues its existing deterministic clone privately to the next `wakeTarget`, then publishes a separate warning for the contiguous PINNED barrier found there. It is not conflated with a bar-below-15 conflict.
- [x] **Strings passed writing.md's gate.** Humanizer **v2.2.0** ran first, then the §5 checklist. `content/strings/review-manifest.json` records the exact queue-file SHA-256, all **21** reviewed string IDs, the 2026-07-30 pass date, invocation, and rewrites. The content gate now fails on a stale hash or ID set; a regression test proves an unreviewed copy change fails.
- [x] Verify: all visible and accessibility copy formats the published forecast DTO; the UI does not re-run adjacency, conflict, wake, or cap-waste logic. Full `npm run verify` is green — **45 suites / 378 tests**, existing golden snapshot unchanged, content/writing/atlas/typecheck clean, and web export clean. A 1366×768 exported-browser pass exercised a live Shower → Practice reorder (`Fresh` chip on Practice), an anchor why-line, forecast announcements, and projected cap-waste; it found and fixed the floating-point display tail (`38.30000000000001` → `38.3`). Console and page-error logs were empty. No `ENGINE_VERSION` bump: T7 adds frozen read-model metadata and presentation only.

### T8 — Drag to reorder (Q5, third input adapter)

- [x] **Early browser spike ran first.** The exported Chromium build delivered PanResponder movement and reordered through `moveCard`; the spike also caught mouse-up click-through opening the card menu. The adapter now suppresses that post-drag press for the mouse/touch click window while preserving ordinary taps.
- [x] `PanResponder` reorder issues the existing `moveCard`. Any activated drag calls it even when the rounded index is unchanged, so dragging an AUTO card invokes the engine's existing AUTO → PINNED ownership rule.
- [x] Leaving the measured strip removes through the same `onRemoveCard` command/receipt path as menus and Delete. A one-card-height vertical fallback covers platforms/test renderers where window measurement is unavailable; responder termination cancels without editing.
- [x] Verify: pure threshold/rounding/clamp/off-strip tests, mounted synthetic grant/move/release/terminate events, and **1,000 seeded drag-generated edits** followed by planner passes keep the PINNED subsequence intact. Full `npm run verify` is green — **46 suites / 385 tests**, existing golden snapshot unchanged, content/writing/atlas/typecheck clean, and web export clean. The required early mouse spike additionally observed reorder with no menu leak, upward drag → receipt-backed Undo, and a normal post-drag tap reopening the menu; console/page-error logs were empty. T12 still owns the complete mouse/touch/keyboard matrix, tap-vs-drag threshold, overflow, and cancellation proof (Q4).

### T9 — Sleep-skip (§11.4)

- [x] On night-sleep start with no URGENT queued and no input for 10 s (real time, in `application/`, pause/background excluded — Q6), advance to `wakeTarget` via the named `skipNightToWake()` batch entry point, never `advance()` (whose `MAX_TICKS_PER_FRAME` discards backlog). Pointer, touch, and every keyboard input restart the quiet-time gate.
- [x] The batch runs the same top-level sim → game → composed-snapshot tick for every minute, consumes every event in order, suppresses only intermediate observer publication, and publishes one final snapshot.
- [x] Daytime urgent sleep never skips. A night urgent sleep may skip without mistaking its own running card for queued urgency; any *other* queued URGENT card blocks the gate.
- [x] Verify: the skipped-vs-watched parity matrix covers baseline/early/owl wake targets, anchor sleep, night urgent, daytime urgent, queued urgency, an event emitted mid-sleep, input at 9.9 s, player pause, system background, reset, accumulator preservation, and the elapsed-driven/no-late-timer unmount contract. Complete sim state, complete game session (including goals and recap), ordered events, final composed snapshot, tick stats, and accumulator all match. Full `npm run verify` is green — **47 suites / 396 tests / 1 snapshot**, content/writing/atlas/typecheck clean, existing golden unchanged, and web export clean.

### T10 — The first-session content slice

**[R3] Five separate checkpoints, not one.** R2 split T10 out of the old monolith but left the content itself bundled; each of these has its own failure mode and its own verification.

**[R4] T10a — Object hit-testing** *(was T10b; it now precedes Practice, whose acceptance depends on object-click working)*
- [x] Generic object clicks use accessible 44 px minimum React Native hit targets mapped over authored world footprints, including explicit multi-activity choice panels (Sink: Brush/Quick wash; Couch: Nap/Sit) — not only the guitar. Single and chosen activities reuse the queue's `insertPlayer` path; objects with no activities expose no false target; Escape closes the panel. Pure geometry + mount coverage is green (5 tests). Exported-browser proof at 1366×768 inserted Practice from the guitar, opened and chose from the sink, and closed the panel with Escape; accessibility names were present and console/page errors were empty.

**[R4] T10b — Practice, made visible** *(was T10a)*
- [x] Practice is insertable from both the room-grouped palette and the guitar click through the same command path; earned points land on the permanent HUD counter; the consecutive-session advantage renders as a `Block` chip and plain detail (`Keeps 85% of base instead of 70%.`). The exported-browser object-click run visibly moved Practice from 0 to 38 points, while focused palette/HUD/read-model/mount tests cover the other paths.

**T10c — Package mechanics**
- [x] Day-1 package wrinkle on T2's command, with the **two-decoration choice** (§9.4). → deterministic 10:00 insertion, system-only package activity, exactly-once resolution, reset coverage, and a two-choice accessible event card.

**T10d — Decoration rendering**
- [x] **[R3] This needs a real path, not a content entry.** `WorldScene` memoizes a static world once (`src/render/WorldScene.tsx:96`), so "the decoration stays visible for the run" requires game state → composed snapshot → dynamic rendering. Verified by mount test and T12's exported-browser run: the Goal-1 plant and chosen sunny vase remained visible together through the rest of Day 1 and into the Day-2 recap.

**T10e — Goals and recap**
- [x] Goals 1–2 to §12's letter, on T1's `GameAction` path, with the minimal visibility surface (§11.1). → watched completions + Why, edit + observed forecast, Journal and plant rewards.
- [x] First-night recap: contents, dismiss/expand, missed-routine wording, SR announcement (§11.4).
- [x] Verify: a scripted run completes goal 1 and goal 2, shows the chosen decoration, and produces the recap. → `first-session.test.ts` and the full scripted-player golden. `G` opens the real Goals surface, `Esc` closes it, and reset closes presentation-owned panels.

### T11 — The scripted-player golden and the consolidated version path (§16.3)

**[R2] New task.** Exit evidence (line 9) requires "scripted queue replay added," and SPEC §16.3 explicitly requires P4's *second* replay with fixed player edits and stops. The only golden today has `commands: []` (`src/sim/__tests__/harness/golden-week.test.ts:25`). Neither T4's unit tests nor T10's scripted goal test satisfies it.

- [x] A named replay covering insert, move/pin, object click, stop, remove, undo, suppression, duplicate-card identity, and forecast agreement. **[R3] It runs the top-level game tick, includes session actions, and digests full game state** — `scripted-player-golden.test.ts`, full-state SHA-256 pinned.
- [x] **[R3] The four adjacency pairs §2 assigns to P4** (warmed-up, cramp, minty-fresh, fresh-mind), each asserted to deliver a nonzero effect at least once.
- [x] **[R3] The consolidated version path lands here** → `ENGINE_VERSION` 6, literal pins, unattended snapshot, harness record, scripted snapshot, and P4 evidence updated together.
- [x] Verify: both golden diffs reviewed and explained in `docs/superpowers/evidence/P4.md`; unattended behavior is byte-identical apart from version, and the new player-pressure golden pins full sim + game state.

### T12 — Browser acceptance matrix and the P4 completion baseline

- [x] **[R4] Exported-build matrix over the complete §7.4 surface — not only drag.** Master §5's contract is the full queue interaction surface with keyboard/mouse/touch-capable-web parity, and Jest runs in Node (`jest.config.js:6`), so nothing in T1–T11 proves *browser* behaviour. In each applicable input mode (mouse, touch emulation, keyboard): **palette insertion · card-menu actions · Stop · object click and multi-activity choice · expanded-block editing · card details · Undo · shortcuts and panel open/close · drag (tap-vs-drag threshold, reorder, cancellation, horizontal overflow, drag-off removal)**. Recorded as emulation, not a device. Full matrix and exact touch capabilities are in `docs/superpowers/evidence/P4.md`.
- [x] **[R4] A live package → goals → recap smoke** in the exported build — the same run received the Day-1 package, chose the sunny vase, completed both goals, retained both decorations, crossed the real sleep-skip, and displayed the expandable Day-1 recap on Day 2.
- [x] **[R3] Decoration visibility confirmed in the exported build** (T10d).
- [x] **[R4] Final end-to-end reset coverage** — `reset-contract.test.ts` mutates and resets sim/session state, queued commands/actions, forecast revision, timing/stats, speed/system pause, removal receipt/toast and idle state; `first-session-ui.test.tsx` covers presentation selections.
- [x] Confirm all nine minimum-slice items are present (master §5), record the build hash and seed, write the evidence. → seed `1234`; post-audit P4 completion app bundle SHA-256 `405046acc6af273cea2ba156dcf99a1380b01914488e439940f582d2a5bbee5a`.
- [x] Verify: the idle check below. A ten-Practice scripted day reduced idle minutes from **722 to 286** on the frozen seed; the regression assertion requires a material reduction without pinning future P4.5 tuning to the exact counts.

---

## 4. The thing this phase is actually for

P3 proved the world and clock are visible. It proved nothing about the loop being interesting — and the measured numbers say why that matters: **79% of waking minutes are idle**, because Practice is player-only and there was no queue to schedule it with.

P4 is what fills those hours. So **free-time fill is load-bearing, not polish**: the queue, Practice, and the Day-1 wrinkle are the game the SPEC claims is fun, and P4.5 tests exactly that. A P4 that ships a beautiful queue editor over an empty day passes its own task list and fails the gate.

Concretely, before freezing: run a scripted day that inserts Practice and check the idle percentage actually falls. If it does not, the slice is incomplete regardless of how many §11.2 elements are ticked off.

## 5. What P4 deliberately does not do

- Goals 3–7, wrinkle variety beyond Day 1, intentions, identity-lite, journal, settings/autonomy, Day-8 letter → **P5**
- Three-layer persistence and rotating saves → **P5**. P4 ships only the deterministic session reset the slice requires.
- Real art, audio, juice → **P6**
- Phone and fractional scaling → **v1.1**
- NativeWind → **not adopted** (DoR row 4)
- Whole-block drag / whole-block remove → needs its own ruling (Q3)
- **[R2] No sim behaviour changes beyond Q1, Q6 and Q7.** Anything else that seems to need one is a finding to report, not a fix to make here.

## 6. Integrity constraints

**[R2]** This phase adds no network or auth surface, so classic exposure is low. The integrity rules that do matter:

- Undo restores from **engine-issued receipts**, never a UI-authored card payload.
- Validate command activity IDs before enqueueing.
- Suppress destructive global shortcuts in inputs, contenteditable, IME composition, and modified chords.
- Render string templates through React `Text` — never raw HTML.
- Reset targets only the session/career namespace; never a broad `localStorage` clear.

## 7. Carried in from P3

| Item | Action |
|---|---|
| `HUD_H = 148` | Settled in code **and** SPEC §11.5. If P4's layout changes the HUD's real height, change both — never one. |
| `ProofScreen` / `AtlasProof` dead | Cut during this phase's `application/` work. |
| Non-walk poses static; RGBA vs indexed PNG | **P6** — do not re-open. |
| `scene-mount.test.tsx` | The pattern for every React-mounting test in this phase. |
| NativeWind deferral | **Closed: not adopted** (DoR row 4). |
