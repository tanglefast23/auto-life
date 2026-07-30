# Auto Life P5 — Staged v1 Systems, Settings & Saves

> **Status:** IMPLEMENTATION IN PROGRESS. Joe approved the consolidated plan on
> 2026-07-30. T0 is complete and recorded in
> `docs/superpowers/evidence/P5.md`; Gate A is green and Milestone B is active.
>
> **Implementation contract:** work one checked task at a time. For behavior,
> first capture the intended failure, implement the smallest complete change,
> run the focused check green, then run the relevant wider checks. Never
> checkpoint a red tree. Git writes remain separately authorized.

**Goal:** turn P4's proven first-session slice into the complete, save-safe v1
home chapter that can be frozen for the already-approved P4.5 human playtest.

**Owned by this phase** (master §5): Goals 3–7; all six reusable wrinkle shapes,
the two v1 day modifiers, and their variants/storylets; blocked-object
deferral, Quick wash rerouting, and visitor behavior beyond the Day-1 package;
Practice levels and the Prepared Performer handoff; daily intentions;
identity-lite and visible preferences; the full journal and morning recap;
pause/settings/autonomy; three-layer persistence, three rotating saves,
migrations, and the Day-8 letter.

**Exit evidence** (master §5 and SPEC §§15–17):

- kill or close the exported app mid-activity, reopen it, and resume the exact
  activity phase with no hidden-time catch-up;
- Goals 1–6 are completable by their exact deliberate actions and sampling
  boundaries; Goal 7 obeys the letter contract;
- the existing scripted-player replay is extended through a full week and
  proves Practice pacing, all eight canonical v1 wrinkle mechanics/reactive-band
  exposure, Goal 6, suppression, Undo, and P5's remaining adjacency assertion;
- authored strings have current Humanizer and `writing.md` review records;
- the complete P4 interaction/browser matrix still passes;
- a post-P5 build, seed, browser, viewport, engine version, and manifest hash
  are frozen for P4.5.

**Current implementation baseline:** committed P4 is `p4-queue-ui` at `ad347a4`
(`feat(P4): ship queue UI and first-session slice`, engine v6). The current
post-audit working tree is engine v7: travel-stop anchor consumption,
PINNED-reactive deduplication, cross-registry/fixed-point content validation,
and a visible parked-state failure surface. Its full gate was green: content
and writing validation, deterministic atlas, strict TypeScript, **56 Jest
suites / 431 tests / 2 snapshots**, and exported web. T0 records the exact
implementation-start tree before P5 changes it.

---

## 0. Definition of Ready

Checked against the current tree, not inherited from an earlier phase.

| # | Check | Current result |
|---|---|---|
| 1 | Prior phase and evidence | P4 is complete at `ad347a4`; the current engine-v7 working tree contains the verified post-P4 dual-audit stabilization and must be recorded as the exact P5 start baseline before implementation. |
| 2 | Repository inspected | `sim/` already owns minute mechanics and Practice scoring; `game/` owns the P4 session envelope; `application/` composes the top-level tick; the P0 `persistence/kv` adapter is present but not wired to a career. |
| 3 | Owned clauses mapped | §4 maps every P5-owned contract to a task and check. |
| 4 | Dependency assumptions | No new UI/state dependency is planned. Continue with React Native `StyleSheet`, Zustand, Zod, Jest, and the existing KV adapter. P5 creates a silent audio-bus interface; `expo-audio` and actual assets stay P6-owned. |
| 5 | Determinism/version effect | P5 changes planner behavior, deals seeded wrinkles, adds Goal 6's total-order tie-break, and changes serialized state. The planned target is engine v8 from the current v7 baseline. The literal and canonical career-payload goldens change together at T2, the first affected checkpoint; they are not deferred to the end of the phase. |
| 6 | Cut-line effect | The P4 minimum slice and minimum forecast UI cannot regress. Daily intentions remain the first approved cut only with the SPEC's paired removal of Goal 5 and its toggle, changing the P5 goal gate to Goals 1–4 and 6. Text-variant count and decoration variety follow. No cut or exit-gate rewrite is silent. |
| 7 | Writing gate | The `humanizer` skill is installed. Before P5 player-facing prose starts, T1 closes the current validator hole that lets a brand-new unregistered string file escape review. |
| 8 | Plan audit | Both external plan audits and the local repository/flow passes are incorporated. Their disagreements are resolved explicitly in §2; Joe's approval of the consolidated defaults remains the gate. |
| 9 | Implementation-start check | Immediately before T0 code, rerun `npm run verify` on the exact implementation-start tree and record the result. |
| 10 | Mid-phase safety gate | P5 is one master phase with two mandatory internal milestones. Week/content implementation cannot begin until the save-safe spine is green and its schema is frozen. |

---

## 1. Required execution gates

P5 remains one phase in the master plan, but it is not one uninterrupted
100-checkbox cliff. Task labels remain stable for traceability; implementation
follows this order:

1. **Milestone A — save-safe spine:** T0 → T1 → T2 → T3 → T4 → T10 → T12.
2. **Gate A:** migrate both v6 and v7 fixtures, resume an exact P4
   mid-activity state, fall back from a corrupt newest generation, prove the
   three settings layers and New Game fence, reject a second live writer, run
   `npm run verify`, and review the engine-v8 canonical payload diffs.
3. **Milestone B — complete week:** T5 → T0A → T6 → T7 → T8 → T9 → T11 →
   T13 → T14. T0A executes immediately before T6, once the persisted data
   shapes are known.

T2 freezes the complete P5 envelope with empty/default values for later
systems. A later task that truly must alter the schema stops, adds a migration,
and reruns both legacy fixtures plus current round-trips before continuing.

---

## 2. Consolidated decisions for Joe's feedback

These are the places where the specifications do not fully determine an
implementation. The defaults below reconcile both audits rather than counting
votes. Where reviewers disagreed, the decided SPEC and deterministic safety
win. Joe can still change a product ruling before T0.

