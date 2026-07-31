# 08 — Stats, perks, and the roll: how an activity turns out

**Status:** spec, 2026-08-01.
**Owner:** P9.
**Extends:** SPEC §6 (activities), §8 (practice), §9 (a person, not a dashboard), §11 (UI),
§16.2 (determinism). Replaces nothing.
**Studied for inspiration:** RimWorld's skills/traits split — see §2 for what we take and
what we refuse.

---

## 1. What is missing

Every activity in the game currently produces the same number every time. A meal is +35
Nutrition on Day 1 and +35 Nutrition on Day 40, whoever the sim is. The character has a
name, pronouns, a palette and two preferences, and **none of them touch a single outcome**.

That is the gap. SPEC §9's title is "A person, not a dashboard", and the systems under it
are all flavor: preferences pick *which* activity the planner books, never *how it goes*.
There is no answer to "is my sim good at this?", so there is nothing to get better at, and
watching a completion is watching a timer end.

This spec adds three things, in one loop:

1. **Stats** — four numbers that say how good this person is at a kind of thing, and that
   grow from doing it.
2. **Perks** — two rolled traits that say who this person is, and that change the *shape*
   of the roll rather than its center.
3. **The roll** — every activity that produces something resolves a D&D-style `d20` check
   at start, lands a letter grade from **A+ to F-** at completion, and delivers a real,
   visible bonus or penalty to the bar it feeds.

The payoff the loop is aimed at: **a completion becomes a small event with a result you
did not already know**, and the result improves over a career because the sim is learning.

---

## 2. RimWorld, studied

RimWorld is the reference because it solved this exact problem — a colonist who is a
*person* rather than a work-rate — and it solved it with two separate systems that are
easy to confuse and expensive to merge.

**What it does.**

| RimWorld | Shape | Effect model |
|---|---|---|
| **Skills** (12, level 0–20) | continuous, earned, per-domain | drive work speed and product quality; XP from doing the work |
| **Passion** (none / interested / burning) | a per-skill modifier on *learning* | ×0.35 / ×1.0 / ×1.5 XP — changes growth, never output |
| **Traits** (0–3 per pawn, drawn from mutually exclusive degree-spectrums) | discrete, fixed at generation | `statOffsets` (flat), `statFactors` (multiplicative), `skillGains` (a head start), `disabledWorkTags` (hard gates), mood and behavior gating |
| **Backstories** | discrete, fixed | skill gains and hard work-type bans |
| **Quality** (Awful → Legendary) | the *outcome* of a made thing | a Gaussian draw whose **center rises with skill** and whose result is discretized into named tiers |

Four findings drive the design below.

1. **Skill moves the center of a distribution; it does not remove the roll.** A level-20
   crafter still makes a merely "good" item roughly 40% of the time and cannot make a
   legendary at all without an inspiration. Mastery buys a *floor* and a better *average* —
   not certainty. This is the single most important thing to copy, because certainty is
   boring and a coin-flip is unfair, and the Gaussian-centered-on-skill answer is neither.
2. **Traits act through three mechanisms, and they are genuinely different.** A flat
   offset, a multiplier, and a hard gate are not interchangeable, and RimWorld keeps them
   separate in data. §5 keeps the same three.
3. **Passion changes growth, not output.** Splitting "how fast you learn" from "how well
   you do" is what stops a trait from being a permanent free bonus.
4. **Incapability makes characters.** A pawn who *cannot* cook is more memorable than one
   who cooks at 80%. Hard gates are a real design tool, not a punishment.

**What we refuse.**

- **20 levels and 12 skills.** This game has ten graded activities. Twelve skills would
  leave most of them dormant, and §6.5 already rules that shipping a dormant mechanic and
  calling it a consequence is the mistake it exists to prevent. **Four stats, levels 1–10.**
- **Skill rust.** RimWorld decays skills above level 10. In a v1 whose whole arc is seven
  days, decay cannot read as a system — it reads as a bug in the number that just went up.
  **Rejected for v1**; revisit when a career spans months.
