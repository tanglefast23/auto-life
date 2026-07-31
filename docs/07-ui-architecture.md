# 07 — UI Architecture: regions, layers, and the end of free-floating panels

**Status:** **implemented** (M1–M5), 2026-08-01. `src/ui/layout.ts` is the owner; the
gates live in `src/ui/__tests__/layout.test.ts`.
**Owner:** P8.
**Revised:** 2026-07-31, after the P7 art pass landed a new palette, new `CHROME` recipes
and new `TYPE_SCALE` metrics. §3.4 and §6 were rewritten; §3.4.1 is new.
**Revised:** 2026-08-01 on implementation. §1.2's mechanism is no longer a guess — see the
box below — and §3.3.1 was rewritten because the rule as first stated was unsatisfiable.
**Supersedes:** nothing. Extends SPEC §11 and design.md §3/§4 rather than replacing them.

---

## 1. The problem, stated precisely

The game does not have a UI layout. It has a screen full of surfaces that each
independently pick an edge, a hand-typed pixel offset, and a hand-typed `zIndex`, and hope.
That works while there are three of them. There are now **23 `zIndex` literals across 8
files**, and they collide.

Full census, taken mechanically from the tree at P7 close (`grep`-verified, not from
memory — an earlier draft of this spec mis-stated several of these):

| Surface | Anchor | z | File |
|---|---|---|---|
| `PauseSettings.overlay` | fullscreen | 200 | `ui/PauseSettings.tsx:694` |
| `AppShell.notice` | `left 24, top 24` | 200 | `ui/AppShell.tsx:601` |
| `FirstSessionUI.lifeDecisionOverlay` | fullscreen | 100 | `ui/FirstSessionUI.tsx:683` |
| `GameScreen.fatalOverlay` | fullscreen | 100 | `application/GameScreen.tsx:573` |
| `FirstSessionUI.intentionPanel` | centred | 55 | `ui/FirstSessionUI.tsx:696` |
| `QueueStrip.toast` | `right QUEUE_W + 10, bottom 10` | 50 | `ui/QueueStrip.tsx:1193` |
| `FirstSessionUI.eventCard` | `left 50%` | 50 | `ui/FirstSessionUI.tsx:671` |
| `FirstSessionUI.recapCard` | `right 8` | 45 | `ui/FirstSessionUI.tsx:760` |
| `QueueStrip.popover` | `bottom 8, right QUEUE_W - 3` | 40 | `ui/QueueStrip.tsx:1045` |
| `Hud.root` | `top 0, left 0, right 0` | 35 | `ui/Hud.tsx:429` |
| `FirstSessionUI.goalsPanel` | `left 8` | 31 | `ui/FirstSessionUI.tsx:521` |
| `Hud.tip` | `top 100%` of its row | 30 | `ui/Hud.tsx:469` |
| `FirstSessionUI.goalChip` | `left 8` | 30 | `ui/FirstSessionUI.tsx:468` |
| `FirstSessionUI.intentionChip` | `left 280` | 30 | `ui/FirstSessionUI.tsx:490` |
| `FirstSessionUI.wrinkleChip` | `right 8` | 30 | `ui/FirstSessionUI.tsx:502` |
| `QueueStrip.root` | `right 0, bottom 0`, width `QUEUE_W` | 20 | `ui/QueueStrip.tsx:759` |
| `WorldInteractions.choicePanel` | in-stage | 20 | `ui/WorldInteractions.tsx:306` |
| `GameScreen.preferenceBubble` | `top 70` | 19 | `application/GameScreen.tsx:543` |
| `QueueStrip.forecastChips` | in-card | 4 | `ui/QueueStrip.tsx:860` |
| `QueueStrip.poof` | in-card | 3 | `ui/QueueStrip.tsx:920` |
| `QueueStrip.dragSurface` | in-card | 2 | `ui/QueueStrip.tsx:854` |
| `QueueStrip.urgentBadge` | in-card | 2 | `ui/QueueStrip.tsx:950` |
| `WorldInteractions.hotspot` | in-stage | 2 | `ui/WorldInteractions.tsx:276` |

Note the bottom five: they are **intra-component** ordering inside a single card or
hotspot, not screen-scope layering. §3.3 has to make room for them, and an earlier draft's
Gate 1 would have outlawed them by accident.