### Q1 — What does “reveal two rolled preferences” mean?

SPEC §9.1 says creation reveals **two** rolled preferences, while §9.2 lists
four dimensions: workout, chronotype, food mood, and idle behavior. Showing
only two while secretly applying all four would violate “never hidden
modifiers.”

**Consolidated ruling:** preserve §9.1's decided reveal of two. Chronotype is
always one active category and rolls early bird or night owl; `baseline`
becomes migration/test-only. Draw the second active category from workout,
food mood, and idle without replacement. Show both values during creation and
everywhere they matter. The other two dimensions produce no preference tag,
bonus, happy bubble, or grumble:

- inactive workout uses the stable default activity without calling it a
  preference or applying a preference bias;
- inactive food mood uses today's planner rules;
- inactive idle uses the ordinary couch/wander pool.

Until a second authored food variant exists, food mood is flavor only. It must
not silently change the exact Meal/Snack thresholds. Likewise, “Practice focus
suggests and protects a block” means a player-accepted suggestion; Practice
remains player-only and is never silently auto-scheduled.

The audit alternative to roll and show all four is not adopted because it
overrides the explicit two-preference decision and expands the first-session
surface. Do not roll four and hide two.

### Q2 — Where do the five deterministic PRNG streams live?

`SimState` currently stores all five streams, but no simulation mechanic
consumes them yet. P5's wrinkle and storylet selection belongs to `game/`, and
letting `game/` mutate `SimState.prng` would blur the locked ring ownership just
as persistence starts depending on it.

**Recommendation:** introduce one versioned `CareerState` envelope owned by the
application composition root:

```text
CareerState
  sim: SimState
  game: SessionState
  identity: IdentityState
  prng: PrngSnapshot
```

Move the unchanged five-stream snapshot from `SimState` into that envelope via
the v6→v8 and v7→v8 fixtures. `game/` consumes `wrinkles`, `storylets`, and
`cosmetic`; future chapters retain their named streams. The forecaster receives
only already-announced rules/effects and never reads or advances undealt draws.
The scripted golden hashes the canonical `CareerState.payload`; T2 proves the
five stream values are byte-identical across relocation rather than treating a
new key path as a behavioral change.

### Q3 — How do intentions, autonomy, and active wrinkles reach `sim/`?

They are game/career choices, but they alter planner and activity mechanics.
Reading Zustand or global preferences from `sim/` would break headless replay;
duplicating the same truth in both `SessionState` and `SimState` creates drift.

**Recommendation:** derive a serializable, immutable `SimRules` value from
career/game state at each boundary and pass it explicitly to both `step()` and
`forecast()`. It contains only currently knowable mechanical truth:

- autonomy mode;
- today's selected intention and resolved conditional effects;
- announced object blocks, activity slowdowns, availability gates, anchor
  overrides, and wake modifiers.

Derive it once per boundary and pass that same readonly value to live step and
forecast. Existing tests use a frozen `DEFAULT_SIM_RULES`. The forecast cache
signature includes the rules revision, and the canonical golden records the
derived rule key. Changing the derivation is engine behavior and requires an
`ENGINE_VERSION` decision. No UI or prose enters the object.

### Q4 — What can “finish the day” mean for an unmigratable save?

SPEC §15 says an engine mismatch should migrate, or offer read-only “finish the
day” plus a fresh start. An unknown state that cannot be migrated also cannot be
safely simulated by the current engine; doing so would falsely claim replay
compatibility.

**Recommendation:** all known shipped versions must migrate. For corrupt or
unknown future versions, show the last readable snapshot in a read-only
recovery screen and offer a fresh start without overwriting the three stored
generations until the player confirms. Let the player copy/download the raw
local blob for a useful bug report. Change the SPEC wording from “finish the
day” to “view the last readable day.”

If Joe wants literal simulation, P5 must retain runnable older engine adapters;
that is a material scope expansion, not a persistence detail.

### Q5 — Does backgrounding override the five-second write coalescer?

SPEC §15 requires writes at background/close, but also says only major
decisions bypass the global five-second coalescing rule. A queue edit followed
by an immediate close can otherwise be lost.

**Recommendation:** make `visibilitychange`→hidden, `pagehide`, Return to Title,
and confirmed New Game durability barriers. A barrier reserves the newest
generation and invalidates older queued requests; on web it writes through the
synchronous localStorage driver instead of waiting behind the foreground
coalescer. Expose that as a typed KV/repository barrier capability rather than
importing a web driver into application code. Native flushes immediately but
remains best-effort. Persist accepted-but-not-yet-run boundary commands/actions
as the second guard. Keep the five-second rule for ordinary foreground churn;
do not depend on `beforeunload`.

### Q6 — What exactly does Goal 6's “Routine memory” remember?

“Prefer the relative order you've used most in the last 3 days” needs a sampling
rule before it can be deterministic.

**Consolidated ruling:** never put a pairwise “within ±0.1” predicate inside
`Array.sort`; it can form cycles and diverge between runtimes. For each
completed day, retain the first-completion position of each distinct reactive
activity type. For each type, compute a scalar `routineRank` across the last
three completed days, using a fixed absent-day sentinel.

The non-urgent reactive sort becomes a lexicographic tuple:

```text
scoreBucket desc → routineRank asc → enqueuedTick asc → stableCardId(code-unit) asc
```

`scoreBucket` is the integer `round(baseScore × 10)`, so “close enough for
Routine memory” is a true equivalence class instead of a non-transitive
pairwise relation. Routine rank applies only within one bucket, after Goal 6's
reward is banked, and never crosses a PINNED barrier or reorders an anchor
block. T0 amends §12's “within ±0.1” wording to this exact total order.

### Q7 — How far does the Day-8 letter open v2?