- **Passion as a separate axis.** Its job here is already done by perks (§5), which are
  rolled at creation from mutually exclusive families in exactly RimWorld's shape. A third
  per-stat axis would be a knob with no decision attached to it.
- **Hard gates in v1.** "Incapable of cooking" is a great mechanic and a terrible fit for a
  game whose planner must be able to feed the sim unattended (§7.2's reactive net assumes
  every need has an answer). Gates are specified as the perk mechanism §5.3 leaves open,
  and land with v2's job types, where refusing work is a real choice.

---

## 3. The ruling: what a stat is and what a perk is

This is the question the whole spec turns on, so it gets a normative answer rather than a
description.

> **A stat is a number that answers "how good is this person at this kind of thing, right
> now?" It is continuous, it is earned, it moves the center of the roll, and it grows.**
>
> **A perk is a rule that answers "who is this person?" It is discrete, it is fixed at
> creation, it fires only in the contexts its tags name, and it changes the shape of the
> roll — never its center.**

Three consequences, all mechanical and all testable:

| | Stat | Perk |
|---|---|---|
| **Domain** | applies to every activity that names it | applies only where its tags match |
| **Roll effect** | sets the modifier (the center) | offsets, or grants advantage/disadvantage (the shape) |
| **Over time** | grows with use (§7) | never changes |
| **Count** | all four always present | exactly two, drawn from two families |
| **Failure it prevents** | "my character is a generic dashboard" | "every character plays identically" |

The distinction is not cosmetic. **Advantage is not the same as +3**, even though both
average out near the same place: advantage lifts the floor and barely moves the ceiling,
while an offset slides the whole curve. That is precisely the difference between "this
person is *reliable* at quiet work" and "this person is *better* at quiet work" — and it
is why a perk cannot be expressed as a stat bonus without losing what it meant.

The line also tells you where a future idea belongs. *"She cooks well"* → a stat.
*"She cooks well when nobody is watching"* → a perk.

---

## 4. The stats

Four, integers **1–10**, stored per career. Every one governs at least two activities;
none ships dormant.

| Stat | What it is | Governs |
|---|---|---|
| **Strength** | physical output and exertion | `weights`, `treadmill`, `stretch` |
| **Dexterity** | hands, cooking, fine motor | `meal`, `snack` |
| **Vitality** | how well the body takes rest and care | `nap`, `shower`, `quickwash`, `brush` |
| **Intellect** | attention, learning, craft-of-the-mind | `practice`, and `read` (XP only — §7) |

`sleep`, `toilet`, `package` and `idle` name no stat and are **never graded** (§6.6).

**The modifier.** `statMod = statLevel − 5`, so the range is **−4 … +5** and a stat of 5 is
exactly par. Read as a D&D ability modifier with the arithmetic simplified: one point of
stat is one point of modifier, because a 1–10 range does not need a second conversion step
on top of it.

**Starting values.** Each stat rolls uniformly on **4…7** at career creation, drawn from
the `rolls` PRNG stream (§8). The floor of 4 is load-bearing and is derived, not chosen —
see §9.2.

**Intellect's loop is the one to notice.** It grows from `read` — the activity the routine
planner already books for productive free time since ENGINE_VERSION 9, and which currently
does *nothing at all* — and it pays out in `practice`. Reading makes your guitar practice
better. That closes a real hole in the existing content rather than adding a new one.

---

## 5. The perks

Two per character, one from each **family**. Within a family the options are mutually
exclusive — RimWorld's degree-spectrum, and the same shape as SPEC §9.2's existing
preference categories, which is why the two systems can eventually merge (§14).

### 5.1 Approach — shape, via advantage

| Perk | Advantage on | Disadvantage on |
|---|---|---|
| **Creative** | `expressive` (`meal`, `practice`) | `routine` (`brush`, `quickwash`, `stretch`) |
| **Methodical** | `routine` | `expressive` |

Advantage rolls `2d20` and keeps the higher; disadvantage keeps the lower. Untagged
activities (`nap`, `snack`, `weights`, `treadmill`, `shower`) are unaffected by this
family, which is what keeps it conditional rather than a global bonus.

