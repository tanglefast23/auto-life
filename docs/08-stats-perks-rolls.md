# 08 — Stats, perks, and the roll: how an activity turns out

**Status:** spec, 2026-08-01.
**Owner:** P9.
**Extends:** SPEC §6 (activities), §8 (practice), §9 (a person, not a dashboard), §11 (UI),
§16.2 (determinism). Replaces nothing. **Amends** §6.8's "the reactive snack never fires in
normal play" and §8's stated L3 pacing — both flagged at §9.4 and §9.5.
**Studied for inspiration:** RimWorld's skills/traits split — §2 records what we take and
what we refuse.
**Revised:** 2026-08-01, after a Fable audit rejected the first draft. Eight blocking
findings; §0 records what moved and why.

---

## 0. Changelog — draft 1 → draft 2 (Fable audit)

The audit was right on all eight blocking findings. Seven produced real changes; one
produced a correction to prose. The two that moved the design rather than the numbers:

1. **The engine could not draw where the roll was specified to happen.** `step()` takes
   `(state, commands, content, rules, options)` and no PRNG — since ENGINE_VERSION 8 the
   five streams live in the application-owned career envelope and every existing draw
   happens in `game/` at a boundary. Activity starts happen inside stage 3 of `step()`,
   which the application cannot reach. **The roll stream now lives inside `SimState`** (§8),
   which is the same argument the draft already made for stats and perks, applied one field
   further.
2. **Perks could sink a bar budget.** §6.8's verified daily margins are Nutrition +9,
   Hygiene +4, Movement +2 — that is 2–8% of daily restore. A disadvantage roll is worth
   −13.9%. The draft's Methodical perk put disadvantage on `meal`, which carries 105 of the
   105-point Nutrition budget: a Methodical character ate −5.6/day, and a
   Methodical-plus-Easygoing one −11/day. That is the spiral the draft's own §9.2 ruled out
   two paragraphs earlier. **No perk may now lower a bar output** (§5.0); every perk
   downside is paid in time.

Also changed: the E-multiplier table now includes the always-on crit/fumble rule it
previously omitted (§9.2); the worst legal start is a named fixture rather than an
arithmetic average (§9.3); `nap` moved to the ungraded list (§6.6); the forecaster is
forbidden from drawing (§8.3); the migration branch no longer contradicts the
stamp-forward invariant it cites (§8.4); and the "+2 stat in a week" claim, which the cap
and cost rules make arithmetically impossible, is gone (§7).

---

## 1. What is missing

Every activity in the game produces the same number every time. A meal is +35 Nutrition on
Day 1 and +35 Nutrition on Day 40, whoever the sim is. The character has a name, pronouns,
a palette and two preferences, and **none of them touch a single outcome**.

That is the gap. SPEC §9's title is "A person, not a dashboard", and the systems under it
are all flavor: preferences pick *which* activity the planner books, never *how it goes*.
There is no answer to "is my sim good at this?", so there is nothing to get better at, and
watching a completion is watching a timer end.

This spec adds three things, in one loop:

1. **Stats** — four numbers saying how good this person is at a kind of thing, which grow
   from doing it.
2. **Perks** — two rolled traits saying who this person is, which change the *shape* of the
   roll rather than its center.
3. **The roll** — every activity that produces something resolves a `d20` check at start,
   lands a letter grade from **A+ to F−** at completion, and delivers a real, visible bonus
   or penalty to the bar it feeds.

The payoff: **a completion becomes a small event with a result you did not already know**,
and the results improve over a career because the sim is learning.

---

## 2. RimWorld, studied

RimWorld is the reference because it solved this exact problem — a colonist who is a
*person* rather than a work-rate — with two systems that are easy to confuse and expensive
to merge.

| RimWorld | Shape | Effect model |
|---|---|---|
| **Skills** (12, level 0–20) | continuous, earned, per-domain | drive work speed and product quality; XP from doing the work |
| **Passion** (none / interested / burning) | a per-skill modifier on *learning* | ×0.35 / ×1.0 / ×1.5 XP — changes growth, never output |
| **Traits** (0–3, drawn from mutually exclusive degree-spectrums) | discrete, fixed at generation | `statOffsets` (flat), `statFactors` (multiplicative), `skillGains` (a head start), `disabledWorkTags` (hard gates), mood and behavior gating |
| **Backstories** | discrete, fixed | skill gains and hard work-type bans |
| **Quality** (Awful → Legendary) | the *outcome* of a made thing | a Gaussian draw whose **center rises with skill**, discretized into named tiers |

Four findings drive the design.

1. **Skill moves the center of a distribution; it does not remove the roll.** A level-20
   crafter still makes a merely "good" item roughly 40% of the time and cannot make a
   legendary at all without an inspiration. Mastery buys a *floor* and a better *average* —
   not certainty. This is the most important thing to copy: certainty is boring, a coin-flip
   is unfair, and centered-on-skill is neither.
2. **Traits act through three mechanisms and they are genuinely different.** A flat offset,
   a multiplier, and a hard gate are not interchangeable, and RimWorld keeps them separate
   in data. §5 keeps the same three.
3. **Passion changes growth, not output.** Splitting "how fast you learn" from "how well you
   do" is what stops a trait from being a permanent free bonus.
4. **Incapability makes characters.** A pawn who *cannot* cook is more memorable than one
   who cooks at 80%. Hard gates are a design tool, not a punishment.

**What we refuse.**

- **20 levels and 12 skills.** Nine graded activities cannot fill twelve skills, and §6.5
  already rules that shipping a dormant mechanic and calling it a consequence is the mistake
  it exists to prevent. **Four stats, levels 1–10.**
- **Skill rust.** In a v1 whose arc is seven days, decay cannot read as a system — it reads
  as a bug in the number that just went up. **Rejected for v1.**