P5 owns the letter and Prepared Performer handoff; v2 owns Funds, jobs, career
GP, and the Week Plan.

**Recommendation:** P5 implements the complete v1 opening handoff from
`docs/02-funds-career.md`:

- Goal 6 + day ≥8, or Day 10 fallback, including past-Day-10 load;
- accept/decline, once-per-trigger behavior, and Sunday re-offer after decline;
- Goal 7 completion;
- on acceptance, freeze the current Practice level and its
  +20%/+50%/+100% first-five-workday bonus plus the next-weekday start date.

P5 does **not** create shifts, Funds, career GP, venues, or Week Plan UI.
Accepting records the promise, frozen bonus, and start date, then says plainly
that the story continues in the next chapter. Booking Mon–Fri commitments is
owned by v2 and is named as such in `docs/02-funds-career.md`; P5 must not
promise a playable Tuesday shift that does not exist.

### Q8 — How much of `QueueStrip.tsx` should P5 refactor?

The P4 audit confirmed that the file is 1,886 lines, but a broad rewrite would
put an already-proven interaction surface at risk.

**Recommendation:** execute T0A immediately before T6, after the career and
rules shapes settle. Extract only the existing card/menu/details/palette pieces
that the new state must touch. Preserve props and commands, require
byte-equivalent copy, and isolate the extraction from feature work. The T0A
diff may not edit tests or snapshots; if an expectation must change, revert the
extraction. No style-system migration or general cleanup.

### Q9 — What does the P5 audio setting control?

**Recommendation:** P5 introduces persistent master/music/SFX/mute values, the
`M` shortcut, and an `AudioBus` interface backed by a silent implementation.
The mute control still changes a visible icon/state and announces the result,
so it never appears broken before audio assets exist. P6 supplies `expo-audio`,
tracks, sounds, mixing, and orphan-audio QA.

---

## 3. Architecture and state ownership

### Three persistence layers

| Layer | Persists | Must not contain |
|---|---|---|
| App-global preferences | audio/mute, default speed, sleep auto-skip, intention-prompt preference, reduced motion override, HUD text scale, fractional scaling, non-color emphasis, screen-reader verbosity | career progress, daily intention, autonomy, open panels |
| Career | sim state, game/session state, identity and active preferences, autonomy, goal/journal/wrinkle history, PRNG streams, queued boundary commands/actions | wall-clock timers, open panels, current speed, Undo toast visibility |
| Session | current speed, open/focused panel, sleep-skip idle timer, interpolation accumulator, Undo toast visibility | anything needed to reproduce or resume the career |

Autonomy is career state because it changes deterministic planner behavior.
Default speed and display/accessibility/audio choices are app-global. A daily
intention and its progress are career state. Session-only state resets on every
launch without changing game outcomes.

Mechanical preference truth has one owner. `SimState` owns chronotype and the
workout activity selected by its planner; `IdentityState` owns name, pronouns,
appearance preset, the two active category IDs, and optional food/idle values
only when those categories are active. Identity never copies the
chronotype/workout values. The active-category set controls whether a stored
workout default is actually presented or treated as a preference.

### Stored career shape

The exact TypeScript names may adjust during T2, but the contract is:

```text
StoredCareer
  schemaVersion
  engineVersion
  generation
  savedAt             # metadata; excluded from replay digests
  payload
    rootSeed
    sim
    game
    identity
    prng
    pendingCommands
    pendingGameActions
```

- Validate the outer header before selecting a migration.
- Run schema migrations before current strict Zod schemas.
- Validate every referenced activity, object, goal, wrinkle, intention,
  decoration, and storylet ID against the injected `ContentRegistry`.
- A generation is valid only if the whole envelope and all referenced IDs pass.
- Replay/hash deterministic `payload`, never `savedAt` or generation metadata.
- Do not persist the five-second Undo toast. On load, expire a canonical removal
  receipt that has no restored pending Undo command.

### Save repository

Use three fixed generation keys. Each stored blob carries its own monotonic
generation number; loading reads all three, validates independently, and picks
the newest valid generation. This avoids a separate pointer becoming the
single corrupt write.

Writes are serialized. A slow older write may never overwrite a newer
generation. Tests use delayed and failing fake drivers, not only localStorage.
The web implementation continues using the P0 localStorage adapter; native
continues behind the same KV interface.

V1 has one active writer per career. Before each write and on the web `storage`
event, an instance compares the newest persisted generation with the generation
it loaded. If another tab advances it, the stale instance hard-pauses, stops
writing, and shows a reload/other-tab notice. Last-writer-wins is not accepted
for deterministic career data; tests run two repository instances against one
fake driver.

App-global preferences use their own versioned envelope and fall back to safe
defaults if malformed; a corrupt career can never erase or poison them. A
confirmed New Game must establish a durable reset fence before success is
reported, so no partial write or later corrupt-generation fallback can
resurrect the overwritten career.

### Deterministic boundary order

P4's order remains the base:

1. `game/` pre-boundary: apply day/minute triggers, make named PRNG draws,
   update announced game state, produce sim commands and `SimRules`;
2. `sim/`: apply queued commands and advance exactly one minute;
3. `game/` post-event: fold serializable player actions, command outcomes, and
   domain events plus a small immutable observation of the completed boundary
   (day/minute/bars/current activity) in their fixed order;
4. `application/`: compose one immutable snapshot, publish it, and issue a
   semantic save request when required.

Sleep-skip runs this exact boundary repeatedly and only coalesces publication.
Save checkpoints are taken between complete boundaries, never from a
half-applied tick.

The engine-v7 fatal-loop behavior remains a separate safety boundary: an
escaped simulation invariant parks speed at zero and shows the existing alert.
Hydration, migration, and write failures route to explicit persistence states;
they do not masquerade as a simulation fault or construct a ticking loop.

---

## 4. Contract traceability

