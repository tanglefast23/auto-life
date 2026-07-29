# Auto Life — Design Spec v0.3.1

**Status:** Post-audit-round-2 revision, plus the one design fix round 3's plan audit surfaced (§0aa). This is the v1 contract; deep v2–v6 specs live in `docs/` (see §19).
**Date:** 2026-07-29 · **Owner:** Joe · **Author:** Claude (v0.1 → three audit rounds, each independently arithmetic-verified)
**Companion docs:** [design.md](design.md) — the binding visual bible all artwork must follow · [writing.md](writing.md) — the binding prose bible all authored text must pass · `docs/02`–`06` — per-version system specs.

**Decision labels:**
- **[CONFIRMED]** — decided by Joe (brief, answered questions, or mid-thread instruction).
- **[DECIDED]** — ruled by the audit-synthesis pass under Joe's "take agreed advice" delegation; veto anytime.
- **[DEFAULT]** — author default, override welcome.
- **[HYPOTHESIS]** — believed good, unproven until the P4.5 playtest (the sole fun gate — C12 skipped P−1).
- **[OPEN]** — unresolved, awaiting Joe's ruling (tracked in §22).

---

## 0aa. Changelog v0.3 → v0.3.1 (round 3 — plan audit)

Round 3 audited the *implementation plans*, not the design. One design defect surfaced from that angle and is fixed here; everything else it found landed in the plan files.

| Finding | Fix |
|---|---|
| **Brush→Sleep was a dead mechanic.** `+0.1 m_speed until the morning check` collided with two other rules: §6.1 pins Energy at exactly 100 at wake, and §6.7 caps `m_speed` at 1.5 — so the bonus was clamped away for nearly its whole window. Measured over the real wake block (Toilet+Brush+Shower+Breakfast, durations sampled at each start): **41 ticks without, 40 with — 1 game-minute per day.** Worse than a clean zero, because §6.7's "every bonus delivers a nonzero effect" assertion would have passed green on it, certifying a dead mechanic as alive. It was also the one bonus the routine granted automatically — the player's tutorial instance of the whole system. | **Minty-fresh** [CONFIRMED by Joe]: the first Practice session started before the morning check earns **+15% points** (§6.7). Uncapped, visible in a counter the player is accumulating, and it creates a real reason to schedule morning Practice against the wake block. Joins Well-fed and Shower→Practice as the third Practice output multiplier — one coherent theme (*clean, fed and rested makes you practise better*) instead of five unrelated rules. Verified +5%/day on a blocked day; §8's pacing bands hold unchanged. |
| The §6.7 coverage assertion still ran on the **unattended** golden | Moved to the **scripted-player** golden. With Minty-fresh now Practice-facing, only Workout→Meal fires unattended — the other four are all player-dependent (§6.7, §16.3). This is the same class of error round 2 split the goldens to fix; one instance survived. |
| "Bonuses never stack" was ambiguous about *different* bonuses | Clarified: a bonus never stacks with itself; different bonuses compound multiplicatively. The three Practice multipliers are deliberately not all earnable at once — §8 records the verified eat-first (≈119/day) vs shower-first (≈112/day) trade-off. |

**General rule added to §6.7:** before authoring any bonus, check the target quantity's value at the moment the bonus applies. If the design already guarantees it is at maximum, the bonus is decoration.

**Round-3 rulings (orchestration, 2026-07-29) — the P2 draft's six blocking questions, all recommendations accepted:** Q1 Practice scoring/curves/block bonus are P2's, visible integration P4's, levels/progression P5's (master §5 already reflects it) · Q2 each maximal AUTO run sorts independently (§7.4) · Q3 missed anchor = block not started by window close (§7.1) · Q4 an anchor fires at most once per day, deletion included (§7.1) · Q5 single-rest-card rule (§7.2) · Q6 §6.8's traces are pre-travel; P2 records travel-inclusive numbers before asserting (§6.8). Plus: **Practice points are integers ×100** (§8).

## 0a. Changelog v0.2 → v0.3 (audit round 2)

Both round-2 audits agreed the set is near-P−1-ready; their overlapping findings are adopted, conflicts ruled. Full rulings inline at the cited sections.