- **Passion as a separate axis.** Perks already occupy it, in RimWorld's own
  mutually-exclusive-family shape. A third per-stat axis is a knob with no decision on it.
- **Hard gates in v1.** "Incapable of cooking" is a great mechanic and a poor fit for a game
  whose planner must feed the sim unattended (§7.2's reactive net assumes every need has an
  answer). Gates are the mechanism §5.4 leaves open, and land with v2's job types.

---

## 3. The ruling: what a stat is and what a perk is

> **A stat answers "how good is this person at this kind of thing, right now?" It is
> continuous, earned, moves the center of the roll, and grows.**
>
> **A perk answers "who is this person?" It is discrete, fixed at creation, fires only where
> its tags match, and changes the shape of the roll — never its center.**

| | Stat | Perk |
|---|---|---|
| **Domain** | every activity that names it | only where its tags match |
| **Roll effect** | sets the modifier (the center) | grants advantage, or offsets globally (the shape) |
| **Over time** | grows with use (§7) | never changes |
| **Count** | all four always present | exactly two, one per family |
| **Cost model** | none — it is earned | paid in time (§5.0) |
| **Failure it prevents** | "my character is a dashboard" | "every character plays identically" |

The distinction is not cosmetic. **Advantage is not the same as +3**, though both average
near the same place: advantage lifts the floor and barely moves the ceiling, while an
offset slides the whole curve. That is the difference between "reliable at quiet work" and
"better at quiet work", and it is why a perk cannot be re-expressed as a stat bonus without
losing what it meant.

The line also tells you where a future idea belongs. *"She cooks well"* → a stat. *"She
cooks well when nobody is watching"* → a perk.

---

## 4. The stats

Four, integers **1–10**. Every one governs at least two activities; none ships dormant.

| Stat | What it is | Grades | Also earns XP from |
|---|---|---|---|
| **Strength** | physical output and exertion | `weights`, `treadmill`, `stretch` | — |
| **Dexterity** | hands, cooking, fine motor | `meal`, `snack` | — |
| **Vitality** | how well the body takes care | `shower`, `quickwash`, `brush` | `nap` |
| **Intellect** | attention, learning, craft-of-the-mind | `practice` | `read` |

`sleep`, `nap`, `read`, `toilet`, `package` and `idle` are never graded (§6.6).

**The modifier.** `statMod = statLevel − 5`, range **−4 … +5**; a stat of 5 is exactly par.
A D&D ability modifier with the second conversion step removed, because a 1–10 range does
not need one.

**Starting values.** Each stat rolls uniformly on **4…7** at career creation, from the roll
stream (§8). The floor of 4 is derived in §9.3, not chosen.

**Intellect's loop is the one to notice.** It grows from `read` — the activity the routine
planner has booked for productive free time since ENGINE_VERSION 9, and which currently
does *nothing at all* — and pays out in `practice`. Reading makes your guitar practice
better. That closes an existing hole rather than opening a new one.

---

## 5. The perks

Two per character, one from each **family**. Within a family the options are mutually
exclusive — RimWorld's degree-spectrum, and the same shape as SPEC §9.2's preference
categories, which is why the two can eventually merge (§14).

### 5.0 The rule that shapes the whole family design

> **A perk never lowers a bar output. Every perk downside is paid in time.**

This is derived, not chosen. §6.8's verified daily margins are **Nutrition +9, Hygiene +4,
Movement +2** — between 2% and 8% of each bar's daily restore. Every shape effect in this
system is worth **±13.9%** (§9.1). A perk penalty is therefore an order of magnitude too
coarse to sit on the wrong side of any of those margins: the audited first draft put
disadvantage on `meal`, which carries 105 of the 105-point Nutrition budget, and produced
a −5.6/day deficit for half the cast — the exact spiral §9.3 exists to rule out.

Time is the right currency instead, and not by elimination: SPEC §8's whole thesis is that
*"Health buys speed; speed buys free hours; Practice is what free hours are for."* A perk
that costs fifteen minutes a day is spending the resource the game is already about, out of
a 12.8-hour waking budget rather than a 2-point one.

### 5.1 Approach — care, expressed as advantage and time

| Perk | Advantage on | Duration on the same tag |
|---|---|---|
| **Creative** | `expressive` = `meal`, `practice` | **×1.15** |
| **Methodical** | `routine` = `brush`, `quickwash`, `shower`, `stretch` | **×1.15** |

*The things you care about, you do better and slower.* Untagged activities (`snack`,
`weights`, `treadmill`) are untouched by this family, which is what keeps it conditional
rather than a global bonus — and the family self-balances, because whoever's tag set is
larger both gains more output and pays more time.

### 5.2 Drive — center and pace

| Perk | Roll offset | Duration, everything |
|---|---|---|
| **Perfectionist** | **+2** on every roll | **×1.15** |
| **Easygoing** | none | **×0.85** |

Perfectionist buys ≈+9.25% output with ≈15% of the day's activity time; Easygoing sells
nothing and buys the time back. Neither dominates: one plays for quality, the other for
free hours, and §8 says free hours are what the game is for. Verified in §9.2.

Worst-case duration stacking is Creative + Perfectionist on an `expressive` activity:
×1.15 × ×1.15 = **×1.3225**, taking a 30-minute meal to 40. §6.8's routine time cost moves
from ≈3.2 h to ≈3.7 h of 16 waking hours — inside its own stated ≈6.3 h worst case.

### 5.3 Social energy — specified, deliberately not shipped, flagged for veto

| Perk | Advantage on | Duration |
|---|---|---|
| **Introvert** | `solitary` | ×1.15 |
| **Extrovert** | `social` | ×1.15 |

**Ruling: this family does not ship in v1.** v1 has no graded `social` activity, so
Extrovert's tag set would be empty and the perk would be a rolled trait that does nothing —
§6.7's decoration class, and now a build failure rather than an opinion (§10, assertion 4).
It lands with the first graded conversation (docs/03, v3) as two lines of content and no
engine change.