Four collisions follow, and all four are visible in play:

1. **`recapCard` (right 8) lands inside the queue rail's column** (right 0, width 224). The
   morning recap and the rail occupy the same pixels, and the rail is the one surface the
   player is steering with. **The z values do not explain who wins** — see §1.1.
2. **`wrinkleChip` (right 8, z 30) lands in the same column**, for the same reason.
3. **`goalChip` / `intentionChip` (left 8 / left 280) land under `Hud.root`**, which spans
   `left 0 → right 0`. The chip text disappears behind the health block.
4. **`Hud.root` spans the full width**, so its own right edge crosses the rail's column.

The shared cause is not any one offset. It is that **`QUEUE_W` (224) and `HUD_H` (148)
already exist in `render/scale.ts` as reserved dimensions, and only the world renderer
respects them.** Every UI surface treats the screen as empty and anchors to raw edges.

### 1.1 The reserves are also wrong, not merely ignored

Measured live at `textScale` 1, the HUD block's real box is **200 × 198**. The spec it is
supposed to fit is `HUD_H = 148`, and `GameScreen` reserves exactly
`hudHeight = HUD_H * hudTextScale` ([GameScreen.tsx:121](../src/application/GameScreen.tsx#L121)).
So the HUD **overhangs its own reserve by 50px** before any collision is considered, and
because the reserve scales linearly while the block's fixed paddings and borders do not,
the error changes with the text-size slider rather than staying constant.

Any region model that adopts 148 and 168 as given inherits this bug. §3.2 therefore derives
region sizes by measurement, not by copying the existing constants.

### 1.2 Who wins collision 1, and why — **confirmed on implementation**

> **Measured, 2026-08-01.** react-native-web assigns **every** `View` `position: relative;
> z-index: 0`. Every View is therefore a CSS stacking context, and a z value only ever
> competes with its siblings inside the nearest one. `FirstSessionUI` wrapped all of its
> surfaces in an `absoluteFill` View, so the recap's 45 and the chips' 30 competed only
> with each other while the wrapper as a whole competed at z 0 — and lost to the rail. The
> numbers in §1's table were never compared to each other at all.
>
> This makes §3.3.1 as originally written ("no intermediate wrapper may create a stacking
> context") **unsatisfiable** — in RNW every wrapper does. The implemented rule is the
> reachable one: screen-scope surfaces are emitted as **siblings**, so they share a single
> stacking context and the ladder decides. `FirstSessionUI` now returns a fragment rather
> than a wrapping View, and Gate 3 fails any file that reintroduces one.

The original note, kept for the record:

Observation (from play): the rail paints over the recap. But `recapCard` is z 45 against
the rail's z 20, **and** `FirstSessionUI` mounts *after* `QueueStrip`
([GameScreen.tsx:458 and :477](../src/application/GameScreen.tsx#L458)) — so both z order
and DOM order predict the recap should win. It does not.

The likely explanation is that the two subtrees sit in separate CSS stacking contexts, so
their z values never actually compete; react-native-web assigns `z-index: 0` to wrapper
views, and any such ancestor isolates its descendants. **I was not able to confirm this
against a live repro** — the recap only mounts at a wake boundary, and the rail was empty
when measured. Treat the mechanism as unconfirmed.

What is confirmed is the part that matters: **the numbers in the table above do not
determine what the player sees.** Whatever the exact mechanism, hand-typed z values in
sibling subtrees are not a layering system, which is what §3.3 replaces. The rule in §3.3.1
makes the mechanism moot rather than requiring it to be diagnosed first.

This spec replaces edge-anchoring with regions that reserve space, and hand-typed
`zIndex` with a fixed layer ladder.

---

## 2. What the reference games actually do

Sourced from published design writing and from the interfaces themselves. The useful
finding is how strongly they converge.

### 2.1 Consolidate; never scatter

The clearest published rule for this genre is negative. *Game Developer*'s strategy-UI
piece singles out Planetary Annihilation for splitting "building commands on the bottom,
resources at the top and unit orders on the right side," and prescribes consolidating
commands and information into unified sections instead of spreading them across areas.
The same piece reserves the bottom of the screen for contextual detail — unit stats,
building details — as a single predictable place to look.

RimWorld is the cautionary case in a life-sim shape: pop-up messages float at the
top-left, alerts stack on the right, clock and speed cluster bottom-right. Players
routinely install notification mods to consolidate it. Scattering is survivable and
still worth avoiding.

**Take:** one place per *kind* of information, chosen once, never negotiated per feature.

### 2.2 Hierarchy is by urgency, and position is part of the hierarchy

Vitals and immediate threats get the strongest contrast **and the most stable position**;
cosmetic or low-frequency information gets quieter treatment. A HUD is read peripherally
while the player's eye is on the centre, so a panel that moves between sessions is a panel
that has to be re-found every time.

**Take:** stability is a feature. A surface that sometimes appears at `left 8` and
sometimes at `left 280` has no position at all.

### 2.3 Progressive disclosure: tiles that open into cards

Football Manager 26's overhaul is the most recent large-scale statement of this. Its
stated principles are **Efficiency** (fewer clicks to information), **Familiarity**, and
**Predictability** (easy to learn and master). Structurally it uses tiles as the component
part of every screen — a snapshot that expands into a detailed Card on interaction — and a
single Portal hub replacing a previous Home/Inbox split. Overview data sits upfront;
granularity is reachable, not resident.

Notably, FM26 lists correcting unreadable font sizes and undefined colour contrast as a
headline goal of the redesign, not a footnote. Density and legibility are not opposites,
but they do have to be budgeted.

**Take:** the rail card is already a tile. The details panel is already a card. The pattern
is right; it is the *placement* that is unmanaged.

### 2.4 Anchoring as a first-class, composable property

Crusader Kings 3 positions every interface node relative to a `parentanchor` — `left`,
`right`, `top`, `bottom`, `hcenter`, `vcenter`, combinable. Position is declared against a
named parent, not against the screen.

**Take:** this is the mechanism this codebase is missing. Surfaces should anchor to a
**region**, and regions anchor to the screen. One indirection fixes every collision in §1,
because moving a region moves everything in it.

### 2.5 Nothing important happens off-screen

The same strategy-UI source is blunt: important events should never just happen without the
player realising. Idle workers, attacks, completions all get a visual notification.

**Take:** this is the reason alerts cannot simply be deleted to solve overlap. They need a
home, not a silencer. That home is §3's Notice column.

---

## 3. The spec

### 3.1 Two primitives

Everything below is built from exactly two ideas.

**A Region** is a named rectangle that reserves space. Regions are laid out first; the
world viewport is whatever they leave. A surface names a region and never a screen edge.

**A Layer** is a named entry on a fixed ladder. A surface names a layer and never a number.

If a surface needs neither — if it wants to float somewhere new — the answer is that it
belongs in an existing region, or the region set is wrong and changes here first.

### 3.2 The regions

Six, chosen to match where these games converge and where this game's information already
lives.

```
┌──────────────────────────────┬───────────┐
│ STATUS                       │  TEMPORAL │   STATUS   vitals, always. never moves.
│ (health, four bars, practice)│ (day,clock│   TEMPORAL day/clock/speed/settings.
├──────────────────────────────┤  speed)   │
│                              ├───────────┤
│                              │           │
│           STAGE              │   RAIL    │   STAGE    the world. gets what's left.
│      (the world, the sim)    │  (queue)  │   RAIL     the action queue. one column.
│                              │           │
│                              │           │
├──────────────────────────────┤           │
│ NOTICE  (chips, toasts)      │           │   NOTICE   ambient, transient, stacked.
└──────────────────────────────┴───────────┘
                                             FOCUS    centred overlay (not shown)
```

| Region | Anchor | Reserves | Holds |
|---|---|---|---|
| `STATUS` | top-left | `measure(textScale)` — **not** `168 × HUD_H` | health block, four bars, practice counter |
| `TEMPORAL` | top-right | `QUEUE_W × measure(textScale)` | day, clock, speed, settings, mute |
| `RAIL` | right, below `TEMPORAL` | `QUEUE_W` wide | current card, queue, palette trigger |
| `NOTICE` | bottom-left, left of `RAIL` | grows upward, capped | goal/intention/wrinkle chips, toasts |
| `STAGE` | fills remainder | — | world canvas, hotspots, thought bubbles |
| `FOCUS` | centred over all | — | recap, event, intention, life decision, pause |

**Region sizes are functions, not constants.** §1.1 measured the HUD block at 200 × 198
against a reserve of 148. Copying `168` (the row's inner width) or `HUD_H` (148) into this
table would carry that bug forward, and `healthWidth` alone reaches 252 at `textScale` 1.5.
So `REGION.status(textScale)` returns a rectangle derived from the same recipe that sizes
the content — `hudType(scale)` — rather than a literal that has to be kept in sync by hand.
The existing constants stay only as the `textScale = 1` fallback for the world solver.

Three consequences worth naming:

- **`TEMPORAL` moves into the rail's column.** It is already visually there. Making it a
  region means `Hud.root` stops spanning `right 0` and stops crossing the rail.
- **`recapCard` and `wrinkleChip` move out of `right 8`.** The recap is a focused summary,
  so it belongs in `FOCUS` — **without a scrim** (§7.1). The wrinkle chip is a genuine
  notification, so it belongs in `NOTICE`. The goal and intention chips do **not** move;
  they are pointers, and they stay with their referents (§7.2).
- **`NOTICE` is a column, not a scatter.** One stack, bottom-left, growing up, capped at
  three visible with a "+N more" affordance. This is the fix for §2.5 without recreating
  RimWorld's spread.

### 3.3 The layer ladder

Hand-typed `zIndex` is banned. One token table, one owner.

| Layer | z | What lives here | May cover |
|---|---|---|---|
| `world` | 0 | the Skia canvas | — |
| `worldOverlay` | 10 | hotspots, hotspot labels, thought bubbles | world |
| `notice` | 20 | chips, toasts, undo | world only |
| `chrome` | 30 | `STATUS`, `TEMPORAL`, `RAIL` | world, notice |
| `chromePopover` | 40 | bar tips, card menus, rail popovers | own chrome |
| `focus` | 50 | recap, event, intention | everything but modal |
| `modal` | 60 | pause, settings, fatal, life decision | everything |

Plus one band that is **not** on the screen ladder:

| Band | z | Scope |
|---|---|---|
| `local` | 1–9 | ordering *within* one component's own subtree |

`local` is what the rail's card internals use — drag surface under poof under forecast
chips — and what `WorldInteractions` uses for hotspot vs label. It is legal only inside a
surface that has already claimed a screen layer, and it can never lift a child out of its
parent. Without it, Gate 1 would outlaw five correct usages on day one.

**`notice` sits below `chrome`, deliberately.** An earlier draft put notices *above* chrome
at z 40. That is wrong twice over. It would have undone the live fix that currently keeps
the goal chip from painting over the HUD (`Hud.root` z 35 today), and it picks the wrong
loser: if the geometric guarantee in rule 2 ever slips, the surface the player is *steering
with* should win, not an ambient chip. Ordering notices below chrome makes the failure mode
"a chip is briefly hidden" instead of "the queue is briefly unusable."

Rules that make the ladder hold:

1. **A layer token is the only legal source of a screen-scope `zIndex`.** A literal in a
   StyleSheet is a review failure. `local` band values are the sole exception, and only
   inside a component's own subtree.
2. **`notice` may never overlap `chrome`.** It is placed in the `NOTICE` region, defined as
   space `chrome` does not occupy. Enforced by geometry, with the z ordering above as the
   backstop, not the mechanism.
3. **A popover belongs to its own chrome.** The bar tip at `chromePopover` may cover the
   HUD block it belongs to and nothing else.
4. **`focus` dims the stage.** A focused surface is exclusive: at most one, and it takes a
   scrim so the player knows the world is waiting — **except the recap, which is `focus`
   without a scrim** and lets the sim keep running (§7.1). Exclusivity still applies to it.
5. **Within a region, surfaces queue rather than stack.** Two chips do not overlap; the
   second waits or the column grows. Two focus cards do not overlap; the second queues.

#### 3.3.1 Layers apply only at screen scope

This is the rule that makes §1.2's unresolved mechanism stop mattering.

**Only a surface mounted directly into the screen root may carry a layer token, and no
intermediate wrapper between the screen root and that surface may set `zIndex`, `opacity`
below 1, `transform`, `filter`, or `isolation`.** Each of those creates a CSS stacking
context, and a stacking context is exactly what makes a z value stop competing with its
apparent peers.

Without this rule, M1 swaps 23 numbers for 23 tokens and changes nothing observable,
because the contexts — not the numbers — are deciding. A gate for it is in §5.

### 3.4 Density budget

Density is the point of this genre, so the budget is explicit rather than aspirational,
and it inherits the constraints design.md already set.

- **Four type sizes, two weights**, unchanged from design.md §4. `TYPE_SCALE` is the only
  source. `scaledType()` is the only way to read it — a raw `TYPE_SCALE.body` in a
  StyleSheet is how the rail silently stopped honouring the text-size preference.
- **Type metrics are no longer implicit.** The art pass gave every pixel step an explicit
  `lineHeight` and `letterSpacing`, and made `heading`/`display` `textTransform:
  'uppercase'`. Vertical budgets must be computed from `TYPE_SCALE.*.lineHeight` rather than
  from a browser default — see §3.4.1.
- **Every spacing value divisible by 4.** Region gutters are 8.
- **60/30/10 colour.** Region backgrounds are the 60. Two amendments from the art pass:
  **blue is now the action colour** (`CHROME.neutralButton` and `selectedControl` are water
  blue, not cream), so blue is spent on controls and must not also become a region
  background; and red's separation from rose fell from 1.53:1 to **1.25:1** when
  `IZAKAYA_RED.base` moved `#c8402e → #d94f52`. Red still means urgent, but it is now close
  enough to rose that red must never be the *only* carrier of urgency — the alert glyph and
  the badge stay mandatory (SPEC §11.6's non-colour rule, now load-bearing rather than
  belt-and-braces).
- **At most one focal point per region.** If two things in a region are both emphasised,
  one of them is not actually important.
- **`NOTICE` caps at three.** Beyond that it collapses to a count. An uncapped alert column
  is how RimWorld's right edge became a wall.

#### 3.4.1 The art pass moved the vertical budget — recompute, do not assume

Two changes from the P7 art pass tighten every box in the UI, and M2 must re-derive heights
rather than inherit today's numbers.

**`TYPE_SCALE.body` gained `lineHeight: 20`.** It previously had none, so the browser chose
roughly 18. The queue card's stack is glyph row (14) + label + start time (16); that moved
from 48 to **50**. The card's 64px unit leaves 52 after borders and padding, so the fix in
§1 still holds — with **2px of headroom instead of 4**.

**`CHROME.chunky()` gained a 4px top highlight border.** Panels are now `borderTopWidth: 4`
as well as `borderBottomWidth: 4`. Any surface that migrates onto `CHROME.card` therefore
loses 2 more vertical pixels than the hand-rolled borders it replaces. A 64px card built
from `CHROME.card` (4 + 4 borders, `space.sm` padding both sides) has **40px of content
space against a 50px need — it would clip immediately.**

This is the same defect §1 documents, one refactor away from returning. The rule: **a region
or card height is computed from `lineHeight` plus the actual border and padding of the
`CHROME` recipe in use**, never from a number that was measured once. Gate 5 catches it.

#### 3.4.2 Chrome must separate from the stage, not just avoid it

The art pass moved the world from warm browns to near-white walls (`GREY.light #c9c5d0`)
while chrome moved from warm cream to white and near-white. Measured luminance contrast
between UI fills and the world surfaces they sit over:

| Chrome fill | vs wall `#c9c5d0` | vs floor `#6b4f74` |
|---|---|---|
| `creamLight` `#ffffff` | 1.70 | 7.01 |
| `creamBase` `#f4f1ea` | **1.50** | 6.21 |
| `creamShadow` `#d9d5cf` | **1.16** | 4.80 |

Text contrast is excellent and not at issue — ink on white is 16:1. The problem is the
**panel edge**: a rail whose background is 1.50:1 against the wall behind it is held apart
from the world by its 2px ink border alone.

Regions solve overlap. They do not solve indistinctness, and a region that reserves space
correctly can still read as part of the scene. So the spec adds one requirement: **every
chrome region carries an ink border at full opacity, and no region fill may be used where
its contrast against the adjacent stage surface falls below 1.5:1 without that border.**
Gate 10 checks it against the palette rather than against a screenshot.

### 3.5 Responsive behaviour

The v1 target is desktop web, but this ships to iOS, and the region model has to survive a
390pt-wide screen. One breakpoint, not a matrix.

- **Wide (≥ 900):** as drawn above. `RAIL` and `TEMPORAL` share the right column.
- **Narrow (< 900):** `RAIL` collapses to a bottom sheet with a peek row showing the
  current card; `TEMPORAL` collapses to zero width and `STATUS` widens to span the top bar,
  absorbing the clock and speed controls; `NOTICE` caps at one. `STAGE` keeps the full
  width, because the world is the thing being watched.

**The six region *names* are stable across breakpoints; their rectangles are not.** A region
may collapse to zero and hand its contents to a named sibling — that is what `TEMPORAL` does
above — but no new region is invented and no surface changes which region owns it. Surfaces
therefore never learn about breakpoints; only `layout.ts` does. That is the whole reason for
the indirection.

(An earlier draft claimed "the region set does not change, only the anchors do" in the same
breath as describing a merge. Both halves cannot be true; the rule above is the one meant.)

---

## 4. Migration

Sequenced so each step is shippable and independently verifiable. No step requires the next
one to be correct.

**M1 — Introduce the tokens.**
`src/ui/layout.ts` exports `REGION`, `LAYER`, and the `local` band. Every screen-scope
`zIndex` literal is replaced by its token, and every intermediate wrapper that sets a
stacking-context property is flattened (§3.3.1) — that flattening, not the renaming, is the
substantive work.

**M1 does not promise "no visual change," because that promise cannot be kept.** Three
orderings genuinely change, and each is intended:

| Pair | Today | After | Why |
|---|---|---|---|
| `toast` vs `recapCard` | 50 > 45, toast above | `notice` 20 < `focus` 50, toast below | a transient toast must not cover a summary the player is reading |
| `PauseSettings.overlay` vs `AppShell.notice` | both 200, DOM order decides | both `modal`, explicit order | a tie is not a decision |
| `fatalOverlay` vs `lifeDecisionOverlay` | both 100, DOM order decides | both `modal`, explicit order | same |

The honest promise is: **preserve observable order except for the three rows above, which
are listed, intended, and covered by a test.** Everything else is byte-identical in paint
order — including `Hud.root` above the chips, which the new ladder preserves by construction
(`chrome` 30 > `notice` 20) rather than by the z 35 stopgap it replaces.

**M2 — Region the chrome.**
`STATUS`, `TEMPORAL`, `RAIL` become real reserved boxes sized by `measure(textScale)`
(§3.2). `Hud.root` stops spanning `right 0`. This is also where §1.1's 50px HUD overhang is
fixed: the world solver reads the measured region, not `HUD_H`. Fixes collision 4.

**M3 — Region the notices.**
The rail's toast/undo and the wrinkle chip move into the `NOTICE` column, stacked, capped at
three. Fixes collision 2. **`goalChip` and `intentionChip` stay where they are** (§7.2):
they are anchored pointers, not notifications. Collision 3 is already fixed by M2, which
stopped `Hud.root` spanning the full width, so nothing forces them to move.

**M3 must not be deferred past M2.** M2 gives chrome a hard rectangle; until M3 gives
notices theirs, the geometric guarantee in rule 2 is unenforced and only the z backstop is
holding. That backstop is why the ladder orders `notice` below `chrome` — but a backstop is
not a design.

**M4 — Region the focus surfaces.**
`recapCard` moves from `right 8` into `FOCUS`: centred, exclusive, dismissible, **no scrim,
sim keeps running** (§7.1). Joins `eventCard`, `intentionPanel`, `lifeDecisionOverlay`,
which are already centred and only need the token and the exclusivity rule — those three
keep their scrims, because each one asks the player for a decision. Fixes collision 1.

**M5 — Narrow breakpoint.**
`RAIL` as a bottom sheet, `TEMPORAL` merged into `STATUS`. Nothing above changes.

---

## 5. Acceptance gates

A spec that cannot fail a test is a mood board. Each gate is mechanically checkable.

1. **No screen-scope `zIndex` literal in `src/ui` or `src/application`.** Grep gate, same
   shape as the existing `MOTION.` gate that catches hand-rolled animation timings.
   *Scope:* values in the `local` band (1–9) inside a component's own subtree are exempt and
   must be declared via `LAYER.local(n)` so the gate can tell them apart. Without this
   carve-out the gate fails on five correct usages the day it lands — `dragSurface` (2),
   `urgentBadge` (2), `poof` (3), `forecastChips` (4), `hotspot` (2).
2. **No `position: 'absolute'` anchored to a raw screen edge outside `layout.ts`.**
   *Scope:* "screen edge" means an offset measured from the viewport. Absolutes positioned
   inside their own parent box are legitimate and exempt — verified against the tree, that
   exemption covers `srOnly` ×3 (the standard `left: -10000` screen-reader pattern),
   `edgeTick`, `alertPulse`, `urgentPulse`, `poofPuff`, `urgentBadge`, `forecastChips`,
   `hotspotLabel`, `progressPip`, and `Hud.tip` (`top: '100%'` of its own row). An
   unscoped gate flags all eleven and would be turned off within a day.
3. **No stacking-context property on any wrapper between the screen root and a layered
   surface.** Asserts §3.3.1: walk the mounted tree from root to each layered surface and
   fail on an intermediate `zIndex`, `transform`, `filter`, `isolation`, or `opacity < 1`.
   This is the gate that makes M1 mean something; without it the token swap is cosmetic.
4. **Region rectangles do not intersect.** A unit test computes the six rectangles at
   several viewport sizes — including 390×844 and 1470×956 — **and at `textScale` 0.75, 1.0
   and 1.5** — asserting pairwise non-intersection for `STATUS`, `TEMPORAL`, `RAIL`,
   `NOTICE`, `STAGE`. The scale axis is not optional: §1.1's defect is a scale bug.
5. **Every region contains its content.** For each region, the measured bounding box of its
   mounted children fits inside the region rectangle. This is the gate that would have
   caught the 200 × 198 HUD block in a 148-tall reserve.
6. **Mounted-overlap gate.** With every ambient surface forced visible at once — chips,
   undo toast, a full rail, an open bar tip — no `notice` surface's rect intersects any
   `chrome` surface's rect.
7. **At most one `focus` surface mounts at a time.** Asserted by mounting two and expecting
   the second to queue.
8. **`NOTICE` never shows more than three.** Push five, assert three plus a count.
9. **Type and spacing gates hold.** Existing `theme.test.ts` extends to assert every UI
   StyleSheet spacing value is divisible by 4, and that **`TYPE_SCALE` is imported nowhere
   outside `theme.ts` and its tests** — every consumer goes through `scaledType()`. Stated
   that way it is mechanical; "every font size came from `scaledType`" is not checkable, and
   this is the exact defect that left the rail's `cardLabel` deaf to the text-size slider.
10. **Chrome separates from the stage.** For each chrome fill and each adjacent stage
    surface in the palette, either luminance contrast ≥ 1.5:1 or the region declares a
    full-opacity ink border. Computed from `palette.ts`, so an art pass that darkens a wall
    or lightens a panel fails the gate instead of quietly dissolving the rail's edge.
11. **Presentation bounds stay inside `STAGE`.** `object-presentation.ts` now draws objects
    larger than their 32px collision tile, so a sprite's visual box no longer equals its
    logical one. Assert every presentation rectangle is contained by the `STAGE` region at
    each breakpoint, or the furniture will reach under the rail.

---

## 6. What this deliberately does not do

- **No new information.** This spec moves and constrains what already exists. SPEC §11.1
  caps the permanent HUD at Health · Funds · Connection · clock/speed forever, and that cap
  is untouched.
- **No visual restyle.** This spec is architecture, not art direction: it does not choose
  colours, borders or type faces. It does *consume* them, and the P7 art pass changed all
  three underneath it — new neutrals, a top-highlight border on every `CHROME` recipe, and
  explicit type metrics. §3.4.1 and §3.4.2 record what those changes cost the layout. An
  earlier draft claimed the palette was "unchanged"; that was true when written and is not
  true now, which is precisely why region and card sizes must be derived rather than
  copied.
- **No new library.** Plain `StyleSheet` and computed rectangles, consistent with the
  existing recorded deviation from SPEC §3 on NativeWind.
- **No customisation.** FM26 ships 24 bookmark slots; this game has six regions. Letting the
  player rearrange them would be solving a problem this game does not have.

---

## 7. Decisions taken

Two places where an earlier draft quietly decided a product question by writing it into a
layout table. Both were surfaced to Joe and both are now **settled — option B in each case,
decided 2026-07-31**. Recorded here with the alternatives, so a later reader can see what
was weighed rather than re-litigating it.

### 7.1 Does the morning recap interrupt? — **decided: B, no scrim**

The draft moved `recapCard` into `FOCUS`, which per rule 4 means centred, exclusive, and
scrimmed. That is not a relocation — **it converts a passive corner card into a modal that
stops the world at every single wake.** The player currently reads it while the sim carries
on.

| Option | Cost |
|---|---|
| **A. `FOCUS` with scrim** (as drafted) | a hard interrupt every morning, forever |
| **B. `FOCUS`, no scrim, dismissible** | keeps the centre stage and the ceremony, sim keeps running |
| **C. Expandable `NOTICE` entry** | never interrupts; a summary the player may never open |

**Decided: B.** A day boundary earns a moment of attention, but not a modal — and the recap
is read, not acted on. A was right only if the wake should be a beat the player must
acknowledge; it should not be, every morning, forever.

*Consequence for rule 4:* `FOCUS` no longer implies a scrim. Exclusivity and the scrim are
separate properties, and the recap takes the first without the second.

### 7.2 Do the onboarding chips stay where they point? — **decided: B, they stay**

The draft swept `goalChip` and `intentionChip` into the bottom-left `NOTICE` column with the
toasts. But these are not notifications — they are **pointers**, deliberately placed near
the thing they refer to. `intentionChip` sits at `left 280` precisely because that is where
the intention is. Moving them into a stack in the corner turns a pointer into ambient noise
and costs them the one property that makes them work.

| Option | Cost |
|---|---|
| **A. All chips → `NOTICE`** (as drafted) | uniform and tidy; chips stop pointing at anything |
| **B. Chips stay contextual, owned by the region they point at; only toasts/undo/wrinkle → `NOTICE`** | two placement rules to understand instead of one |

**Decided: B.** `wrinkleChip` is a genuine notification and belongs in `NOTICE`; `goalChip`
and `intentionChip` are tutorial affordances anchored to their referent, and a pointer moved
away from what it points at is no longer a pointer. Collision 3 is fixed by M2 regardless.

*Consequence:* placement has two rules, not one. A surface goes to `NOTICE` if it reports
something that happened; it stays anchored if it points at something on screen. §5 gains no
new gate — an anchored chip is inside `STATUS` or `STAGE` and is covered by Gate 5.

---

## Sources

- [UI Strategy Game Design Dos and Don'ts — Game Developer](https://www.gamedeveloper.com/design/ui-strategy-game-design-dos-and-don-ts)
- [FM26's Reimagined User Interface — Football Manager](https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface)
- [Interface — CK3 Wiki](https://ck3.paradoxwikis.com/Interface)
- [Game UI Database — HUD: Info and Notifications](https://www.gameuidatabase.com/index.php?scrn=145)
- [Game UI Database — Frostpunk 2](https://www.gameuidatabase.com/gameData.php?id=1965)
- [Game UI Database — Anno 1800](https://www.gameuidatabase.com/gameData.php?id=1118)
- [Game UI Database — Two Point Hospital](https://www.gameuidatabase.com/gameData.php?id=99)
- [Game UI Database — The Sims 4 (PC)](https://www.gameuidatabase.com/gameData.php?id=528)
- [RimWorld — info on the right side (community discussion)](https://steamcommunity.com/app/294100/discussions/0/2957166487942540122/)
- [HUD in Video Games: Meaning, Examples & Design Guide — Sunstrike Studios](https://sunstrikestudios.com/en/blog/HUD_design_in_games/)