| Contract | Owner task | Proof |
|---|---|---|
| §7.4 blocked object, Quick wash, visitor behavior | T6 | one engine test per row; forecast why/chip; exported interaction |
| §7.5 undealt wrinkles stay hidden | T2, T6 | PRNG independence + forecaster non-consumption tests |
| §8 levels and Prepared Performer | T7, T11 | threshold/pacing tests; acceptance freezes bonus |
| §9.1 identity-lite and skip=randomize | T4 | first-launch flow, deterministic-seed tests, mounted/browser checks |
| §9.2 visible preferences and shifted clocks | T4, T5 | no-hidden-modifier tests; early/owl day traces |
| §9.3 five intentions | T5 | one planner/effect/bias-target test per row |
| §9.4 six reusable wrinkle shapes + availability/wake modifiers, variants, no-repeat, quiet days, exposure | T1, T6, T13 | eight-mechanic mapping; schema/content tests; seeded deck tests; scripted week |
| §9.4 storylets | T8 | separate stream, trigger-source, no-duplicate journal tests |
| §11.1 Practice level, wrinkle, goal surfaces | T7, T9 | mounted labels/state tests |
| §11.4 complete recap | T8, T9 | exact sampling/order tests; dismiss/expand/SR checks |
| §11.6 settings-backed accessibility | T10 | reduced motion, scale, non-color, verbosity tests |
| §11.7 pause/settings/three layers/New Game/Return to Title | T3, T10, T12 | every named settings row; mounted flows; persistence isolation; two-tab writer conflict |
| §11.8 `Esc`, `G`, `M`, existing bindings | T9, T10, T14 | pure mapper + exported keyboard matrix |
| §12 Goals 3–6 | T7 | explicit act, exact midnight/morning-check tests, and total-order Routine-memory properties |
| §12 Goal 7 / Day-8 letter | T11 | Goal6/day8, day10, late-load, decline/re-offer tests |
| §15 versioned saves, policy, rotations, fallback | T2, T3, T12, T14 | v6/v7 migrations; codec/repository races; second-writer stop; real hard-reload resume |
| §16.2 five independent streams | T2, T6, T8 | locked vectors and cross-stream non-interference |
| §16.3 P5 scripted replay/harness ownership | T13 | reviewed golden and exposure/pacing assertions |
| `writing.md` every P5 string | T1 and each authored batch | discovered-file gate, Humanizer record, hashes/IDs/checklist |
| Master: preserve P4 slice and freeze P4.5 candidate | T14 | full P4 matrix + post-P5 build record |

---

## 5. Implementation tasks

### T0 — Approve rulings and capture the migration baseline

- [x] Joe reviews Q1–Q9; record every changed ruling here before code.
- [x] Re-run `npm run verify` on the exact start tree.
- [x] Record package versions and confirm no new P5 dependency.
- [x] Amend normative text before behavior: SPEC §§9.1–9.2 for
  chronotype-plus-one; §9.4 for six reusable shapes plus availability/wake
  modifiers; §12 for Routine memory's total order; §15 for read-only recovery
  and durability barriers. Update `docs/02-funds-career.md` so commitments are
  explicitly v2-owned and an accepted P5 letter is terminal for this chapter.
- [x] Capture a deterministic synthetic engine-v6 compatibility fixture from
  `ad347a4` before changing state schemas. It contains a mid-activity state, P4
  goals, the Day-1 wrinkle state, queue provenance, a removal receipt, and all
  PRNG streams.
- [x] Capture a second synthetic engine-v7 compatibility fixture from the exact
  post-audit implementation-start tree, including travel toward an anchor, a
  PINNED reactive, the cross-registry content gate, and current game/session
  state.
- [x] Record that P4 shipped no career disk persistence: these fixtures protect
  deterministic compatibility and migration code, but they are not presented
  as real player saves.
- [x] Record engine v8 as the P5 target. T2 changes the literal with the first
  schema/replay-affecting diff and reviews both canonical goldens immediately.
- [x] Confirm P4's nine-piece minimum slice, the four post-audit regression
  fixes, and the frozen P4.5 criteria remain unchanged.

**Checkpoint:** v6 and v7 fixtures restore under their source code; exact start
tree is green and recorded.

### T1 — Make all P5 content and writing reviewable

- [x] Extend content schemas and the single `ContentRegistry` for goals,
  intentions, wrinkles, storylets, identity presets/preferences, and their
  stable string IDs. Tunable data lives in JSON; rule evaluators stay typed code.
- [x] Extend engine v7's existing `validateContentRegistry`; preserve its
  activity/object/anchor/reactive/adjacency references and fixed-point
  `scaleDecay` integrality checks while adding duplicate IDs,
  reward/string references, invalid windows, unowned mechanics, impossible
  success conditions, and wrinkle variants without an explicit player action.
- [x] Replace the hard-coded writing-file list with discovery/registration of
  every shipped `content/strings/*.json` except the manifest itself.
- [x] Fail validation when any authored file has no review, two reviews, a
  stale hash, missing/extra string IDs, or an unrecorded rewrite.
- [x] Add content-only fixtures for all eight canonical v1 wrinkle entries
  mapped explicitly to six reusable shapes plus the availability-gate and
  wake-modifier primitives. Additional flavor variants stay data-only and
  follow the master cut line.

**Checkpoint:** a new unreviewed P5 string file fails for the right reason;
valid structural content passes without yet adding final prose.

### T2 — Introduce the career envelope and deterministic PRNG seam

- [x] Add strict schemas for `CareerState`, `IdentityState`, `AppPreferences`,
  the versioned app-preferences envelope, pending boundary work, and stored
  metadata.
- [x] Include the complete P5 fields now with empty/default values so later
  content tasks populate a frozen envelope instead of rewriting its migration.
- [x] Move the unchanged named PRNG snapshot to the career envelope per Q2.
  Prove both v6 and v7 fixtures migrate without replaying draw history.