**[FLAGGED FOR JOE — SPEC §0 override convention.]** Introvert/Extrovert was named
explicitly in the brief and is being deferred on a mechanical argument. If the flavor is
wanted in v1 regardless, the cheapest honest route is to tag `practice` and `read` as
`solitary` and ship **Introvert alone as a third Approach option** — a three-way family
rather than a pair — leaving Extrovert for v3. That keeps every shipped perk live and costs
one content entry.

### 5.4 The mechanism table

Three mechanisms, kept separate in data exactly as RimWorld keeps them:

| Mechanism | Field | Used by | Reserved for |
|---|---|---|---|
| Roll offset | `{ kind: "rollOffset", value }` | Perfectionist | — |
| Roll shape | `{ kind: "rollShape", shape, tag }` | Creative, Methodical | Introvert/Extrovert (v3) |
| Duration factor | `{ kind: "durationFactor", percent, tag? }` | all four | — |
| Hard gate | *not implemented* | — | v2 job types (§2) |

---

## 6. The roll

### 6.1 The check

```
natural  = d20                          (advantage: 2d20 keep high; disadvantage: keep low)
total    = natural + statMod + perkOffset
margin   = total − DC                   (DC = 10, one global value, content/rates.json)
grade    = band(margin), then the crit/fumble step
```

**One global DC, not one per activity.** Every graded activity except `practice` feeds a
bar whose daily budget §6.8 has already balanced, so any DC other than 10 would silently
re-balance that budget and buy nothing. Difficulty variety comes from *which stat an
activity names* and from perk tags, both of which are real. If v2's job tasks want harder
checks they add the field then; adding it now is the speculative-knob failure YAGNI names.

**Crit and fumble.** A natural 20 moves the grade **one step up**, a natural 1 moves it
**one step down**, both clamping at the ends of the ladder. Deliberately *not* "a natural 20
always scores an A": that would let a novice hit top marks 5% of the time and throw away
RimWorld's best property, that mastery buys a floor. Under advantage, "natural" means the
kept die. At par the rule is provably a no-op (§9.1), so it costs the balance nothing there
— but it is **not** a no-op anywhere else, which is why §9.2's table includes it.

### 6.2 What is explicitly **not** in the roll

**No bar value, no Health, no `m_out`, no `m_speed`, no adjacency bonus, no well-fed state.**

- **No death spiral.** §6.6 guarantees that low health costs time, never effectiveness.
  Grading *does* scale effectiveness, so the guarantee survives only because the roll's
  center is a stat, and **a stat never falls when a bar falls**. There is no feedback edge
  from bars back into the roll: a bad day cannot make tomorrow's rolls worse.
- **No double-counting.** Well-fed (§6.5), Minty-fresh, Shower→Practice (§6.7) and `m_out`
  (§6.6) already multiply outputs. Feeding them into the roll would apply each twice.

The roll is a **new, independent factor** multiplying alongside the existing ones. §9.5
checks the stacked result against §8's practice pacing.

### 6.3 The grade ladder

Fifteen grades, banded on the **margin**, so a better character shifts up the same ladder
rather than getting a different one.

| Grade | Margin | Multiplier | Reference rolls | p at par |
|---|---|---|---|---|
| **A+** | ≥ +10 | 150% | 20 | 5% |
| **A** | +9 | 140% | 19 | 5% |
| **A−** | +8 | 130% | 18 | 5% |
| **B+** | +7 | 120% | 17 | 5% |
| **B** | +5 … +6 | 115% | 15–16 | 10% |
| **B−** | +4 | 110% | 14 | 5% |
| **C+** | +2 … +3 | 105% | 12–13 | 10% |
| **C** | 0 … +1 | 100% | 10–11 | 10% |
| **C−** | −2 … −1 | 95% | 8–9 | 10% |
| **D+** | −4 … −3 | 90% | 6–7 | 10% |
| **D** | −5 | 85% | 5 | 5% |
| **D−** | −6 | 80% | 4 | 5% |
| **F+** | −7 | 70% | 3 | 5% |
| **F** | −8 | 60% | 2 | 5% |
| **F−** | ≤ −9 | 45% | 1 | 5% |

Contiguous and exhaustive over the reference character's twenty outcomes — rolls 1…20 map
onto the ladder with no gap and no overlap. That is a schema-checkable property, not a claim
(§10, assertion 3).

At par the shape is a believable report card: **A 15% · B 20% · C 30% · D 20% · F 15%** —
fat in the middle, because the middle bands are wide.

### 6.4 How the grade reaches the bar

Three engine affordances, all of which already exist, and one that did not and is added in
§8.

**The roll resolves at start.** It joins `mSpeed`, `wellFed` and `pointsMultiplier` on the
`ActiveTimedActivity.sampled` record, which is exactly what that record is for (§6.6:
*"both multipliers sample at activity start"*). A mid-activity save and reload replays the
same roll, because the roll is state rather than a coin flipped later.

**The base effect fills exactly as today.** `effectTotalsFixed` is untouched: the integer
remainder-carrying accumulator, the phase fill, the pro-rata early stop and the cap-waste
forecast all keep working byte for byte, because none of them can see the grade. *(The one
exception is duration, for a perk-carrying character — §5.2's factor enters
`activityDurationTicksAtCurrentSpeed`, per §8.2.)*

**The grade is delivered at completion, as one signed instant delta:**

```
gradedFixed = (totalFixed × multiplier100 + 50) / 100, integer-floored   // round-half-up
bonusFixed  = gradedFixed − totalFixed                                    // signed; 0 at C
```

pushed onto `SimState.pendingInstantDeltas` — a field that already exists and is already
summed and clamped by the single per-tick reducer. No new fill machinery and no new
rounding rule: the same integer round-half-up form as `fillStartTick`'s `frac100`.

