# v3 — "People" (Connection & the social battery)

**Fantasy:** the apartment stops being the whole world. Friends exist, and weekends have faces in them.
**Depends on:** v1 queue/planner, v2 calendar (weekends free). Art obeys [design.md](../design.md).
**Status:** **CONFIRMED — Joe ruled O3 for the split model on 2026-07-29 (SPEC C11).** This doc is canon for v3. All numbers harness-owned (docs/02 convention); verified claims marked ✓.

---

## 1. The model: two meters, one bar shown

- **Connection (the third top bar, 0–100):** how *connected to people* the sim feels. Decays 0.4/h awake (−6.4/day; ≈2 weeks full→empty — a skipped weekend is felt, two skipped weekends are a hole). A verifier killed the draft 0.6/h: weekly decay 67 exceeded the standard weekend's +50 intake, so the doc's own harness assertion failed at average health. **Only interaction with people restores it** — introvert or extrovert. This is the bar on the HUD.
- **Opening & Catch-up** (docs/02 contract): prerequisite = v2 career accepted + first payday · fallback = Day 25 · existing save past that = the first friend-knock wrinkle fires on next load · decline/postpone = knocks recur weekly, no pressure · commitments effect = accepted invitations book Week Plan commitments (SPEC §7.6), never idle queue cards.
- **Connection gains scale by battery state only — never m_out** [DECIDED round 2, SPEC §6.6 exception]: a verifier showed m_out × battery stacking (+50 base → +84 effective) pinned Connection at 100 permanently. Friendship isn't a performance.
- **Social battery (qualitative face icon, exact number in details — SPEC Pillar 2):** capacity for interaction *right now*. **Normative numbers:** 0–100, starts 70; high ≥70 → +25% Connection gains; empty ≤10 → half gains + grumpy bubbles; solitude = reading, solo games, quiet idle (Practice counts as solitude; work never touches the battery, §3). Personality changes (Settings → Sim) take effect the **next morning** with a **7-day cooldown**; battery carries over as a percentage; the journal notes it. Personality sets the physics:

| | Extrovert | Introvert |
|---|---|---|
| Interaction | charges the battery | drains the battery |
| Solitude (reading, solo games, practice) | slowly drains | recharges |
| Battery high | interactions give +25% Connection | same |
| Battery empty | interactions give half Connection, grumpy bubbles | same |

Reading therefore does what it really does: it **recharges an introvert** so their next hangout lands better — it never substitutes for people. An introvert plays fewer, better-timed interactions; an extrovert chains them. Same bar, different rhythm — that's the personality fantasy, mechanically real.

- Personality is chosen at identity-lite (v1 §9.1 gains a third question) or rolled; changeable in Settings → Sim (people grow).

## 2. Friends (NPC-lite)

Three named neighbors, introduced by wrinkles across the first v3 week (a knock, a package mix-up, a noise complaint that turns friendly):

| Friend | Flavor | Schedule chips |
|---|---|---|
| Rio | park runner, early bird | Sat/Sun mornings, park |
| Maren | café bookworm | weekday evenings, café |
| Dot | game-night host | Fri/Sat nights, their place / online |

- Friendship levels 1–3 per friend (repeat interactions + variety): each level unlocks a hangout variant and a storylet arc line. Friends are schedule + tags + storylets — **not simulated sims** (scope guard, same as v5 mates).
- Friends foreshadow v5: one of them knows your future mate pool ("you should meet my cousin…").

## 3. Activities

Invitations arrive as **invitation cards** — they enter the queue only when accepted (PINNED by choice, C2-pure). Weekend big slots + light weekday-evening options (O3b):

| Activity | When | Min | Connection | Battery (I/E) | Notes |
|---|---|---|---|---|---|
| Text a friend | any evening | 5 | +5 | −2 / +2 | phone at couch |
| Call | evening | 15 | +10 | −5 / +5 | |
| Coffee with ___ | weekend day | 90 | +25 | −15 / +15 | café scene |
| Café evening (Maren's slot) | weekday eve | 60 | +20 | −10 / +10 | the one weekday in-person option — without it Maren's schedule was unreachable (verifier catch) |
| Park hangout | weekend day | 180 | +40 | −25 / +25 | park scene, friend-flavored |
| Game night | Fri/Sat eve | 120 | +30 | −20 / +20 | couch (online) or Dot's |
| Reading | any | 60 | 0 | **+20 / −5** | the introvert's sharpening stone |
| Solo games | evening | 60 | 0 | +15 / −5 | |

Gains scale by **battery state only** (§1; SPEC §6.6 exception — never m_out). Planner never auto-schedules social [DEFAULT — like Practice, people are the player's verb]; it *hints* via bubbles and the weekend "Social" chip (brief's weekend button, kept). **Performing at work is craft, not socializing — it never touches the battery** (otherwise an introvert musician's weekdays would permanently drain it).

**Friendship levels:** L2 = 4 interactions with that friend including ≥2 types · L3 = 10 including their signature hangout (Rio: park run · Maren: café evening · Dot: game night).

## 4. Consequences

- Connection ≥70: **"Seen" buff** — storylets warm up, +5% Practice/GP that day [HYPOTHESIS, harness-owned].
- Connection <30: lonely bubbles, idle behaviors droop, recap notes it. No death spiral: nothing blocks, everything slows into melancholy — and one park afternoon fixes most of it.
- Feeds v5 directly: mates are met *through* this system (friends, venues, schedules), and Connection level gates how confident date conversations start.

## 5. UI/UX

- **Goals (chapter 3 chain):** First knock (meet Rio) → First coffee → The whole crew (all three met) → Regular (any friend L2) → Inner circle (any friend L3) → Seen (Connection ≥70 at the morning check (wake+2h) for 3 consecutive days, with ≥1 social activity inside that window).
- Third top bar (Rose fill per design.md) + battery face icon (5 states, non-color-coded shapes).
- **Contacts panel** (phone motif, same chrome as v2 shop): friends, levels, schedule chips, "last seen" — the social memory surface.
- Invitation cards: distinct card back, accept/decline inline, auto-expire with a gentle storylet (declining has flavor, never punishment).
- Park scene: a new full screen (24×14) — the first non-job life scene outside home; same queue strip; picnic wrinkles.

## 6. Art scope (per design.md)

Park scene (grass/path/pond tiles, bench, kite) · café corner reuse from v2 with table set · 3 friend chibis (layered, palette-swapped) + 2 emotes each · phone/contacts chrome · battery face icon set · invitation card back.

## 7. Audio

Park ambience (birds, distant kids) · message blip / call ring · per-friend two-note leitmotifs · game-night chiptune under-loop · café clatter reuse.

## 8. Harness assertions

At the SPEC §16.3 steady-state health band: a weekend with one big hangout + two texts holds Connection ≥60 all week ✓ (0.4/h decay = 44.8/wk vs +50 intake; Friday trough 68 from a Monday 100) · every friend has ≥1 reachable in-person activity per week (Maren's is the weekday café evening) · an introvert who never reads still progresses (slower, never blocked) · battery never traps: from empty, one evening of solitude restores enough for a weekend hangout · the "Seen" buff cannot stack with itself.

## 9. Open questions

Q1 (O3): ~~approved~~ — split model confirmed (SPEC C11). Q2 (O3b): ~~approved~~ with C11. Q3: ~~resolved round 2~~ — each friend shows **one visible comfort tag** (Rio: early hours · Maren: quiet places · Dot: online-first); it flavors hangout bonuses and rehearses v5's tag-reading without making friendship transactional. The People Person aspiration page seeds in this version (SPEC §19).