### 5.2 Drive — center and time, via offset and factor

| Perk | Roll offset | Duration factor |
|---|---|---|
| **Perfectionist** | **+2** on every roll | **×1.15** — everything takes longer |
| **Easygoing** | **−1** on every roll | **×0.90** — everything is quicker |

The trade is the point, and it is a trade in the currency SPEC §8 says the game is about:
Perfectionist buys ≈+9.75% output with ≈15% of the day's activity time; Easygoing sells
≈5.25% of output for free hours. Neither dominates, and the numbers are verified in §9.1.

### 5.3 Social energy — specified, and deliberately not shipped in v1

| Perk | Advantage on | Disadvantage on |
|---|---|---|
| **Introvert** | `solitary` | `social` |
| **Extrovert** | `social` | `solitary` |

**Ruling: this family does not ship in v1, and shipping it would be a bug.** v1 has no
graded `social` activity, so Introvert's downside could never fire and the perk would be a
free bonus wearing the costume of a trade. SPEC §6.7 already rules on exactly this class of
error — *"before authoring any bonus, check the target quantity's value at the moment the
bonus applies; if the design guarantees it is already at maximum, the bonus is
decoration."* A disadvantage that can never apply is the same failure with the sign
flipped. The family lands with the first graded conversation (docs/03, v3), at which point
it is a two-line addition to `content/perks.json` and nothing else.

This is also the honest answer to "why only two families?" — because two is how many have
both sides live.

---

## 6. The roll

### 6.1 The check

One `d20`. One global difficulty. Exactly D&D's ability check with the fewest possible
moving parts:

```
natural  = d20                            (advantage: 2d20 keep high; disadvantage: keep low)
total    = natural + statMod + perkOffset
margin   = total − DC                     (DC = 10, one global value, content/rates.json)
grade    = band(margin), then crit/fumble adjustment
```

**One global DC, not one per activity.** A per-activity DC is a knob with no decision
attached to it in v1: every graded activity except `practice` feeds a bar whose daily
budget §6.8 has already balanced, so any DC other than 10 would silently re-balance that
budget and buy nothing. Difficulty variety comes from *which stat an activity names* and
from perk tags, both of which are real. If v2's job tasks want harder checks, they add the
field then; adding it now is the speculative-knob failure YAGNI names.

**Crit and fumble.** A natural 20 moves the grade **one step up**; a natural 1 moves it
**one step down**; both clamp at the ends of the ladder. This is deliberately *not*
"natural 20 always scores an A" — that would let a novice hit top marks 5% of the time and
throw away RimWorld's most valuable property, that mastery buys a floor. At par the rule is
provably a no-op (§9.1), so it costs the balance nothing.

### 6.2 What is explicitly **not** in the roll

**No bar value, no Health, no `m_out`, no `m_speed`, no adjacency bonus, and no well-fed
state enters the check.** Two reasons, both load-bearing:

- **No death spiral.** SPEC §6.6 guarantees that low health costs time, never
  effectiveness. Grading *does* scale effectiveness, so the guarantee survives only because
  the roll's center is set by a stat, and **a stat never falls when a bar falls**. There is
  no feedback edge from bars back into the roll. A bad day cannot make tomorrow's rolls
  worse.
- **No double-counting.** Well-fed (§6.5), Minty-fresh, Shower→Practice (§6.7) and `m_out`
  (§6.6) already multiply outputs. Feeding them into the roll as well would apply each one
  twice, once as a modifier and once as a multiplier.

The roll is a **new, independent factor** that multiplies alongside the existing ones. §9.3
checks the stacked result against §8's practice pacing.

### 6.3 The grade ladder

Fifteen grades. Bands are on the **margin**, so a better character shifts up the same
ladder rather than getting a different one.

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

The bands are contiguous and exhaustive over the reference character's twenty outcomes —
rolls 1…20 map onto the ladder with no gap and no overlap, which is a schema-checkable
property and not a claim (§10, assertion 3).

