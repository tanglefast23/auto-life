# Auto Life P4 — Queue UI & the Minimum First-Session Slice

> **Implementation contract:** one checked task at a time; focused failing check → minimal implementation → green → wider checks. Never checkpoint a red tree (master convention 1). Stage only task-owned paths; never `git add -A` (convention 2).

**Goal:** the player gets verbs. P3 made the sim visible; P4 makes it *steerable*, and assembles the exact build that P4.5's external testers will play.

**Owned by this phase** (master §5, verbatim): full §7.4 queue interaction surface · forecasts/why-lines needed for comprehension · keyboard/mouse/touch-capable-web parity · player-visible Practice integration using P2's math · **§11.4 sleep-skip** (assigned 2026-07-30) · plus the minimum first-session slice.

**Exit evidence** (master §5, verbatim — not re-negotiable here): every interaction passes · scripted queue replay added · a frozen build contains the complete P4.5 slice.

---

## 0. Definition of Ready — recorded 2026-07-30

Per master §3, checked against the tree rather than from memory.

| # | Check | Result |
|---|---|---|
| 1 | Prior evidence + green tree | P3 COMPLETED (evidence/P3.md), 4 adversarial loops. `npm run verify` green at `ccb1d10`: content + atlas gate + typecheck + **316 tests / 32 suites** + web export. |
| 2 | Repository inspected | `src/` = sim (23 files), render (7), ui (3), application (4), persistence (3). **No `src/game/` ring exists yet** — goals and wrinkles land here, and master §4 says that ring is framework-free. |
| 3 | Owned clauses mapped | §2 traceability table below. |
| 4 | Library assumptions verified | Nothing new is required. Reanimated 4.5.1 + Zustand 5 arrived in P3 and are proven in the exported build. Drag-and-drop uses RN's own `PanResponder`/Pressability rather than a new dependency — see Q5. |
| 5 | Cross-phase effects named | **`ENGINE_VERSION` will bump**: undo and sleep-skip change simulated behaviour (Q1, Q6). The golden week must be re-recorded and the diff reviewed. This is the first phase since P2 to touch sim behaviour, so the bump is expected, not a surprise. |
| 6 | Cut-line effects | Master §5: the minimum slice and the minimal forecast UI are **not cuttable or movable past P4.5**. Everything else in §11.2 polish may slip to P5. |
| 7 | Plan audited before code | **Outstanding** — see "Before T1" below. |

**Before T1:** master §3.7 requires this plan to be audited before phase code starts. P3's four-loop cadence ran *after* implementation; for a phase this size the cheaper order is to audit the plan first. Run the council (codex + fable) on this document before writing code.

---

## 1. Blocking questions

Six. Four change code structure. A plan that guesses here produces a queue nobody can debug.

**Q1 — What exactly does Undo restore?** §7.4 promises a 5-second Undo toast on remove. Removing an AUTO card also **suppresses that activity type for 2 game-hours**. So "undo" could mean: (a) re-insert the card, (b) re-insert *and* lift the suppression, or (c) restore the pre-removal state wholesale.
→ **Recommendation: (c), as an engine-level `undoLastRemove` command** carrying the removed card's full identity (id, owner, source, blockId, index) and clearing the suppression it created. (a) leaves the planner unable to re-add what you just restored — the player un-deletes a card and the planner still refuses to schedule it, which is indistinguishable from a bug. (b) is (c) minus the index, so the card reappears in the wrong place. **Bumps `ENGINE_VERSION`.**

**Q2 — Where do why-lines live?** §7.5 wants `Added: Nutrition will pass 35 around 12:40`. That is authored prose, and **writing.md gates every authored string** with a mandatory humanizer pass (master convention 10).
→ **Recommendation: the sim emits structured *reasons* (`{kind: 'reactiveTrigger', bar, threshold, atMinute}`), and `content/strings/` holds the templates.** Keeps `sim/` free of prose, keeps the strings inside the gate, and makes the why-line translatable later. **Verify the `humanizer` skill is available before authoring the first batch** (master convention 10 requires this explicitly).

**Q3 — Anchor blocks are one card in the UI and many in the engine.** §7.4: blocks render as one expandable card ("Morning routine ▸ ×4"). The engine stores four cards sharing a `blockId`.
→ **Recommendation: grouping is a pure function in `game/` or `ui/`, never a change to the queue model.** The engine's per-card representation is what makes §7.3's ordering rules work; collapsing it in the model would break them. Expanding the card reveals the real cards, and editing one detaches it (the engine already does this — `moveCard` detaches block members).