- [x] Change `ENGINE_VERSION` 7→8 here. Hash the canonical
  `CareerState.payload`, prove the five stream values are unchanged modulo
  location, and review both golden diffs before the checkpoint.
- [x] Add pure game pre-boundary selection that consumes only its named stream.
  Storylet/cosmetic draws cannot shift wrinkle order.
- [x] Add readonly `SimRules` per Q3, derive it once per boundary, and pass the
  same object to `step()` and `forecast()`. Cache invalidation and the canonical
  golden include its deterministic revision/key.
- [x] Add the minimal immutable post-boundary `GameObservation` needed for
  midnight/morning-check goal samples and the full recap. `game/` never reaches
  into mutable loop state.
- [x] Add a calendar-day ledger distinct from wake-based recap presentation:
  Goal 3 samples midnight, Goal 6 samples wake+2h, and the recap appears at wake.
- [x] Extend reset/new-career construction and JSON round-trip tests. Test
  session-only fields are absent from the envelope.

**Checkpoint:** migrated v6 and v7 fixtures plus a new P5 career round-trip;
canonical engine-v8 diffs are reviewed; forecasting advances no live stream;
no framework import enters `sim/`/`game/`.

### T3 — Build the rotating repository and load-before-loop boot state

- [x] Extend `KvStore` only as needed for three fixed career generations and
  app-global preferences; keep web/native drivers behind the same interface.
- [x] Implement serialized generation writes and newest-valid fallback.
- [x] Enforce one active writer per career. A newer external generation or web
  `storage` event parks the stale tab before it can write and shows a
  reload/other-tab notice.
- [x] Run migrations before strict current parsing, then validate content IDs.
- [x] Preserve corrupt/unknown generations until the player confirms a fresh
  start. Show a plain fallback/recovery notice and a copy/download-raw-save
  diagnostic.
- [x] Give confirmed New Game a durable reset fence. Failure after any
  individual storage write cannot resurrect an older career or report a reset
  that was not durably established.
- [x] Add application boot states: loading preferences → loading career →
  title/resume/recovery/identity. Do not construct or tick `GameLoop` before
  that decision.
- [x] Make `GameLoop` constructible from a complete restored `CareerState`,
  including `SessionState`, pending commands/actions, and PRNG streams. Publish
  one restored snapshot before accepting elapsed time.
- [x] Keep reset meanings separate: `GameLoop.reset()` returns to its injected
  deterministic baseline; the P4.5 “reset test session” action creates a fresh
  frozen-seed career through the application/New Game fence, never the player's
  loaded checkpoint.
- [x] Test delayed writes, rejected writes, newest corruption, all-three
  corruption, unknown engine, two live repository instances, and a load that
  finishes while the tab is hidden.

**Checkpoint:** no frame can advance a fresh fixed-seed game before hydration;
fallback selects the exact newest valid generation; a restored mid-activity
career is the first published frame.

### T4 — Title, identity-lite, visible preferences, and New Game

- [x] Build title and 60-second identity flow: name, pronouns, four placeholder
  appearance presets, chronotype-plus-one preference reveal, and
  skip=randomize.
- [x] Inject a `SeedSource` at the application boundary. Production desktop web
  may use browser crypto once and then stores the root seed; tests and the P4.5
  reset use recorded seeds.
- [x] Construct the first `SimState` only after chronotype and the active
  preference categories are known. Day 1 starts at that career's wake target.
- [x] Keep preference truth single-owned: `sim` stores chronotype/workout
  mechanics; `identity` stores the other values and active category IDs, never
  duplicate mechanical values.
- [x] Show every active preference on relevant cards and in the journal; no
  inactive/hidden preference changes behavior.
- [x] Identity edits and confirmed New Game save immediately. New Game
  double-confirms, replaces only the career generations, and preserves global
  preferences.
- [x] Add the returning-player “Welcome back” notice with zero away-time ticks.

**Writing gate:** run the installed Humanizer skill over the complete identity,
title, preference, recovery, and resume string batch; record hashes, IDs,
rewrites, version/invocation, and the `writing.md` checklist.

**Checkpoint:** fresh, skipped, returning, corrupted, and New Game paths mount
cleanly; early/owl traces shift every owned clock rule together.

### T5 — Daily intentions and preference mechanics

- [x] Treat all five intentions and Goal 5 as approved scope. If Joe invokes
  the cut line, stop and amend the plan/SPEC/exit gate together before omitting
  any of them.
- [x] Implement all five intentions from §9.3, including planner behavior,
  conditional costs, bias-target observations, one selection per day, and
  Balanced default.
- [x] Practice focus may offer a one-action “add protected block” suggestion,
  but it cannot enqueue Practice until the player accepts it.
- [x] Turning off the morning prompt chooses no deliberate intention and cannot
  accidentally complete Goal 5. Goals/Journal still offers a manual picker.
- [x] Goal 5 observes only a favored activity completed after that day's
  deliberate selection; an earlier completion cannot satisfy a later choice.
- [x] Implement the approved visible preference behaviors. Respect/grumble is
  cosmetic and can never override a player command.
- [x] Feed announced policy through `SimRules`; forecaster and live sim must
  agree under every policy.

**Writing gate:** Humanizer + manifest for intention labels, preference tags,
bubbles, and autonomy explanations.

**Checkpoint:** one focused test per intention row; two representative full-day
traces; no clock or P4 queue regression.

### T0A — Make the two large P4 UI files safe to extend

- [x] Immediately before T6, extract only the existing
  card/menu/details/palette pieces from `QueueStrip.tsx` and the package/goal/
  recap sections from `FirstSessionUI.tsx` that T6–T9 must extend.
- [x] Keep public props, commands, focus behavior, strings, styling, and
  rendered states unchanged. Do not rename concepts or adopt a new styling
  system.
- [x] Keep the extraction in one isolated diff that changes no test file or
  snapshot. Require the existing mounted suites, pure presenter/drag tests, and
  a quick exported-browser smoke to pass.