At par the shape is a believable report card: **A 15% · B 20% · C 30% · D 20% · F 15%**,
fat in the middle from a flat `d20` because the bands are wide in the middle.

### 6.4 How the grade reaches the bar

This is the part that has to fit the existing engine exactly, and it does — using two
affordances that are already there.

**The roll resolves at start.** It joins `mSpeed`, `wellFed` and `pointsMultiplier` on the
`ActiveTimedActivity.sampled` record, which is precisely what that record is for (§6.6's
decided sampling rule: *"both multipliers sample at activity start"*). A mid-activity save
and reload therefore replays the same roll, because the roll is state, not a coin flipped
later.

**The base effect fills exactly as it does today.** `effectTotalsFixed` is untouched. The
integer remainder-carrying accumulator, the phase fill, the pro-rata early stop and the
cap-waste forecast all keep working, byte for byte, because none of them can see the grade.

**The grade is delivered at completion, as one signed instant delta:**

```
gradedFixed = round-half-up(totalFixed × multiplier / 100)      // integers only
bonusFixed  = gradedFixed − totalFixed                          // signed; 0 at grade C
```

pushed onto `SimState.pendingInstantDeltas` — a field that already exists and is already
summed and clamped by the single per-tick reducer. **No new fill machinery, and no new
rounding rule**: the same integer round-half-up form as `fillStartTick`'s `frac100`.

Four properties fall out of this shape for free, and each one would have cost work under
any other:

1. **The reveal is honest.** Nothing observable depends on the grade until completion — the
   bar fills at the ungraded rate the whole way — so revealing the die at completion leaks
   no information and pre-empts nothing. The roll was decided at start; only the telling
   waits.
2. **Stopping forfeits the grade.** An activity that never completes never pushes a delta.
   That is §6.7's stop-cancels-bonus rule, arrived at by construction rather than by a
   second code path.
3. **The bar visibly pops.** The delta is a real jump at a real instant — up to +50% of the
   base on an A+, down 55% on an F− — which is exactly the beat §11 asks for and which a
   graded progressive fill could never produce.
4. **It can never drive a bar backwards past its start.** The worst multiplier is 45%, so
   `fill + bonus` is always a positive fraction of the base. A terrible shower leaves the
   sim cleaner than before it, just barely.

**Only positive outputs are graded.** Cross-effects (`weights` −5 Nutrition, `treadmill`
−5 Hygiene) and every passive decay are ungraded, the same rule §6.5's well-fed bonus
already follows. A bad workout does not also make you hungrier.

**Practice** has no bar effect; its graded output is points. The multiplier joins the
existing stack at award time and the pop lands on the practice counter instead of a ring.

### 6.5 Cap-waste is a feature here, on purpose

An A+ meal at Nutrition 90 delivers its base fill into the clamp and then throws the entire
+50% bonus away. That is not a bug to fix — SPEC §6.7 already treats cap-waste as the thing
that makes *"moving dinner later a real decision"*. The roll sharpens it: your best rolls
are worth most when you actually needed them, and the forecast chip (§11.2) shows the
waste before you commit, exactly as it does today.

### 6.6 What is not graded

| | Why |
|---|---|
| `sleep` | §6.1 pins the Energy closure at exactly −80/+80 per day. Any variance here ratchets into nightly urgent sleep — a verified failure mode, not a hypothesis. Sleep's restore is scaled by nothing, and that stays true. |
| `toilet`, `package`, `idle` | No output to grade. A graded toilet is a joke with a one-day shelf life. |
| `read` | No bar effect. It awards Intellect XP (§7) and is never graded. |

---

## 7. Growth

Stats grow from **doing**, not from succeeding — RimWorld's rule, and the one that stops a
lucky streak from compounding into a better character.

- Every completed activity that names a stat awards **`baseMin` XP** to that stat. A 60-min
  workout is 60 Strength XP; a 5-min brush is 5 Vitality XP. Duration-proportional, so no
  activity needs its own weight.