Four properties fall out for free:

1. **The reveal is honest.** Nothing observable depends on the grade until completion — the
   bar fills at the ungraded rate the whole way — so revealing the die at completion leaks
   nothing and pre-empts nothing. The roll was decided at start; only the telling waits.
2. **Stopping forfeits the grade.** An activity that never completes never pushes a delta.
   That is §6.7's stop-cancels-bonus rule, by construction rather than by a second path.
3. **The bar visibly pops.** A real jump at a real instant — up to +50% of base on an A+,
   −55% on an F− — which a graded progressive fill could never produce.
4. **It can never drive a bar below where the activity started it.** The worst multiplier is
   45%, so `fill + bonus` is always a positive fraction of the base. A terrible shower
   leaves the sim cleaner than before, just barely.

**Timing (audit finding).** Stage 4 drains `pendingInstantDeltas` *before* the activity
block that completes an activity, so a delta pushed at completion commits on the **next**
tick. That is one game-minute and is stated rather than hidden: assertion 7's event boundary
and §11.1's bar-pop beat both straddle two ticks, and the UI reads the delta from the tick
it lands on, not the tick the grade was announced on.

**Source uniqueness.** `applyBarContributions` throws on a duplicate contribution source, by
design. The grade delta's source is therefore `grade:<cardId>` — unique per completion, so
it can never collide with an adjacency `barDelta` landing on the same commit.

**Only positive outputs are graded.** Cross-effects (`weights` −5 Nutrition, `treadmill` −5
Hygiene) and every passive decay are ungraded, the same rule §6.5's well-fed bonus follows.
A bad workout does not also make you hungrier.

**Practice** has no bar effect; its graded output is points, and the multiplier joins the
existing stack at award time. Practice builds its own DTO in `beginCard` and pays in
`completeActivity` — **both code paths carry the roll**, not just the timed one.

**Wrinkles compose after the roll.** Burned breakfast overrides `effectTotalsFixed` to +10
after start; the grade then multiplies the overridden total, so an F− burned breakfast
delivers +4.5. That is correct and intended: the wrinkle says what was cooked, the roll says
how it went.

### 6.5 Cap-waste is a feature here, on purpose

An A+ meal at Nutrition 90 fills into the clamp and throws its whole +50% bonus away. §6.7
already treats cap-waste as the thing that makes *"moving dinner later a real decision"*;
the roll sharpens it, because your best rolls are worth most when you needed them. The
forecast chip shows the waste before you commit, exactly as today.

### 6.6 What is not graded

| | Why |
|---|---|
| `sleep` | §6.1 pins the Energy closure at exactly −80/+80 per day. Variance here ratchets into nightly urgent sleep — a verified failure mode. Sleep's restore is scaled by nothing, and stays so. |
| `nap` | **Added on audit.** The nap fires reactively at Energy <30 and urgent sleep at <15: its output is the only graded output sitting inside a 15-point margin against an URGENT event, and an F− nap would spend a third of that margin. It is also hard-bounded to one effective use per day, so it is the one activity the design has already ruled must not vary. It still earns Vitality XP. |
| `read` | No bar effect. It earns Intellect XP (§7) and is never graded. |
| `toilet`, `package`, `idle` | Nothing to grade. A graded toilet is a joke with a one-day shelf life. |

A **flavor nap** — a later nap whose effect totals are zeroed — would in any case roll
nothing and award nothing. With `nap` ungraded the case is moot for the roll; it still
awards no XP, because XP is for an activity that did something.

---

## 7. Growth

Stats grow from **doing**, not from succeeding — RimWorld's rule, and the one that stops a
lucky streak compounding into a better character.

- Every completed activity that names a stat awards **`baseMin` XP** to that stat: a 60-min
  workout is 60 Strength XP, a 5-min brush is 5 Vitality XP. Duration-proportional, so no
  activity needs its own weight. **`baseMin`, not the perk-adjusted duration** — otherwise
  Perfectionist would buy 15% faster growth as well as better output.
- **Daily cap 100 XP per stat**, reset at the wake boundary, using the same
  `crossedWakeBoundary` reset `napEffectiveUsesToday` already uses. Without it, three meals
  a day would race Dexterity ahead of everything else.
- **Advancing from level L to L+1 costs `100 × L` XP.** Level 10 is the cap; XP at cap is
  discarded rather than banked, so the save never carries a number that means nothing.
- Grade does **not** affect XP, and a stopped activity awards none — same rule as the grade
  delta, same reason.

**Verified pacing** at shipped content, from a stat of 5 (cost 500):

| Stat | XP on a typical day | 5 → 6 |
|---|---|---|
| Strength | 75 (weights 60 + stretch 15) | ≈ 6.7 days |
| Dexterity | 90 (three meals) | ≈ 5.6 days |
| Intellect | up to 100 (practice + read; capped) | ≈ 5 days when played hard |
| Vitality | 30–75 (shower, two brushes, an occasional nap) | ≈ 7–16 days |

A seven-day v1 career therefore gains **+1 in the stat it leans on, and no more**: two
levels from any legal start costs at least `100×4 + 100×5 = 900` XP, and the daily cap
allows at most 700 in a week. (The first draft claimed "+2, occasionally" — the audit
caught that its own cap and cost rules make that impossible.) Slow enough that §9's balance
argument holds over the week; fast enough that the letter grades visibly trend — you watch
C+ become B, which is the entire point of putting a number on a person.

---

## 8. Determinism, storage, and the engine

### 8.1 The roll stream lives in `SimState`

**This is the audit's first blocking finding and the design's largest change.** The first
draft put a sixth stream in `PrngSnapshot`. That cannot work: `step()` takes
`(state, commands, content, rules, options)` and no PRNG, the five streams have lived in the
application-owned career envelope since ENGINE_VERSION 8, and every existing draw happens in
`game/` at a boundary the application can see. Activity starts happen inside stage 3 of
`step()`, which the application cannot reach until the tick is over.

