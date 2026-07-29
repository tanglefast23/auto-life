# v4 — "Growth" (become someone / own better things)

**Fantasy:** invest in yourself. One decision space — *what are weekends and wages for?* — with two answers: buy better things (external) or become a better you (internal).
**Depends on:** v2 Funds + shop chrome, v3 weekend contention. Art obeys [design.md](../design.md).
**Honest scope note (audit-adopted):** this is several connected systems shipped as one fantasy with one shared currency: **weekend hours + funds**. The contention with Social/Practice *is* the game.

---

## 0. Opening & Catch-up

Prerequisite = v2 venue L2 + $400 lifetime earned · fallback = career week 4 · existing save past that = the community-center flyer wrinkle fires on next load · postpone freely · commitments effect = class sessions book Week Plan commitments (SPEC §7.6). Perfect Home and Peak Form aspiration pages seed in this version (SPEC §19).

## 1. External axis — object upgrade tracks

Every core object has L1→L3 (data dormant in `objects.json` since v1). Tap an object → upgrade tab (same catalog chrome as v2's shop). Silhouettes persist across tiers; materials improve (design.md ramp discipline).

**Round-2 rule — upgrades buy time or decisions, never capped amounts:** a verifier showed the draft's "+restore" effects were mostly cap-waste (morning showers already cap; sleep already reaches 100). Every effect below passes the test "what changes during normal steady play?", and the shop previews it as time: `Saves ≈ 55 game-min / week`.

| Object | L2 ($) | L3 ($) | Effect track (time/decision form) |
|---|---|---|---|
| Bed | 220 (owned if bought in v2) | 520 | full recovery arrives earlier → unlocks an **optional early wake** (+30/+50 banked morning minutes) |
| Shower | 180 | 450 | duration 20 → 15 → 11 min |
| Kitchen (fridge+micro) | 250 | 600 | prep phase 12 → 8 → 5 min; L3 adds **leftovers** (one cooked meal yields a 10-min reheat meal) |
| Home gym | 200 | 500 | workout 60 → 52 → 45 min at full +50 value |
| Wardrobe | 150 | 400 | confidence bubbles; date-attraction modifier (v5); outfit **colorways** (palette swaps — full outfit sets remain v6's budget, so this costs zero new frames) |
| Toilet/sink | 90 | 220 | L3 sink combines brush+quick-wash into one 6-min card (routine minutes made literal) |

Rule: upgrades **raise amounts or shave minutes — never change the loop.** The routine stays the routine; it just compounds. Every effect previews before purchase; every purchase is a visible sprite change (the home tells the story of the run).

**Meal-value stacking (one rule, three sources):** the microwave Meal's base is the kitchen tier (35/42/50); good groceries (docs/02 §6) add a flat +10 on top; the Cooking skill's "Cook" is a *separate activity* with its own values (45/50/55), unaffected by microwave tiers. Highest applicable base + flat grocery bonus — never multiplicative. (Meals can't double-fire regardless: the `<90` + 3-h gate holds at any size.)

## 2. Internal axis — hobbies with personal levels

Hobbies cost money **and weekend time slots** — the same hours Social and Practice want. Levels live in the *person*, not the house (they survive any future move; they feed v5 tags).

### Cooking (class at the community kitchen, weekend 2-h sessions)

| Level | Sessions | Unlocks |
|---|---|---|
| 1 | 3 ($30 ea) | **Cook** activity at home: real meal +45, batch leftovers (next-day meal 15 min) |
| 2 | +4 | meals +50; "dinner for two" (v5 date-at-home unlock) |
| 3 | +5 | gourmet +55; weekly meal-prep Sunday ritual (one 2-h cook → 3 fast meals); visible plating sprites |

### Gym (membership $25/wk + weekend sessions; unpaid week = membership pauses — no sessions, no level loss, fail-soft)

| Level | Sessions | Unlocks |
|---|---|---|
| 1 | 3 | workout efficiency +10% |
| 2 | +4 | +20%; **jog commute** — a per-morning choice that *replaces* the transit pass that day: the 15-min route on foot, +8 Movement (the pass's 5-min ride earns nothing; no stacking) |
| 3 | +5 | visible **buff body layer** (paper-doll layer swap); Peak Form aspiration track opens |

Class sessions are queue cards at a new scene (community center: kitchen studio + gym floor — one screen, two zones). **Credit rule [DECIDED round 2]: one session always grants exactly one credit; `m_out` scales the session's *duration*, not its learning** — a verifier showed fractional credits broke every session-count band in this doc. Health pays in time here, same as everywhere.

## 3. The decision space

A weekend holds ~4 big slots (a big slot ≈ 2–3 h). Claims on them: park hangout (Connection) · class session (hobby, **max 2 per hobby per weekend** — the cap is what makes the math below true) · practice (GP) · wrinkles/rest. **Nothing is wrong; nothing is free.** The daily-intention chip gains a weekend variant ("Growth weekend / People weekend / Gig weekend") that biases planner suggestions [HYPOTHESIS].

Money contention mirrors it: L3 upgrades (~$500) vs hobby runs (~$150–360 + weeks of slots) vs v2's transit/groceries. External = instant, house-bound. Internal = slow, permanent, person-bound, tag-bearing (v5). That asymmetry is the strategy.

## 4. Goals

Home chef (Cook unlocked) → Meal-prep Sunday (L3 ritual once) → Gym rat (L2) → Transformation (L3 body reveal — big card moment) → House proud (any two objects at L3) → aspiration seeds: *Perfect Home*, *Peak Form*.

## 5. UI/UX

Object upgrade tabs (tap object in-world — first direct-world UI; still not control, just shopping) · hobby progress pips on the HUD next to Practice · class scene uses the standard queue · weekend planner chip (§3) · body-reveal and house-milestone event cards per design.md.

## 6. Art scope

Community-center scene (split kitchen/gym zones) · 6 objects × 2 upgrade sprites each (12, silhouette-stable) · buff body layer + plating/food sprites (5) · class instructor chibi ×2 · meal-prep containers · membership card chrome.

## 7. Audio

Class scene beds (kitchen sizzle / gym rhythm) · level-up stings per axis (soft home chime vs personal fanfare) · gourmet plating flourish · jog-commute footstep variant.

## 8. Harness assertions

One hobby at the 2-session cap → maxed in 6 weekends with half of every weekend still free · both hobbies at once → both maxed in ~6 weekends but with zero weekend slack — Connection and GP pay the price (the harness asserts the Connection dip) · interleaving hobbies with social pushes completion past 10 weekends (verifier-corrected: the draft's "4–6 either axis / nothing before 10 split" didn't survive its own session counts) · upgrades never shorten the day below the SPEC §6.8 time-budget floor · Cook at L3 keeps Nutrition's cap-waste ≤ v1 levels (gate is `<90` + 3-h rule, so bigger meals can't double-fire).

## 9. Open questions

Q1: gym membership as weekly cost vs per-session — weekly chosen for the "commitment" feel; confirm. Q2: third hobby (art? language?) or keep two deep? Recommend two deep. Q3: should upgrades be visible from v2's shop as grayed "someday" cards (want-building) or arrive fresh in v4?