| Finding (agreement) | Fix |
|---|---|
| **Practice↔v2 handoff broken both ways** — L3 unreachable inside v1 at the old ceiling (Day 9.5), yet its +350 GP conversion would skip venue content past the 300-GP threshold | **Prepared Performer** conversion (first 5 workdays earn +20/50/100% GP by Practice level ≈ 1.0 passive-week / 0.5 engaged — can't skip anything), venue **debut requirement** before each promotion, mastery points never consumed, and a **consecutive-block practice curve** that makes L3 reachable by ~Day 6–8 *only* by protecting practice blocks — which is the v1 scheduling game (§8, docs/02) |
| **Systems tuned out of reach** ("margin vs exposure") — a player could finish v1 never seeing a Snack, Stretch, Nap, URGENT, or focus penalty | Wrinkle deck now guarantees weekly visits to each reactive band; wrinkles split into 6 mechanical shapes × unlocking text variants; quiet days allowed (§9.4) |
| **m = 1.0 accounting error** — docs computed budgets at neutral health while the design guarantees steady m_out ≈ 1.345 | All bands recomputed at the guaranteed multiplier; multi-version **currency harness** with income-relative price bands (docs/02 §11) |
| **Harness asserted player-dependent facts on the unattended run** | Split golden runs: unattended (fairness only) + **scripted-player** replay (adjacency coverage, practice pacing, Goal 6) (§16.3) |
| **Two planning horizons needed** (work shifts, invitations, dates can't live in a 12-card queue) | **Commitments / Week Plan** layer (§7.6) — dormant in v1, arrives with v2 work shifts; queue stays the only execution surface |
| Queue reserve (2 slots) can't hold a 4-card wake block | Routine blocks render as **one expandable card**; blocks don't count against the player's 10 (§7.4) |
| Intentions were a free +10% with a dominant pick | Reworked: planner preference + one conditional effect each, no universal buff (§9.3) |
| Nutrition's consequence shipped disabled | Replaced with **Well-fed**: Nutrition ≥70 → Practice/workout outputs +10% — harness-safe, visible (§6.5) |
| Chronotype didn't reach the clock rules | All time rules are offsets from `wakeTarget`/`bedTarget`; morning check = wake+2h (§9.2) |
| Settings lived inside the career save | Three persistence layers; accessibility reachable from title; major decisions bypass save coalescing; iOS "Return to Title" (§11.7, §15) |
| v3–v5 openings undefined | Every roadmap doc gains an **Opening & Catch-up** contract (docs/03–05) |
| Fixed-point remainders (5.0/h ÷ 60 isn't integer at ×100) | Bars stored **×6000** — every 2-decimal per-hour rate is integer per minute; golden replay asserts exact closure (§16.2) |
| PRNG streams too coarse; forecaster could advance real state | Five domain streams; forecaster clones state; forecast horizon/uncertainty rules (§7.5, §16.2) |
| Writing was the unmanaged top risk | **writing.md** — binding prose bible, same posture as design.md, gates P5 (§20) |
| Cut line didn't cut; iOS quietly inside v1 | v1 DoD is desktop-web; iPhone verification moves to a v1.1 mobile pass; real cut order stated (§17, §18) |
| HUD would accrete by v5 | Versioned HUD hierarchy: permanent set capped at Health · Funds · Connection · clock (§11.1) |
| Palette & frame counts inconsistent | Canonical: core 31 + character-only 26 = 57; v1 ≈ 48 frames; early art-risk spike added (design.md, §17) |
| **Art direction** (Joe, overriding both) | The generated week-plan concept art is **rejected**; the *idea* (two horizons) is kept. Art pivots to **simple HFM-style pixel art** — C8 revised, design.md rewritten |

Also adopted (single-audit, no conflict): Autonomy setting (Full / Essentials / Reactive-only) [HYPOTHESIS] · monthly rhythm beat (docs/02) · endings can end the run, NG+ carries the gallery (docs/05/06) · v5 ships 4 deep candidates · friend comfort tags · Tab freed for focus traversal (`Q` focuses the queue; shortcuts suppressed while typing).

## 0. Changelog v0.1 → v0.2 (audit synthesis)

Both audits were read in full; every arithmetic claim was independently re-verified by 5 checker agents before adoption. Where the audits **agreed**, the finding was adopted per Joe's instruction. Where they conflicted, a ruling is recorded. Where they contradicted Joe's brief, the change is flagged.

### Adopted — both audits agreed

| Finding | Fix in v0.2 |
|---|---|
| **"Optimal play in v1 is doing nothing"** — autopilot solves the game; free time has no sink; the health multiplier is inert | **Practice system** (§8): a spendable use of free time that feeds v2 directly; plus differentiated activity variants (§6.2), daily wrinkles (§9.4), lasting goal rewards (§12) |
| **Energy math broken** — urgent sleep fired ~20:36 daily (Day 1: ~19:00), before the 23:00 bedtime ever ran. Verified exact. | New rates: −5.0/h awake, +10.0/h asleep via the Sleep activity only; Day-1 Energy starts at 100 (verified load-bearing: 90 re-creates the bug at 22:00) (§6.1) |
| **Sleep double-restore ambiguity** — +12.5/h appeared in both the decay table and the activity table; a literal implementation restores +25/h | Single source of truth: passive Energy decay is 0 while asleep; the Sleep activity is the only writer (§6.1) |
| **Queue reordering was mechanically inert** — three linear systems commute; order changed almost nothing | Adjacency bonuses (§6.7), cap-waste surfaced on cards (§7.5), start-time forecasts (§7.5), wrinkle deadlines (§9.4) |
| **Bars were secretly one bar** — every sub-bar fed the same mean, same consequence | Per-bar distinct consequences (§6.5); Fitness renamed **Movement** |
| **Anchors as timestamps break** — late starts, cross-apartment walks, pinned cards | Anchors are now windows with targets and a missed-anchor policy (§7.1) |
| **v2 career screen: five doors, four locked** | v2 reframed as the **Musician chapter**; tracks are data from day one; the choice screen ships only when ≥3 tracks are playable (§19, docs/02) |
| **$20 groceries can't carry a money system** | v2 shop with real wants: instrument gate, one pulled-forward apartment upgrade, groceries, transport (§19, docs/02) |
| **Marriage+baby as the only ending is narrow** | Aspirations / endings gallery; family remains one rich branch (§19, docs/05) |
| **Build plan had no fun gate** | P−1 disposable fun prototype before scaffold; P4.5 external playtest gate; DoD gains game criteria (§17, §18) |
| Broken cross-references (§20/§18, §14.4/§13.2, C4→§10.4) | Renumbered throughout; verified by a doc-check agent pass |

### Adopted — single-audit findings verified true

| Finding (source) | Fix |
|---|---|
| Lunch anchor never fired — gate `<70` vs post-breakfast ~82 at 13:00; real net was −26 on 2-meal days, oscillating 2–3 meals with the snack firing every ~3 days (Audit 1; trace verified) | Meal gates raised to `<90`; verified stable 3-meal steady state, daily min ≈50 pre-breakfast, ~9/day dinner cap-waste (§7.1, §6.8) |
| Emergency priority backwards — at all-bars-0 the sim **exercised first** (Workout 100 > Shower 90 > food > Sleep 65; exact) (Audit 2) | Two-stage priority with common urgent normalization (§7.3). Verifier also caught that the audit's own fix failed at Energy 14/Nutrition 14 — corrected formula adopted |
| Reactive workout rule: audit called it dead code — **refuted**; simulation showed it fired daily for 10 days while the anchor never fired. Truth was worse than claimed | Reactive tier rebuilt as strictly-lower safety nets: Stretch at Movement <35 (19-pt margin below the verified steady-state trough of 54) (§7.2) |
| Energy cliff at 15/16 — above the urgent line, rest didn't exist as an option (Audit 2 verifier finding) | Reactive **Nap** at Energy <30 gives Energy a presence outside emergencies (§6.2, §7.2) |
| Urgency inflation — a healthy sim could show red-pulsing "emergency workout" (verifier finding) | Movement can never be URGENT (§7.2) |
| Career grind: 11.7 real hours at 4× to Musician L5 (~20 h under the incremental misreading) — verified exact (Audit 2) | Cumulative thresholds 100/300/800/1600, workday GP 25×m, practice 14×m; verified: engaged ≈4.7 game-weeks (~1.7 h at 4×), passive ≈2.0× engaged, head start saves ≥1 week (§8, docs/02) |
| Sleep is 4 real minutes of dead air nightly (Audit 1) | Auto sleep-skip + morning recap card (§11.4) |
| Goal "Health ≥85 for 3 days" undefined and passively completable (Audit 2) | Goal chain rebuilt around deliberate action with explicit sampling rules (§12) |
| Viewport doesn't fit — 2× (1536×896) fails MacBook Air 13 and 1366×768 on width alone; phones need fractional scale (verified; the 24×13 "fix" was refuted — keeps 24×14) | Responsive scaling policy: UI-first reservation, DPR-aware half-integer steps, sharp-bilinear on phones, landscape-first (§11.5) |
| Walking untracked: ~30–50 game-min/day (audit's 50–70 corrected by verifier) | Transit line added to the balance table (§6.8) |
| Autosave every game-hour = every 7.5 real s at 4× (exact) | Event-driven save policy with coalescing (§15) |
| Queue edge cases undefined (undo, duplicates, stop-suppression, caps, cross-midnight, pinned segments…) (Audit 2) | Normative queue rules table (§7.4) |
| Planner intent invisible (Audit 2) | "Why" lines on AUTO cards + conflict warnings, powered by deterministic lookahead (§7.5) |
| Drag-only queue editing fails accessibility (Audit 2) | Full keyboard/button/screen-reader alternatives (§11.6, §11.8) |
| Default "Sam" until v6 blocks attachment (Audit 2) | Identity-lite at first run (§9.1) |
| Character has no inner life (Audit 2) | Visible preferences (§9.2), optional daily intention (§9.3), storylets (§9.4) |
| Balance assertions lacked measurement definitions (Audit 2) | Every band states its sampling rule (§6.8, §16.3) |
| Relational DB in v2 premature; integer bars + split PRNG streams for determinism; prove web export in P0 (Audit 2) | All adopted (§3, §15, §16.2, §17 P0) |

### Conflicts — rulings

| Conflict | Ruling |
|---|---|
| Audio: keep v1 silent (Audit 1 + old D4) vs minimal ambient/SFX (Audit 2) | **Overtaken by Joe: SFX and music are in** [CONFIRMED]. §14 defines the scope; settings get audio sliders (§11.7) |
| v2 careers: all five selectable as data variants (Audit 1) vs don't show a choice until ≥2 real (Audit 2) | Chapter framing now (honors Joe's Musician-only v2 scope) **plus** Audit 1's tracks-as-data architecture so later tracks are cheap [DECIDED] |
| O1 work-time freeze | Audit 1 endorsed the v0.1 recommendation; adopted: **bars decay during work; job performance locks at clock-in** [DECIDED] |

### Overrides of the original brief — flagged for veto

1. **Bars decay during work** (brief: freeze). Reason: a freeze makes weekdays mathematically easier than weekends and hollows the evening routine. Performance still locks at clock-in, which was the intent. [DECIDED]
2. **v2 job letter is a Musician chapter opening, not a 5-way career menu** (brief: "choose your job track"). The 5-way choice arrives when ≥3 tracks are playable. [DECIDED]
3. **"Who keeps working" after marriage is a player decision card** (brief: auto-resolve by income). It's one of the biggest life moments in the game; income data is shown on the card. [DECIDED]
4. **Fitness renamed Movement** (a 2-day-decay bar measures recent activity, not fitness; long-term fitness is the v4 Gym hobby). [DECIDED]
5. **v3 "reading refills Social for introverts" → replaced by the Connection + social-battery split** (O3 ruled by Joe 2026-07-29). Reading recharges the introvert; connection still needs people, at introvert-friendly intensity. [CONFIRMED C11]

### Kept exactly as v0.1 — praised by both audits

Time-cost-not-amount-cost performance model · 2-hour suppression window · PINNED cards untouchable · deterministic sim ring + seeded PRNG + golden replays + balance harness · placeholder-first art rule · layered paper-doll character from day 1 · fail-soft everything.

---

## 1. Vision

**Auto Life** is an autonomous life sim: your character lives their life by themselves — sleeping, eating, moving, practicing, working, dating — and you are the gentle hand on the wheel. You never drive directly; you steer by editing the **plan queue**, choosing the big life decisions, and spending what the sim earns and learns.

The core loop the whole game is built to deliver:

> **See the sim's intentions → spot an approaching conflict → choose a priority or trade-off → watch the sim react → see a visible consequence → bank a lasting change.**

**Pillars**

1. **Autonomy you steer.** The sim always has a sensible, *explained* plan. Player verbs: reorder, insert, remove, stop. Never puppet.
2. **Numbers you can feel.** Every bar maps to a distinct visible behavior (§6.5). No *consequential* state is invisible — qualitative faces (like v3's battery) are fine, but exact numbers are always available in details.
3. **Time is the currency.** Health buys speed; speed buys free hours; free hours become Practice, wrinkles handled, and later gigs, friends, and dates.
4. **Cozy, readable pixel world.** Warm interiors in simple, chunky HFM-style pixel art (Mystia's Izakaya is mood/layout reference only — C8 revised), one screen per scene, everything legible at a glance. All art obeys [design.md](design.md).
5. **A person, not a dashboard.** Preferences, storylets, and a home that accumulates history make the sim someone you *know*.

**Working title:** "Auto Life" (naming candidates parked in O5).

---

## 2. Confirmed decisions

| # | Decision | Value |
|---|---|---|
| C1 | Offline | **Pause when closed.** Deterministic core keeps fast-forward possible later. |
| C2 | Control | **Queue only** — reorder / insert / remove / stop. Object-click is a queue shortcut (§7.4). |
| C3 | Pacing | **1 game-min = 0.5 real s at 1×** → day ≈ 12 real min. Speeds: pause / 1× / 2× / 4×. |
| C4 | Direction | **Goal cards** (§12). |
| C5 | Health 0 | No death; everything is slow, never blocked (§6.6). |
| C6 | Ladder | v1 Health → v2 Funds/Career → v3 Connection → v4 Growth → v5 Partner → v6 Creation-expanded. |
| C11 | v3 social model | **Connection + social-battery split** (O3 ruled 2026-07-29): reading recharges an introvert's battery; only people fill Connection. Weekday-evening light social (O3b) ships with it — verifier-required for friend reachability. |
| C12 | Fun gate | **P−1 skipped, non-negotiable** (Joe, 2026-07-29): queue-steering is known-fun from experience; build goes straight to P0. P4.5 is the only external fun gate. The `humanizer` skill pass is a mandatory build step for all authored strings (writing.md §5). |
| C7 | Platforms | Desktop web first, iPhone later, one Expo codebase. |
| C8 | Art | **Revised by Joe (round 2): simple pixel art in Hero Football Manager's chunky style**, warm home palette, per [design.md](design.md). Mystia's Izakaya is a mood/layout reference only; the AI-generated week-plan concept image is explicitly *not* the direction. |
| C9 | Audio | **SFX + music ship in v1** (§14), with sliders in Settings. |
| C10 | Meta UI | Escape opens the pause/settings menu (§11.7); keyboard bindings per §11.8. |

---

## 3. Platform & stack

Mirrors **Hero Football Manager** (verified in-repo):

| Layer | Choice |
|---|---|
| Shell | Expo (managed) + TypeScript strict; EAS + existing `testflight` workflow for iOS |
| Desktop | react-native-web export → Vercel |
| World renderer | @shopify/react-native-skia — **Atlas API from day one** |
| Animation | react-native-reanimated v4 + worklets (60 fps interpolation off the JS thread) |
| UI state | zustand (UI mirrors sim snapshots; sim owns truth) |
| Validation | zod on all `content/` JSON at build time |
| Saves | expo-sqlite, versioned JSON snapshots (§15). Relational tables deferred until a feature needs queries [DECIDED] |
| Styling | NativeWind; Silkscreen pixel font (art pass may substitute a friendlier pixel face — design.md owns this) |
| Audio | expo-audio (§14) |

Approaches considered and rejected: Phaser+Capacitor (abandons the HFM toolchain and conventions), Godot (strongest engine, worst fit for the existing pipeline and TestFlight tooling).

---

## 4. Game structure

- **Top-level trio:** **Health** (0–100 composite, v1) · **Funds** (unbounded wallet, v2 — *not* a 0–100 bar) · **Connection** (0–100, v3 — the split model, O3 ruled by Joe 2026-07-29: people fill Connection, the hidden social battery sets each personality's rhythm; docs/03 owns the system; "Social" survives only in brief quotes). They never feed each other; they feed *outcomes*.
- **Health** = equal-weighted mean of **Energy, Nutrition, Movement, Hygiene** (weights are data). The brief's "if all 3 are at 0" is treated as a typo for these 4 — confirm in O4.
- **Practice** (v1) is a *counter*, not a bar: it only rises, and converts into career value at v2 (§8).
- **The queue is the spine.** Home care, job tasks, dates, childcare — all flow through one queue system.
- **Calendar:** 7-day week, Monday start. v1 = the "settling-in week+". Day 8 letter opens v2's chapter (goal-gated, day-10 hard fallback).

---

## 5. Time system

| Constant | Value |
|---|---|
| Sim tick | 1 game-minute |
| Real time per tick | 0.5 s at 1× · 0.25 s at 2× · 0.125 s at 4× |
| Day / week | 1440 ticks ≈ 12 real min at 1× · week ≈ 84 min |
| Clock display | `Day 3 · Wed · 14:32` |
| New game | Day 1 (Mon) 07:00 |

- Walking consumes ticks; speed scales with Movement (§6.5). The renderer interpolates ticks to 60 fps.
- Sleep auto-skips (§11.4).
- Background/close → save + hard pause (C1). Resume shows a "Welcome back" toast; no time passes while away.

---

## 6. Needs, Health & activities

Bars are scaled integers (value **×6000** internally — §16.2), displayed 0–100. Clamped [0, 100].

### 6.1 Passive rates (per game-hour)

| Bar | Awake | Asleep | Full→empty if ignored |
|---|---|---|---|
| Energy | −5.0 | **0** (no passive restore — Sleep/Nap are the sole writers while running) | 20 h awake |
| Nutrition | −4.0 | −4.0 | 25 h |
| Hygiene | −3.0 | −1.0 | ~1.8 days |
| Movement | −2.0 | −2.0 | ~2.1 days |

**Single-commit rule:** leaf systems emit named signed deltas; one engine reducer sums and clamps each bar once per tick. There is no passive Energy restore. During Sleep, and during the first effective Nap of the day, passive Energy decay is suppressed and the activity supplies the only Energy delta — stated gains are therefore **net**. Other passive bars continue. This kills the v0.1 double-restore ambiguity without forbidding a Meal fill and passive Nutrition decay from contributing to the same tick. Verified closure: 16 h awake × 5 = −80; 8 h sleep × 10 = +80; bedtime Energy 20, wake 100, exactly. (The bedtime Brush can start Sleep as early as ~22:35; the 100-cap absorbs the ≤4 extra points.)

**Day-1 start:** Energy **100**, Nutrition 70, Hygiene 70, Movement 60 → Health 75. Energy 100 is load-bearing (verified: starting at 90 fires urgent sleep at 22:00 on Day 1, re-creating the bug this revision fixes). The tutorial's "watch it get fixed" beat lives in the other three bars.

### 6.2 Activities — every need has a quick and a strong answer

All effects preview on cards before you commit. `pref` = planner respects character preference (§9.2).

| Activity | Object · Room | Base min | Effect | Cross-effect | Notes |
|---|---|---|---|---|---|
| Sleep | Bed · Bedroom | window 23:00→07:00 | +10 Energy/h | — | §7.1 window rules; restore rate never scaled (§6.6) |
| **Nap** | Couch · Living | 45 | +10 Energy (net; first nap of the day — later naps restore 0, use ordinary awake Energy decay, and are flavor only) | delays bedtime pressure | reactive at Energy <30; startable at all (incl. player inserts) only below Energy 50, 08:00–20:00 |
| Meal | Microwave · Kitchen | 30 | +35 Nutrition | — | phased: prep 40% (no fill) → eat 60% (fills) §6.3 |
| Snack | Fridge · Kitchen | 10 | +10 Nutrition | — | reactive backstop only |
| Weights | Bench · Living | 60 | +50 Movement | **−5 Nutrition** ("works up an appetite") | `pref` |
| Treadmill | Treadmill · Living | 60 | +50 Movement | **−5 Hygiene** (sweaty) | `pref`; teaches the run→shower adjacency |
| **Stretch** | Rug · Living | 15 | +8 Movement | — | reactive safety net at Movement <35 |
| Shower | Shower · Bathroom | 20 | +40 Hygiene | — | |
| **Quick wash** | Sink · Bathroom | 8 | +15 Hygiene | — | the "fit it around a commitment" option |
| Brush teeth | Sink · Bathroom | 5 | +10 Hygiene | — | auto after wake & before bed |
| Use toilet | Toilet · Bathroom | 3 | — (flavor) | — | part of the wake block |
| **Practice** | Guitar · Living | 60 | +25 Practice pts × m_out | — | **never auto-scheduled** — §8 |
| Sit / idle | Couch · Living | — | — | — | fallback; idle behaviors & storylet triggers |

Cross-effect budget check: Weights day → Nutrition needs 101/day vs 105 intake ✓. Treadmill day → Hygiene needs 61/day vs 60 restore (−1/day drift, absorbed by an eventual reactive shower) ✓. Energy is never a cross-effect cost — its daily closure is exact, so any recurring cost would ratchet into nightly urgent sleep (verified failure mode).

**Quick-option invariant** (harness-checked): quick options exist to fit gaps, never to optimize — each is rate-inferior to its strong sibling (Stretch 32/h vs workouts 50/h; Snack vs Meal; Quick wash vs Shower), and Nap, the lone rate-exception, is hard-bounded to one effective use per day. A verifier proved the old Stretch (+12) and Nap (+15, unbounded) were strictly dominant strategies; these numbers are the patch.

### 6.3 Activity phases

Activities may define phases; only marked phases fill the bar. v1 uses this once: **Meal = prep 12 min (no fill) + eat 18 min (fills)** — stopping a meal at the microwave no longer grants half the food, and the eating animation matches the numbers. All other v1 activities are single-phase continuous fill, pro-rata on early stop.

### 6.4 Health

`Health = mean(Energy, Nutrition, Movement, Hygiene)`, recomputed per tick, weights in `content/rates.json`. All four at 0 → 0; all four at 100 → 100 (brief-exact). The v0.1 "min-clamp" reserve idea is **dropped** — per-bar consequences (§6.5) solve hidden-zero structurally.

### 6.5 Per-bar consequences — no two bars feel alike

| Bar | Distinct consequence |
|---|---|
| **Energy** | **Action speed.** `m_speed = 0.5 + Energy/100`, sampled at activity start; duration = base / m_speed. Sleep exempt. A tired sim visibly drags. |
| **Movement** | **Walk speed.** `tiles/min = 3 × (0.75 + Movement/200)` → 2.25–3.75. A stiff sim shuffles between rooms; a limber one zips. |
| **Nutrition** | **Well-fed.** Nutrition ≥70 at activity start: Practice and workout *outputs* +10% for that activity ("fed and focused"). The start sample keeps previews stable. Bar-state, cap-proof, zero interaction with decay math — replaces the round-1 metabolic buffer, which shipped disabled and therefore wasn't a consequence at all (round-2 audit agreement). The buffer survives only as dormant data. |
| **Hygiene** | **Focus.** Practice earns −25% below 40 (grumpy bubbles); the Shower→Practice adjacency (§6.7) gives +20%. Later: tips (v2), attraction (v5). |

### 6.6 Performance: low health costs time, never effectiveness

- `m_out = 0.5 + Health/100` (0.5–1.5, exactly 1.0 at Health 50). It multiplies **performance outputs**: Practice points now; job pay, gig points (sampled at clock-in), and Love gains later. **Scope exception [DECIDED round 2]: Connection gains scale by battery state only, never m_out** — friendship isn't a performance, and a round-2 verifier showed the stacked multipliers pinned Connection at 100 permanently (docs/03).
- Durations scale by `m_speed` (Energy, §6.5); restore *amounts per completion never scale*. Low bars cost time, not recovery power — structurally no death spiral. Sleep's restore rate is scaled by neither.
- Sampling rule [DECIDED]: both multipliers sample at **activity start** (stable card previews; matches v2 clock-in).

### 6.7 Adjacency bonuses — order becomes a small puzzle

One data file (`content/adjacency.json`); bonus chips render *between* queue cards, so the system teaches itself.

| Sequence (gap limit) | Bonus |
|---|---|
| Workout → Shower (≤30 min) | that shower runs at **half duration** ("already warmed up") |
| Workout → Meal (≤60 min) | Movement decays ×0.5 for 12 h ("it sticks") |
| Meal → Workout (≤30 min) | −10 Movement (cramp) |
| Brush → Sleep (immediate) | **Minty-fresh:** the **first** Practice session started before the morning check earns **+15% points** |
| Shower → Practice (≤60 min) | +20% Practice points ("fresh mind") |

Bonuses are deliberately **cap-proof** — time, rate, and *points* effects, never instant bar fill, and never an addend to a quantity the design already pins at its maximum. (A verifier showed the v0.2-draft instant-fill versions were clamp-wasted in the exact steady state §6.8 verifies. Round 3 caught the same failure in a subtler form: Brush→Sleep was `+0.1 m_speed`, but §6.1 pins Energy at exactly 100 at wake, so `m_speed` is already at its 1.5 cap and the bonus was clamped away — measured worth over the real wake block was **1 game-minute per day**, and §6.7's own "nonzero effect" assertion would have passed green on it. **General rule: before authoring any bonus, check the target quantity's value at the moment the bonus applies. If the design guarantees it is already at maximum, the bonus is decoration.**)

Harness assertion [round-3 fix]: every bonus delivers a nonzero effect at least once in the **scripted-player** golden week (§16.3). Only Workout→Meal fires in the unattended run — Practice is never auto-scheduled, the reactive Shower never fires at the verified Hygiene steady state, and Meal→Workout requires a player mistake. Asserting player-dependent coverage on the unattended run is the exact error round 2 split the goldens to fix.

Cap-waste is surfaced too: a +35 meal at Nutrition 90 previews as `+10 (25 wasted)` — moving dinner later becomes a real decision. (The forecaster uses *projected* values at the card's predicted start, not current ones.)

**Lifecycle rules (normative):** the gap is measured between the first activity's end and the second's start, walking included; other completed activities in between break adjacency; a bonus never stacks **with itself** — a re-trigger replaces the old instance — while *different* bonuses do compound multiplicatively (Well-fed × Minty-fresh × Shower→Practice is the intended morning play, §8); stopping either activity early cancels the bonus; no bonus can push `m_speed` past its 1.5 cap.

**Armed vs earned [round 3].** Minty-fresh is *armed* automatically by the bedtime block and *paid* only if the player schedules morning Practice. The chip therefore renders on the **Practice card** ("Minty-fresh +15%"), never on the bedtime Brush — a chip on a card the planner queued by itself would claim credit for a puzzle the player did not solve. No v1 bonus is now both auto-armed and auto-paid; the honesty rule stands as the constraint on any future one.

### 6.8 Balance (verified numbers; every assertion names its sampling)

Daily budgets at base routine (amounts are m-independent; only durations flex):

| Bar | Decay/day | Restore/day | Net |
|---|---|---|---|
| Energy | −80 (16 h awake) | +80 (8 h sleep) | 0, exact |
| Nutrition | −96 | +105 (3 meals) | +9 → exits as ~9 cap-waste at dinner |
| Hygiene | −56 (−61 treadmill days) | +60 (2 brushes + shower) | +4 / −1 |
| Movement | −48 | +50 (1 workout) | +2 |
| **Transit** | 30–50 game-min/day walking (verified estimate; midpoint ~40) | — | counted in the time budget |

Verified steady-state facts (from the trace agents; these become CI assertions in §16.3):
- Nutrition: 3-meal cadence is stable from Day 2; **daily minimum ≈50, occurring just before breakfast's eat phase (~07:15–07:45 depending on m_speed)** — assertions measure min-over-all-ticks, never a wall-clock sample (a verifier showed an 08:00 sample reads post-breakfast ~85); dinner cap-waste ≈ 9/day; the reactive snack never fires in normal play (15-point margin) — a genuine safety net.
- Energy: bedtime 20 (1-hour buffer above the urgent line); wake exactly 100. One bad night (up to 01:00) wakes at ~70, forces one early urgent-sleep evening, and is back to a clean 100 by the second morning under the §7.1 continue-sleeping clause — never a spiral.
- **Morning check — the shared healthy-day sample [DECIDED]:** at a **09:00** sample, steady state reads Energy 90 · Nutrition ≈82 · Movement ≈71 · Hygiene ≥95 — all ≥65 with margin. Goal 6 and the harness use this single sample time (§12, §16.3). No evening sample can work: Energy is *designed* to be 20 at bedtime, so "all bars ≥65 at end-of-day" is impossible by construction (verifier-proven).
- **Trace status [round 3, Q6]:** every figure above was traced **pre-travel**. P2's harness records the travel-inclusive numbers *first*, then compares: bars are expected to hold within ±3 display points, with restore timings shifting by minutes (decay is wall-clock, not completion-driven). A larger move re-derives this section — with **no** `ENGINE_VERSION` bump, since no behavior changed; the earlier trace was simply incomplete. Bands are never quietly widened to green a test.
- Movement: steady-state trough 54 at 17:30; the Stretch net at 35 has a 19-point margin ⇒ one missed workout day before the net catches — felt consequence, then rescue.
- Routine time cost: ≈ 3.2 h of 16 waking hours at m_speed 1.0; ≈ 6.3 h at worst (×2); never impossible.

---

## 7. The planner & the queue

### 7.1 Routine anchors — windows, not timestamps

| Window | Target | Enqueues | Gate |
|---|---|---|---|
| 07:00 wake | — | Toilet → Brush → Shower → Breakfast(Meal) | always |
| 12:00–15:00 | 13:00 | Meal (lunch) | Nutrition <90 **and** no meal completed in last 3 h |
| 16:30–20:00 | 17:30 | Workout (preferred variant) | Movement <70 |
| 18:00–21:00 | 19:00 | Meal (dinner) | same gate as lunch |
| 22:30– | 23:00 | Brush → Sleep | always |

- The `<90` meal gate is verified: worst-case pre-meal values are 82 (lunch) / 78 (dinner), and 84 even at Health-0 durations, so meals always fire for planner-only play; the gate exists to skip a meal after manual player feeding. **Snacks never count as meals** for the 3-h clause.
- **Missed window [sharpened round 3, Q3+Q4]:** missed = the block has **not started** by window close; the unstarted card is removed and an `anchorMissed` domain event fires (the recap consumes it). A block already *running* at close finishes normally — the planner never interrupts (§7.4). **An anchor window fires at most once per day, and deleting its card counts as that firing** — otherwise the planner re-adds lunch two hours later and the player learns their edits are ignored, the worst lesson a game about steering can teach. The reactive net (§7.2) catches the bar either way. Anchors never roll over.
- **Sleep window rules:** sleep targets 23:00 and *ends at 07:00 regardless of start* — a late night is a short night, never a shifted calendar. If urgent sleep reaches Energy ≥80 between 23:00 and 07:00, the sim **continues sleeping until 07:00** (verified: this clause is the difference between next-morning recovery and a two-day wobble with a 13:30 afternoon nap).
- Chronotype preference (§9.2) shifts all windows ±30 min.

### 7.2 Reactive rules — strictly-lower safety nets under the anchors

| Trigger | Enqueue | Window |
|---|---|---|
| Nutrition <35 | Snack (Meal instead if <20; **never both** — single-food-card rule, unit-tested) | any |
| Energy <30 | Nap | 08:00–20:00 |
| Energy <15 | **Urgent Sleep** (runs until Energy ≥80 or 07:00; then §7.1's continue clause) | any |
| Hygiene <40 | Shower | any |
| Movement <35 | Stretch | 08:00–21:00 |
| Energy, Nutrition, or Hygiene <15 | card promoted to **URGENT** | — |

**Movement is never URGENT** [DECIDED] — no red-pulsing emergency workouts on an otherwise healthy sim (verified urgency-inflation case).

**Single-rest-card rule [round 3, Q5 — mirrors the food rule]:** never both a Nap and an Urgent Sleep in the queue. Urgent Sleep supersedes and removes a queued-but-unstarted Nap; a *running* Nap finishes (the planner never interrupts). Unit-tested beside the single-food-card test.

### 7.3 Priority (verified formula)

Two stages; Stage 1 always outranks Stage 2. Weights: Energy 4 · Nutrition 3 · Hygiene 2 · Movement 1.

- **Stage 1 (urgent, bar <15):** `score = weight × (15 − bar) / 15` — common normalization. (The per-trigger version failed verification: at Energy 14 / Nutrition 14 the sim ate before sleeping; with common normalization equal deficits rank by weight, as intended.)
- **Stage 2 (non-urgent reactive):** `score = weight × (trigger − value) / trigger`, where `trigger` is the card's §7.2 reactive threshold.
- **Anchor blocks:** anchor windows enqueue their cards as an **ordered block** (wake: Toilet → Brush → Shower → Breakfast; bedtime: Brush → Sleep) at a fixed priority tier between URGENT and reactive. Blocks keep their data-defined internal order and are never re-scored — Stage 2's `trigger` exists only for reactive rules; anchor cards (and Toilet) deliberately have none. The sorter scores reactive singles and slots them relative to whole blocks; ties break by enqueue time. Unit test: Day 1 at 07:00 produces exactly the wake sequence. (A verifier showed per-tick score-sorting of anchor cards would scramble the morning routine — Breakfast ahead of Toilet — every day.)

Verified at all-bars-0: Sleep 4.0 > Food 3.0 > Shower 2.0 (the v0.1 formula produced *Workout first* — exact scores 100/90/85/70/65). Six mixed scenarios verified sane; the Nap rule closes the "Energy cliff" where rest didn't exist above bar 15.

### 7.4 Queue rules (normative — every edge case has one answer)

| Rule | Answer |
|---|---|
| Card ownership | `AUTO` (planner) vs `PINNED` (anything the player inserted, moved, or touched — that card only). Planner never moves, reorders, or removes PINNED cards. |
| AUTO ordering | **Each maximal AUTO run sorts independently [round 3, Q2]:** reactive AUTO cards sort by §7.3 score and anchor blocks hold their fixed internal order *within their own run*; sorting never crosses a PINNED card, so `[AUTO][PINNED][AUTO]` is two separately-sorted runs and a deliberately-placed pin is a barrier the player can use. New AUTO cards enqueue into — and URGENT promotion targets — the **earliest** run (immediately after the leading PINNED cards); an URGENT card never crosses a PINNED card — the pinned card gets a ⚠ conflict warning instead (§7.5). |
| Auto-cleanup | An unstarted AUTO card whose bar recovers above trigger+10 poofs away. |
| Dedup | Planner keeps max one AUTO card per activity type. The **player may insert duplicates freely** (two Practices, a second Meal — different occasions are legitimate). |
| Remove | Drag off / Delete key / card-menu → removed with a **5-second Undo toast**. Removing an AUTO card suppresses that activity type for 2 game-hours (urgency overrides suppression). |
| Stop current | Stop button / X key → pro-rata credit, next card starts. Stopping an AUTO activity suppresses its type for **1** game-hour. The planner **never** interrupts the current activity. |
| Object click | Shortcut, not a command (C2): if that activity is queued → promote it to PINNED at the front of the unpinned segment; else insert it there as PINNED. |
| Queue cap | The player may hold **10** cards. Anchor blocks render as **one expandable card** (e.g. "Morning routine ▸ ×4" — tap to expand and edit individual steps) and, together with urgent cards, live outside the player cap entirely — so no queue state can ever lock out the wake block, the bedtime block, or an emergency (round-2 fix: two reserved slots couldn't hold a four-card block). |
| Object blocked (wrinkle) | The card defers in place with a why-line + ⚠ chip until the object frees. URGENT Hygiene reroutes to the sink Quick wash if reachable; everything else waits. Doorbell-type wrinkles interrupt idle only — if the sim is mid-activity, the visitor card enters at URGENT-front instead. |
| Cross-midnight | Cards persist across midnight; the bedtime anchor queues *behind* pinned cards and warns (§7.5) if the plan pushes sleep past 00:00. |
| Empty queue | Idle: couch sit, wander, idle behaviors, storylet triggers. |

### 7.5 Forecasts & explanations — the planner shows its work

The deterministic core makes lookahead free: the forecaster headlessly simulates the current queue forward and annotates the UI.

- Every card shows a **predicted start time** (`Shower · ~08:12`).
- AUTO cards carry a one-line **why** (`Added: Nutrition will pass 35 around 12:40`).
- **Conflict warnings:** if the current plan drives any bar below 15, the responsible card(s) get a ⚠ chip and the sub-bar pulses (`Sleep predicted 23:50 ⚠`).
- **Horizon & uncertainty [round 2]:** the forecast runs to the next wakeTarget or 12 h, whichever is sooner; it knows accepted commitments and deterministic rates but **never reveals unannounced seeded wrinkles** (it clones PRNG state, §16.2, and treats undealt wrinkles as absent); refresh triggers: queue edit, commitment change, top of each game-hour.
- Tooltips/card-menus show: duration at current speed, effect with cap-waste (`+10 (25 wasted)`), active adjacency chips, and the target object.

### 7.6 Commitments & the Week Plan (dormant in v1; arrives with v2's work shifts)

The queue is the **execution** horizon; a 10-card strip cannot also hold Friday's shift, a Saturday invitation, and next week's class. The **Commitments layer** is the second horizon (round-2 audit agreement — the one good idea in the rejected concept image):

- A commitment: `{ownerId, targetStart, earliestStart, latestStart, duration, location, travelMinutes, flexibility, source, status}` — typed JSON, zod-validated.
- Work shifts (v2), accepted invitations (v3), class sessions (v4), and dates (v5) are commitments, **never** immediate queue cards. Accepting an invitation books a commitment.
- A commitment **materializes** into an ordered PINNED queue block ~2 game-hours before `targetStart`, with travel and prep cards generated alongside.
- The forecaster warns about commitment conflicts days ahead; the player can reschedule, cancel, or pick between overlaps from the **Week Plan panel** (`W`, v2+). Once materialized, normal queue rules take over — queue-only control (C2) is untouched: the calendar says *when something matters*; the queue still owns *what the sim does next*.
- v1 ships the data model and nothing else (the Day-8 letter is retroactively the first commitment); no Week Plan UI exists until v2 has something to show.

### 7.7 Loop pseudocode (normative)

```
everyTick:
  applyBoundaryCommands()
  runAnchorWindows(clock, prefs)                    // clock is the minute about to run
  runReactiveRules(bars, suppression)               // §7.2
  sortReactivesAroundBlocks()                       // §7.3 — blocks keep order; never crosses PINNED
  if !current: startNext() or idle()
  collectPassiveDeltas(awake?, current)             // Sleep/effective Nap suppress passive Energy
  collectCurrentActivityOrTravelDeltas()            // §6.3, §6.6
  applyCombinedBarDeltasOnce()                      // §6.1 single-commit rule
  advanceClock()
  forecaster.refreshIfQueueDirty()                  // §7.5
```

---

## 8. Practice — the spendable use of free time

The answer to both audits' core finding. Health buys speed; speed buys free hours; **Practice is what free hours are for.**

- **Practice (guitar)**: 60 min at the living-room guitar. Earns `25 × m_out` points. Never auto-scheduled — the planner will not add it; only the player does. The sim hints when idle ("...maybe I'll play something?" bubble) but never acts.
- **Per-day diminishing returns with a block bonus** (reset at wake; **max 4 counted sessions/day, 5th+ earn ×0 on both curves** — verifier fix, otherwise the "ceiling" wasn't one): *scattered* sessions yield ×1.0 / ×0.7 / ×0.4 / ×0.2 of the base; an **unbroken consecutive block** keeps ×1.0 / ×0.85 / ×0.7 / ×0.5. Protecting a contiguous block against the 13:00 meal window and the 17:30 workout anchor *is* the v1 scheduling puzzle — adjacency chips render between consecutive Practice cards exactly like §6.7's.
- **Levels (cumulative mastery points, never consumed):** L1 = 100 · L2 = 300 · L3 = 700. Verified pacing, **stacks included** — the stated ceilings count all three output multipliers where earned (a verifier showed the unstacked figures understated a min-maxer by ~25%):

  | Multiplier | Source | Applies to |
  |---|---|---|
  | Well-fed +10% | Nutrition ≥70 (§6.5) | every session while fed |
  | Minty-fresh +15% | Brush→Sleep (§6.7) | the first session started before the morning check |
  | Shower→Practice +20% | §6.7 | a session immediately following the shower |

  Pacing: plain blocks ≈ 98/day → L3 ~Day 7–8; fully-stacked blocks ≈ 122/day → L3 ~Day 6–7; casual scattered (2–3 sessions) reaches L2 ~Day 5–6. Minty-fresh is worth **+5% to a blocked day** and moves L3 by roughly a third of a day — inside the stated bands, so they hold unchanged (round-3 verification). Otherwise L3 lands early in v2 — fine; mastery accrues forever (it backs the v5 *Master of the Craft* aspiration).
- **Storage [round 3]:** practice points are **integers ×100** — one round per award (`round(sessionValue × 100)`), thresholds 10,000 / 30,000 / 70,000 internally, displayed ÷100. Same anti-drift rule as the ×6000 bars; decided now because the value enters the save schema the moment `practice.json` lands (P2).

- **The morning decision [round 3].** The three multipliers cannot all be earned at once, which is the point. Eating breakfast first satisfies Well-fed for the whole block but puts a completed Meal between the Shower and the Practice, breaking that adjacency (§6.7). Practising straight off the shower earns +20% on session one but forfeits Well-fed until breakfast, and pre-breakfast Nutrition (≈50, the daily minimum) drags `m_out` down for the whole block. Verified: **eat-first ≈ 119/day, shower-first ≈ 112/day — 6% apart.** Two defensible answers, neither dominant, decided by reordering four cards. This is the v1 scheduling game in its smallest complete form.
- **Feeds v2 as "Prepared Performer" [DECIDED round 2 — replaces the GP dump]:** on accepting the letter, Practice level grants **+20% / +50% / +100% bonus GP on the first five workdays** (L1/L2/L3). Verified with explicit baselines: L3 ≈ +169 GP ≈ **1.0 week at the passive rate, ≈ 0.5 weeks engaged** — deliberately about half the old +350 dump, which also skipped venues; it can't anymore, because promotions require a **debut day at each venue** (docs/02 §4). After the letter, home Practice earns career GP (`14 × m_out`, first session of the day, then ×0.5/×0.2/0 — docs/02) *and* keeps earning mastery points.
- **Why it fixes the loop:** low health now costs Practice hours *automatically* — no punishment mechanics needed. `m_out` gives Health a payoff in v1, the same formula that pays wages in v2.

---

## 9. A person, not a dashboard

### 9.1 Identity-lite at first run [DECIDED]

60-second, fully skippable (skip = randomize): **name · pronouns · one of 4 appearance presets** (palette-swaps of the layered doll — cheap by construction) · reveal of two rolled **preferences** (below). Full paper-doll editor remains v6 ("expanded customization"). Data model is preference-tagged and gender-neutral throughout; dating-pool preferences are collected by a one-question prompt when v5's chapter opens (docs/05 §1) and stored in the field v6's editor later edits.

### 9.2 Visible preferences

Rolled at creation, shown as tags on cards and in the journal — never hidden modifiers:

- **Workout:** prefers weights *or* treadmill (planner picks it; the other still works).
- **Chronotype:** early bird (`wakeTarget` 06:30 / `bedTarget` 22:30) or night owl (07:30 / 23:30). **Every clock rule in this spec is an offset from these targets** [DECIDED round 2] — anchor windows, **reactive windows (Nap, Stretch), and wrinkle windows** all shift with them; Day 1 begins at the sim's own wakeTarget; sleep and sleep-skip end at wakeTarget; the "morning check" is **wake + 2 h**. Every absolute time printed in this spec (07:00, 09:00, 08:00–20:00…) is the trace baseline at the neutral midpoint.
- **Food mood:** proper-meals person / grazer (flavor + which variant the planner reaches for first).
- **Idle:** favorite idle behavior (air-guitar, window-gazing, stretching…).

Respecting a preference earns a happy bubble; repeatedly overriding one earns mild grumbling (cosmetic only — the sim never disobeys).

### 9.3 Daily intention [HYPOTHESIS — first cut-line item]

An optional morning chip. **No universal gain buff** (round-2 fix: a flat +10% made Practice Focus the dominant pick and punished players who turned the prompt off). Each intention changes what the planner *does*, plus at most one conditional effect with a real cost:

| Intention | Planner behavior | Conditional effect |
|---|---|---|
| Take it easy | suppresses today's workout anchor; favors quick variants | evening storylet if no URGENT all day |
| Get moving | favors the preferred workout; suggests a Stretch mid-morning | a second workout that day carries no cross-effect cost (no −5 Nutrition / Hygiene) |
| Eat properly | favors Meal over Snack; holds the dinner window | Well-fed window (§6.5) extends to ≥60 |
| Practice focus | suggests and *protects* one contiguous practice block (§8) | none — the block bonus is the payoff |
| Balanced (default) | today's behavior, untouched | — |

Its **bias target** — the thing Goal 5 checks — is completing at least one activity of the intention's favored type that day. Queue-only philosophy intact — the sim still plans and executes.

### 9.4 Wrinkles & storylets — one small story per day

**Deck architecture [DECIDED round 2]:** the exposure guarantee below is a property of the **scripted-player harness week** (§16.3) — the unattended golden seed deals only benign wrinkles, so fairness bands and exposure never fight. Wrinkles are **6 mechanical shapes** (blocked object · timed window · slowed activity · free half-hour · forced substitution · visitor) × **text variants** (6–10 per shape, unlocking per version, venue, and friend — flavor scales to ~40 without new systems; a round-2 audit costed the flat 6-deck at 105–140 slots across v1–v5, four full repeats by mid-v2). Quiet days are allowed — the deck may deal "nothing today"; the no-repeat window is 6 days. **Exposure guarantee:** the deck ensures each reactive band (§7.2) is visited roughly weekly — the round-2 "margin vs exposure" finding proved a player could otherwise finish v1 never seeing a Snack, Stretch, Nap, URGENT card, or focus penalty. The repair-visit two-day pattern (skip a shower → Hygiene <40 → focus penalty + reactive shower become real) is the template.

**Day 1 is scripted:** the package delivery always fires as the tutorial wrinkle — it carries the decoration choice and the first real decision, which is what §12's 60-second target rests on. From Day 2, one seeded wrinkle most days. Launch text variants for the six shapes (every entry declares a success condition requiring a queue action):

| Wrinkle | The play |
|---|---|
| Package delivery, window 10:00–12:00 | Keep a 15-min slot free mid-morning; contains a **choice of one of two decorations** |
| Repair visit, bathroom blocked 07:30–09:30 | Collides with the morning routine: quick-wash now and shower later, or shower before the knock |
| Favorite show, 19:00 sharp | Dinner moves early (18:00) or late (20:00) — the `<90` gate allows both; cozy storylet on the couch |
| Headache day | Workouts 50% slower today; a completed Nap clears the headache (the stated mechanical link) |
| Slept-great morning | Wakes 30 min early at full Energy — a banked half-hour for Practice (a verifier killed the draft "+10 Energy" version: wake is already 100, the bonus was provably inert) |
| Burned breakfast | Breakfast completes with only +10 Nutrition and **does not count as a meal for the 3-h gate** — the reactive snack band gets visited, by design |
| Empty fridge (restock day) | Meals unavailable until the 14:00 delivery; snacks and the Nutrition <35 band do the morning's work |
| Rough night | Sim wakes at Energy 60 — the Nap window and Energy bands become real for a day |

Wrinkle-vs-anchor precedence: a wrinkle that owns a time window (favorite show 19:00) suppresses or shifts the colliding anchor for that day, stated per entry — anchors never fight wrinkles silently.

**Storylet** — one term, used everywhere: a one-line journal entry generated by a wrinkle, an idle moment, or a milestone (found an old photo, danced while cooking, proud of a 3-day streak…). The journal is the game's memory — where attachment accumulates.

---

## 10. Home scene

Single fixed screen, interior cutaway, **24×14 tiles @ 32 px** (768×448 logical) — the 24×13 alternative was verified to buy phones ~7% and nothing qualitative; not worth the layout redesign.

```
+----------------+---+------------+
|  BEDROOM       |   |  BATHROOM  |
|   [bed]  [wd]  | H |[sink][wc]  |
|                | A |  [shower]  |
+---------+  door| L +--door------+
|  LIVING        | L |  KITCHEN   |
| [couch][tv]    |   | [fridge]   |
| [wts][tread]   |dr | [micro][ct]|
| [guitar][rug]  |   |            |
+----------------+---+------------+
```

- A* on the walkable grid, 4-directional; each object declares an `interactPoint` + facing.
- Objects are data (`content/objects.json`): footprint, interactPoint, activities, upgrade track (dormant until v4), decoration slots (§9.4 rewards).
- Guitar and rug added for Practice and Stretch.

---

## 11. UI / UX

Obeys Joe's global design rules (60-30-10, ≤4 font sizes, 2 weights, 8-pt grid, tabular numerals, one emphasis per section). Visual construction rules live in [design.md](design.md).

### 11.1 HUD — versioned hierarchy [DECIDED round 2]

The permanent HUD is **capped forever** at: Health block · Funds · Connection · clock/speed. Everything else lives one tap away: a single **contextual chip** shows the current objective (goal → career level → relationship beat, whichever is live); Practice/GP/friends/hobbies/Love detail lives in the phone-journal panels; future commitments live in the Week Plan (§7.6); execution lives in the queue. A round-2 audit projected the v5 HUD at 12+ permanent elements without this rule.

- **Top-left — Health block:** large Health bar + four sub-bars with icons (moon · fork · shoe · droplet). Display bands are per-bar data in `rates.json`: default ≥70 normal · 40–69 cream-shadow edge tick (design.md §8 — "amber" exists in no ramp) · <40 red pulse **plus a non-color icon change** (§11.6). **Energy uses edge tick <30 · red <15** — 20-at-bedtime is designed, not an emergency, and the default bands would cry red every healthy evening (verifier finding). Practice counter + level chip beneath.
- **Top-right — Clock block:** `Day 3 · Wed · 14:32`, speed controls, today's wrinkle chip.
- **Goal chip** under the health block; tap → goals panel.
- **World:** thought bubbles (need <40, preferences, hints), progress ring over the sim, ⚠ forecast pulses (§7.5).

### 11.2 Queue strip (bottom) — the primary control surface

- **Current card** 64 px: icon, radial progress, Stop on hover/tap.
- **Upcoming** ~6 visible of the player's 10 (anchor blocks and urgent cards render additionally, outside the cap — §7.4): drag to reorder; PINNED pin glyph, AUTO gear glyph, URGENT pulse; **adjacency chips render between cards**; predicted start time on each card.
- **`+` palette:** grid popover grouped by room — icon, live duration, effect with cap-waste, preference tag.
- Every card has a **card menu** (⋯): move earlier / move later / do next / remove / details — full parity with dragging (§11.6).
- Remove → 5-s Undo toast. Hit targets ≥44 px.

### 11.3 Feel

Walk/act tempo visibly tracks `m_speed`; card micro-animations (slide+squash, poof); day/night ambient light; lamp glow after 19:00; sim glances at the queue when it changes (she knows you're steering).

### 11.4 Sleep skip & morning recap

On night-Sleep start (no URGENT queued, no input for 10 s): dissolve → 07:00. Daytime urgent sleep never skips — its cost is meant to be felt. A **non-modal recap card** slides in with wake: bars end-of-day vs yesterday, meals eaten, Practice earned, wrinkle outcome, goal progress, journal line. Tap to dismiss or expand. (Kills the 4-real-minute dead-air block; doubles as the audit-requested daily summary.)

### 11.5 Responsive & scaling (verified policy)

1. Reserve UI first: ~48 px HUD + 72 px queue on desktop; phones overlay the HUD and collapse the queue to a 48 px expandable strip.
2. Scale `S` = largest value where `S × devicePixelRatio` is an integer and the scene fits the remaining area — on 2× retina this legalizes half-steps (1.5× = exactly 3 physical px per art px; fits MacBook Air 13, verified). 1×-DPR laptops (1366×768) run 1×.
3. Phones: no integer fit exists (verified) — render at 1× offscreen, downscale ~0.72–0.88 with a sharp-bilinear pixel-art filter (chosen over raw nearest-neighbor shimmer). **Landscape-first; portrait is out of scope for v1.** Respect safe areas (verified: 0.87 scale clears the iPhone 15 Dynamic Island).

### 11.6 Accessibility (v1 scope, not deferred)

Keyboard-complete queue editing (§11.8) · card menus as full drag parity · non-color urgency (icon shape change + pulse) · no hover-only information (everything in card menu/details) · reduced-motion setting (kills pulses/parallax, keeps state changes) · scalable HUD text (world stays fixed-pixel) · screen-reader labels and announcements for bars, cards, forecasts, and recaps.

### 11.7 Pause menu & settings (Escape) [CONFIRMED C10]

**Escape** (or ⚙): first closes any open panel; otherwise opens the **pause menu** (game hard-pauses — the sanctioned modal):

> Resume · Settings · Goals & Journal · New Game (double-confirm: overwrites the single slot) · **Return to Title** (saves first; on iOS this replaces any "quit" concept — the OS owns backgrounding and termination callbacks aren't guaranteed)

**Persistence is three layers [DECIDED round 2]:** app-global preferences (audio, mute, reduced motion, HUD scale, screen-reader verbosity, controls — survive New Game and save corruption, editable from the title screen *before* identity setup) · the career save (§15) · session state (speed, open panel — never persisted). 

**Settings:**

| Group | Contents |
|---|---|
| Audio | Master / Music / SFX sliders · mute toggle (state persists) |
| Gameplay | Default speed · sleep auto-skip on/off · daily-intention prompt on/off · **Autonomy: Full routine / Essentials only (anchors: sleep + meals; player drives the rest) / Reactive only** [HYPOTHESIS — the fishtank-vs-game dial; at every setting the sim still plans, so Pillar 1 holds]. **Clock rules survive every setting** (verifier fix): sleep's end-at-wakeTarget and continue-to-wakeTarget are engine rules, never anchors — only *enqueueing* is disabled, so nights can't drift around the clock; in Reactive-only, a night urgent sleep starting after 21:00 counts as night sleep for sleep-skip. Goals 3 and 6 show "needs Full routine" below Full; the v2 letter uses its Day-10 fallback |
| Display | Reduced motion · HUD text scale · fractional-scaling on/off (pixel purists) |
| Accessibility | Non-color urgency emphasis · screen-reader verbosity |
| Controls | Binding reference (§11.8; fixed in v1, rebinding later) |
| Sim | Rename sim · pronouns |
| Data | Last-saved time · Reset save (double-confirm) |
| About | Version, ENGINE_VERSION, credits |

Modal policy: routine simulation never blocks; modals are reserved for **player-initiated** meta actions (this menu, New Game confirm) and rare life decisions (v2 letter, v5 proposal).

### 11.8 Keyboard bindings (v1 fixed set) [CONFIRMED C10]

| Key | Action |
|---|---|
| `Space` | Pause / resume |
| `1 / 2 / 3` | Speed 1× / 2× / 4× |
| `Esc` | Close panel → pause menu |
| `Q` | Focus queue (then:) `←/→` move focus · `Shift+←/→` move card · `Enter` card menu · `Delete` remove (Undo toast). `Tab` stays ordinary focus traversal (round-2 a11y fix) and reaches the queue in document order. All single-key shortcuts are suppressed while a text field is focused |
| `W` | Week Plan panel (v2+, once commitments exist) |
| `X` | Stop current activity |
| `A` | Activity palette |
| `G` | Goals & journal |
| `M` | Mute toggle |
| `U` | Undo the last remove (the only undoable queue action — reorders are just re-dragged; stops are final, pro-rata credit already granted) |

Shown in Settings → Controls; remapping is post-v1.

---

## 12. Goals & the first session

Goals are data (`content/goals.json`) with **explicit sampling rules**; every goal needs a deliberate act; every goal banks a lasting reward.

| # | Goal | Condition (sampling) | Reward |
|---|---|---|---|
| 1 | **Meet ___** | Watch 3 activities complete; open one card's "why" | Journal unlocks |
| 2 | **Change of plans** | Move/insert a card *and* see a forecast change | Decoration: plant |
| 3 | **Handle the wrinkle** | Resolve today's wrinkle with zero URGENT events that day (count sampled midnight) | Decoration choice |
| 4 | **First chord** | Reach Practice L1 | New idle behavior: air-guitar (or the next variant if already rolled at creation) |
| 5 | **Find the rhythm** | Pick an intention and complete its bias target (§9.3) that day | Poster decoration |
| 6 | **Balanced week** | 3 consecutive days: **≥2 Practice sessions each day** *and* every bar ≥65 at the morning check (§6.8) *and* zero URGENT events — the practice demand makes the bar clauses compete instead of auto-passing (round-2 fix: the old clauses were the unattended harness's guarantees verbatim) | "Routine memory" — a §7.3 tie-break: reactive scores within ±0.1 prefer the relative order you've used most in the last 3 days (stored in the save, deterministic) |
| 7 | **Holiday's over** | (teaser) A letter arrives Day 8… | Opens v2 chapter |

First-session pacing targets (P4.5-tested, not assumed): a real choice within ~60 s (Goal 2 + Day-1 wrinkle) · visible consequence within ~3 min · recap at first night · first lasting reward by day 2–3. Goal 1 completes inside the first morning — no "watch a whole day" gate (audit-verified pacing failure, removed).

---

## 13. Art direction

Binding rules, palette, sprite construction, and per-version asset scope live in **[design.md](design.md)** — every generated or drawn asset must pass its checklist. Summary of what's fixed here:

- Style: simple chunky HFM-style pixel chibi (C8 revised round 2); Mystia's Izakaya is mood/layout reference only. The AI-generability and small-loop rationale carries over; the rendering lineage is HFM's pixel bible (design.md v2).
- Tiles 32×32 · character 32×48 · scaling per §11.5 (integer/half-step on desktop, sharp-bilinear fractional on phones) · indexed master palette per design.md §2 (canonical count lives there) · soft colored outlines, never pure black · character authored as layers (body/hair/outfit) from the first sprite.
- v1 asset list: [design.md](design.md) §11's v1 bill of materials is canonical.
- Pipeline & placeholder-first rule unchanged (placeholders through P5; art lands P6; licensed-pack fallback stands).

## 14. Audio (v1 ships with sound) [CONFIRMED C9]

| Layer | v1 scope |
|---|---|
| Music | One chill home loop with a day and an evening variant; crossfade at 19:00. Practice audibly layers the guitar riff (level-dependent — L3 sounds *good*). |
| Ambience | Room tone; rain-on-window as a wrinkle variant |
| SFX | Footsteps (per floor material) · ~8 activity loops (shower, microwave, treadmill…) · queue insert/remove/complete · adjacency-bonus chime · gentle urgency cue · recap slide |
| Controls | Master/Music/SFX sliders + mute (§11.7); mute state persists |

Dev hygiene (HFM lesson): web previews auto-muted in dev builds; QA checklist includes "no orphaned audio after tab close."

## 15. Saves

- Versioned JSON snapshot behind the **`persistence/kv` adapter** [P0 kill-gate ruling, evidence/P0.md]: web driver = localStorage (expo-sqlite's alpha web support hung the exported-build proof), native driver = expo-sqlite, one interface. Blob shape: `{schemaVersion, engineVersion, clock, bars, queue, currentActivity+phase, practice, goals, journal, wrinkleDeck, prefs, prngStates}`. **App-global preferences live outside the career save** (§11.7's three layers) — New Game or corruption never resets audio or accessibility.
- **Major decisions bypass the 5-s coalescing** and write immediately: purchases, chapter acceptance, proposal responses, identity edits, New Game.
- **Write policy** (verified): on activity completion, queue edit (500 ms trailing debounce), day boundary, app background/close (best-effort — not guaranteed by browsers), and major decisions; plus a 60-s throttled periodic. All writes coalesced to ≥5 s apart (4× completion-storms verified otherwise).
- **3 rotating snapshots**; corrupt-load falls back a generation with a plain notice. Engine-version mismatch: migrate via the migration map, or offer read-only "finish the day" + fresh start if unmigratable.
- Single player-visible slot; New Game double-confirms.

## 16. Architecture & testing

### 16.1 Rings (HFM, inherited)

```
ui/ → render/ → game/ → sim/    + content/ (zod) + persistence/
```

`sim/` + `game/` are pure TS: no RN/Skia/Expo imports, no `Math.random`/`Date.now`. The forecaster (§7.5) is `sim/` code reused headlessly — the renderer can lag or not exist without affecting outcomes.

### 16.2 Determinism (tightened per audit)

- Bars are **scaled integers ×6000** [round-2 fix]: at that scale every per-hour rate with ≤2 decimals is an exact integer per game-minute (5.0/h → 500/min, 0.4/h → 40/min) — no remainder drift; the ×100 draft made 5.0/h ÷ 60 non-integer. Activity fills use an **integer remainder-carrying accumulator** (`fill_t = floor(A×6000×t/T) − floor(A×6000×(t−1)/T)`) so completed totals are exact even when per-tick shares aren't (Meal's eat phase is 11,666.67/min raw); durations round to whole ticks by `ceil`. The golden replay asserts **exact** one-day closure, not bands.
- **Five mulberry32 domain streams:** `wrinkles` · `storylets` · `relationships` · `careerEvents` · `cosmetic`. Adding a storylet can't shift wrinkle selection; a new idle animation can't shift anything. The forecaster **clones** stream state and never advances the real ones.
- No transcendental Math in `sim/`. `ENGINE_VERSION` bumps on any behavior change; golden 7-day replay enforced.

### 16.3 Testing

- **Unit (TDD):** rates, health mean, both multipliers, phase fill, priority formula (incl. the snack-beats-meal inversion test and the E14/N14 ordering test — both verifier-flagged), pinning invariants, suppression, window/missed-anchor logic, adjacency, forecaster-vs-sim agreement.
- **Two golden replays [DECIDED round 2], built incrementally:** (a) P2 creates the seeded 7-day **unattended** run — fairness guarantees only; (b) P4 creates the **scripted-player** replay format and its fixed queue edits/stops, then P5 extends that same replay with Practice, wrinkles, Goal 6, and the remaining player-owned assertions. Everything player-dependent asserts against (b): adjacency coverage, practice pacing and the block bonus, Goal 6, suppression, undo. (A round-2 audit proved three of five adjacency bonuses were structurally impossible unattended — Practice is never auto-scheduled, so `Shower → Practice` cannot fire without a hand on the wheel.) Diffs in either require an `ENGINE_VERSION` decision. The Day-1 wake-sequence check lives with the unit tests.
- **Balance harness (CI), sampling-explicit (§6.5):** the unattended golden seed deals **only benign wrinkles** — the §9.4 exposure guarantee is a scripted-player-week property, asserted there (verifier fix: rough-night and empty-fridge wrinkles legitimately break the fairness bands, by design). Untouched 7-day: every bar ≥65 at the **morning check (wake+2h; 09:00 baseline)** from Day 2; zero URGENT events; Nutrition min-over-all-ticks = 50±3 (pre-breakfast); dinner cap-waste ≤ 12; snack never fires except when a wrinkle engineers it (the §9.4 exposure guarantee is asserted separately: each reactive band visited ≥ once per scripted-player week). Neglect: no workouts → Movement <20 within 3 days. Recovery: all-bars-0 → autopilot ends Day 2 with Health ≥70. Property test: planner never moves a PINNED card across 10k random edit sequences. Note: Goal 6 requires player-pinned cards *on top of* what this autopilot assertion guarantees — the harness proves the world is fair; the goal still demands a hand on the wheel.

### 16.4 User flows (all defined; details in the sections cited)

First launch → identity-lite → Day 1 (§9.1, §12) · returning player → resume toast (§5) · corrupt save / engine mismatch (§15) · background tab → pause via visibility API; timer drift impossible (tick accumulator) · add/reorder/remove (undoable)/stop (§7.4) · urgent-vs-pinned conflict (§7.4–7.5) · missed anchor (§7.1) · full queue (§7.4) · Day-8 letter when the save is already past Day 10 (fires on next load, once) · New Game overwrite (§11.7) · quit/resume (§11.7).

---

## 17. Build plan

| Phase | Scope | Gate / acceptance |
|---|---|---|
| ~~P−1~~ | **SKIPPED — non-negotiable [CONFIRMED by Joe, C12]:** the disposable fun prototype is cut; Joe rules from experience that queue-steering is fun. Its validation duties transfer whole to the P4.5 external playtest, which becomes the only fun gate. | — |
| P0 | Expo scaffold, rings, strict TS, Jest, zod content pipeline, CI, **web-export render+persistence proof** | test suite green; exported web build draws Skia + persists |
| P1 | `sim/`: clock, rates, health, multipliers, phases | §6 unit tests |
| P2 | `sim/`: top-level step, planner, windows, priority, queue model, adjacency, deterministic headless path/travel, **Practice scoring/curves/block-bonus math**, commitments DTO, forecaster | unattended golden recorded; Practice math green; P2-owned §16.3 fairness/recovery/property harness green |
| P3 | `render/`: tilemap, placeholder boxes, movement; `ui/`: HUD, clock, speeds | A0 already passed; full placeholder day watchable at 1×–4×, 60 fps |
| P4 | Queue strip complete: drag + card menus + keyboard, palette, undo, forecasts, adjacency chips; **minimum first-session slice:** player-visible Practice using P2's math, scripted Day-1 package, Goals 1–2, one persistent decoration reward, first-night recap | every §7.4 interaction on desktop web via mouse/keyboard/touch-capable browser; frozen build contains the complete P4.5 slice |
| **P4.5** | **External playtest gate** (≥3 fresh people, not Joe; frozen no-coaching protocol in the master plan) | each chooses within 60 s, predicts and sees a consequence, and explains a decision; ≥2/3 choose another day. Fail → P5/P6 wait and the unchanged protocol reruns with fresh testers. |
| P5 | Goals 3–7, full wrinkles/storylets and Practice levels/Prepared-Performer progression around the playable core, intention, identity-lite/preferences, full journal/recap, settings/pause (audio sliders wired to the still-silent bus — assets land P6), three-layer saves/migrations | kill app mid-shower → resume mid-shower; goals 1–6 completable; scripted replay gains week-scale Practice/wrinkle/Goal-6 assertions |
| P6 | Art per design.md, animations, audio (§14), juice, desktop-web perf | no placeholders; 60 fps on MBA-13 web and 1366×768 |

**Cut line, in order, if v1 slips [rewritten round 2 — the old list totaled ~3% of the build]:**
1. **iOS pass** — v1 DoD is desktop-web only (§18); iPhone scaling/60fps/simulator gates move to a **v1.1 mobile pass**. Touch-parity stays in the design (cheap insurance, expensive retrofit).
2. **Audio scope** — trim to one loop + queue cues; full §14 lands in v1.1.
3. **Forecast UI polish** — the headless forecaster stays P2. The minimum start-time/why/conflict presentation required to understand choices is non-cuttable before P4.5; only post-gate detail/polish may slip P4 → P5.
4. Daily intention (also cuts Goal 5 + its toggle; P5 gate becomes goals 1–4 + 6) → wrinkle text-variant count (shapes stay 6; Day-1 package always kept) → decoration variety.
Accessibility (§11.6) is never cut.

**A0 — art-risk spike (technical gate before P3 planning):** render one 4-direction walk + one seated activity + a hair layer + an outfit on the average *and* offset-derived slim bodies. Proves or simplifies the layer/anchor/offset strategy before the renderer hardens around it. This is not a replacement fun prototype (round-2 addition; timing tightened by the plan audit).

**writing.md gates P5:** no authored string (storylet, why-line, recap, goal, bubble) ships without passing the [writing.md](writing.md) checklist — same posture as design.md for art.

## 18. v1 Definition of Done

**Technical:** §16.3 harness + both golden replays green in CI · all §7.4 interactions via mouse, touch, and keyboard · save/resume mid-activity · pause-on-close · §11.5 scaling verified on MBA-13 and 1366×768 (**iPhone verification moves to the v1.1 mobile pass** — round-2 fix: C7 says desktop-first, and the DoD was quietly carrying a second platform) · 60 fps on desktop web · audio mixes with working sliders.

**Game (playtested at P4.5, re-checked at ship):** a new player makes a meaningful choice inside 60 s · at least two viable daily strategies exist (e.g., practice-max vs balance-max) · activity variants are mechanically distinct · forecasts make consequences predictable · goals require deliberate action · a session banks a visible lasting change · 3+ external testers can explain the loop unprompted.

**Honesty note (replaces v0.1's "the system works"):** the *architecture* is verified by arithmetic and will be verified by the harness; the *fun* is a set of [HYPOTHESIS] tags until P4.5 says otherwise.

---

## 19. Roadmap (summaries — full systems in docs/)

Framing rule (audit-adopted): each release ships **one complete player fantasy**, not one data category.

- **v2 — "First Gigs" (docs/02-funds-career.md):** Funds + the Musician chapter. Day-8 letter (chapter opening, not a career menu). Bars decay at work; performance locks at clock-in `m_out` [DECIDED]. Venue ladder L1–L5 on **cumulative** GP 100/300/800/1600; workday 25×m_work (m_out locked at clock-in — docs/02 §3), home Practice 14×m_out with steep daily diminishing returns so performing stays the primary GP source (docs/02 §4; verified pacing: engaged ≈4.7 wks ≈1.7 h at 4×; passive ≈2×). Shop with real wants: instrument (gates L2), one apartment upgrade, groceries, transport. Music system debuts fully (busking = the theme made literal). Tracks are data; career choice UI arrives at ≥3 tracks.
- **v3 — "People" (docs/03-social.md):** the Connection top bar with the **social-battery split** [CONFIRMED C11]: everyone needs connection; personality sets preferred intensity and drain/recharge, so reading is battery-recharge, not connection. Weekend outings (park scene) + light weekday-evening interactions.
- **v4 — "Growth" (docs/04-growth.md):** the two upgrade axes — buy better things (external) vs become someone (internal: Cooking, Gym L1–3 with visible body/meal changes). Weekend time contention with Social is the strategic heart. Honest scope note: this is several connected systems; the doc treats it as one fantasy ("invest in yourself") with one shared currency: weekend hours + funds.
- **v5 — "Partner" (docs/05-partner.md):** **4 deeply-written** NPC-lite mates [DECIDED round 2] (preference tags mapped to systems that exist, schedules, Love meter), conversation *choices*, one normative compatibility formula, proposal modal, marriage; **who-keeps-working is a revisitable decision card** (monthly settlement); partner has a bounded capacity model; baby care has a real contract (all docs/05). **Aspirations** are seeded early — the journal page appears with each track's version (Master of the Craft v2, People Person v3, Perfect Home/Peak Form v4) so endings are intentions, not retroactive surprises; completing one offers **"keep living" or "frame it"** — framing ends the run into the gallery and seeds **NG+** [DECIDED round 2].
- **v6 — "You" (docs/06-creation.md):** expanded customization (full paper-doll editor, appearance, orientation/preference settings) — *expanded*, because identity basics shipped in v1 (§9.1).

## 20. Assessment & risks

The concept survived two adversarial audits: the queue-steered autonomy, fail-soft philosophy, and version ladder all held. What did **not** survive was v0.1's claim that v1 was already a game — both audits independently proved the autopilot was the optimal player. v0.2's answer is structural: Practice gives time a sink, variants give choices texture, wrinkles give days stakes, forecasts make the queue legible, and goals demand action. Each carries a [HYPOTHESIS] tag until P4.5.

Top remaining risks: (1) fun hypotheses now ride to P4.5 unvalidated (C12 accepted this trade knowingly) — if P4.5 fails, the redesign happens with the architecture already built, which is why the sim core stays data-driven and cheap to retune; (2) **writing** — Pillar 5 is delivered almost entirely in prose (journal, storylets, why-lines, ~250 v5 beats) and, unlike a palette violation, AI-sounding prose has no validator; [writing.md](writing.md) is the answer and it gates P5 (round-2 top finding); (3) art coherence — design.md + placeholder-first + the A0 spike + fallback pack; (4) scope — the §17 cut line now contains real cuts (iOS, audio, forecast UI); (5) v5 remains the largest version and its doc budgets conversation content explicitly.

## 21. Defaulted decisions (override any)

D1 one Movement bar; both machines fill it, cross-costs differ (§6.2) · D2 toilet flavor-only · D3 couch = idle + Nap · D4 *(superseded by C9)* · D5 start bars 100/70/70/60; goal sampling per §12 · D6 all §6 numbers are harness-owned after P2 · D7 identity-lite presets ×4; full editor v6 · D8 single save slot (3 internal rotations) · D9 object-click = §7.4 shortcut · D10 pixel font per design.md · D11 fixed keybindings v1, remap later · D12 phone portrait unsupported v1.

## 22. Open questions for Joe

| # | Question | Recommendation |
|---|---|---|
| O1 | ~~Work freeze~~ | Resolved [DECIDED §0]: decay continues, performance locks at clock-in — veto if wrong |
| O2 | ~~v2 money sink~~ | Resolved: shop with instrument gate + pulled-forward upgrade (docs/02) |
| O3 | ~~v3 social model~~ | Resolved [CONFIRMED C11]: Connection + social-battery split, ruled 2026-07-29 |
| O3b | ~~Weekday-evening social~~ | Resolved with C11: texts/calls + Maren's café evening; weekends keep the big outings |
| O4 | Confirm: 4 health sub-bars (brief said "all 3") | Yes, 4 |
| O5 | Title: keep "Auto Life"? | Fine as working title; candidates parked: *Little Routines*, *Small Life*, *Someone's Day* |

## 23. Out of scope (unchanged + additions)

Multiplayer, mods, monetization design, Android, offline simulation (core supports it; revisit post-v1), weather/seasons, pets, moving house, aging/death, procedural NPCs beyond mates, phone portrait (v1), key remapping (v1), cloud saves (Supabase exists if wanted later).