So the roll's stream record goes **inside `SimState`**, which is the same argument this spec
already makes for stats and perks — the engine and the golden replay must both see it —
carried one field further:

```ts
rollStream: { state: uint32; calls: number }     // one mulberry32 record, in SimState
```

seeded at career creation as `(rootSeed ^ 0x299f31d0) >>> 0`, continuing the π-hex series
`prng.ts` already uses. `PrngSnapshotSchema` is **unchanged** at five streams, so the career
envelope's PRNG field is untouched and there is exactly one migration surface (§8.4) instead
of two. `mulberryNext` is promoted from module-private to exported so `step()` can advance
the record functionally and `SimState` stays a plain JSON DTO with no class instances —
master §4's rule, intact.

**No transcendental math.** `d20 = 1 + floor(value × 20)`, clamped to 20. Advantage draws
twice. Every downstream step — modifier, margin, band lookup, multiplier — is integer
arithmetic on integer inputs.

**Draw discipline.** Exactly one draw per graded start, two under advantage or disadvantage,
taken at start and never again.

### 8.2 Duration factors

`activityDurationTicksAtCurrentSpeed` gains a perk-percent argument and is used by **three**
callers that must agree: the activity start, the snapshot's `durationTicksAtCurrentSpeed`
card field, and the forecaster. The rounding order is pinned here so two implementations
cannot disagree by a tick:

```
ticks = ceil( baseMin × approachPct × drivePct × 600000 / (10000 × (300000 + energyFixed)) )
```

— one ceiling, at the end, over integers. Maximum magnitude `1440 × 115 × 115 × 600000 ≈
1.14e13`, well inside the safe-integer range. Wrinkle slowdowns compose in the same
expression, before the ceiling.

### 8.3 The forecaster never draws

**Audit finding, and a subtle one.** The forecaster runs the *same* `step()` on cloned
state. A cloned stream drawn forward reproduces the **exact** rolls the real run will make,
so predicted bar trajectories and conflict warnings would embed real future grades —
contradicting §11.2's "the grade is never previewed" and SPEC §7.5's precedent that undealt
randomness is treated as absent.

> **Normative: `StepOptions.forecast` suppresses the draw. Under it every future roll is
> modelled as grade C — multiplier 100, delta 0 — and `rollStream` is not advanced.**

This is exactly right rather than merely safe, because §9.1 makes grade C the expected
outcome at par. The §16.3 forecaster-vs-sim agreement tests get a stated carve-out: they
agree on everything except the grade delta, which the forecast declines to predict.

### 8.4 `ENGINE_VERSION` 11 → 12

Behavior changes, both goldens are re-recorded, and `SimStateSchema` — a `strictObject` —
gains four fields, so a v8–v11 envelope cannot be stamped forward.

**The migration is a transform branch, not a stamp-forward.** The first draft told the
implementer to widen `STAMP_FORWARD_ENGINE_VERSIONS` to `[8, 9, 10, 11]` *and* apply field
additions in the same pass, which contradicts that constant's own documented invariant:
*"A bump that does not change the envelope belongs on this list, and a bump that does needs
its own branch above."* v12 changes the envelope. So:

- `STAMP_FORWARD_ENGINE_VERSIONS` keeps its meaning and becomes empty — no shipped version
  currently shares v12's shape, and the next shape-preserving bump adds 12 to it.
- A new `PRE_ROLL_ENGINE_VERSIONS = [8, 9, 10, 11]` is handled by `migrateToV12`, so a v9
  career still reaches the present in **one hop** — the failure v10's own note describes is
  not repeated, only the constant it lives on changes.
- A third constant, `MIGRATABLE_ENGINE_VERSIONS`, is the union, and it is what the coverage
  gate iterates. Splitting the lists must not quietly halve what that gate checks: a player
  cares whether their save loads, not which branch loaded it.

`migrateToV12`:

- creates `rollStream` from the career's own `rootSeed` by the standard
  `(rootSeed ^ salt) >>> 0` formula with `calls: 0`. Nothing is replayed and no draw count
  is inferred, exactly as the P5 PRNG relocation did;
- draws stats and perks from that fresh stream, so a migrated career gets **precisely what a
  new career on the same seed would have rolled**. The character always had these traits;
  the game did not model them yet. Seeding everyone at a flat 5 with no perks would have
  been the cheaper lie;
- leaves `statXpToday` at 0 — a career migrated mid-day starts its cap fresh, which can
  only be generous;
- leaves an in-flight activity's `sampled.roll` **absent**. `roll` is optional, so that
  activity completes ungraded and delivers no delta. One activity, once, at the version
  boundary.

`perks` and every stat id are validated against content in `validateSimContentRefs`, like
every other content reference in the envelope.

---

## 9. Balance

### 9.1 The identity that makes this safe

> **At a stat of 5 with no perk offset, the expected multiplier is exactly 100.00%.**

Not approximately. The fifteen multipliers, weighted by the reference character's twenty
equally-likely outcomes, sum to exactly **2000**:

```
150 + 140 + 130 + 120 + 2(115) + 110 + 2(105) + 2(100) + 2(95) + 2(90) + 85 + 80 + 70 + 60 + 45  =  2000
2000 / 20 = 100
```

It is an integer identity, so it is a unit test with no simulation in it.

Two more exact results:

**Crit/fumble is a no-op at par, and only at par.** At `statMod` 0 a natural 20 is already
A+ and a natural 1 already F−, so both adjustments clamp. Everywhere else the rule bites,
which is why §9.2 includes it.