**Checkpoint:** behavior-preserving extraction only. If a test/snapshot edit or
intentional visual/behavior diff appears necessary, revert and extend the
existing files narrowly instead.

### T6 — Seeded wrinkle deck: six shapes plus two day modifiers

- [x] Add Day-2+ seeded dealing, quiet days, the six-day no-repeat window,
  exactly-once firing, and saved deck state. Day 1 remains the P4 package.
- [x] Implement and assert the explicit eight-entry mapping: package/visitor,
  repair/block, favorite-show/timed-window, headache/slowdown,
  slept-great/free-time, burned-breakfast/forced-substitution,
  empty-fridge/availability-gate, and rough-night/wake-modifier.
- [x] Implement explicit wrinkle-vs-anchor precedence per entry.
- [x] Replace boolean card startability at the affected seam with an explicit
  `start | wait | reroute` decision. A blocked card defers in place with a
  structured reason/chip; only urgent Hygiene reroutes to reachable Quick wash.
  No wait silently becomes a deletion or reorder.
- [x] Slept-great applies a one-day sleep-end/wake override. It does not mutate
  the permanent chronotype target or shift every anchor/reactive window.
- [x] Preserve P4 visitor behavior: interrupt idle only; otherwise enter
  URGENT-front without crossing a PINNED barrier.
- [x] Store selected IDs/parameters, never resolved prose. Announced effects
  appear in forecasts; undealt effects never do.
- [x] Land new queue state through T0A's proven seam. Do not reopen a broad
  `QueueStrip` rewrite.

**Writing gate:** Humanizer + manifest for every wrinkle intro, why-line,
choice, success, failure, and outcome string.

**Checkpoint:** one exact test per mechanical entry, no-repeat/quiet-day
properties, pending-wrinkle save/resume, blocked-object/reroute browser smoke,
and PRNG non-interference.

### T7 — Practice levels, Goals 3–6, rewards, and Routine memory

- [x] Derive L0–L3 from existing cumulative ×100 points and
  `content/practice.json`. Do not rewrite scoring, curves, or multipliers.
- [x] Add level transitions and their visible rewards idempotently:
  Goal 3 decoration choice; Goal 4 idle variant; Goal 5 poster; Goal 6 Routine
  memory. Reloading on the completion boundary grants each reward once.
- [x] Replace hard-coded Goal 1–2 UI assumptions with data-backed goal
  definitions and typed condition evaluators, without creating a general
  expression language.
- [x] Add exact sampling events/state:
  - Goal 3: resolved wrinkle + zero URGENT at midnight;
  - Goal 4: Practice level crossing;
  - Goal 5: deliberate intention + completed bias target that day;
  - Goal 6: three consecutive wake+2h checks with ≥2 Practice sessions for
    each prior day, every bar ≥65, and zero URGENT.
- [x] A quiet day is not a resolved wrinkle and cannot satisfy Goal 3.
- [x] Below Full autonomy, Goals 3 and 6 remain visible but say they require
  Full routine; they cannot silently complete.
- [x] Implement Q6's scalar Routine-memory tuple with a three-day bounded
  history, fixed absent-day sentinel, integer score buckets, enqueue/stable-ID
  fallback, and no PINNED/anchor crossing.
- [x] Prove the comparator is antisymmetric and transitive, and that every
  permutation of the same input produces the same output ordering.
- [x] Surface Practice level in the HUD and Goals/Journal while preserving the
  permanent-HUD cap.
- [x] Add placeholder decoration placements/IDs for Goal 3 and Goal 5 rewards;
  final art remains P6.

**Writing gate:** Humanizer + manifest for goals, progress, rewards, level
labels, and Routine-memory explanation.

**Checkpoint:** boundary/reload tests per goal, exact three-day streak reset
cases, all reward idempotency, total-order properties, and exact score-bucket
boundary tests, including save/resume on a reward boundary.

### T8 — Journal, storylets, and complete recap truth

- [x] Extend the existing `SessionState` envelope in place. Do not add a
  parallel journal/recap store.
- [x] Journal entries have stable IDs, day/minute, source kind/source ID, and a
  reviewed string ID. They append exactly once across watched sleep,
  sleep-skip, reload, and migration.
- [x] Use only the `storylets` stream for flavor selection. Include at least one
  v1 trigger from each required source: wrinkle outcome, idle moment, and
  milestone.
- [x] Complete recap accumulation: end-of-day bars versus the prior day, meals,
  Practice points and counted sessions, wrinkle outcome, goal progress/rewards,
  missed routines, and one journal line.
- [x] Define and test event ordering at midnight, wake, and morning check. A
  completion sharing a boundary lands on exactly one day.
- [x] Preserve the P4 recap's non-modal dismiss/expand behavior and screen-reader
  announcement.

**Writing gate:** Humanizer + manifest for journal/storylet/recap batches.

**Checkpoint:** watched and skipped nights produce byte-identical deterministic
career payloads and the same visible recap; reload creates no duplicate entry.

### T9 — Complete Goals & Journal, intention, wrinkle, and recap UI

- [x] Replace `FirstSessionUI`'s Goal 1–2-only panel with the versioned Goals &
  Journal surface while retaining the P4 package and recap behavior.
- [x] Add goal filtering/status, explicit progress, locked/rewarded states,
  journal chronology, preference tags, intention picker, today's wrinkle, and
  decoration choices.
- [x] Keep routine play non-modal. Only player-opened panels and sanctioned
  life decisions block/pause.
- [x] `G` opens Goals & Journal from every ordinary game state; `Esc` closes the
  top panel first. Focus returns to the opener.
- [x] Meet hit-target, keyboard, non-hover, live-region, and non-color
  requirements. Player-visible copy comes only from reviewed content.

**Checkpoint:** mounted state matrix plus exported keyboard/mouse/touch smoke;
Goal 2 still requires deliberately opening changed Details.