- **Daily cap: 100 XP per stat**, reset at the wake boundary — RimWorld's soft daily cap,
  and it uses the same `crossedWakeBoundary` reset that `napEffectiveUsesToday` already
  uses. Without it, three meals a day would race Dexterity ahead of everything else.
- **Cost to advance from level L to L+1 is `100 × L` XP**, cumulative. Level 10 is the cap;
  XP at cap is discarded rather than banked, so the save never carries a number that means
  nothing.
- Grade does **not** affect XP. Nor does a stopped activity award any — same rule as the
  grade delta, same reason.

**Verified pacing** at the shipped content, from a stat of 5 (cost 500):

| Stat | XP on a typical day | 5 → 6 |
|---|---|---|
| Strength | 75 (weights 60 + stretch 15) | ≈ 6.7 days |
| Dexterity | 90 (three meals) | ≈ 5.6 days |
| Intellect | up to 100 (practice + read; capped) | ≈ 5 days when played hard |
| Vitality | 30–75 (shower, two brushes, an occasional nap) | ≈ 7–16 days |

So a diligent seven-day v1 career gains **+1 in its busiest stat, occasionally +2**. That is
slow enough that §9.2's balance argument holds over the week, and fast enough that the
letter grades visibly trend — you watch C+ become B, which is the entire point of putting a
number on a person.

---

## 8. Determinism and storage

The engine is integer-exact, seeded, and golden-replayed (SPEC §16.2). Everything here obeys
that without exception.

**A sixth PRNG stream, `rolls`.** `STREAM_SALTS` is name-owned specifically so that adding a
stream cannot reseed the existing five by array position — this is that extension point
being used for the first time. Salt continues the same π-hex series: `0x299f31d0`.

**No transcendental math.** The `d20` is `1 + floor(next('rolls') × 20)`, clamped to 20.
Advantage draws twice. Every downstream step — modifier, margin, band lookup, multiplier —
is integer arithmetic on integer inputs.

**Draw discipline.** Exactly one draw per graded start (two under advantage or
disadvantage), taken at start and never again. The forecaster clones stream state and never
advances the real one — already true of `PrngStreams.clone()`, and now load-bearing for a
sixth stream.

**New `SimState` fields** (they belong in `SimState`, beside `chronotype` and
`preferredWorkout`, because the engine and the golden replay must both see them):

```ts
stats:      Record<StatId, { level: number; xp: number }>   // level 1..10
statXpToday: Record<StatId, number>                          // reset at the wake boundary
perks:      string[]                                          // exactly 2 perk ids
```

and on `ActiveTimedActivity.sampled`:

```ts
roll?: {
  natural: number;         // the kept die, 1..20
  shape: 'plain' | 'advantage' | 'disadvantage';
  modifier: number;        // statMod + perkOffset
  gradeId: GradeId;
  multiplier100: number;   // 45..150
}
```

**`ENGINE_VERSION` 11 → 12.** Behavior changes, both goldens are re-recorded, and the
envelope shape changes, so this is a real migration branch and **not** a stamp-forward. The
migrator:

- widens `STAMP_FORWARD_ENGINE_VERSIONS` to `[8, 9, 10, 11]` and applies the v12 field
  additions in the same pass, so a v9 save still reaches the present in one hop — the
  failure v10's own note describes is not repeated;
- creates the `rolls` stream record from the career's own `rootSeed` by the standard
  `(rootSeed ^ salt) >>> 0` formula with `calls: 0`. Nothing is replayed and no draw count
  is inferred, exactly as the P5 PRNG relocation did;
- draws stats and perks from that fresh stream, so a migrated career gets **precisely what
  a new career with the same seed would have rolled**. The character always had these
  traits; the game simply did not model them yet. Seeding everyone at a flat 5 with no
  perks would have been the cheaper lie.

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

This is why §6.8's whole daily budget table survives untouched in expectation, and why the
forecaster can keep showing the base effect without lying. It is an integer identity, so it
is a unit test with no simulation in it (§10, assertion 1).

Two more exact results:

**Crit/fumble is a no-op at par.** At `statMod` 0 a natural 20 is already A+ and a natural 1
is already F−, so both adjustments clamp and the identity above is undisturbed.