**Advantage and disadvantage are exactly symmetric.** For any pair `(a, b)`,
`mult(max) + mult(min) = mult(a) + mult(b)` — a multiset identity, true for any ladder, and
it survives crit/fumble because the adjusted multiplier is a pure function of the kept die.
So `E[advantage] + E[disadvantage] = 2 × E[plain]` at **every** stat and offset. At par that
is **113.875% and 86.125%** — a perk worth ±13.9% where its tags fire, which is a real trait
and not a rounding error, and which is precisely why §5.0 forbids spending it against a
2-point margin.

### 9.2 The whole curve — crit/fumble included

The first draft's table omitted the crit/fumble rule, which is never off in play. Corrected:

| Stat | `statMod` | E[multiplier] | (draft 1 claimed) |
|---|---|---|---|
| 1 | −4 | **82.25%** | 82.00% |
| 4 | −1 | **95.25%** | 94.75% |
| 5 | 0 | **100.00%** | 100.00% ✓ |
| 6 | +1 | **104.50%** | 105.25% |
| 7 | +2 | **109.25%** | 109.75% |
| 10 | +5 | **120.25%** | 120.50% |

Mean over a fresh character's uniform 4…7 draw: **102.25%**. Perfectionist's +2 is therefore
worth **+9.25%** at par, not +9.75%.

**Upward drift is structurally safe.** A grown stat inflates a restore, the bar clamps at
100, and the surplus becomes cap-waste — which §6.7 treats as a decision rather than a leak.
Energy is exempt entirely, because both sleep and nap are ungraded, so the one closure that
must be exact stays exact.

### 9.3 The worst legal start, as a named fixture

Draft 1 computed its floor at `perkOffset = 0` while also mandating one Drive perk per
character — describing a character that could not legally exist. Under §5.0 no perk offset
is negative any more, so the worst legal character is the one whose perks help **least**:

> **`worst-legal-start`: all four stats at 4 · Creative (so no `routine` advantage on the
> Hygiene activities) · Easygoing (no offset) · `preferredWorkout: treadmill` (the −5
> Hygiene cross-cost).**

At `E = 95.25%`:

| Bar | §6.8 restore | delivered | vs decay | net/day |
|---|---|---|---|---|
| Nutrition | 105 | 100.0 | −96 | **+4.0** ✓ |
| Hygiene | 60 | 57.2 | −56 / −61 treadmill | +1.2 / **−3.8** |
| Movement | 50 | 47.6 | −48 | **−0.4** |

Movement drifts 0.4/day against §6.8's 19-point margin above the Stretch net at 35 — a
felt consequence followed by a rescue, which is the designed behavior. Hygiene on treadmill
days is the tightest case and is why the floor is 4 and not 1: at stat 1 (82.25%) Nutrition
nets −10/day, which is a spiral.

**This is a derivation, not a verification.** §10's assertion 5 is the falsifiable gate,
run against this exact fixture rather than a seed-rolled career. If it fails, the floor
rises to 5 and this table is re-derived — the band is never widened to green a test
(§16.3).

### 9.4 The clamp, the trough, and an amendment to §6.8

**§9.1's identity is pre-clamp.** `applyBarContributions` clamps once at 100, so a positive
grade delta near cap is partly or wholly wasted while a negative one always lands in full.
Realized delivery is therefore strictly **at or below** the identity wherever a bar sits
near its cap — systematically at dinner. §6.8's budgets survive as an *upper* bound in
expectation; the realized figures come from the re-derived golden, not from this identity.
The first draft claimed the budgets survived "untouched", which was not true.

**The pre-breakfast trough moves, and §6.8 needs amending.** An F− dinner delivers a
−19.25 Nutrition delta, so the overnight decay starts from a lower point and the
min-over-all-ticks can fall well under the current `nutritionMinBand [50, 55]` — far enough
to reach the reactive snack band at 35, which §6.8 says *"never fires in normal play"*.

> **Amendment.** In the graded world the snack net is reachable after a poor evening meal,
> and that is desirable rather than tolerated. SPEC §9.4's exposure guarantee exists
> precisely because *"a player could otherwise finish v1 never seeing a Snack, Stretch, Nap,
> URGENT card, or focus penalty"* — and a mechanism that visits the band is strictly better
> than a deck engineered to. §6.8's "the snack never fires" assertion is replaced by:
> **the snack net fires only following a meal graded D or worse**, and
> `nutritionMinBand` is re-derived from the new unattended golden with the movement recorded
> in prose (§16.3's normative rule: the data file governs, and bands are never quietly
> widened).

### 9.5 Practice pacing, at the legal extreme

The grade multiplier joins `m_out` × well-fed × minty × shower→practice as a fifth
independent factor. At par it contributes exactly 1.00, so §8's stated pacing (plain blocks
≈98/day → L3 around Day 7–8) is unchanged for a starting character.

The extreme is **Creative** (advantage on `practice`) + **Perfectionist** (+2) +
**Intellect 7** (+2) — all three of which are rolled, not chosen, so this is luck rather
than min-maxing. Advantage at an effective +4 yields **E = 130.125%**, taking §8's
fully-stacked ≈122/day to ≈159/day and L3 from Day 6–7 to **≈ Day 5**.

> **Amendment to §8.** Stated L3 pacing becomes: plain blocks Day 7–8 · fully stacked
> Day 6–7 · fully stacked with favorable perks and a high Intellect roll **Day 5**. §8's own
> text already rules early L3 acceptable — *"Otherwise L3 lands early in v2 — fine; mastery
> accrues forever"* — so this is a band being restated honestly, not widened to pass.

---

## 10. Assertions

Tests, not claims. The first four need no simulation.

1. **`Σ multiplier over the reference ladder === 2000`.** The E = 100.00% identity, as
   integer arithmetic.
2. **`E[advantage] + E[disadvantage] === 2 × E[plain]`** for every stat 1…10 and every perk
   offset — a property test over the exact distribution, not a sample.
