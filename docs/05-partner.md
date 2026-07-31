# v5 — "Partner" (love, marriage, family — and the other endings)

**Fantasy:** someone sees the life you built — the career, the home, the person — and wants in. The whole game so far was the dating profile.
**Depends on:** everything. v2 career tags, v3 Connection + meeting places, v4 hobby tags + home state.
**Honest scope note (audit-adopted):** this is the largest version. Dates are *scenes with choices*, not just queue cards — the queue schedules a dinner; it cannot make the dinner matter. Conversation content is budgeted explicitly (§8) and has its own cut line.

---

## 1. The mate pool (NPC-lite, tag-driven)

**Opening & Catch-up** (docs/02 contract): prerequisite = Connection ≥50 + any friend L2 (a friend makes the introduction) · fallback = v5 install + 2 weekends · existing save = the "you should meet my cousin…" storylet fires on next load · postpone freely; the pool waits · commitments effect = dates book Week Plan commitments (SPEC §7.6).

**Four candidates** [DECIDED round 2 — depth over count; the pool's tag spread still guarantees variety under any preference filter], generated-but-authored: each = portrait + layered chibi + **preference tags** + schedule + a 3-arc storylet file. Not simulated sims (scope guard, held from v0.1). The data model is gender-neutral `Person` records; the pool respects preferences collected by a **one-question prompt when the v5 chapter opens** (default "show me everyone"; editable in Settings → Sim; v6's editor later edits the same field — a verifier caught that identity-lite never collects this, so v5 must ask).