**Advantage and disadvantage are exactly symmetric.** For any pair of dice `(a, b)`,
`mult(max) + mult(min) = mult(a) + mult(b)`, so `E[advantage] + E[disadvantage] = 2 ×
E[plain]` at **every** stat and every offset. At par that is **113.875% and 86.125%** — a
perk worth ±13.9% where its tags fire, which is a real trait and not a rounding error.

### 9.2 The whole curve, and where the starting floor comes from

| Stat | `statMod` | E[multiplier] |
|---|---|---|
| 1 | −4 | 82.00% |
| **4** | −1 | **94.75%** |
| **5** | 0 | **100.00%** |
| **6** | +1 | **105.25%** |
| **7** | +2 | **109.75%** |
| 10 | +5 | 120.50% (120.25% with the fumble rule) |

Mean over a fresh character's uniform 4…7 draw: **102.44%**.

**Upward drift is structurally safe.** A grown stat inflates a restore, the bar clamps at
100, and the surplus becomes cap-waste — which §6.7 already treats as a decision rather than
a leak. Energy is exempt entirely because sleep is ungraded, so the one closure that must be
exact stays exact.

**Downward drift is where the floor comes from.** At stat 4 the worst legal start:

| Bar | §6.8 restore | at 94.75% | vs decay | net/day |
|---|---|---|---|---|
| Nutrition | 105 | 99.5 | −96 | **+3.5** ✓ |
| Hygiene | 60 | 56.9 | −56 (−61 treadmill) | **+0.9 / −4.2** |
| Movement | 50 | 47.4 | −48 | **−0.6** |

Nutrition holds. Movement drifts slowly and §6.8 already grants it a 19-point margin above
the Stretch net at 35 — that is a felt consequence followed by a rescue, which is the
designed behavior, not a break. Hygiene on treadmill days is the tightest case and is the
reason the floor is 4 and not 1: at stat 1 (82%) Nutrition nets −10/day, which is a spiral.

**This is a derivation, not a verification.** §10's assertion 5 is the falsifiable gate: an
all-stats-4 career must survive the unattended week. If it does not, the floor rises to 5
and this table is re-derived — the band is never widened to green the test (SPEC §16.3).

### 9.3 Practice pacing

The grade multiplier joins `m_out` × well-fed × minty × shower→practice as a fifth,
independent factor. At par it contributes exactly 1.00, so §8's stated pacing (plain blocks
≈98/day → L3 around Day 7–8) is unchanged for a starting character. At a grown Intellect of
7 it contributes ≈+9.75%, moving L3 earlier by roughly half a day — inside §8's own stated
bands, which already tolerate "L3 lands early in v2 — fine".

---

## 10. Assertions

Every one of these is a test, not a claim. The first four need no simulation at all.

1. **`Σ multiplier over the reference ladder === 2000`.** The E = 100.00% identity, checked
   as integer arithmetic.
2. **`E[advantage] + E[disadvantage] === 2 × E[plain]`** for every stat 1…10 and every perk
   offset — a property test over the exact distribution, not a sample.
3. **The ladder is contiguous and exhaustive.** Reference rolls 1…20 map onto exactly one
   grade each, with no gap and no overlap. Enforced in the content schema so a bad edit to
   `content/grades.json` fails `validate:content`, not a play session.
4. **No dormant stat, no dormant perk.** Every stat governs ≥1 graded activity; every
   shipped perk has ≥1 tagged activity on **both** its advantage and its disadvantage side.
   This is §5.3's ruling as a build gate rather than a promise.
5. **Worst legal start survives.** An all-stats-4 career, unattended, seven days: every bar
   ≥65 at the morning check from Day 2, zero URGENT events, and Health ≥75 at the Day-3
   morning check on the all-zeros recovery run — the existing §16.3 bands, unwidened.
6. **Stop forfeits the grade.** Stopping a graded activity pushes no `pendingInstantDeltas`
   entry and awards no XP.
