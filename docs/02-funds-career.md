# v2 — "First Gigs" (Funds & the Musician chapter)

**Fantasy:** from bedroom guitarist to concert-hall musician. Money exists, and it wants things.
**Depends on:** SPEC.md v1 systems (queue, planner, Practice, m_out). Art obeys [design.md](../design.md).
**Status:** system spec, numbers harness-owned. Verified pacing figures marked ✓.

---

## 1. Opening: the Day-8 letter

- Trigger: Goal 6 complete AND day ≥ 8, or Day 10 hard fallback; fires on next load if the save is already past Day 10.
- A letter modal (sanctioned player-initiated modal — the sim brings it to you and waits): a busking permit + a note from the café owner who heard you practicing. **Chapter framing, not a career menu** [DECIDED §0]: other tracks (Stand-up, Sports, Actor, Investment) appear only as a one-line teaser ("other lives, other stories — later"). The career-choice screen ships when ≥3 tracks are playable.
- Accept → P5 records the next-weekday start date and Prepared Performer promise, then ends visibly with "this story continues in the next chapter." The v1 build does not imply that a playable shift will appear on that date. V2 materializes the career and starts it on the recorded next weekday morning (timing rule below). Decline → letter returns every Sunday (no pressure, cozy). Home Practice starts earning career GP only when the v2 chapter materializes the accepted handoff, never from mere arrival.
- **Prepared Performer [DECIDED round 2 — replaces the GP dump]:** Practice level grants +20% / +50% / +100% bonus GP on the **first five workdays** (L1/L2/L3). L3 ≈ +169 GP ✓ — **≈ 1.0 week at the passive workdays-only rate, ≈ 0.5 weeks at the engaged rate** (baselines stated explicitly; verifier-corrected). That is deliberately about half the old +350 conversion's value: the old dump also skipped the café and bar entirely, and it cannot anymore. Mastery points are never consumed and keep accruing for the v5 *Master of the Craft* aspiration.
- **Career start timing:** accepting the letter starts the career **the next weekday morning** (accept Monday Day 8 → first shift Tuesday Day 9 — the draft's "following Monday" silently inserted a dead week).
- **Opening & Catch-up** (contract pattern for every chapter doc): prerequisite = Goal 6 + day ≥8 · hard fallback = Day 10 · existing save past Day 10 = fires on next load, once · decline = returns every Sunday, no pressure · re-entry = accept any later Sunday · **P5 effect** = persist the accepted handoff, frozen Prepared Performer bonus, and next-weekday start date, with terminal v1 copy · **v2-owned commitments effect** = on chapter materialization, book the Mon–Fri work shifts into the Week Plan (SPEC §7.6) — shifts are commitments, never idle queue cards.

## 2. Funds

- Unbounded wallet (not a bar). Starts at **$120** ("holiday savings"). Display: coin icon + tabular numerals, top-right under the clock.
- **Fail-soft:** never negative. If a weekly cost can't be paid, the fallback happens instead (below) — never a game-over.

### Recurring costs

| Cost | $/week | Fallback if unpaid |
|---|---|---|
| Groceries (basic) | 20 | Fridge serves instant noodles: Meal becomes +20, storylet grumble |
| Good groceries (optional upgrade) | 35 total | drops back to basic |
| Transit pass (optional) | 40 | commute reverts to 15 min |

No rent in v2 [DEFAULT — the apartment is "gran's old place"; rent is a lever we can add if money accumulates too fast; harness watches the curve].

## 3. The work week

- Mon–Fri: after breakfast → **commute** (door fade + transit vignette, 15 game-min; 5 with transit pass) → Job scene 09:00–17:00 → commute home.
- **Bars decay normally at work** [DECIDED]; **performance locks at clock-in**: `m_work = m_out` sampled at 09:00. Pay and GP for the whole day scale by `m_work`. Come to work wrecked, earn wrecked wages — but the day itself never punishes you further.
- The home planner pauses; the **job planner** runs the same queue UI with job cards (§5). At 17:00, pack-up auto-queues; home planner resumes on arrival.
- Weekends: no job. Practice, wrinkles, and (v3) social own the weekend.

## 4. The venue ladder

Cumulative GP thresholds ✓ (the word *cumulative* is normative — the incremental misreading doubles the grind):

| Lv | Venue | Unlock | Pay/day | Scene mood |
|---|---|---|---|---|
| 1 | Street corner | — | $40 × m_work | Open air, foot traffic, weather wrinkles |
| 2 | Café open mic | 100 GP **+ real guitar owned** | $80 × m_work | Warm interior, small tables |
| 3 | Bar residency | 300 GP | $150 × m_work | Evening palette, regulars |
| 4 | Recording studio | 800 GP | $250 × m_work | Tight, focused, meters |
| 5 | Concert hall | 1600 GP | $400 × m_work | The big room, spotlights |

**Debut rule [DECIDED round 2]:** crossing a GP threshold earns an *invitation*; the promotion lands only after one completed **debut day** at the new venue (effective the next workday morning). Banked GP can never skip a venue's story.

- GP income: **workday = 25 × m_work** (sum of performed sets) · **home Practice = 14 × m_out** for the first session each day, then ×0.5 / ×0.2 / 0 ("fingers need rest"). Performing is the primary GP source by construction — an adversarial check showed flat 14/session made stay-home practice ~6.7× more GP-efficient per hour than working, collapsing the career fantasy. The verified engaged pacing (~1.3 sessions/day) sits almost entirely in the ×1.0 tier, so the 4.7-week figure holds within ~5%.
- Verified pacing ✓: engaged (workdays + ~9 practices/wk) reaches L5 in ~4.7 game-weeks ≈ 1.7 real hours at 4×; passive (workdays only) ~9.5 weeks ≈ 2.0× engaged; Practice-L3 head start saves ~1.1 weeks.
- Each level-up: venue reveal card, journal entry, pay bump, new backdrop + crowd, one new crowd-moment type.

## 5. The job scene — same queue, venue-shaped days

A round-2 audit showed the draft's uniform sets-and-breaks day left ~2–3 dead hours and no real ordering decision (pay locks at clock-in, so "perform everything early" dominated). Each venue now has its **own day shape** — the career ladder is also a ladder of day structures:

| Venue | Day shape | The decision |
|---|---|---|
| L1 Street | One flexible 3-h busking block, placeable anywhere 09:00–17:00; foot-traffic varies by hour (posted each morning) | *When* to busk — peak hours vs energy vs weather |
| L2 Café | Two scheduled sets (11:00, 15:00); request cards appear between them | Which requests to take (each costs break time, pays GP) |
| L3 Bar | Soundcheck (10:00) → two back-to-back late sets (15:00, 16:30) under the bar's evening palette; crowd moments cluster late | Bank energy for the late sets or spend it on crowd work — the consecutive sets are where "winded" first bites |
| L4 Studio | 4–6 recording takes; each take previews quality-vs-rest ("take now at m_speed 0.9, or break first?") | Takes vs breaks — the first explicitly quality-driven day |
| L5 Hall | Rehearsal → preparation → one big performance at 16:00 | Everything funnels into one moment; prep choices set its multiplier |

**Earnings decomposition (all venues):** base appearance pay (guaranteed — a bad day is never $0) + per-completed-set/take GP + crowd-moment tips. A missed set forfeits its share only.

| Universal card | Min | Rule |
|---|---|---|
| Set up | 15 | system bookend, first |
| Break | 30 | eats the packed lunch (+30 Nutrition, auto-packed while groceries are paid; +20 noodle-tier; +10 bare) **and clears the "winded" modifier** (−10% set GP after 2 consecutive sets/takes — first bites at L3's back-to-back sets). **Breaks carry a venue opportunity cost** (verifier fix — costless breaks were rote-optimal): street, break minutes tick away posted peak foot-traffic; café, request cards arrive only during breaks and taking one forfeits the rest of that break; studio, 6 takes + 2 breaks don't always fit before 17:00 — the quality-vs-rest choice is real |
| Crowd moment | 5–15 | reactive event card (below) |
| Pack up | 15 | system bookend; queues at 17:00, **waits for the current set to finish** — work never runs past the set in progress |

Late arrival (home queue overran): the first set/block window is forfeited, the day continues — fail-soft, never a fired sim.

**Job-scene reactive policy [verifier fix]:** home-object reactive cards never enqueue at work; the Break's food is the only on-site source; if a bar goes URGENT at work, the sim performs through it at the m_speed penalty — visible, recoverable at home, never a spiral. **Deck constraint:** food/energy-availability wrinkles (empty fridge, rough night) deal only on non-workdays once the career is active; the §9.4 exposure guarantee schedules its band visits on home days.

- Player steering: order sets vs breaks (Energy management — sets are faster with high Energy via m_speed, same as home), pin responses to crowd moments. **Set up and Pack up are system bookends:** not removable, not reorderable past each other — the one queue-verb exception, stated here so SPEC §7.4 stays universal at home.
- **Crowd moments** (seeded, venue-flavored): song request (accept → +GP, costs a break) · tip surge (street/café: +$) · broken string (lose 15 min, or 5 with spare strings $10) · rain (street only: pack early or busk the storm for a storylet) · a familiar face (v3/v5 hook seed).
- Forecast/why-lines work identically at the job — the skill the player learned at home transfers 1:1.

## 6. The shop — money's wants

Catalog panel from the couch (phone motif). Everything previews its effect before purchase.

| Item | $ | Effect |
|---|---|---|
| **Real guitar** | 180 | **Chapter objective, labeled as such** — it gates venue L2, so the shop presents it honestly as the required first purchase, not as one option among equals (round-2 fix); also upgrades Practice audio, +2 pts/session |
| Better bed | 220 | Sleep restore 10 → 11/h (bedtime buffer widens) — the pulled-forward v4 taste of upgrades |
| Good groceries | +15/wk | +10 on top of the kitchen tier's meal base (so +45 at v2's base kitchen — stacking rule in docs/04 §1) |
| Transit pass | 40/wk | Commute 15 → 5 min (≈ +20 game-min/day of free time) |
| Spare strings | 10 | Consumable; defuses the broken-string moment |
| Decorations | 15–60 | Cosmetic, journal lines |

Design intent: the guitar is the chapter's stated objective (~1 week of busking); *after* it, bed-vs-pass-vs-savings is the first real discretionary choice — earning has a want from week one.

## 6b. The First of the Month (monthly beat) [DECIDED round 2]

The week is the game's only rhythm until now; a monthly pulse makes weeks feel different from each other. On the 1st: a **month card** — career recap (GP earned, best day), funds summary, and from v4 the elective **lifestyle billing** (lifestyle tier, gym membership, instrument upkeep) and the **who-works settlement point** (v5). Monthly flavor gigs (a wedding booking, a festival slot) enter the deck from L2. No rent — sinks stay elective (round-2 agreement: never a punitive drain).

## 7. Goals (chapter 2 chain)

First busk (complete a workday) → Real deal (buy the guitar) → Open-mic debut (reach L2) → Regulars (L3) → Tape rolling (L4) → The big room (L5, chapter end card + aspiration unlock: *Master of the Craft* track begins).

## 8. UI/UX

- Funds counter (top-right, coin + tabular numerals); floating `+$` ticks on earnings.
- Job HUD variant: GP meter replaces the goal chip; set-list queue identical to home.
- Shop: card grid, effect previews, owned badges; buy = single confirm inline (no modal).
- Letter/level-up: full-card moments per design.md's "event card" recipe.

## 9. Art scope (per design.md)

5 venue backdrops (one screen each, same 24×14 grid) · crowd chibi set: 6 bodies × palette swaps, 2-frame sway/clap loops · guitar sprites ×2 + case · commute vignette (door + street strip) · shop card chrome · coin/GP icons · weather overlay (rain) · per-venue lighting moods within the master palette (design.md §ramps — no new hues).

## 10. Audio

The version where music becomes content: per-venue performance loops that improve with venue level (street = sparse acoustic → hall = full arrangement); crowd beds (murmur/applause scaled by GP earned); rain layer; register/GP chimes; letter sting. Home Practice riff quality now tracks the owned instrument.

## 11. Harness assertions

**All bands are computed at the design's guaranteed steady state, m ≈ 1.345 — never at 1.0** (round-2 systemic fix: §4 defines pay as $40 × m_work while the old §11 asserted a band computed at 1.0; the two contradicted each other and CI would have caught it on the first run).

Income curve: passive week-1 earnings ≈ **$269 ± 20** vs weekly costs ≤ $60 (the guitar costs ~1 week — verified want-pressure) · time-to-L5 bands from §4 hold across m_work 1.0–1.5 · a 5-workday week with paid groceries ends with Nutrition min ≥ 40 and zero reactive snacks at home (packed-lunch closure) · a stay-home practice strategy is strictly slower to L5 than working · noodle fallback only from over-spending, never neglect · a zero-Practice player still reaches L5.

**Multi-version currency harness [DECIDED round 2, scoping verifier-corrected]** — each price class is asserted against net income **at that class's unlock boundary** (guitar at v2 open, object tiers at v4 open, wedding at v5 open), never re-asserted at later richer incomes; later boundaries assert only the recurring-lifestyle band and that newly-unlocked content of each class exists in-band. Bands: chapter objective = 0.5–1.0 weeks (the guitar's own class: $180 ≈ 0.72–0.86 net weeks ✓) · minor want = 0.25–0.5 · meaningful upgrade = 1–2 · major L3 upgrade or life event = 2–4 · chosen recurring lifestyle = 10–30% of weekly income. The v4 price pass (~2–3× on L3 tiers) hits the 2–4-week band at v4-unlock income (venue L2, net ≈ $478/wk); the elective monthly sinks (§6b) carry the late game.

## 12. Open questions

Q1: rent as a money sink if the curve runs hot? Q2: ~~packed lunch~~ — resolved yes (§5): required for workweek Nutrition closure. Q3: does declining the letter forever need an ending ("The Quiet Life")? — candidate for the v5 aspiration gallery.