**Primary tag** — mapped to systems that *exist at v5 launch* (an adversarial check caught the draft's brief-literal career mapping: with only Musician playable, four candidates' ×1.5 primary bonus was unreachable for every player — the "five doors, four locked" failure recurring inside the mate pool):
creativity ↔ Musician career/Practice L2+ · athleticism ↔ Gym level · craft ↔ Cooking level · homebody ↔ home upgrade tier · sociability ↔ friend levels · +1 wildcard (their primary is whatever the *player's* strongest system is — someone who loves you for your thing).
The brief's full career↔tag matrix (humour↔Stand-up, fame↔Actor, wealth↔Investment) ships as **dormant data**, activating as tracks land — same tracks-as-data pattern as docs/02.

**Secondary tags** (2 each, drawn from lived systems): gym-love (Movement/Gym level) · foodie (Cooking level) · homebody (home upgrade state) · bookish (battery-recharge habits) · tidy (Hygiene average) · night-owl / early-bird (chronotype match).

**Discovery is the mini-game:** tags start hidden as `?` chips; conversations, friend gossip (v3 friends pay off here), and observation reveal them. Courting well = learning a person.

## 2. Love & compatibility

- **Love meter 0–100 per candidate** (relationship panel). Gains scale by `m_out` × compatibility × battery state (introverts date better rested — v3 physics carry through).
- **One normative compatibility formula [DECIDED round 2]** (the draft's mixed multiply-and-add wording was unimplementable):
  `compatibility = clamp(1.0 + primaryMatch×0.35 + secondaryMatches×0.12 + lifestyleFit×0.10 + wardrobeTier×0.08, 0.8, 1.8)`
  Shown honestly in the panel as tags are discovered — no hidden dice. **One payoff per tag:** tags feed this formula only; the old "foodie doubles dinner / homebody doubles home-dinner" double-dipping is removed. Activity dates keep their ×2 solely for the **primary** tag match (the discovery payoff).
- **Variety pressure — rolling window, not consecutive-only:** each type's yield scales by its share of the last 5 dates: ×1.0 / ×0.8 / ×0.6 at 1 / 2 / 3+ occurrences. (A verifier showed the draft's consecutive-only rule was defeated by simply alternating two cheap types A-B-A-B.) Talk → coffee → dinner → activity-date stays the natural ladder, and the broke-player path (conversation + park) still works — slower, per §9.
- **Combined Love multiplier caps at ×2.5** (m_out × compatibility × battery can't stack past it).

| Interaction | Where | Min | $ | Love | Notes |
|---|---|---|---|---|---|
| Conversation | meeting places | 15 | — | +4–8 | choice beats (§3) |
| Coffee date | café | 90 | 8 | +8 | low stakes |
| Dinner date | restaurant (new scene) | 120 | 30 | +12 | choice beats |
| Activity date | park / gig / gym / class | 120–180 | 10–20 | +15, **×2 only on a primary-tag match** | the discovery payoff |
| Dinner for two at home | home | 90 | 12 | +14 | requires Cooking L2; shows off the house |

## 3. Conversation scenes

Visual-novel-lite: two chibis, location backdrop, bubble choices. **2–3 beats per scene**, choices drawn from: known tags (safe, warm), unknown `?` probes (reveals a tag; a mismatch is a gentle storylet, never a meter crash), and life-moments (share career/hobby milestones — the game's own history becomes dialogue). Fail-soft: no conversation can lose more than it could gain; awkwardness is content, not punishment.

## 4. Milestones

Steady (Love 50, both agree — a choice card) → **Proposal** (Love ≥80 + compatibility ≥ ×1.3 — the same floor §9 guarantees every candidate can reach, so Steady can never dead-end + a ring $150; sanctioned modal; they can say "not yet" with a stated, fixable reason — never a hard no). **Stepping back is always in scope** (Q3 resolved fail-soft): an amicable step-back storylet returns Love to friend-tier 40, no pool lock, no punishment — the cozy contract holds even in heartbreak. → Wedding (small scene, guest list = v3 friends, $200 modest / $600 lovely) → Move-in (their sprite joins the home; **household queue** shows both plans side-by-side; chores share) → **Who-works decision card** [DECIDED, brief override]: both incomes shown, options *I work / they work / both + hire help ($/wk)* — **revisitable at every First-of-the-Month settlement** (docs/02 §6b): career level and GP persist while not working, returning is always possible, income changes at the next settlement, scheduled shifts unbook cleanly [round 2] → Baby chain (§4b) → the gallery (§5).

**Partner capacity model [DECIDED round 2 — bounded, not a second sim]:** the partner has a work schedule, **≤2 reassignable cards per day**, chore preference tags, and a visible busy/free chip; a persistently uneven split earns reaction bubbles and a storylet, never a meter. Reassignment is drag-between-lanes within those bounds — no unlimited free labor.

**§4b Baby contract [round 2 — "cards enter both queues" wasn't implementable]:** care needs generate on a schedule (6 daytime windows + 1–2 night feeds, seeded); each spawns one card offered first to the on-care parent per the who-works split, reassignable within capacity; a missed window = fussy-baby storylet and the next window arrives sooner — **never a harm counter** (fail-soft holds for the baby too). Night feeds wake the on-duty parent: sleep-skip pauses at the feed and resumes after. Hired help absorbs up to N cards/day for its fee. The baby has **3 poses/states (newborn · sitting · toddling)** — art states tied to story beats, explicitly not an aging system (SPEC §23 stands).

## 5. Aspirations & the endings gallery [DECIDED §0]

Marriage+baby is one rich branch, not the only ending. An **Aspirations** panel (unlocked v1-goal-style, chosen and changeable anytime) tracks five life summits; completing any plays its ending card into a **gallery**, and the game continues sandbox-after:

Completing any aspiration offers the choice: **"keep living"** (sandbox continues, the card waits) or **"frame it"** — the ending card enters the gallery, the run ends, and NG+ seeds (docs/06 §3) [DECIDED round 2 — this section is the normative statement]. Every condition follows the v1 goal pattern — explicit sampling + a deliberate act the autopilot can't fake (a verifier caught the draft recreating v0.1's passive "Health ≥85" goal here):

*Family* — wedding + baby · *Master of the Craft* — career L5 + Practice L3 (700 pts; mastery keeps accruing forever — the Prepared Performer bonus never consumes it) · *Perfect Home* — all six objects at L3 + ≥8 decorations placed · *Peak Form* — Gym L3 + 30 consecutive days of Health ≥80 at the 09:00 check **with ≥2 player-inserted gym/class sessions per week** (the deliberate act; autopilot alone can't book classes) · *People Person* — all friends L3 + Connection ≥70 at the 09:00 check for 14 consecutive days · (candidate: *The Quiet Life* — decline the Day-8 letter forever, docs/02 Q3).

## 6. UI/UX

Relationship panel (hearts, discovered-tag chips, `?` slots, next-step hint) · date scenes (VN-lite layout, choices as bubble cards — same card grammar as the queue) · household queue view (two lanes, drag between = reassign chore) · proposal/wedding/who-works as full event cards/modals per design.md · gallery screen (frame per ending, date-stamped).

## 7. Art scope (largest art version — per design.md)

4 candidates: layered HFM heroic-chibis + **portraits** (the one place portraits enter the game; palette-locked, layer-composed for v6 reuse) · restaurant scene · wedding dressing of the park scene · nursery object set + baby sprite (3 sizes, care animations) · ring/gift icons · gallery frames · household-queue chrome. Each candidate gets one caricature move that breaks the facial thirds and the same rest/joy/effort/focus/awkward/tired expression grammar as the v1 hero; a generic dot face fails. Portrait consistency is the art risk—design.md's portrait recipe is binding; fallback is chibi-only close-ups.

## 8. Content budget & cut line

Budget: 4 candidates × ~30 conversation beats + 3 storylet arcs each ≈ **~170 authored beats** (typed JSON, zod-validated, every string passes [writing.md](../writing.md)). Cut line, in order: beats per scene 3 → 2 · restaurant scene → café reuse · wedding scene → event card only. The *who-works* card and the gallery are never cut — they're the version's spine.

## 9. Harness assertions

Every candidate is reachable: some tag path from any career/hobby build reaches ≥ ×1.3 compat — the same value as the proposal floor, so Steady can never dead-end · Love can reach 80 within 6–10 weekends of varied dating at average health · the rolling-window variety rule makes any repeat-heavy rotation (including alternating pairs) strictly slower than true variety · a broke player can still court (conversation + park path to 80 exists, slower) · baby-care cards never starve the health loop below the SPEC §6.8 floors (household split absorbs them).

## 10. Open questions

Q1: ~~resolved round 2~~ — 4 deep candidates. Q2: ~~resolved round 2~~ — schedule, income, and story flavor only; no partner career progression. Q3: ~~breakups~~ — resolved fail-soft in §4 (amicable step-back, friend-tier 40, no lock). New: aspiration completion offers **"keep living" or "frame it"** — framing ends the run into the gallery and seeds NG+ (docs/06 Q2, now decided).