**Q4 — What does "touch-capable-web parity" mean for the gate?** Master §5 says keyboard/mouse/touch-capable-web parity; §18's DoD is desktop-web only, and the v1.1 mobile pass owns devices.
→ **Recommendation: build every interaction on pointer events so touch works, and test mouse + keyboard as the gate.** Touch is verified by construction (pointer events) plus one manual pass in a browser's touch emulation, recorded honestly as emulation rather than a device.

**Q5 — Drag-and-drop: new dependency or hand-rolled?** The queue strip needs reorder-by-drag on web.
→ **Recommendation: hand-roll on RN's `PanResponder`.** `react-native-draggable-flatlist` and friends are native-first and historically weak on react-native-web, and P0 fought hard to stabilise this export path. §11.6 already requires **full keyboard + card-menu parity**, so dragging is the *third* input path onto the same commands, not the only one — which caps the cost of hand-rolling.

**Q6 — Sleep-skip must not diverge the simulation.** §11.4: on night-sleep start, dissolve → `wakeTarget`. That is ~490 ticks.
→ **Recommendation: run every skipped tick through `step()`, just without painting.** Jumping the clock would fork sim state from the replay and silently break the golden. At 12 µs/tick (measured in P3) 490 ticks is ~6 ms — a single frame. Also: **"no input for 10 s" is real-time presentation state and must live in `application/`, never in `SimState`** — the sim has no concept of the player being idle, and putting it there would make the replay depend on wall-clock. **Bumps `ENGINE_VERSION`** only if the skip changes what ticks run; if it is purely a paint-suppression, it does not. Decide and record which.

---

## 2. SPEC-clause traceability (master convention 6)

| Clause | Task | Verified how |
|---|---|---|
| §7.4 every queue rule row | T3, T4, T5 | one test per row, plus the scripted replay |
| §7.4 undo + suppression semantics | T3 | engine tests (Q1) |
| §7.5 predicted starts, why-lines, conflicts, cap-waste | T2, T6 | forecast-to-UI agreement test |
| §11.2 queue strip: current card, upcoming, palette, card menus, undo toast | T4, T5 | interaction tests per element |
| §11.4 sleep-skip | T8 | tick-parity test (skipped run ≡ watched run) |
| §11.6 keyboard-complete editing, non-hover info, reduced motion, screen-reader labels | T7 | keyboard-only traversal test; a11y label assertions |
| §11.8 the fixed key set | T7 | one test per binding |
| §8 Practice, player-visible | T9 | insert → points awarded → counter moves |
| §9.4 Day-1 package wrinkle | T10 | scripted: wrinkle fires, is resolvable, grants the decoration |
| §12 goals 1–2 | T10 | goal completes on the specified action |
| master §5 minimum slice | T11 | the frozen build contains all nine items |

**Not P4, owners named:** goals 3–7, wrinkle variety, intentions, identity, journal, settings, three-layer persistence, Day-8 letter → **P5** · real art, audio, juice → **P6** · phone/fractional scaling → **v1.1**.

---

## 3. Tasks

### T1 — Publish a queue DTO on the snapshot (do this first)

The single most important ordering decision in the phase. `SimSnapshot.queueIds` is `string[]`; the strip needs owner, urgency, block membership, activity, predicted start, duration, effect and cap-waste.

**If P4 starts drag-and-drop by reaching into `GameLoop.peekState()`, it breaks the "UI reads snapshots only" seam (master §4) and couples the UI to mutable sim truth.** P3 already set the pattern with the render read-model: derive, never store, freeze on publication.

- [ ] Extend `SimSnapshot` with `queue: readonly QueueCardView[]` — id, activityId, owner, urgent, source, blockId, plus display fields (duration at current `m_speed`, effect with cap-waste, predicted start when the forecast has one).
- [ ] Derived and frozen, exactly like `render`. Assert the golden digest is unchanged (this is a read-model, so no `ENGINE_VERSION` bump for T1 alone).
- [ ] Verify: new tests green; golden snapshot byte-identical.

### T2 — Extend the forecaster for the UI it must feed

P2 shipped the forecaster headless and recorded why-lines, cap-waste projection, and refresh triggers as **deferred to P4** (evidence/p2.md).

- [ ] Structured reasons per AUTO card (Q2), refresh triggers per §7.5 (queue edit, commitment change, top of each game-hour), and cap-waste computed at *projected* values at the card's predicted start — §6.7 is explicit that it is projected, not current.
- [ ] **Forecast-to-reality agreement test**: for a seeded state, every predicted start matches what `step()` actually does. P2 has this for starts; extend it to cap-waste and conflicts.
- [ ] Verify: agreement test green.