3. **The ladder is contiguous and exhaustive.** Reference rolls 1…20 map onto exactly one
   grade each. Enforced in the content schema, so a bad edit to `content/grades.json` fails
   `validate:content` rather than a play session.
4. **No dormant stat, no dormant perk.** Every stat governs ≥1 graded activity; every
   shipped perk's tag set is non-empty and contains ≥1 activity the unattended planner books
   daily. §5.3's ruling as a build gate rather than prose.
5. **`worst-legal-start` survives.** The §9.3 fixture, unattended, seven days: every bar ≥65
   at the morning check from Day 2, zero URGENT events, and Health ≥75 at the Day-3 morning
   check on the all-zeros recovery run — the existing §16.3 bands, unwidened.
6. **No perk lowers a bar output.** Every perk effect in `content/perks.json` is a
   non-negative `rollOffset`, a `rollShape` of `advantage`, or a `durationFactor`. §5.0 as a
   schema refinement, so the rule cannot be broken by a content edit.
7. **Stop forfeits the grade.** A stopped graded activity pushes no `pendingInstantDeltas`
   entry and awards no XP.
8. **The reveal cannot lie.** The grade the UI stamps equals the grade the engine applied —
   the guarantee `adjacencyGranted` exists to provide, against the failure
   (cancel-inherits-celebration) it exists to prevent.
9. **Determinism.** Two runs from one seed produce an identical grade sequence; a
   save/reload mid-activity replays the same roll; **the forecaster advances `rollStream` by
   zero calls** (§8.3) — asserted on the count, not on the outcome.
10. **Both goldens re-recorded** at ENGINE_VERSION 12, and `content/harness-bands.json`
    re-derived from the new unattended run with the movement recorded in prose, per §16.3.

---

## 11. The beat: dice, grade, pop

One completion, one sequence, ~800 ms, never blocking the sim.

### 11.1 What the player sees

| ms | Beat | Where |
|---|---|---|
| 0 | **die tumbles** — a d20 face cycling six frames, settling on the natural roll | `notice` region |
| 240 | **grade stamps** — the letter, scale-in with overshoot, plus a `Dex 6 · +2` modifier line | `notice` region |
| 600 | **bar pops** — the fed ring flashes and scales, the delivered `+26` floats off it | `status` region |

The banner lives in the **`notice` region** — docs/07 defines that rectangle as "chips and
toasts", and a roll result is a toast. No new free-floating panel and no new `zIndex`
literal: it names a region and a layer, like everything since P8.

The bar pop lands in `status` because that is where the rings are. Two surfaces, because the
sequence reports two different facts: *how it went*, and *what it did to you*. The pop shows
the **numeric delta** as well as moving the ring, which matters because the smallest graded
delta (a brush at F−, −5.5 display points) is less than one of the ring's twelve wedges.

**The animation never gates the simulation.** The roll is already decided and, one tick
later, already applied; the UI replays a result, exactly as the audio router announces what
the engine *did* rather than what a forecast predicted. At 2× and 4× speed, or when
completions arrive faster than the sequence runs, banners **collapse to the newest** rather
than queueing — a backlog of stale dice is worse than a dropped one.

**NOTICE contention.** docs/07 caps NOTICE at three surfaces, and at **one** on a narrow
viewport where the region folds over the stage. The morning block produces three graded
completions back to back.

> **Rule: a grade banner never evicts SPEC §7.4's undo toast.** Undo is a five-second window
> on a destructive action the player took; a grade is a report on something the sim did. If
> only one slot is free and the undo toast holds it, the grade banner is dropped.

### 11.2 The queue card

A running or queued graded card carries a small **d20 glyph and its governing stat**. The
forecast chip keeps showing the **base** effect, and the glyph marks it as an expectation —
honest, because §9.1 makes that expectation exactly right at par. The grade is never
previewed, and the running card never reveals its already-rolled result.

### 11.3 Stats and perks need a home too

The completion beat is the payoff; it is not the whole surface. The promise is *"you watch
C+ become B"*, and nothing in §11.1 shows a stat, its XP progress, or the two perks.

- **Identity-lite (SPEC §9.1)** gains a **perk reveal** beside the existing preference
  reveal — two rolled traits shown as tags, in the shape §9.2's preference tags already use.
- **The `focus` region's information panel** carries a character block: four stats with
  level, a slim XP bar to the next level, and the two perk tags. `focus` is the region
  docs/07 assigns to "what asks", it scrolls rather than growing, and this is the panel that
  answers "who is my sim".
- The HUD is **not** touched. SPEC §11.1 caps its hierarchy, and four more rows is exactly
  the overhang docs/07 §1.1 was written to stop.

### 11.4 Audio

Two cues, synthesized into the existing bank and authored in `content/audio.json`:

- **`grade.high` (A, B) / `grade.mid` (C) / `grade.low` (D, F)** — one plays at the stamp.
  It **replaces** `queue.complete` for a graded activity. Not an extra sound, a more
  specific one; stacking both is the doubled-cue failure the router exists to prevent.
  Ungraded completions keep `queue.complete` unchanged. The band mapping is fixed here, not
  left to content.
- **`bar.pop`** — a short pluck at the bar beat, fired by the UI timeline through
  `CueRouter.onBarPop()`. That path exists in the exact shape it needs: `onFootstep()` is
  fired by the renderer's walk cycle rather than by a domain event, for the same reason, and
  sound policy stays owned by the router either way.

`grade.high` is **not** the adjacency figure. design.md §2 reserves the one bright ascending
motif for reward moments; a good roll is a good roll, not a prize.

### 11.5 Accessibility

- **The grade is a letter**, so it is never colour-only. Colour is redundant reinforcement,
  which is what SPEC §11.6 asks for.