### T10 — Pause menu, settings, global preferences, and silent audio bus

- [x] Implement Escape/gear pause menu: Resume, Settings, Goals & Journal, New
  Game, and Return to Title. Opening it hard-pauses without losing tick alpha.
- [x] Implement every §11.7 row and the three-layer ownership table in §3:
  Audio; Gameplay; Display; Accessibility; Controls; Sim; Data; About.
  Session speed is not persisted; default speed is.
- [x] Store autonomy as career state and implement Full routine, Essentials
  only, and Reactive only as exact planner policies. Prove they change only
  enqueueing: wake targets, sleep continuation, and night sleep-skip remain
  engine rules in every mode.
- [x] Combine OS reduced-motion preference with the player's persistent
  override; wire HUD scale, non-color emphasis, and screen-reader verbosity to
  live surfaces.
- [x] Persist and wire the fractional-scaling toggle for viewports that require
  fractional output. Phone visual acceptance remains v1.1; the setting itself
  is not silently deferred.
- [x] Route Sim → rename/pronouns through T4's identity owner. Route Data →
  Reset save through the same durable New Game fence and double confirmation.
- [x] Add the silent `AudioBus` and persistent master/music/SFX/mute values.
  Activate `M`, update a visible state/icon, and announce mute/unmute; do not
  install audio packages or add assets.
- [x] Return to Title saves first. A failed save reports plainly and does not
  pretend the transition is durable.
- [x] Display last-saved time, app version, `ENGINE_VERSION`, credits, and the
  fixed controls reference.

**Writing gate:** Humanizer + manifest for settings, confirmations, errors, and
accessibility descriptions.

**Checkpoint:** global settings survive career corruption/New Game; career and
session fields do not leak across layers; each autonomy policy has an exact
planner/clock test; all fixed shortcuts pass.

### T11 — Day-8 letter, Goal 7, and Prepared Performer handoff

- [x] Implement Q7's exact trigger, late-load catch-up, one-shot/re-offer
  behavior, and accept/decline actions.
- [x] The sanctioned letter modal pauses. Decline returns on Sunday; acceptance
  records the next weekday start and completes Goal 7.
- [x] If a letter becomes due during sleep-skip or hydration, stop before any
  later gameplay boundary, publish the restored/due state once, and show the
  decision exactly once.
- [x] Snapshot Practice level and the Prepared Performer percentage at
  acceptance. Later Practice gains never retroactively change the promised
  first-five-workday bonus; mastery points are never consumed.
- [x] Persist the dormant v2 handoff only. Do not create Funds, jobs, shifts,
  career GP, venues, or Week Plan UI.
- [x] Make acceptance visibly terminal in v1: record the promise and say the
  story continues in the next chapter. Do not imply that the saved start date
  will produce a playable shift in this build.

**Writing gate:** Humanizer + manifest for the letter, response copy, fallback,
and teaser.

**Checkpoint:** Goal6/day8, day10, past-day10 load, decline/Sunday, accept,
double-load, save/resume while the decision is due, and
changing-Practice-after-acceptance tests.

### T12 — Wire the complete save policy and prove exact resume

- [x] Emit semantic save reasons from accepted outcomes/events/actions, never
  by diffing UI snapshots.
- [x] Implement activity-completion, queue-edit 500 ms trailing debounce, day
  boundary, `visibilitychange`→hidden, browser `pagehide`, major decision, and
  60-second periodic triggers with Q5's approved barrier rule.
- [x] Serialize writes and coalesce ordinary foreground snapshots to ≥5 s.
  Major decisions and approved durability barriers reserve the newest
  generation and obsolete older queued work. Web writes synchronously through
  the typed driver capability; native flushes immediately but is explicitly
  best-effort.
- [x] Save only complete boundary states, including pending deterministic
  commands/actions. Never persist an interpolation fraction or half-applied
  reducer.
- [x] On resume, use app-global default speed, clear session-only presentation,
  expire inaccessible removal receipts, and publish one restored snapshot
  before ticking.
- [x] Add delayed/failing-driver race tests and real exported-browser cases:
  queue edit then background, mid-Shower hard reload, mid-travel hard reload,
  second-tab conflict, corrupt-newest fallback, and no hidden-time catch-up.
  T6, T7, and T11 extend this same matrix for their persisted boundary states.

**Checkpoint:** exact deterministic payload after resumed completion equals an
uninterrupted control run; P0's browser close/reopen persistence deferral is
closed for the real game.

### Gate A — Save-safe spine review

- [x] Re-run v6→v8 and v7→v8 migrations plus current P5 round-trips.
- [x] Prove exact mid-activity resume, corrupt-newest fallback, three-layer
  settings isolation, New Game non-resurrection, and second-writer parking.
- [x] Review the canonical career-payload golden diffs under engine v8.
- [x] Run `npm run verify` and record the midpoint result.
- [x] Freeze the P5 schema. Do not begin T5/T0A/T6 until this gate is green.

**Checkpoint:** one reviewable, save-safe fallback point exists before the
week/content systems land.

### T13 — Extend the scripted week, harness, and versioned goldens

- [x] Extend the existing P4 scripted-player replay; do not create a third
  golden format.
- [x] Cover a fixed week of queue edits/actions with Practice pacing and block
  bonus, all eight canonical wrinkle mechanics/reactive-band exposure, Goals
  3–6, suppression, Undo, identity/preferences, intentions, and Routine memory.
- [x] Assert P5's remaining adjacency pair (`it-sticks`) delivers a nonzero
  effect. Preserve P4's four per-pair assertions.
- [x] Keep the unattended seed benign and its fairness harness separate. New
  player-dependent assertions never weaken unattended bands.
- [x] Compare both final golden diffs to the documented behavioral changes and
  confirm the engine-v8 metadata introduced at T2. Do not postpone the version
  decision or tolerate an unchanged-version red digest until this task.