### T3 — Engine: undo, and the commands the UI needs

- [ ] `undoLastRemove` per Q1: restores the card at its index with its original owner/source/blockId **and** clears the suppression the removal created. Test that the planner will schedule the restored type again.
- [ ] Undo is single-depth and expires — the toast is 5 s of *real* time, so the expiry lives in `application/`, not the sim (same rule as Q6).
- [ ] `ENGINE_VERSION` bump + golden re-record, with the diff reviewed and explained in evidence.
- [ ] Verify: undo tests green; golden diff justified.

### T4 — The queue strip (mouse)

- [ ] Current card 64 px with radial progress and Stop; upcoming cards with pin/gear glyphs, urgent pulse, predicted start; `+` palette popover grouped by room; card menu (⋯) on every card.
- [ ] Anchor blocks render as one expandable card (Q3).
- [ ] Remove → 5-second Undo toast. Hit targets ≥44 px.
- [ ] **Mount tests, not just logic tests.** P3's hardest bug was a React effect-lifetime defect invisible to every non-mounting test; `scene-mount.test.tsx` is the pattern to copy.
- [ ] Verify: one test per §11.2 element.

### T5 — Drag to reorder (Q5)

- [ ] `PanResponder`-based reorder issuing the existing `moveCard` command. Dragging a card **pins it** (§7.4's ownership row) — assert that.
- [ ] Drag off the strip to remove, with the same undo path as the menu.
- [ ] Verify: drag tests via synthetic pointer events; the PINNED-subsequence property test from P2 still passes under drag-generated edits.

### T6 — Surfacing the forecast

- [ ] Predicted start on each card, why-line on AUTO cards, ⚠ conflict chips, adjacency chips between cards, cap-waste in tooltips/card menus.
- [ ] **Strings go through writing.md's gate** — humanizer pass first, then the checklist, with reviewed IDs recorded (master convention 10).
- [ ] Verify: what the UI shows equals what the forecaster returns (no second computation).

### T7 — Keyboard + accessibility (§11.6, §11.8)

§11.6 is v1 scope and explicitly never cut (SPEC §17's cut line).

- [ ] The §11.8 fixed key set; `Q`/`Tab` focus traversal; card menus as full drag parity; no hover-only information; reduced-motion setting; screen-reader labels for bars, cards, forecasts.
- [ ] Verify: a keyboard-only path completes every §7.4 interaction — this is the acceptance, not a nice-to-have.

### T8 — Sleep-skip (§11.4)

- [ ] On night-sleep start with no URGENT queued and no input for 10 s (real time, in `application/` — Q6), advance to `wakeTarget` by running every tick through `step()` without painting.
- [ ] Daytime urgent sleep never skips.
- [ ] Verify: **tick-parity test** — a skipped night produces state identical to a watched night. That single test is what stops the skip forking the simulation.

### T9 — Practice, made visible

P2 owns the math; P4 owns the player seeing it (master §5).

- [ ] Practice insertable from the palette and by object-click on the guitar; points land on the HUD counter; the block bonus is legible (adjacency chips between consecutive Practice cards, §8).
- [ ] Verify: insert → complete → counter moves by the amount P2's math predicts.

### T10 — The first-session content

- [ ] Day-1 package wrinkle (§9.4, scripted), goals 1–2 (§12), one decoration reward that stays visible for the run, the first-night recap, and a deterministic session reset.
- [ ] `src/game/` is created here — framework-free per master §4.
- [ ] Verify: a scripted run completes goal 1 and goal 2 and shows the decoration.

### T11 — Freeze the P4.5 build

- [ ] Confirm all nine minimum-slice items are present (master §5), record the build hash and seed, and write the evidence.
- [ ] The P4.5 protocol must already be **written and frozen by P4 start** (master §2) — check it exists before freezing, not after.

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
- **No sim behaviour changes beyond Q1 and Q6.** Anything else that seems to need one is a finding to report, not a fix to make here.

## 6. Carried in from P3

| Item | Action |
|---|---|
| `HUD_H = 148` | Settled in code **and** SPEC §11.5. If P4's layout changes the HUD's real height, change both — never one. |
| `ProofScreen` / `AtlasProof` dead | Cut during this phase's `application/` work. |
| Non-walk poses static; RGBA vs indexed PNG | **P6** — do not re-open. |
| `scene-mount.test.tsx` | The pattern for every React-mounting test in this phase. |