- **Reduced motion:** the die renders already settled on its face, the grade appears without
  the scale-in, the bar reaches its new value without the pop. Every state change kept,
  every tween dropped — resolved once through `resolveMotion`, never a per-component branch.
  Three new `MOTION` entries and three new triggers, because the table's rule is one trigger
  per motion: `dieTumble` (240 ms, 6 frames, decorative, trigger `roll-revealed`),
  `gradeStamp` (360 ms, **not** decorative — it is the information, trigger `grade-stamped`),
  `barPop` (200 ms, decorative, trigger `bar-popped`).
- **Screen reader**, at the two existing verbosities:
  `full` → "Meal complete. Rolled 14, B minus. Nutrition plus 26."
  `brief` → "Meal complete. B minus."

---

## 12. Content

**`content/stats.json`** — the four stats, their labels and their one-line blurbs. The
activity→stat map lives on **the activity**, not here: one edge, authored once, and the
activity schema can then enforce the graded/stat pairing in the same place it already
enforces the nap's effective-use rule.

**`content/perks.json`** — families, options, effects. RimWorld's three mechanisms kept
separate in the schema rather than flattened:

```jsonc
{ "kind": "rollOffset",     "value": 2 }
{ "kind": "rollShape",      "shape": "advantage", "tag": "expressive" }
{ "kind": "durationFactor", "percent": 115, "tag": "expressive" }   // tag optional = global
```

Schema-refined so `rollOffset` is non-negative and `rollShape` is `advantage` only — §5.0
enforced by the build (§10, assertion 6). `disadvantage` stays in the type because the roll
engine implements it and assertion 2 tests it; no shipped perk may use it.

**`content/grades.json`** — fifteen entries of `{ id, label, minMargin, multiplier100, band
}`, refined for contiguity and exhaustiveness (§10, assertion 3).

**`content/rates.json`** gains `rollDc: 10`, `statStartMin: 4`, `statStartMax: 7`,
`statXpDailyCap: 100`, `statLevelCostPerLevel: 100`.

**`content/activities.json`** gains an optional `stat` and optional `rollTags`. Schema rule,
stated to cover practice: **an activity with a `stat` is graded if it is `kind: "practice"`
or has a non-empty `effects`; otherwise it earns XP only.** Half-configured activities fail
the build rather than running silently, exactly as the nap's effective-use rule already
does.

---

## 13. Build order

| Task | Scope | Gate |
|---|---|---|
| T1 | Content schemas + the three JSON files; `validate:content` extensions | assertions 3, 4, 6 green |
| T2 | `sim/roll.ts`: dice, modifiers, banding, crit/fumble, multiplier math — pure, no state | assertions 1, 2 green |
| T3 | `rollStream` in `SimState`; exported `mulberryNext`; start-sampling into **both** DTO paths; the completion delta with a unique source; XP, daily cap, wake reset; the duration-factor argument in all three callers | assertions 7, 9 green |
| T4 | `ENGINE_VERSION` 12, `migrateToV12`, career-creation rolls, `validateSimContentRefs` | v8–v11 saves load in one hop; a migrated career matches a fresh career on the same seed |
| T5 | Re-record both goldens; re-derive `harness-bands.json`; the `worst-legal-start` fixture | assertions 5, 10 green |
| T6 | UI: roll banner in `notice`, bar pop in `status`, card glyph, character block in `focus`, perk reveal in identity-lite, `MOTION` entries, a11y strings | assertion 8 green; reduced motion verified; undo toast never evicted |
| T7 | Audio: three grade cues plus `bar.pop`, router routing, `onBarPop` | `audio:check` green; one completion, one grade cue |

---

## 14. Where this goes next

- **Perks absorb preferences.** §9.2's four preference categories are already
  mutually-exclusive families with visible tags — §5's shape exactly. They merge once perks
  have shipped and proven the schema; doing both in one change would couple a new mechanic
  to the migration of a working one.
- **Social energy turns on** with the first graded conversation (docs/03, v3) — two lines of
  content, no engine change. Or earlier, as a third Approach option, if Joe takes §5.3's
  flagged alternative.
- **Hard gates** land with v2's job types, where "cannot do this work" is a decision to
  route around rather than a wall in a one-room house.
- **Perk downsides on bars** become possible the moment a bar has a margin that can absorb
  them. §5.0 is a rule about §6.8's current numbers, not a rule about perks forever.
- **Stat rust**, if ever, belongs to a save spanning months.

---

## 15. Rejected

| Idea | Why not |
|---|---|
| Bars or Health feed the roll | Reintroduces the death spiral §6.6 forbids. |
| Per-activity DC | A knob with no decision on it in v1; silently re-balances §6.8. |
| Natural 20 always scores an A | Throws away mastery-buys-a-floor, the best thing RimWorld's quality roll does. |
| Perk disadvantage on a bar output | §5.0 — worth ±13.9% against margins of 2–8%. Killed a Methodical character's Nutrition budget in draft 1. |
| Grade the progressive fill | Leaks the result before the reveal, and rebuilds the accumulator for nothing. |
| Grade sleep or nap | Sleep breaks §6.1's exact closure; the nap's output is the only graded output inside a 15-point margin against an URGENT event. |
| Grade cross-effects and decay | Punishes twice for one bad roll; well-fed already rules the other way. |
| Forecast the grade | Predicts randomness the player has not been dealt (§8.3), and contradicts §11.2's own reveal rule. |
| Skill rust in v1 | A seven-day arc cannot distinguish decay from a bug. |
| Twelve skills, twenty levels | Nine graded activities cannot fill them; dormant mechanics are the §6.5 failure. |
| Introvert/Extrovert as a v1 pair | Extrovert's tag set would be empty — a rolled trait that does nothing. Flagged for veto at §5.3 with a cheaper alternative. |
| XP scaled by grade, or by perk-adjusted duration | Compounds luck, and lets Perfectionist buy growth as well as output. |