- [x] Re-run both legacy migration fixtures; any post-Gate-A schema drift is a
  failure until its migration and round-trip are explicit.
- [x] Run focused harnesses, `npm run verify`, and a clean generated-art check.

**Checkpoint:** exact replay hashes/snapshots reviewed; no unexplained diff;
full automated tree green.

### T14 — Exported-browser acceptance, evidence, and P4.5 freeze

- [x] Rerun P4's complete queue matrix on the post-P5 export: palette,
  menus/details, Stop, object/multi-activity choice, block editing, Undo, all
  shortcuts/panels, and drag threshold/reorder/cancel/overflow/removal across
  keyboard, mouse, and touch emulation.
- [x] Re-prove the engine-v7 audit regressions: travel-stop consumes its anchor,
  a PINNED reactive never spawns an AUTO duplicate, invalid cross-registry
  content cannot boot, and an escaped loop fault parks with a visible alert.
- [x] Run P5 flows in the exported app: title/identity/skip, preferences and
  chronotype, intention/autonomy, all eight wrinkle mechanics,
  blocked-object/Quick wash, Goals/Journal/recap, settings layers, second-tab
  conflict, New Game, Day-8 letter, hard reload, corruption fallback, and
  Return to Title.
- [x] Run the complete desktop flow at **1366×768 and 1024×768**; record which
  exact viewport becomes the frozen P4.5 environment.
- [x] Record empty console/page-error logs and any honest NOT VERIFIED limits.
  Desktop web is the gate; physical iPhone, final audio, final art, juice, and
  P6 performance are not silently added.
- [x] Create `docs/superpowers/evidence/P5.md` with exact commands/results,
  observed screenshots, browser/version/viewport, hashes, seed, state versions,
  migrations, golden review, remaining risks, and deferrals.
- [x] Freeze the post-P5 app bundle and complete-dist manifest hash plus seed,
  starting state, `ENGINE_VERSION`, browser, and screen size in the existing
  P4.5 protocol.
- [x] Stop. Joe runs the diagnostic session next; three fresh friends then run
  the unchanged counted protocol. P6 remains closed until P4.5 passes.

---

## 6. Required edge-case matrix

| Area | Cases that must be explicit |
|---|---|
| Boot | no save; valid save; newest corrupt; all corrupt; v6/v7 migrations; unknown engine; hidden tab during hydration; restored first frame; parked fatal loop |
| Identity | manual; skip/randomize; empty/long name validation; early/owl active outcome; baseline migration/test only; each second-category draw; same-seed repeatability |
| Persistence | mid-activity; mid-travel; pending command; write race; write failure; background inside debounce; pagehide; two live tabs; New Game failure after each write; old-career non-resurrection; corrupt fallback; raw-blob copy; malformed global preferences |
| Intentions | prompt on/off; no selection; each bias met/missed; change attempt after lock; wake/sleep skip |
| Autonomy | all three modes; mode change mid-day; sleep clock rules; Goals 3/6 availability |
| Wrinkles | quiet day; six-day no-repeat; six reusable shapes; availability gate; wake modifier; anchor collision; blocked target; unreachable Quick wash; visitor while idle/busy |
| Goals | exact sampling tick; quiet day; intention chosen after target; streak start/break/reset; reward reload idempotency; autonomy requirements; Goal7 during sleep-skip/late-load |
| Journal/recap | midnight/wake ordering; sleep-skip; no activity; multiple storylet candidates; duplicate prevention after reload |
| Accessibility | keyboard-only; focus return; reduced motion; HUD scale; non-color urgency; terse/verbose screen-reader output |
| P4 regression | travel-stop anchor consumption; PINNED-reactive deduplication; content-integrality gate; fatal-loop alert; pin barriers; wake conflict; remove/Undo; Goal2 observation; package choice; recap; deterministic reset |

---

## 7. Deliberately not P5

- Final sprites, animation/juice, lighting polish, audio assets/mixing, and
  desktop performance sign-off → **P6**.
- Physical iPhone/device acceptance and portrait/fractional mobile visual
  acceptance → **v1.1 mobile pass**. P5 still ships the persisted
  fractional-scaling setting and touch-capable web emulation.
- Funds, jobs, career GP, venues, commitments materialization, and Week Plan UI
  → **v2**. P5 stores only the visibly terminal letter handoff contract and
  never promises a playable shift in the v1 build.
- Key rebinding, cloud saves, multiple player-visible slots, offline
  simulation, and mods remain out of scope.
- No broad `QueueStrip`, Zustand, renderer, style-system, or persistence-driver
  rewrite. Refactor only the seam a checked P5 task needs.

---

## 8. P5 completion definition

P5 is complete only when:

1. Gate A produced a reviewed save-safe midpoint before week/content work;
2. every P5-owned SPEC/master row maps to green automated or recorded observed
   evidence;
3. the P4 minimum slice, post-audit regressions, and complete input matrix still
   pass;
4. a real exported build resumes exactly from a mid-activity hard reload,
   falls back from a corrupt newest generation, and parks a stale second tab;
5. Goals 1–6 are completable by deliberate actions and Goal 7 obeys the letter
   handoff contract; if Joe formally invokes the intention cut, Goal 5 and this
   gate change together to Goals 1–4 and 6;
6. all six reusable wrinkle shapes plus the availability and wake modifiers
   have deterministic exposure evidence;
7. both deterministic goldens and the balance harness have reviewed engine-v8
   outcomes, and v6/v7 migrations remain green;
8. every shipped authored string file has a current Humanizer/`writing.md`
   manifest record;
9. `docs/superpowers/evidence/P5.md` records the exact result without calling a
   local export deployed;
10. the post-P5 P4.5 environment fields are frozen.

Passing P5 does **not** pass P4.5. It produces the one build Joe and the three
fresh external testers will evaluate under the already-frozen protocol.