7. **The reveal cannot lie.** The grade the UI stamps equals the grade the engine applied,
   asserted at the event boundary — the same class of guarantee `adjacencyGranted` exists to
   provide, and the same failure (HFM's cancel-inherits-celebration) it exists to prevent.
8. **Determinism.** Two runs from one seed produce an identical grade sequence; a
   save/reload mid-activity replays the same roll; the forecaster advances no real stream.
9. **Both goldens re-recorded** at ENGINE_VERSION 12, and `content/harness-bands.json`
   re-derived from the new unattended run with the movement recorded in prose, per §16.3's
   normative rule that the data file governs and bands are never quietly widened.

---

## 11. The beat: dice, grade, pop

One completion, one sequence, ~800 ms, and it never blocks the sim.

### 11.1 What the player sees

| ms | Beat | Where |
|---|---|---|
| 0 | **die tumbles** — a d20 face cycling six frames, settling on the natural roll | `notice` region |
| 240 | **grade stamps** — the letter, scale-in with overshoot, plus `+2 Dex` style modifier line | `notice` region |
| 600 | **bar pops** — the fed ring flashes and scales, the delivered `+26` floats off it | `status` region |

The banner lives in the **`notice` region** — docs/07 defines that rectangle as "chips and
toasts", and a roll result is exactly a toast. No new free-floating panel, no new `zIndex`
literal; it names a region and a layer like everything else since P8.

The bar pop lands in `status` because that is where the rings are. Two surfaces, because the
sequence reports two different facts: *how it went*, and *what it did to you*.

**The animation never gates the simulation.** The roll is already decided and already
applied; the UI is replaying a result, exactly as the audio router announces what the engine
did rather than what a forecast predicted. At 2× and 4× speed, or when completions arrive
faster than the sequence runs, banners **collapse to the newest** rather than queueing — a
backlog of stale dice is worse than a dropped one.

### 11.2 The queue card

A running or queued graded card carries a small **d20 glyph and its governing stat**. The
forecast chip keeps showing the **base** effect, and the glyph is what marks it as an
expectation — honest, because §9.1 makes the expectation exactly right at par. The grade is
never previewed, and the running card never reveals its already-rolled result.

### 11.3 Audio

Two cues, added to the synthesized bank (`scripts/audio/bank.ts`) and authored in
`content/audio.json`:

- **`grade.high` / `grade.mid` / `grade.low`** — one plays at the stamp, chosen by band. It
  **replaces** `queue.complete` for a graded activity. This is not an extra sound; it is a
  more specific one, and stacking both would be precisely the doubled-cue failure the router
  exists to prevent. Ungraded completions keep `queue.complete` unchanged.
- **`bar.pop`** — a short pluck at the bar beat, fired by the UI timeline through
  `CueRouter.onBarPop()`. That path already exists in the shape it needs: `onFootstep()` is
  fired by the renderer's walk cycle rather than by a domain event, for the same reason, and
  keeps sound policy owned by the router either way.

`grade.high` is **not** the adjacency figure. design.md §2 reserves the one bright ascending
motif for reward moments and the bank comment reserves its audible twin just as carefully; a
good roll is a good roll, not a prize.

### 11.4 Accessibility

- **The grade is a letter**, so it is never colour-only. Colour is redundant reinforcement,
  which is what SPEC §11.6 asks for and what the existing `nonColorUrgency` preference
  already assumes.
- **Reduced motion:** the die renders already settled on its face, the grade appears without
  the scale-in, and the bar reaches its new value without the pop. Every state change is
  kept and every tween is dropped — resolved once through `resolveMotion`, never with a
  per-component branch. New `MOTION` entries: `dieTumble` (240 ms, 6 frames, decorative),
  `gradeStamp` (360 ms, **not** decorative — it is the information), `barPop` (200 ms,
  decorative).
- **Screen reader**, at the two existing verbosities:
  `full` → "Meal complete. Rolled 14, B minus. Nutrition plus 26."
  `brief` → "Meal complete. B minus."

---

## 12. Content

Two new files, both zod-validated in the existing pipeline, plus small additions to two
existing ones.

**`content/stats.json`** — the four stats, their string ids, and the activities each
governs. The activity→stat map lives here and not in engine code, for the same reason
adjacency pairs moved to data at ENGINE_VERSION 4.

**`content/perks.json`** — families, options, and effects. The effect model is RimWorld's
three mechanisms, kept separate in the schema rather than flattened:

```jsonc
{ "kind": "rollOffset",     "value": 2 }
{ "kind": "rollShape",      "shape": "advantage", "tag": "expressive" }
{ "kind": "durationFactor", "percent": 115 }
```

**`content/grades.json`** — the ladder: fifteen entries of `{ id, label, minMargin,
multiplier100, band }`. Schema-refined for contiguity and exhaustiveness (§10, assertion 3).

**`content/rates.json`** gains `rollDc: 10`, `statStartMin: 4`, `statStartMax: 7`,
`statXpDailyCap: 100`, `statLevelCostPerLevel: 100`.

**`content/activities.json`** gains, per activity, an optional `stat` and an optional
`rollTags: string[]`. An activity with a `stat` and a non-empty `effects` is graded; the
schema enforces that pairing so a half-configured activity fails the build rather than
running silently, exactly as the nap's effective-use rule already does.

---

## 13. Build order

| Task | Scope | Gate |
|---|---|---|
| T1 | Content schemas + the three JSON files; `validate:content` extensions | assertions 3, 4 green |
| T2 | `sim/roll.ts`: dice, modifiers, banding, crit/fumble, multiplier math — pure, no state | assertions 1, 2 green |
| T3 | `rolls` PRNG stream; `SimState` fields; start-sampling into the DTO; the completion delta; XP + daily cap + wake reset | assertions 6, 8 green |
| T4 | `ENGINE_VERSION` 12, migration branch, career-creation rolls | old saves load; migrated career matches a fresh career on the same seed |
| T5 | Re-record both goldens; re-derive `harness-bands.json`; the worst-legal-start case | assertions 5, 9 green |
| T6 | UI: roll banner in `notice`, bar pop in `status`, card glyph, `MOTION` entries, a11y strings | assertion 7 green; reduced motion verified |
| T7 | Audio: four bank cues, router routing, `onBarPop` | `audio:check` green; one completion, one grade cue |

---

## 14. Where this goes next

- **Perks absorb preferences.** §9.2's four preference categories are already
  mutually-exclusive families with visible tags — the same shape as §5's perk families. They
  merge into one system once perks have shipped and proven the schema; doing it in the same
  change would have coupled a new mechanic to a migration of a working one.
- **Social energy turns on** with the first graded conversation (docs/03, v3). Two lines of
  content, no engine change.
- **Hard gates** land with v2's job types, where "cannot do this work" is a decision the
  player routes around rather than a wall in a one-room house.
- **Stat rust**, if ever, belongs to a save that spans months — not to a seven-day week.

---

## 15. Rejected

| Idea | Why not |
|---|---|
| Bars or Health feed the roll | Reintroduces the death spiral §6.6 exists to forbid. |
| Per-activity DC | A knob with no decision attached in v1; silently re-balances §6.8. |
| Natural 20 always scores an A | Throws away the mastery-buys-a-floor property, which is the best thing RimWorld's quality roll does. |
| Grade the progressive fill | Leaks the result before the reveal, and rebuilds the accumulator for nothing. |
| Grade sleep | Breaks the one closure §6.1 proves exact; the failure mode is nightly urgent sleep. |
| Grade cross-effects and decay | Punishes twice for one bad roll; well-fed already rules the other way. |
| Skill rust in v1 | A seven-day arc cannot distinguish decay from a bug. |
| Twelve skills, twenty levels | Ten graded activities cannot fill them; dormant mechanics are the §6.5 failure. |
| Introvert/Extrovert in v1 | Its disadvantage cannot fire, so the perk is a free bonus in a trade's costume (§5.3). |
| XP scaled by grade | Compounds luck into permanent advantage; RimWorld awards XP for doing. |
