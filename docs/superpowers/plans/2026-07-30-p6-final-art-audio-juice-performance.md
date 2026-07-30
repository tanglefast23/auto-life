# Auto Life P6 — Final Art, Audio, Juice & Performance

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status: DRAFT — awaiting plan audit (master §3.7) before code starts.**
>
> **ORDER RULING (Joe, 2026-07-31): P6 runs before P4.5.** P4.5 has *not* run. Joe ruled
> that it cannot produce a usable signal on placeholder art — he could not identify
> objects in the frozen build himself — so the sole fun gate moves to **after** P6 and
> runs on the final-art build. This reverses master §11's C12 sequence, which master §6
> permits only by Joe's explicit decision; this is that decision, and T0 writes it into
> the master plan. **The six pass conditions are unchanged.**
>
> **What this costs, stated once.** C12 put P4.5 before P6 so a design failure would be
> caught before the expensive polish phase was spent on it. Running P6 first means that if
> P4.5 fails, the art, audio, and juice are already built. Joe's reason is sound — master
> §6's failure loop only knows how to change "the smallest implicated P2–P4 behaviour", so
> a comprehension failure caused by placeholder rectangles has no valid remedy inside the
> loop at all — but the exposure is real and P6 does not pretend otherwise. §1's milestone
> order is the mitigation: legibility ships first and is independently observable at
> Gate A, so the comprehension question can be answered before audio and juice are spent.

**Goal:** replace every placeholder with final art, audio, and motion per `design.md`,
so a new player can identify what they are looking at, hear the world, and run it at
60 fps on desktop web — closing SPEC §18's v1 Definition of Done.

**Architecture:** the art pipeline stays what P0–P5 built — sprites are authored as
flat shapes on the locked 57-colour palette in pure TypeScript, rasterized headlessly,
packed into one deterministic committed atlas, and gated in CI. P6 does not add a
drawing tool, an asset importer, or a runtime art dependency. It adds *shapes*, a
second (evening) tile set, a real audio bus behind P5's existing silent interface, and
a motion module the reduced-motion setting already knows how to switch off. Every new
asset class gets a mechanical gate so "no placeholders" is a test result, not a claim.

**Tech stack:** unchanged, plus exactly two new runtime dependencies — `expo-font`
(Silkscreen, per design.md §4) and `expo-audio` (SPEC §14). Both are Expo SDK 57
packages already named in SPEC §3.

**Owned by this phase** (master §5): final art per `design.md` §§2–11; animation and
juice per design.md §10 and SPEC §11.3; audio and music per SPEC §14; desktop-web
performance; and the ship pass that removes every placeholder and re-checks the v1 DoD.

**Exit evidence** (master §5, SPEC §18):

- no placeholder art, audio, or motion remains — proved by the bill-of-materials gate
  in T13, not asserted;
- every `content/activities.json` activity, every granted decoration, every appearance
  preset, and every idle variant has authored frames the atlas actually contains;
- 60 fps measured (not eyeballed) on MacBook Air 13 web and 1366×768, with p50/p95/worst
  frame times recorded;
- audio mixes with working Master/Music/SFX sliders and a persisted mute; no orphaned
  audio after tab close;
- the unchanged P4.5 criteria pass on the post-P6 build;
- `docs/superpowers/evidence/P6.md` records exact commands, hashes, browser/viewport,
  observations, and any honest NOT VERIFIED limit.

---

## Snapshot of what exists right now (2026-07-30)

Recorded from the live tree because master §3.2 requires the *current* repository, not
an imagined one. P5 implementation is complete but uncommitted.

| Layer | State |
|---|---|
| Git | Main checkout `/Users/joemacprom5/Documents/Vibecode/Life Sim` on branch `p4-queue-ui` at `ad347a4` (`feat(P4): ship queue UI and first-session slice`) with **55 modified + 68 new files uncommitted** — that working tree *is* P5. `main` and `origin/main` are behind at `fc45b39` (P4 plan only). |
| Engine | `ENGINE_VERSION = 8`. Canonical scripted-career SHA-256 `141101f2b3b8b6a81c990b886c44e0fe6e03f7e2b67eb0a35f50034af6c3324e` at seed 1234. |
| Gate | P5 T14 `npm run verify` green: 14 registry files, 10 current writing reviews, atlas 512×162 / 33 sprites / 29 colours byte-clean, strict TS, **83 suites / 572 tests / 2 snapshots**, web export. |
| Frozen P4.5 build | App bundle SHA-256 `0d05de24…f765e4a85`; `dist/` manifest `e5788962…5093a7bce9f`; seed 1234 via `?playtestSeed=1234`; Chrome 150.0.7871.187; viewport **1366×768** DPR 1. |
| P4.5 | **Not run.** Joe's diagnostic run and three fresh external sessions are outstanding. |

### What the world actually draws today

This is the state that produced Joe's report — *"I just see a square and I don't know
what that object is."* It is not a subjective complaint; it is what the code does.

| Asset class | Reality in the tree | design.md v1 bill |
|---|---|---|
| Objects | **15 flat rectangles.** `scripts/art/build-atlas.ts:168` calls `box(w, h, fill.base, fill.edge)` for every object. Bed, fridge, treadmill, guitar and wardrobe differ only by ramp colour. | ~16 objects with readable silhouettes (§11) |
| Tiles | 5 room fills + 1 wall, all flat boxes. **One lighting state.** | day **and** evening tile sets (§7) |
| Character | **9 frames**: walk ×4 dir ×2, plus one seated frame. `stand` reuses walk frame 0; `sleep` reuses the seated frame (`scene-layout.ts:154`). | ~48 frames (§6) |
| Appearance | **One baked look** — auburn hair, skin ramp 2, green tunic. `content/identity.json` offers 4 presets with a `paletteId`; `paletteId` is declared in `content-schemas.ts:747` and **consumed nowhere**. All four presets render identically. | 4 presets as palette swaps (§11) |
| Idle variants | `window-gazing`, `slow-stretching`, `air-guitar` are stored in save state and drive no sprite. Goal 4's whole reward is an idle behaviour that cannot be seen. | 4 preference idle variants (§6) |
| Decorations | **2 sprites reused across 6 grants.** `scene-layout.ts:118` says so in a comment: Goal 3's two choices and Goal 5's poster all redraw the plant or the vase. | ~10 decorations (§11) |
| UI chrome | RN `StyleSheet` with palette hexes **copy-pasted into 14 files** (`AppShell.tsx` 36, `PauseSettings.tsx` 33, `QueueStrip.tsx` 24…). No Track-A chunky recipe. | full UI chrome kit (§3, §8) |
| Type | System font. **No pixel font in the repo** — `assets/` has icons and the atlas, nothing else. | Silkscreen Bold (§4) |
| Icons | Unicode glyphs: `☾ ⑃ ⇗ ◍` (`src/ui/bands.ts:63`). | 12 px drawn icon set (§9) |
| Audio | `SilentAudioBus` — "deliberately makes no sound" (`audio-bus.ts:11`). Sliders, mute, `M`, and persistence all work and drive nothing. `expo-audio` is not installed. | music + ambience + ~8 activity loops + UI SFX (SPEC §14) |
| Juice | Progress ring and HUD pulses only. No card slide/squash, poof, sparkle, lamp glow, or 19:00 crossfade. | design.md §10 |
| Perf | Per-frame maths runs in a JS `requestAnimationFrame` (`WorldScene.tsx:53` names this as P6's job). Never measured. | 60 fps, measured |
| Encoder | `png.ts` writes RGBA colour-type 6. P3 deferred indexed PNG to P6 (`evidence/P3.md:175`). | indexed PNG (§2) |
| Debug art | `debug.interact` marker still in the atlas — `build-atlas.ts:190` says "P6 removes it". | removed |

### Deferrals P6 inherits by name

Every one of these named P6 as owner. Master §3 forbids closing a phase with an owned
clause silently deferred, so each maps to a task in §3.

| Source | Item | Task |
|---|---|---|
| `evidence/A0.md` | Seated frame reads as a squat block; wants a real pass | T4 |
| `evidence/A0.md` | Slim mitten hands read detached at 1× | T4 |
| `evidence/A0.md` | AI generation route never exercised; must pass `validate-palette` unchanged if used | T1 (§2 Q3) |
| `evidence/P3.md:174` | Non-walk poses are static | T4 |
| `evidence/P3.md:175` | PNG encoder writes RGBA, not indexed | T1 |
| `evidence/P3.md:157` | Frame maths on the JS thread | T12 |
| `scene-layout.ts:118` | Goal rewards reuse existing atlas art | T6 |
| `build-atlas.ts:190` | `debug.interact` placeholder | T13 |
| P4 plan `[R3]` | `M` keybinding has no audio bus to talk to | T8 |
| `evidence/P5.md:312` | Goal-3 / Goal-5 placements use existing sprites as deliberate P6 placeholders | T6 |

---

## 0. Definition of Ready

Checked against the current tree, not inherited. **Rows 1 and 10 are red today.**

| # | Check | Current result |
|---|---|---|
| 1 | Prior phase evidence + `npm run verify` green | P5 evidence exists and its T14 gate was green. **Amber:** P5 is still uncommitted on `p4-queue-ui`; T0 records the exact start tree and reruns the gate before any P6 code. |
| 2 | Repository inspected | Done — the snapshot above is read from the live tree, file and line referenced. |
| 3 | Owned clauses mapped | §3 maps design.md §§2–13 and SPEC §§10, 11.1, 11.3, 11.5, 11.6, 13, 14, 18 to tasks and automated checks. **One clause had no owner at all** — §11.1's world bubbles; Q5 assigns them to P6 and T0 records the assignment in the master plan, the same way §11.4's sleep-skip was assigned to P4. |
| 4 | Dependency assumptions verified | `expo-audio` and `expo-font` are SDK 57 packages named in SPEC §3; neither is installed. Current `expo-audio` API confirmed 2026-07-30 against Expo SDK 56/57 docs: `createAudioPlayer(source, options)`, `useAudioPlayer`, `preload()`, `setAudioModeAsync()`, and mutable `player.volume` / `player.loop` / `player.play()` / `player.pause()`. **T8 step 1 re-confirms against the exact installed version before wiring.** |
| 5 | Determinism / `ENGINE_VERSION` effect | **P6 must not change `ENGINE_VERSION`.** Pose is a *derived* render concern (`render-view.ts` is derived-never-stored by design), audio and motion are presentation, and the atlas is a build artifact. `content/activities.json` gains a `pose` field and `content/home-map.json` gains `materials` — both are read by presentation only and are asserted not to enter `SimState`. T13 re-runs both goldens and requires byte-identical digests. If any task believes it needs an engine bump, it stops and escalates. |
| 6 | Cut-line effect | The §17 cut line lists audio as cuttable. Cutting audio would leave P5's shipped sliders and `M` binding controlling nothing, which SPEC §11.7 and §18 both forbid — so the honest cut is **audio scope**, not audio. §7 records the exact reduced set and its owner. Art and the legibility gate are not cuttable: SPEC §18 requires "no placeholders". |
| 7 | Writing gate | P6 authors almost no new prose. Any new string (T8's audio labels, T13's credits) goes through Humanizer 2.2.0 + the `writing.md` checklist and joins `content/strings/review-manifest.json` like every other batch. |
| 8 | Plan audit | **Pending.** Master §3.7 requires it before phase code starts. |
| 9 | Implementation-start check | T0 reruns `npm run verify` on the exact start tree and records it. |
| 10 | P4.5 gate | **Waived as an entry gate by Joe's ruling of 2026-07-31** — P4.5 moves to after P6 and runs on the final-art build. It becomes an **exit** gate instead (§8 item 2), which is stricter than master §5's "re-run playtest criteria pass", because there is no earlier pass for it to re-run. |

---

## 1. Required execution gates

P6 is one master phase with four internal milestones and two hard gates.

1. **Milestone A — legibility** (T0 → T7). Everything needed for a stranger to identify
   what they are looking at: object silhouettes, day/evening rooms, a pose per activity,
   real appearance presets, distinct decorations, the pixel font, icons and UI chrome.
2. **Gate A — legible build.** Full `npm run verify`, the bill-of-materials gate, and an
   exported-browser pass at both desktop viewports. **This is where the comprehension
   question gets answered** — Joe reads the room himself and either can or cannot name
   every object. Under Q1's ruling this is the last checkpoint before audio and juice are
   spent, so it is a genuine stop, not a formality. No build is frozen here; the single
   P4.5 freeze happens once, at T13.
3. **Milestone B — audio** (T8 → T10).
4. **Milestone C — juice and performance** (T11 → T12).
5. **Gate B — ship pass** (T13). No placeholders, v1 DoD, evidence, P4.5 criteria re-run.

Milestone A is deliberately first and deliberately self-contained. It is the milestone
that answers Joe's report, and it is the only one that changes what a playtester can
comprehend. Audio, juice, and performance improve a build that is already legible.

---

## 2. Decisions for Joe

### Q1 — Where P4.5 sits — **RULED 2026-07-31: P6 first, P4.5 after**

**Joe's ruling.** P4.5 has not run and will not run until P6 ships. His reason: the frozen
build cannot be playtested usefully when he himself cannot identify the objects in it, so
a session run now would measure the placeholders, not the design.

**Why that reason holds up, not just as preference.** Master §6's failure loop responds to
a failure by changing "the smallest implicated **P2–P4** behaviour", freezing a new build,
and re-running with fresh testers. Art is P6's, so a comprehension failure caused by flat
rectangles has *no legal remedy inside the loop*. The protocol would record a failure it
is structurally unable to act on, and burn three fresh testers doing it — testers are the
scarcest resource in this whole plan, since master §6 requires people who have never seen
the game.

**What it costs.** C12's stated purpose was to catch a design failure *before* the
expensive polish phase. Reversing that means a P4.5 failure now lands on a finished P6:
retuned mechanics may invalidate authored art, audio cues, and juice timings. That is the
trade, it is accepted deliberately, and the two mitigations are already structural:

1. **Milestone A ships legibility first and is independently observable at Gate A.** The
   comprehension question is answerable there — before audio, juice, and performance are
   spent — and Gate A stays a real stopping point rather than a formality.
2. **Nothing in P6 changes a game rule.** DoR row 5 holds `ENGINE_VERSION` at 8 and T13
   requires both goldens byte-identical. So a P4.5 failure that implicates *mechanics*
   lands on a domain P6 never touched — the retune happens in `sim/`, `game/`, and
   `content/`, and the art survives it. Only a failure implicating *presentation* would
   cost re-authoring, and that is the class P6 is specifically trying to eliminate.

**Consequences recorded elsewhere in this plan:** DoR row 10 (entry gate waived), §1
(Gate A is no longer a re-freeze point; the P4.5 freeze happens once, at T13), T0 step 5
(the master-plan order edit), T13 (P4.5 becomes a full first run, not a re-run), and §8
item 2 (exit condition).

### Q2 — Appearance presets: bake four, or tint at draw time?

design.md §6 requires "skin/hair recolors are palette-index swaps — zero redrawn frames."
Skia's `<Atlas>` can apply a per-quad colour, but that is a *tint*, not an index swap: it
would drag hair, skin, and outfit through one multiply and break the per-shape ramp rule.

**Ruling: bake all four at build time.** The same authored shapes are rasterized four
times through four palette maps. Zero frames are redrawn (the design rule is honoured
literally), the atlas stays one deterministic committed texture, and the renderer picks a
row by `paletteId`. Cost is atlas size: 48 frames × 4 presets = 192 character sprites.
At the current 512 px pack width that is ~640 rows of character alone, so T1 widens the
pack to **1024 px**, which keeps the whole atlas comfortably inside any desktop GPU limit
and preserves the single-texture Atlas promise.

### Q3 — AI-generated art?

`evidence/A0.md` handed forward: design.md §6's secondary AI route was never exercised,
and if used it must pass `validate-palette` unchanged.

**Ruling: do not use it in P6.** Every asset in this plan is authored as palette shapes
in TypeScript — the primary route, already proven through A0, P3, and P5, and the only
one that is deterministic, diffable, and byte-reproducible in CI. An AI-generated sprite
would have to be quantized, hand-cleaned, and committed as opaque binary that no test can
regenerate. The route stays documented and unused. Recorded as a deliberate non-use, not
a deferral.

### Q4 — Audio asset sourcing

SPEC §14 needs one music loop with two variants, room tone, a rain variant, footsteps for
two floor materials, ~8 activity loops, and 6 UI cues. This plan **does not generate audio
files**; it builds the bus, the routing, the content schema, and the gates, and takes the
files as an input. Joe supplies them (licensed pack or commissioned), converted with the
existing `convert_music` skill to the app-optimised M4A profile. T8 ships a validated,
fully-wired bus that reports every missing asset by name, so the wiring can be proven
green before a single final file exists and each file drops in without a code change.

### Q5 — SPEC §11.1's world bubbles have no owner. Assign them to P6.

**The gap.** §11.1's last line reads: *"**World:** thought bubbles (need <40, preferences,
hints), progress ring over the sim, ⚠ forecast pulses."* Checking each against the tree:

| §11.1 world element | State | Owner |
|---|---|---|
| Progress ring over the sim | Built (P3, `WorldScene.tsx:236`) | P3 ✓ |
| ⚠ forecast pulses | Cap-waste and conflicts are surfaced, but **on queue cards**, not over the world (P4, `queue-copy.ts:132`) | P4, partially |
| Preference bubbles | Built, but as an RN panel element in `GameScreen.tsx:373` — **not anchored over the sim** | P5, partially |
| Need <40 bubbles | **Absent** | **nobody** |
| Hint bubbles | **Absent** | **nobody** |

Master §3 is explicit that *"a phase may not close with an owned SPEC clause silently
deferred"* and that a deferral must name a new owner. This is the same shape of hole as
§11.4's sleep-skip, which master §5 caught and assigned to P4 on 2026-07-30 — it sat in no
phase's owned list because each plan assumed a neighbour had it.

**Ruling: P6 owns the world bubble layer**, and this plan records it the way master §5
recorded the sleep-skip assignment.

**Why P6 and not "later":** there is no later — P6 is the last v1 phase, so an unowned v1
clause either lands here or silently becomes a cut nobody decided. It is also the right
phase on the merits: design.md §8 already specifies the recipe (cream rounds, 12 px icons,
Ink tail, plum tint for grumpy, leaf tint for happy, never red), §9 specifies the icons,
and P6 is the phase that draws both. And it directly serves the same problem Q1 is about —
a bubble over the sim's head is how a player learns *why* she just walked to the shower
without opening a panel.

**Scope, bounded deliberately:** one bubble at a time, anchored to the character's head
anchor, driven by existing state only — the energy/nutrition/movement/hygiene band already
computed by `bandFor()`, the preference reaction P5 already derives, and the forecast
warnings P4 already computes. **No new domain state, no new content, no new event.** If a
bubble would need something the engine does not already publish, it is out of scope and
gets recorded as such rather than built.

---

## 3. Owned clauses → task → automated check

| Clause | Requirement | Task | Check |
|---|---|---|---|
| design.md §2 | Every pixel from the 57-colour palette; indexed PNG | T1 | `validate-palette` (exists) + `encodeIndexedPng` round-trip test |
| design.md §3 | Track B world outlines = fill ramp's shadow, never Ink | T1 | new `findOutlineRoleViolations` — today this is enforced only by a code comment |
| design.md §3 | Track A UI = Ink outline, chunky two-tone face | T7 | `theme.test.ts` asserts every chrome recipe |
| design.md §4 | Silkscreen Bold, tabular nums, integer sizes, no AA at 1× | T7 | type-scale test pins sizes to Silkscreen's crisp multiples; HUD height re-measured |
| design.md §6 | ~48-frame character bill; layers; anchors; index swaps | T4, T5 | `character-bill.test.ts` enumerates the bill against the atlas index |
| design.md §6 | Silhouette reads in flat Ink | T2, T4 | `silhouetteSignature` distinctness + `boxiness` ceiling |
| design.md §7 | Day/evening tile sets; 19:00 crossfade; gold pools | T3, T11 | `lighting.test.ts` |
| design.md §8 | Component recipes (bars, cards, chips, buttons, panels, bubbles) | T7 | `theme.test.ts` |
| design.md §9 | 12 px per-bar icons with distinct alert shapes | T7 | icon bill test; alert glyph differs by silhouette, not colour |
| design.md §10 | Slide+squash 90 ms, poof 4 f, gold sparkle for rewards only, no shake | T11 | `motion.test.ts`; reduced-motion path asserted |
| design.md §11 | v1 bill of materials complete | T13 | bill gate |
| design.md §12 | Every asset passes the checklist | T1, T13 | validator is steps 4–5 of the checklist, in CI |
| design.md §13 | Anti-patterns rejected | T1 | pure black/white already rejected; gold/red role check added |
| SPEC §10 | Objects declare footprint + interact point + facing; active states 1–2 frames | T2 | object bill test incl. active-state frames |
| SPEC §11.1 | **World bubbles** — need <40, preferences, hints (Q5: unowned until now) | T11 | `bubbles.test.ts`: one at a time, head-anchored, priority order, no new domain state |
| SPEC §11.3 | Walk/act tempo tracks `m_speed`; day/night light; lamp glow after 19:00; sim glances at the queue | T3, T4, T11 | pose/tempo tests; `lighting.test.ts`; glance test |
| SPEC §11.5 | Reserve UI first — **148 px HUD** | T7 | HUD height re-measured after the font change; `scale.ts` and SPEC §11.5 updated together or neither |
| SPEC §11.6 | Reduced motion kills pulses, keeps state changes; non-colour urgency | T7, T11 | motion + icon tests |
| SPEC §14 | Music day/evening + crossfade; Practice riff by level; ambience; SFX; sliders; persisted mute; dev auto-mute; no orphaned audio | T8–T10 | `audio-bus-expo.test.ts`, `cue-router.test.ts`, browser smoke |
| SPEC §18 | 60 fps desktop web; audio mixes; no placeholders; P4.5 criteria re-checked | T12, T13 | frame probe; bill gate; protocol re-run |

---

## 4. File structure

Created:

```text
src/render/sprites/parts.ts          shared shape primitives, extracted from a0.ts
src/render/sprites/objects.ts        15 object sprites + active states
src/render/sprites/tiles.ts          day + evening tile sets, per room, per material
src/render/sprites/character.ts      the ~48-frame v1 bill
src/render/sprites/decorations.ts    6 grantable decorations, each distinct
src/render/sprites/icons.ts          12 px icon set (bars, practice, warnings, chips)
src/render/appearance.ts             paletteId -> palette map, for the 4 presets
src/render/lighting.ts               clock minute -> lighting state; lamp pools
src/render/motion.ts                 juice timings + the reduced-motion switch
src/ui/theme.ts                      Track-A recipes, type scale, palette re-export
src/ui/Icon.tsx                      atlas-backed icon component
src/application/audio/expo-audio-bus.ts   the real AudioBus implementation
src/application/audio/cue-router.ts       domain events + snapshot -> audio cues
content/audio.json                   asset ids, gains, loops, crossfade minute
assets/fonts/Silkscreen-Regular.ttf  vendored OFL font
assets/fonts/Silkscreen-Bold.ttf
assets/audio/*.m4a                   supplied by Joe (Q4)
```

Modified:

```text
scripts/art/png.ts                   + encodeIndexedPng
scripts/art/validate-palette.ts      + outline roles, boxiness, silhouette signature
scripts/art/build-atlas.ts           real sprites; 1024 pack width; pose/appearance index
src/render/scene-layout.ts           pose frames from the index; lighting; decorations
src/render/WorldScene.tsx            lighting group; frame worklet; bubbles
src/sim/render-view.ts               Pose union per activity; droop flag
src/sim/content-schemas.ts           activity `pose`; home-map `materials`; audio schema
src/sim/content.ts                   register content/audio.json
scripts/validate-content.ts          cross-validate poses/materials/audio against the atlas
content/activities.json              + pose per activity
content/home-map.json                + materials per room
src/ui/*.tsx                         hex literals -> theme tokens
src/application/boot.ts              construct ExpoAudioBus instead of SilentAudioBus
package.json                         + expo-font, expo-audio; + art:bill, perf scripts
```

Each sprite module owns one asset class and stays under ~300 lines, matching how
`a0.ts` is already scoped. `parts.ts` exists so `a0.ts` (which the A0 evidence sheet
still regenerates) and `character.ts` share primitives instead of duplicating them.

---

## 5. Tasks

### Task 0: Implementation-start baseline

**Files:**
- Create: `docs/superpowers/evidence/P6.md`
- Modify: `docs/superpowers/plans/2026-07-29-auto-life-v1-master.md` (§2 rows, §5 rows, §11's C12 order, and the new §11.1 bubble-owner subsection)
- Modify: `docs/superpowers/plans/2026-07-30-p4.5-external-playtest-protocol.md` §8 (supersede the P5 freeze record; re-open the fields for T13)

- [ ] **Step 1: Record the exact start tree**

Run and capture verbatim:

```bash
git -C "$REPO" rev-parse HEAD && git -C "$REPO" status --short | wc -l && node -v && npm -v
```

- [ ] **Step 2: Run the full gate on the start tree**

Run: `npm run verify`
Expected: content/writing gate green, atlas byte-clean, strict TS, **83 suites / 572
tests / 2 snapshots**, web export succeeds. Any deviation from the P5 T14 numbers stops
the phase and is investigated before code.

- [ ] **Step 3: Record the pre-P6 atlas census**

Run: `npm run art:atlas`
Expected: `atlas 512×162, 33 sprites, 29 colours — validator green`. Write those numbers
into `evidence/P6.md` as the "before" row; T13 diffs the final census against it.

- [ ] **Step 4: Write the T0 section of the evidence file**

Create `docs/superpowers/evidence/P6.md` with the start commit, dirty-file count, tool
versions, the verify result, the atlas census, and Q1's order ruling with its date, reason,
and accepted exposure — in the same shape as `evidence/P5.md` T0.

- [ ] **Step 5: Write Q1's order ruling into the master plan**

Master §11 (C12) states the build order as "P0 → P1 → P2 → P3 → P4 → **P4.5 external
playtest, the sole fun gate** → P5 → P6", and master §6 says the criteria and their
placement "cannot be weakened, waived, or moved without Joe's explicit decision". Moving
P4.5 after P6 is exactly such a move, so it is recorded where the order is locked — not
only in this phase plan:

- master §11 (C12): note the 2026-07-31 amendment and its reason;
- master §2's plan-index rows for P4.5 and P6: swap their status text;
- master §5's P4.5 and P6 rows: P4.5 runs on the post-P6 final-art build; P6's exit gains
  "P4.5 passes on this build" as a hard condition;
- P4.5 protocol §8: the frozen `0d05de24…` P5 build record is superseded, and the freeze
  fields are re-opened for T13 to fill.

**Copy no pass condition into any of these edits.** The six conditions live in master §6
and are unchanged; every other document points at them. That is what stopped them drifting
through four phases and it does not stop now.

Record in `evidence/P6.md`: the ruling, its date, Joe's stated reason, and the accepted
exposure from §2 Q1.

- [ ] **Step 6: Record the Q5 ownership assignment in the master plan**

Master §3 requires a deferral to name its new owner *in the master plan*, not only in a
phase plan. Add a short subsection to master §5 in the same shape as its existing
"§11.4 sleep-skip — owner assigned to P4 (2026-07-30)" entry:

> **§11.1 world bubbles — owner assigned to P6 (2026-07-30).** The progress ring shipped
> in P3 and forecast warnings shipped on P4's queue cards, but §11.1's need-, preference-,
> and hint bubbles over the world were in no phase's owned list. P5's preference bubble is
> a panel element, not a world bubble, and the need and hint bubbles do not exist. P6 is
> the last v1 phase and the one that draws the world, so it owns them. Scope is bounded to
> presentation over state the engine already publishes.

This step runs regardless of the Q1 ruling.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/evidence/P6.md docs/superpowers/plans/
git commit -m "docs(P6): baseline, and give SPEC 11.1's world bubbles an owner"
```

---

### Task 1: Art pipeline gates — outline roles, legibility, indexed PNG

The gate work comes first because every later asset task depends on it. Today
`validate-palette.ts` checks *colour membership only*; `build-atlas.ts:44` records that
pass 4 caught wall/tv/bench using Ink outlines while the validator still reported green.
That hole is closed here, mechanically.

**Files:**
- Modify: `scripts/art/validate-palette.ts`
- Modify: `scripts/art/png.ts`
- Modify: `scripts/art/build-atlas.ts` (pack width 1024)
- Test: `scripts/__tests__/validate-palette.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `scripts/__tests__/validate-palette.test.ts`:

```ts
import { createBitmap, decodePng, encodeIndexedPng, type Bitmap } from '../art/png';
import {
  boxiness,
  findOutlineRoleViolations,
  silhouetteSignature,
} from '../art/validate-palette';
import { hexToRgb, INK, WOOD } from '../../src/render/palette';

function fill(bmp: Bitmap, x: number, y: number, w: number, h: number, hex: string): void {
  const { r, g, b } = hexToRgb(hex);
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const i = (py * bmp.width + px) * 4;
      bmp.data[i] = r;
      bmp.data[i + 1] = g;
      bmp.data[i + 2] = b;
      bmp.data[i + 3] = 255;
    }
  }
}

/** A world sprite outlined in Ink — legal by colour, illegal by design.md §3 Track B. */
function inkOutlinedBox(): Bitmap {
  const bmp = createBitmap(8, 8);
  fill(bmp, 0, 0, 8, 8, INK);
  fill(bmp, 1, 1, 6, 6, WOOD.base);
  return bmp;
}

function rampOutlinedBox(): Bitmap {
  const bmp = createBitmap(8, 8);
  fill(bmp, 0, 0, 8, 8, WOOD.shadow);
  fill(bmp, 1, 1, 6, 6, WOOD.base);
  return bmp;
}

describe('design.md §3 Track B outline roles', () => {
  it('rejects a world sprite whose outline is Ink', () => {
    const violations = findOutlineRoleViolations(inkOutlinedBox());
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.hex).toBe(INK);
  });

  it('accepts a world sprite outlined in its own ramp shadow', () => {
    expect(findOutlineRoleViolations(rampOutlinedBox())).toEqual([]);
  });
});

describe('legibility gates', () => {
  it('scores a plain filled rectangle at boxiness 1', () => {
    expect(boxiness(rampOutlinedBox())).toBeCloseTo(1, 5);
  });

  it('scores a shape with a notch below 1', () => {
    const bmp = rampOutlinedBox();
    for (let py = 0; py < 3; py++) {
      for (let px = 5; px < 8; px++) bmp.data[(py * 8 + px) * 4 + 3] = 0;
    }
    expect(boxiness(bmp)).toBeLessThan(0.92);
  });

  it('gives two differently-shaped sprites different signatures', () => {
    const a = rampOutlinedBox();
    const b = rampOutlinedBox();
    b.data[3] = 0;
    expect(silhouetteSignature(a)).not.toBe(silhouetteSignature(b));
  });

  it('ignores colour when computing a signature', () => {
    const a = rampOutlinedBox();
    const b = inkOutlinedBox();
    expect(silhouetteSignature(a)).toBe(silhouetteSignature(b));
  });
});

describe('indexed PNG', () => {
  it('round-trips every pixel through colour-type 3', () => {
    const src = rampOutlinedBox();
    const decoded = decodePng(encodeIndexedPng(src));
    expect(decoded.width).toBe(src.width);
    expect(decoded.height).toBe(src.height);
    expect(Array.from(decoded.data)).toEqual(Array.from(src.data));
  });

  it('refuses a bitmap with more than 256 distinct colours', () => {
    const bmp = createBitmap(32, 32);
    for (let i = 0; i < 32 * 32; i++) {
      bmp.data[i * 4] = i & 0xff;
      bmp.data[i * 4 + 1] = (i >> 3) & 0xff;
      bmp.data[i * 4 + 2] = (i >> 6) & 0xff;
      bmp.data[i * 4 + 3] = 255;
    }
    expect(() => encodeIndexedPng(bmp)).toThrow(/256/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest scripts/__tests__/validate-palette.test.ts`
Expected: FAIL — `findOutlineRoleViolations`, `boxiness`, `silhouetteSignature`,
`encodeIndexedPng`, and `decodePng` are not exported.

- [ ] **Step 3: Implement the legibility and role gates**

Append to `scripts/art/validate-palette.ts`. Its existing import line becomes
`import { ..., hexToRgb, INK, ... } from '../../src/render/palette'` — `hexToRgb` is not
imported there today.

```ts
/**
 * Every legal outline colour for a **world** sprite: each §2 world/meaning ramp's shadow.
 *
 * Enumerated from the ramp constants, NOT derived by index arithmetic over `PALETTE_57`.
 * That array is not a clean run of triples — `HAIR_BLACK` contributes only two entries
 * because its shadow *is* Ink and is already listed as a neutral — so any "every third
 * element" trick misaligns from that point on and starts admitting base colours as
 * outlines. Enumerate; do not count.
 */
const OUTLINE_RAMPS = [
  WOOD, GREY, DUSK_PLUM, LEAF_GREEN, WATER_BLUE, TERRACOTTA,
  LANTERN_GOLD, IZAKAYA_RED, ROSE,
] as const;

const RAMP_SHADOWS: ReadonlySet<number> = new Set(
  OUTLINE_RAMPS.map((ramp) => {
    const { r, g, b } = hexToRgb(ramp.shadow);
    return (r << 16) | (g << 8) | b;
  }),
);

const INK_KEY = (() => {
  const { r, g, b } = hexToRgb(INK);
  return (r << 16) | (g << 8) | b;
})();

function keyAt(bmp: Bitmap, x: number, y: number): number | null {
  const i = (y * bmp.width + x) * 4;
  if (bmp.data[i + 3] === 0) return null;
  return (bmp.data[i]! << 16) | (bmp.data[i + 1]! << 8) | bmp.data[i + 2]!;
}

/**
 * design.md §3, as code: a **world** sprite's outline is its fill ramp's shadow, never Ink.
 *
 * An outline pixel is an opaque pixel with at least one transparent or out-of-bounds
 * 4-neighbour, OR any opaque pixel on the bitmap border. `build-atlas.ts` already carries
 * a comment saying an adversarial pass caught Ink outlines while the colour validator
 * reported green — this is that comment turned into a check.
 *
 * Two exemptions, both from design.md rather than convenience:
 *
 *  - Ink is legal *inside* a world sprite (A0's eyes are Ink). Only the outline is ruled.
 *  - **Character sprites are exempt from this check entirely.** §2 defines
 *    `HAIR_BLACK`'s shadow as Ink, so a black-haired sim is *correctly* outlined in Ink
 *    and a pixel-level rule cannot tell that layer from a chair leg. Characters are
 *    covered instead by the palette audit plus the silhouette and layer tests in T4.
 *    `auditBitmap` therefore takes a `track: 'world' | 'character'` and runs this check
 *    only for `'world'`; `build-atlas.ts` passes the track it already knows per entry.
 */
export function findOutlineRoleViolations(bmp: Bitmap): PaletteViolation[] {
  const byHex = new Map<string, PaletteViolation>();
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      const key = keyAt(bmp, x, y);
      if (key === null) continue;
      const onBorder = x === 0 || y === 0 || x === bmp.width - 1 || y === bmp.height - 1;
      const exposed =
        onBorder ||
        keyAt(bmp, x - 1, y) === null ||
        keyAt(bmp, x + 1, y) === null ||
        keyAt(bmp, x, y - 1) === null ||
        keyAt(bmp, x, y + 1) === null;
      if (!exposed) continue;
      if (key !== INK_KEY && RAMP_SHADOWS.has(key)) continue;
      if (key !== INK_KEY) continue; // a non-shadow, non-Ink outline is a §2 problem, not a §3 one
      const hex = rgbToHex({ r: (key >> 16) & 0xff, g: (key >> 8) & 0xff, b: key & 0xff });
      const seen = byHex.get(hex);
      if (seen) seen.count += 1;
      else byHex.set(hex, { x, y, hex, count: 1 });
    }
  }
  return [...byHex.values()];
}

/**
 * Fraction of the sprite's bounding box that is opaque.
 *
 * A plain filled rectangle scores exactly 1.0. This is the mechanical form of Joe's
 * report — "I just see a square and I don't know what that object is" — and of
 * design.md §6's silhouette-first rule. Objects must carry shape, not just colour.
 */
export function boxiness(bmp: Bitmap): number {
  let minX = bmp.width;
  let minY = bmp.height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.data[(y * bmp.width + x) * 4 + 3] === 0) continue;
      opaque++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return 0;
  return opaque / ((maxX - minX + 1) * (maxY - minY + 1));
}

/**
 * A colour-independent silhouette fingerprint: per row, the opaque run boundaries.
 *
 * Two sprites with the same signature are the same shape in flat Ink, which design.md §6
 * says must never happen between distinct things. Colour is deliberately ignored — that
 * is the whole point of the silhouette test.
 */
export function silhouetteSignature(bmp: Bitmap): string {
  const rows: string[] = [];
  for (let y = 0; y < bmp.height; y++) {
    const runs: number[] = [];
    let run = 0;
    let opaque = false;
    for (let x = 0; x < bmp.width; x++) {
      const here = bmp.data[(y * bmp.width + x) * 4 + 3] !== 0;
      if (here === opaque) run++;
      else {
        runs.push(run);
        opaque = here;
        run = 1;
      }
    }
    runs.push(run);
    rows.push(runs.join('.'));
  }
  return rows.join('|');
}
```

Extend `AssetReport` with `outlineRoleViolations: PaletteViolation[]`, change
`auditBitmap(name, bmp)` to `auditBitmap(name, bmp, track: 'world' | 'character' = 'world')`
so the default is the strict path, populate the new field only for `'world'`, include it
in `reportIsClean`, and print it in `formatReport`.

- [ ] **Step 4: Implement indexed PNG**

Append to `scripts/art/png.ts`:

```ts
/**
 * design.md §2: "Author all art as indexed PNG against this palette."
 *
 * P3 shipped RGBA (colour-type 6) and recorded the gap as P6's (evidence/P3.md). This
 * writes colour-type 3 with a PLTE + tRNS chunk. Palette order is the first-seen order
 * over a row-major scan, so the output stays byte-reproducible and `art:check`'s
 * `git diff --exit-code` remains meaningful.
 *
 * Fully transparent pixels all collapse onto one palette entry; design.md §13 forbids
 * anti-aliasing, so partial alpha cannot occur (and the validator rejects it if it does).
 */
export function encodeIndexedPng(bmp: Bitmap): Uint8Array {
  const order: number[] = [];
  const indexOf = new Map<number, number>();
  const pixels = new Uint8Array(bmp.width * bmp.height);
  for (let i = 0; i < bmp.width * bmp.height; i++) {
    const a = bmp.data[i * 4 + 3]!;
    const key =
      a === 0
        ? -1
        : (bmp.data[i * 4]! << 16) | (bmp.data[i * 4 + 1]! << 8) | bmp.data[i * 4 + 2]!;
    let idx = indexOf.get(key);
    if (idx === undefined) {
      idx = order.length;
      if (idx > 255) throw new Error(`indexed PNG needs <= 256 colours, found more`);
      indexOf.set(key, idx);
      order.push(key);
    }
    pixels[i] = idx;
  }

  const plte = new Uint8Array(order.length * 3);
  const trns = new Uint8Array(order.length);
  order.forEach((key, i) => {
    if (key === -1) {
      trns[i] = 0;
      return;
    }
    plte[i * 3] = (key >> 16) & 0xff;
    plte[i * 3 + 1] = (key >> 8) & 0xff;
    plte[i * 3 + 2] = key & 0xff;
    trns[i] = 255;
  });

  const raw = new Uint8Array((bmp.width + 1) * bmp.height);
  for (let y = 0; y < bmp.height; y++) {
    raw[y * (bmp.width + 1)] = 0; // filter type 0
    raw.set(pixels.subarray(y * bmp.width, (y + 1) * bmp.width), y * (bmp.width + 1) + 1);
  }

  const ihdr = new Uint8Array(13);
  ihdr.set(u32(bmp.width), 0);
  ihdr.set(u32(bmp.height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // colour type: indexed
  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('tRNS', trns),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * Reads back colour-type 3 and colour-type 6 so tests can prove a round-trip.
 *
 * Deliberately narrow: filter type 0, no interlace, 8-bit depth — exactly what
 * `encodePng` and `encodeIndexedPng` write. A decoder that silently accepts more than it
 * can prove is worse than one that throws, so anything else is an error.
 */
export function decodePng(bytes: Uint8Array): Bitmap {
  let pos = 8; // skip signature
  let width = 0;
  let height = 0;
  let colourType = 0;
  let palette: Uint8Array | null = null;
  let alpha: Uint8Array | null = null;
  const idat: Uint8Array[] = [];

  while (pos < bytes.length) {
    const len =
      (bytes[pos]! << 24) | (bytes[pos + 1]! << 16) | (bytes[pos + 2]! << 8) | bytes[pos + 3]!;
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = (body[0]! << 24) | (body[1]! << 16) | (body[2]! << 8) | body[3]!;
      height = (body[4]! << 24) | (body[5]! << 16) | (body[6]! << 8) | body[7]!;
      if (body[8] !== 8) throw new Error(`decodePng supports bit depth 8, got ${body[8]}`);
      if (body[12] !== 0) throw new Error('decodePng does not support interlacing');
      colourType = body[9]!;
      if (colourType !== 3 && colourType !== 6) {
        throw new Error(`decodePng supports colour types 3 and 6, got ${colourType}`);
      }
    } else if (type === 'PLTE') palette = body.slice();
    else if (type === 'tRNS') alpha = body.slice();
    else if (type === 'IDAT') idat.push(body.slice());
    else if (type === 'IEND') break;
    pos += 12 + len; // length + type + body + crc
  }

  const raw = new Uint8Array(inflateSync(concat(idat)));
  const bpp = colourType === 3 ? 1 : 4;
  const stride = width * bpp;
  const out = createBitmap(width, height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    if (filter !== 0) throw new Error(`decodePng supports filter 0, got ${filter} on row ${y}`);
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colourType === 3) {
        const i = row[x]!;
        out.data[o] = palette![i * 3]!;
        out.data[o + 1] = palette![i * 3 + 1]!;
        out.data[o + 2] = palette![i * 3 + 2]!;
        out.data[o + 3] = alpha === null ? 255 : (alpha[i] ?? 255);
        // A fully transparent index carries no meaningful colour; normalise to 0,0,0,0
        // so a round-trip against a bitmap built by `createBitmap` compares equal.
        if (out.data[o + 3] === 0) {
          out.data[o] = 0;
          out.data[o + 1] = 0;
          out.data[o + 2] = 0;
        }
      } else {
        out.data[o] = row[x * 4]!;
        out.data[o + 1] = row[x * 4 + 1]!;
        out.data[o + 2] = row[x * 4 + 2]!;
        out.data[o + 3] = row[x * 4 + 3]!;
      }
    }
  }
  return out;
}
```

`PNG_SIGNATURE`, `chunk`, `concat`, and `u32` already exist as private helpers in
`png.ts`; hoist them into module scope so both encoders and the decoder share them. Add
`inflateSync` to the existing `node:zlib` import.

Note the transparent-pixel normalisation in the indexed branch: `encodeIndexedPng`
collapses every alpha-0 pixel onto one palette entry whose RGB is arbitrary, so without
this the round-trip test would compare `0,0,0,0` against that entry's stored colour and
fail for a reason that has nothing to do with correctness.

- [ ] **Step 5: Switch the atlas writer and widen the pack**

In `scripts/art/build-atlas.ts`: change `pack(entries, maxWidth = 512)` to `1024`
(Q2's ruling), and change the write to `encodePng` → `encodeIndexedPng`. Add the outline
role report to the `main()` failure path.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest scripts/__tests__/validate-palette.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Regenerate the atlas and prove it still loads**

Run: `npm run art:atlas && npm test`
Expected: atlas rebuilds at the new width in indexed form, validator green, full suite
green (`scene-layout` and `scene-mount` read the index by name, so coordinates moving is
not a break).

Run: `npm run export:web && npm run serve:dist`, open `http://localhost:4173` in Chrome,
and confirm the room still draws. **An indexed PNG that CanvasKit will not decode is the
one real risk in this task; find that out here, not in T13.** If it fails, revert step 5's
encoder switch only, keep the round-trip test as documentation, and record the encoder as
a NOT DONE deferral with `v1.1` as owner.

- [ ] **Step 8: Commit**

```bash
git add scripts/art/ scripts/__tests__/validate-palette.test.ts assets/generated/
git commit -m "feat(P6): art gates — outline roles, legibility scoring, indexed PNG"
```

---

### Task 2: Object sprites — the fifteen squares become fifteen things

This is the task that answers Joe's report.

**Files:**
- Create: `src/render/sprites/parts.ts`
- Create: `src/render/sprites/objects.ts`
- Modify: `scripts/art/build-atlas.ts`
- Test: `src/render/__tests__/objects-legibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/render/__tests__/objects-legibility.test.ts`:

```ts
import { content } from '../../sim/content';
import { OBJECT_SPRITES, renderObject } from '../sprites/objects';
import {
  auditBitmap,
  boxiness,
  reportIsClean,
  silhouetteSignature,
} from '../../../scripts/art/validate-palette';

const TILE = 32;

describe('object sprites (design.md §6 silhouette-first, §12 checklist)', () => {
  it('authors a sprite for every object in content', () => {
    const authored = new Set(Object.keys(OBJECT_SPRITES));
    for (const o of content.objects.objects) expect(authored.has(o.id)).toBe(true);
    expect(authored.size).toBe(content.objects.objects.length);
  });

  it('sizes every sprite to its declared footprint', () => {
    for (const o of content.objects.objects) {
      const xs = o.footprint.map(([x]) => x);
      const ys = o.footprint.map(([, y]) => y);
      const bmp = renderObject(o.id);
      expect(bmp.width).toBe((Math.max(...xs) - Math.min(...xs) + 1) * TILE);
      expect(bmp.height).toBe((Math.max(...ys) - Math.min(...ys) + 1) * TILE);
    }
  });

  it('passes the full palette, extremes, and outline-role audit', () => {
    for (const o of content.objects.objects) {
      const report = auditBitmap(o.id, renderObject(o.id));
      if (!reportIsClean(report)) throw new Error(`${o.id}: ${JSON.stringify(report)}`);
    }
  });

  // The regression that matters: a flat rectangle scores 1.0.
  it('is never a plain filled rectangle', () => {
    for (const o of content.objects.objects) {
      expect({ id: o.id, boxiness: boxiness(renderObject(o.id)) }).toEqual({
        id: o.id,
        boxiness: expect.any(Number),
      });
      expect(boxiness(renderObject(o.id))).toBeLessThan(0.92);
    }
  });

  it('gives every object a silhouette no other object shares', () => {
    const seen = new Map<string, string>();
    for (const o of content.objects.objects) {
      const sig = silhouetteSignature(renderObject(o.id));
      const clash = seen.get(sig);
      expect(clash).toBeUndefined();
      seen.set(sig, o.id);
    }
  });

  it('authors an active-state frame for every object with an activity (SPEC §10)', () => {
    for (const o of content.objects.objects) {
      if (o.activities.length === 0) continue;
      expect(OBJECT_SPRITES[o.id]!.active).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/render/__tests__/objects-legibility.test.ts`
Expected: FAIL — `src/render/sprites/objects.ts` does not exist.

- [ ] **Step 3: Extract the shared shape primitives**

Create `src/render/sprites/parts.ts` by moving `rect`, `px`, and `outlined` verbatim out
of `a0.ts`, exporting them, and re-importing them in `a0.ts`. Add two helpers the object
set needs:

```ts
import type { Shape } from '../sprite-spec';

export const rect = (x: number, y: number, w: number, h: number, c: string): Shape =>
  ({ k: 'rect', x, y, w, h, c });

export const px = (x: number, y: number, c: string): Shape => ({ k: 'px', x, y, c });

/** design.md §3 Track B: a filled box wearing its own ramp's shadow as an outline. */
export function outlined(
  x: number, y: number, w: number, h: number, fill: string, shadow: string,
): Shape[] {
  return [rect(x, y, w, h, shadow), rect(x + 1, y + 1, w - 2, h - 2, fill)];
}

/** Knock a rectangular bite out of a silhouette. Transparent, so it changes the outline. */
export function notch(x: number, y: number, w: number, h: number): Shape {
  return { k: 'rect', x, y, w, h, c: TRANSPARENT };
}

/** A one-pixel highlight lip along a shape's top edge — design.md §3's two-tone face. */
export function lip(x: number, y: number, w: number, light: string): Shape {
  return rect(x, y, w, 1, light);
}
```

Two supporting changes in `sprite-spec.ts`:

1. Export its private `paint()` as `paintShapes(bmp, shapes, dx?, dy?)`. `rasterize()`
   keeps using it internally; the object, tile, decoration, and icon modules all need it
   and must not each grow a copy.
2. Add the `TRANSPARENT` sentinel (`export const TRANSPARENT = 'transparent'`) and handle
   it in `paintShapes` as an explicit alpha-0 write, so a notch *removes* coverage rather
   than painting a colour. `hexToRgb` throws on anything that is not `#rrggbb`, so the
   sentinel must be branched on before the colour lookup.

- [ ] **Step 4: Author the object set**

Create `src/render/sprites/objects.ts`. Three objects are written in full below — the
multi-tile case, the single-tile appliance case, and the non-blocking floor case. The
remaining twelve follow the same API and the spec table in step 5.

```ts
import { createBitmap, type Bitmap } from '../../../scripts/art/png';
import { paintShapes } from '../sprite-spec';
import { DUSK_PLUM, GREY, LANTERN_GOLD, TERRACOTTA, WATER_BLUE, WOOD } from '../palette';
import { lip, notch, outlined, rect } from './parts';
import type { Shape } from '../sprite-spec';

/**
 * The v1 object set (design.md §11).
 *
 * P3 drew every object as a flat `box()` — fifteen rectangles that differed only in ramp
 * colour, which is exactly why the placeholder scene was unreadable. Every sprite here
 * must clear three mechanical gates in `objects-legibility.test.ts`:
 *
 *   1. `boxiness < 0.92`  — it is not a rectangle;
 *   2. a silhouette no other object shares — you can tell it apart in flat Ink;
 *   3. the palette + outline-role audit — design.md §3 and §12.
 *
 * Shapes are authored in the footprint's own pixel space (top-left = 0,0), so an object
 * that moves in `home-map.json` needs no art change.
 */

export interface ObjectSprite {
  /** Resting state. */
  idle: Shape[];
  /** SPEC §10: "active states 1–2 frames". Present for every object with an activity. */
  active?: Shape[];
  width: number;
  height: number;
}

const TILE = 32;

/** Bed — 2×2 tiles (64×64). Pillow, duvet fold, and two visible legs break the box. */
const bed: ObjectSprite = {
  width: 2 * TILE,
  height: 2 * TILE,
  idle: [
    ...outlined(2, 6, 60, 52, DUSK_PLUM.base, DUSK_PLUM.shadow),
    // Headboard sits proud at the top; the notches beside it are what kill boxiness.
    ...outlined(6, 0, 52, 10, WOOD.base, WOOD.shadow),
    notch(0, 0, 6, 6),
    notch(58, 0, 6, 6),
    // Pillow.
    ...outlined(8, 10, 48, 14, DUSK_PLUM.light, DUSK_PLUM.shadow),
    // Duvet fold — one straight highlight, no gradient.
    lip(4, 32, 56, DUSK_PLUM.light),
    rect(4, 33, 56, 2, DUSK_PLUM.shadow),
    // Legs, with the floor showing between them.
    rect(4, 58, 6, 6, WOOD.shadow),
    rect(54, 58, 6, 6, WOOD.shadow),
    notch(10, 58, 44, 6),
  ],
  active: [
    // Occupied: the duvet humps and the pillow dents.
    ...outlined(2, 6, 60, 52, DUSK_PLUM.base, DUSK_PLUM.shadow),
    ...outlined(6, 0, 52, 10, WOOD.base, WOOD.shadow),
    notch(0, 0, 6, 6),
    notch(58, 0, 6, 6),
    ...outlined(8, 12, 48, 12, DUSK_PLUM.light, DUSK_PLUM.shadow),
    ...outlined(10, 28, 44, 16, DUSK_PLUM.light, DUSK_PLUM.shadow),
    rect(4, 58, 6, 6, WOOD.shadow),
    rect(54, 58, 6, 6, WOOD.shadow),
    notch(10, 58, 44, 6),
  ],
};

/** Fridge — 1×1 tile (32×32). Tall body, two doors, a handle, and a floor gap. */
const fridge: ObjectSprite = {
  width: TILE,
  height: TILE,
  idle: [
    ...outlined(4, 0, 24, 30, GREY.light, GREY.shadow),
    // Door split — the single line that says "fridge" and not "grey box".
    rect(4, 12, 24, 1, GREY.shadow),
    // Handles, on the same side of both doors.
    rect(23, 4, 2, 6, GREY.shadow),
    rect(23, 16, 2, 8, GREY.shadow),
    // Feet, so the silhouette is not flush to the floor.
    notch(4, 30, 4, 2),
    notch(24, 30, 4, 2),
    rect(8, 30, 16, 2, GREY.shadow),
  ],
  active: [
    // Open: the door swings left and warm light spills out (gold = light source, §2).
    ...outlined(12, 0, 16, 30, GREY.light, GREY.shadow),
    ...outlined(2, 2, 10, 26, LANTERN_GOLD.light, LANTERN_GOLD.shadow),
    rect(23, 4, 2, 6, GREY.shadow),
    notch(12, 30, 4, 2),
    notch(24, 30, 4, 2),
    rect(16, 30, 8, 2, GREY.shadow),
  ],
};

/** Rug — 1×1 tile, `blocksMovement: false`. Flat on the floor with a fringed edge. */
const rug: ObjectSprite = {
  width: TILE,
  height: TILE,
  idle: [
    ...outlined(1, 6, 30, 20, TERRACOTTA.base, TERRACOTTA.shadow),
    // Woven band, one shape, one ramp.
    rect(5, 12, 22, 8, TERRACOTTA.light),
    rect(9, 14, 14, 4, TERRACOTTA.shadow),
    // Fringe: alternating columns. This is the whole silhouette signature.
    ...[1, 5, 9, 13, 17, 21, 25, 29].flatMap((x) => [
      rect(x, 3, 2, 3, TERRACOTTA.shadow),
      rect(x, 26, 2, 3, TERRACOTTA.shadow),
    ]),
    notch(0, 0, 32, 3),
    notch(0, 29, 32, 3),
  ],
  active: [
    ...outlined(1, 6, 30, 20, TERRACOTTA.base, TERRACOTTA.shadow),
    rect(5, 12, 22, 8, TERRACOTTA.light),
    rect(9, 14, 14, 4, TERRACOTTA.base), // scuffed flat while stretching
    ...[1, 5, 9, 13, 17, 21, 25, 29].flatMap((x) => [
      rect(x, 3, 2, 3, TERRACOTTA.shadow),
      rect(x, 26, 2, 3, TERRACOTTA.shadow),
    ]),
    notch(0, 0, 32, 3),
    notch(0, 29, 32, 3),
  ],
};

export const OBJECT_SPRITES: Record<string, ObjectSprite> = {
  bed, fridge, rug,
  // The other twelve are authored in step 5 against the same API and this same file.
  // The legibility test enumerates `content.objects.objects`, so an id missing here is a
  // red suite, not a silent gap.
  toilet, sink, shower, microwave, counter, couch, tv, bench, treadmill, guitar,
  'front-door': frontDoor, wardrobe,
};

export function renderObject(id: string, state: 'idle' | 'active' = 'idle'): Bitmap {
  const spec = OBJECT_SPRITES[id];
  if (!spec) throw new Error(`no authored sprite for object "${id}" — see design.md §11`);
  const shapes = state === 'active' ? (spec.active ?? spec.idle) : spec.idle;
  const bmp = createBitmap(spec.width, spec.height);
  paintShapes(bmp, shapes);
  return bmp;
}
```

- [ ] **Step 5: Author the remaining twelve to this spec**

Each row is binding: the ramp comes from design.md §2's "owns" column, and the
silhouette cue is the specific feature that must survive flattening to Ink. Sizes come
from `content/objects.json` footprints, already verified.

| id | Size | Ramp | Silhouette cue (must read in flat Ink) | Active state |
|---|---|---|---|---|
| `toilet` | 32×32 | Water blue | Tank above a narrower bowl; a gap under the rim | lid up |
| `sink` | 32×32 | Water blue | Basin with a tap arm rising off-centre, pedestal narrower than the basin | tap arm + water column |
| `shower` | 64×32 | Water blue | Tray, a head on a riser at one end, a curtain rail overhanging both sides | steam overlay (T4 pairs it) |
| `microwave` | 32×32 | Grey | Wide door panel, a control column on the right, feet | door glow + open door |
| `counter` | 64×32 | Wood | Worktop overhanging the cabinet by 2 px each side, one drawer line, a toe-kick recess | — (no activities) |
| `couch` | 96×32 | Terracotta | Two arms taller than the back, three seat cushion divisions, legs | one cushion compressed |
| `tv` | 32×32 | Grey | Screen on a narrow neck and a wide foot — a clear T | screen lit (grey light, **not** gold; gold is reserved) |
| `bench` | 32×32 | Grey | Padded top on two angled legs, with a rack under one end | bar lifted off the rack |
| `treadmill` | 32×32 | Grey | Sloping deck with a console on an upright post | belt-tread lines shifted 2 px |
| `guitar` | 32×32 | Wood | Body with a waist, a neck, and a headstock — the most distinctive shape in the room | strings lit; body angled |
| `front-door` | 32×32 | Wood | Frame with an inset panel, a handle on the leading edge, and a threshold line | ajar |
| `wardrobe` | 32×32 | Wood | Two tall doors with a central split and two knobs, plinth at the base | one door open |

Two rules the table cannot restate often enough, both already burned in by earlier
passes: **no shape may be outlined in Ink** (`findOutlineRoleViolations` will fail it),
and **gold is only ever a light source or a reward** (design.md §2) — the fridge interior
qualifies, the TV screen does not.

- [ ] **Step 6: Wire the atlas to the authored set**

In `scripts/art/build-atlas.ts`, delete `OBJECT_FILL` and the `box()` call for objects,
and replace with:

```ts
for (const o of content.objects.objects) {
  entries.push({ name: `object.${o.id}`, bmp: renderObject(o.id) });
  if (o.activities.length > 0) {
    entries.push({ name: `object.${o.id}.active`, bmp: renderObject(o.id, 'active') });
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest src/render/__tests__/objects-legibility.test.ts`
Expected: PASS — 15 authored, all sized to footprint, all audit-clean, every
`boxiness < 0.92`, 15 distinct signatures, active states present for the 12 with activities.

- [ ] **Step 8: Look at it**

Run: `npm run art:atlas && npm run export:web && npm run serve:dist`

Open `http://localhost:4173` at 1366×768 and **read the room**. Name every object out
loud without consulting `objects.json`. Any object you cannot name goes back to step 5 —
the tests prove it is not a rectangle, only a person proves it is a fridge. Screenshot to
`docs/superpowers/evidence/p6-room-day-1366x768.png` and record its SHA-256.

- [ ] **Step 9: Commit**

```bash
git add src/render/sprites/ src/render/__tests__/objects-legibility.test.ts \
        scripts/art/build-atlas.ts assets/generated/ docs/superpowers/evidence/
git commit -m "feat(P6): fifteen readable objects replace fifteen coloured rectangles"
```

---

### Task 3: Day and evening tile sets

**Files:**
- Create: `src/render/sprites/tiles.ts`
- Create: `src/render/lighting.ts`
- Modify: `content/home-map.json`, `src/sim/content-schemas.ts`, `scripts/art/build-atlas.ts`, `src/render/scene-layout.ts`
- Test: `src/render/__tests__/lighting.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/render/__tests__/lighting.test.ts`:

```ts
import { content } from '../../sim/content';
import { lightingAt, LIGHTING_STATES, tileSpriteFor } from '../lighting';
import { renderTile, TILE_SPRITES } from '../sprites/tiles';
import { auditBitmap, reportIsClean, silhouetteSignature } from '../../../scripts/art/validate-palette';

describe('lighting (design.md §7, SPEC §11.3)', () => {
  it('is day before 19:00 and evening from 19:00', () => {
    expect(lightingAt(18 * 60 + 59)).toBe('day');
    expect(lightingAt(19 * 60)).toBe('evening');
    expect(lightingAt(23 * 60 + 59)).toBe('evening');
  });

  it('is evening through the small hours, before the morning boundary', () => {
    expect(lightingAt(0)).toBe('evening');
    expect(lightingAt(5 * 60 + 59)).toBe('evening');
    expect(lightingAt(6 * 60)).toBe('day');
  });

  it('authors both states for every room and the wall', () => {
    const rooms = [...Object.keys(content.homeMap.rooms), 'wall'];
    for (const room of rooms) {
      for (const state of LIGHTING_STATES) {
        expect(TILE_SPRITES[`${room}.${state}`]).toBeDefined();
      }
    }
  });

  it('makes evening visibly darker than day, not merely different', () => {
    for (const room of Object.keys(content.homeMap.rooms)) {
      expect(meanLuminance(renderTile(room, 'evening')))
        .toBeLessThan(meanLuminance(renderTile(room, 'day')) - 12);
    }
  });

  it('keeps every tile on-palette and outline-legal in both states', () => {
    for (const name of Object.keys(TILE_SPRITES)) {
      const [room, state] = name.split('.') as [string, 'day' | 'evening'];
      const report = auditBitmap(name, renderTile(room, state));
      if (!reportIsClean(report)) throw new Error(`${name}: ${JSON.stringify(report)}`);
    }
  });

  it('gives each floor material a distinct texture, not just a colour', () => {
    const wood = silhouetteSignature(renderTile('living', 'day'));
    const tile = silhouetteSignature(renderTile('bathroom', 'day'));
    expect(wood).not.toBe(tile);
  });

  it('names a material for every room, for T10 footsteps', () => {
    for (const room of Object.keys(content.homeMap.rooms)) {
      expect(content.homeMap.materials[room]).toMatch(/^(wood|tile|carpet)$/);
    }
  });

  it('routes the renderer to the right sprite name for a minute', () => {
    expect(tileSpriteFor('living', 12 * 60)).toBe('tile.living.day');
    expect(tileSpriteFor('living', 20 * 60)).toBe('tile.living.evening');
  });
});

function meanLuminance(bmp: { width: number; height: number; data: Uint8Array }): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < bmp.width * bmp.height; i++) {
    if (bmp.data[i * 4 + 3] === 0) continue;
    sum += 0.2126 * bmp.data[i * 4]! + 0.7152 * bmp.data[i * 4 + 1]! + 0.0722 * bmp.data[i * 4 + 2]!;
    n++;
  }
  return n === 0 ? 0 : sum / n;
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/render/__tests__/lighting.test.ts`
Expected: FAIL — `../lighting` and `../sprites/tiles` do not exist.

- [ ] **Step 3: Add materials to content**

In `content/home-map.json`, add alongside `rooms`:

```json
"materials": {
  "bedroom": "carpet",
  "bathroom": "tile",
  "living": "wood",
  "kitchen": "tile",
  "hall": "wood"
}
```

In `src/sim/content-schemas.ts`, extend `HomeMapSchema`:

```ts
materials: z.record(z.string(), z.enum(['wood', 'tile', 'carpet'])),
```

In `scripts/validate-content.ts`, add: every key in `rooms` has a `materials` entry and
vice versa. A room with no material is a silent-footstep bug in T10; catch it at the
content gate instead.

- [ ] **Step 4: Implement the tile set and lighting**

`src/render/sprites/tiles.ts` authors each room floor once as a *shape recipe* and
renders it through a lighting map:

```ts
/**
 * design.md §7: "Lighting is palette states, not shaders" — day tiles are cream-bright,
 * evening tiles are plum-dim with gold pools, authored as **swapped tile sets**. There is
 * no filter, no overlay alpha, and no shader anywhere in this file. The evening set is a
 * different set of palette indices for the same shapes.
 */
export const LIGHTING_STATES = ['day', 'evening'] as const;
export type Lighting = (typeof LIGHTING_STATES)[number];

/** Per material: base/edge/detail ramp steps for each state. All from design.md §2. */
const MATERIAL_RAMP: Record<string, Record<Lighting, { base: string; edge: string; detail: string }>> = {
  wood:   { day: { base: WOOD.light, edge: WOOD.base, detail: WOOD.base },
            evening: { base: WOOD.base, edge: WOOD.shadow, detail: WOOD.shadow } },
  tile:   { day: { base: GREY.light, edge: GREY.base, detail: GREY.base },
            evening: { base: GREY.base, edge: GREY.shadow, detail: GREY.shadow } },
  carpet: { day: { base: DUSK_PLUM.light, edge: DUSK_PLUM.base, detail: DUSK_PLUM.base },
            evening: { base: DUSK_PLUM.base, edge: DUSK_PLUM.shadow, detail: DUSK_PLUM.shadow } },
};
```

Floor texture per material (this is what makes the materials distinguishable in flat
Ink, which the test asserts): **wood** = two horizontal plank seams at y=10 and y=22 with
staggered end joints; **tile** = a 16×16 grout cross; **carpet** = a 2px stipple on a 4px
lattice. Each is one shape set + the ramp's own steps — no second ramp, per design.md §2's
per-shape rule.

`src/render/lighting.ts`:

```ts
/**
 * SPEC §11.3 / §14: the day→evening change lands at 19:00 and is "the coziest beat of the
 * day". The same minute drives the music crossfade in T9, so the boundary lives here and
 * both consumers read it — one number, one place.
 */
export const EVENING_START_MINUTE = 19 * 60;
export const DAY_START_MINUTE = 6 * 60;

export function lightingAt(minuteOfDay: number): Lighting {
  const m = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  return m >= EVENING_START_MINUTE || m < DAY_START_MINUTE ? 'evening' : 'day';
}

export function tileSpriteFor(room: string, minuteOfDay: number): string {
  return `tile.${room}.${lightingAt(minuteOfDay)}`;
}
```

- [ ] **Step 5: Make the static scene lighting-aware**

`buildStaticQuads` currently memoizes once per session (`WorldScene.tsx:110`). Change
`buildTileQuads(map, lighting)` to take the state, and in `WorldScene` memoize on
`[lighting]` rather than `[]`. Two memoized buffers, swapped at the boundary — not a
per-frame rebuild. Objects and their sprites are unaffected; T11 adds the crossfade
between the two.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/render/__tests__/lighting.test.ts src/render/__tests__/scene-layout.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the wider checks**

Run: `npm run validate:content && npm run art:atlas && npm test`
Expected: content gate reports the new `materials` block, atlas grows by 6 tiles, full
suite green.

- [ ] **Step 8: Commit**

```bash
git add content/home-map.json src/sim/content-schemas.ts scripts/validate-content.ts \
        src/render/sprites/tiles.ts src/render/lighting.ts src/render/scene-layout.ts \
        src/render/WorldScene.tsx src/render/__tests__/lighting.test.ts \
        scripts/art/build-atlas.ts assets/generated/
git commit -m "feat(P6): day and evening tile sets with per-material floors"
```

---

### Task 4: The character frame bill

**Files:**
- Create: `src/render/sprites/character.ts`
- Modify: `src/sim/render-view.ts`, `src/sim/content-schemas.ts`, `content/activities.json`, `src/render/scene-layout.ts`, `scripts/art/build-atlas.ts`, `scripts/validate-content.ts`
- Test: `src/render/__tests__/character-bill.test.ts`, `src/sim/__tests__/pose-mapping.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/sim/__tests__/pose-mapping.test.ts`:

```ts
import { content } from '../content';
import { deriveRenderView } from '../render-view';
import { canonicalDay1State } from '../initial-state';

describe('every activity has a pose (design.md §6 v1 bill)', () => {
  it('declares a pose for every activity in content', () => {
    for (const a of content.activities.activities) {
      expect(typeof a.pose).toBe('string');
      expect(a.pose.length).toBeGreaterThan(0);
    }
  });

  it('never leaves an activity on the generic standing pose by accident', () => {
    const generic = content.activities.activities.filter((a) => a.pose === 'stand');
    // `package` is the only activity design.md's bill gives no dedicated frames.
    expect(generic.map((a) => a.id)).toEqual(['package']);
  });

  it('derives the declared pose while that activity runs', () => {
    for (const a of content.activities.activities) {
      expect(deriveRenderView(stateRunning(a.id), content).pose).toBe(a.pose);
    }
  });

  it('reports droop when the energy band is not normal (design.md §10)', () => {
    const rested = { ...canonicalDay1State(), bars: { ...canonicalDay1State().bars, energy: 9000 } };
    const spent = { ...canonicalDay1State(), bars: { ...canonicalDay1State().bars, energy: 1000 } };
    expect(deriveRenderView(rested, content).droop).toBe(false);
    expect(deriveRenderView(spent, content).droop).toBe(true);
  });

  it('keeps pose out of the simulation state (no ENGINE_VERSION effect)', () => {
    const state = canonicalDay1State();
    const before = JSON.stringify(state);
    deriveRenderView(state, content);
    expect(JSON.stringify(state)).toBe(before);
    expect(before).not.toContain('"pose"');
  });
});

/**
 * A canonical Day-1 state with `activityId` running at tick 0.
 *
 * `sleep` is a `sleepWindow` kind and `idle` is an `idle` kind, so neither takes the
 * ordinary `activity` current-unit shape — they are constructed as the engine constructs
 * them, not force-fitted, or the pose assertion would pass against a state `step()` can
 * never produce.
 */
function stateRunning(activityId: string): SimState {
  const base = canonicalDay1State();
  if (activityId === 'sleep') return { ...base, current: { type: 'sleep', endMinute: 7 * 60 } };
  const activity = content.activities.activities.find((a) => a.id === activityId)!;
  return {
    ...base,
    current: {
      type: 'activity',
      dto: { activityId, elapsedTicks: 0, durationTicks: activity.baseMin, phase: 'main' },
    },
  };
}
```

Read the exact `current`-unit shapes from `src/sim/state.ts` when writing this — they are
discriminated unions and the compiler will reject a guess.

Create `src/render/__tests__/character-bill.test.ts`:

```ts
import { CHARACTER_BILL, POSE_FRAMES, renderCharacterFrame } from '../sprites/character';
import { content } from '../../sim/content';
import { auditBitmap, boxiness, reportIsClean, silhouetteSignature } from '../../../scripts/art/validate-palette';

/**
 * design.md §6's recount, verbatim: walk×4dir (16) · sleep (2) · sit (2) · eat (2) ·
 * brush (2) · shower (2) · lift (3) · run (4) · stretch (2) · practice (3) · idle (2) ·
 * toilet (1) · quick-wash (1) · nap (2) · preference idle variants (4) = 48.
 *
 * `stand` is NOT a bill entry — it aliases walk frame 0, exactly as P3 already does.
 * The steam overlay is an `AnchoredOverlay`, not a body frame, and is counted separately.
 */
const V1_FRAME_BILL = 48;

describe('character bill (design.md §6)', () => {
  it('authors exactly the v1 bill', () => {
    expect(CHARACTER_BILL.length).toBe(V1_FRAME_BILL);
  });

  it('aliases stand onto walk frame 0 rather than spending a frame on it', () => {
    expect(silhouetteSignature(renderCharacterFrame('stand-down-0')))
      .toBe(silhouetteSignature(renderCharacterFrame('walk-down-0')));
    expect(CHARACTER_BILL).not.toContain('stand-down-0');
  });

  it('gives walk four frames per direction', () => {
    for (const dir of ['down', 'up', 'left', 'right']) {
      expect(POSE_FRAMES[`walk-${dir}`]).toBe(4);
    }
  });

  it('matches design.md §6 frame counts per pose', () => {
    expect(POSE_FRAMES['sleep']).toBe(2);
    expect(POSE_FRAMES['sit']).toBe(2);
    expect(POSE_FRAMES['eat']).toBe(2);
    expect(POSE_FRAMES['brush']).toBe(2);
    expect(POSE_FRAMES['shower']).toBe(2);
    expect(POSE_FRAMES['lift']).toBe(3);
    expect(POSE_FRAMES['run']).toBe(4);
    expect(POSE_FRAMES['stretch']).toBe(2);
    expect(POSE_FRAMES['practice']).toBe(3);
    expect(POSE_FRAMES['idle']).toBe(2);
    expect(POSE_FRAMES['toilet']).toBe(1);
    expect(POSE_FRAMES['quickwash']).toBe(1);
    expect(POSE_FRAMES['nap']).toBe(2);
  });

  it('has frames for every pose any activity declares', () => {
    for (const a of content.activities.activities) {
      if (a.pose === 'stand') continue;
      expect(POSE_FRAMES[a.pose]).toBeGreaterThan(0);
    }
  });

  it('keeps every frame on-palette, outline-legal, and non-empty', () => {
    for (const id of CHARACTER_BILL) {
      const report = auditBitmap(id, renderCharacterFrame(id));
      if (!reportIsClean(report)) throw new Error(`${id}: ${JSON.stringify(report)}`);
    }
  });

  it('makes each pose distinguishable in flat Ink from standing', () => {
    const stand = silhouetteSignature(renderCharacterFrame('stand-down-0'));
    for (const pose of ['sleep', 'sit', 'eat', 'lift', 'run', 'stretch', 'practice', 'toilet']) {
      expect(silhouetteSignature(renderCharacterFrame(`${pose}-0`))).not.toBe(stand);
    }
  });

  it('authors a distinct droop frame for standing and idle', () => {
    expect(silhouetteSignature(renderCharacterFrame('stand-down-0')))
      .not.toBe(silhouetteSignature(renderCharacterFrame('stand-down-droop')));
  });

  it('closes A0: the seated frame is no longer a squat block', () => {
    expect(boxiness(renderCharacterFrame('sit-0'))).toBeLessThan(0.72);
  });

  it('closes A0: slim mitten hands stay connected to their arms', () => {
    // A0 handed forward "slim mitten hands read slightly detached at 1x". Detached means
    // a small island of opaque pixels with no 4-connected route to the body — so the
    // check is structural, not a screenshot opinion.
    for (const id of CHARACTER_BILL) {
      for (const island of opaqueIslands(renderCharacterFrame(id, 'slim'))) {
        expect({ id, island }).toEqual({ id, island: expect.any(Number) });
        expect(island).toBeGreaterThanOrEqual(6);
      }
    }
  });
});

/** Sizes of every 4-connected opaque region, largest first. */
function opaqueIslands(bmp: Bitmap): number[] {
  const seen = new Uint8Array(bmp.width * bmp.height);
  const opaque = (i: number) => bmp.data[i * 4 + 3] !== 0;
  const sizes: number[] = [];
  for (let start = 0; start < bmp.width * bmp.height; start++) {
    if (seen[start] || !opaque(start)) continue;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const x = i % bmp.width;
      const y = (i - x) / bmp.width;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < bmp.width - 1 ? i + 1 : -1,
        y > 0 ? i - bmp.width : -1,
        y < bmp.height - 1 ? i + bmp.width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || seen[n] || !opaque(n)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/render/__tests__/character-bill.test.ts src/sim/__tests__/pose-mapping.test.ts`
Expected: FAIL — `sprites/character` missing; `pose` is not on the activity schema;
`droop` is not on `RenderView`.

- [ ] **Step 3: Declare poses in content**

Add `"pose"` to each entry in `content/activities.json`:

| activity | pose | activity | pose |
|---|---|---|---|
| `sleep` | `sleep` | `quickwash` | `quickwash` |
| `nap` | `nap` | `brush` | `brush` |
| `meal` | `eat` | `toilet` | `toilet` |
| `snack` | `eat` | `package` | `stand` |
| `weights` | `lift` | `practice` | `practice` |
| `treadmill` | `run` | `idle` | `idle` |
| `stretch` | `stretch` | | |
| `shower` | `shower` | | |

Extend `ActivitySchema` in `content-schemas.ts` with
`pose: z.enum(['stand','walk','sleep','nap','sit','eat','brush','shower','lift','run','stretch','practice','toilet','quickwash','idle'])`.

In `scripts/validate-content.ts`, add the cross-check that closes the placeholder door
for good: **read `assets/generated/atlas-index.json` and fail if any declared pose has no
frames in the atlas.** An activity whose animation was never authored then cannot reach a
green build.

- [ ] **Step 4: Widen the render read-model**

In `src/sim/render-view.ts`, replace the `Pose` union with the fifteen names above,
rewrite `derivePose` to read `objectForActivityIn(...)`'s activity `pose` from content
instead of the hard-coded `obj.id === 'couch'` check, and add:

```ts
/**
 * design.md §10: "tiredness is an animation state (droop frames), not a filter."
 *
 * The threshold is the Energy band already tuned in `rates.json` — §11.1 records why
 * Energy carries its own bands, and inventing a second tiredness number here would be a
 * silent way to disagree with it.
 */
readonly droop: boolean;
```

derived as `bandFor('energy', displayEnergy, content.rates).band !== 'normal'`.

- [ ] **Step 5: Author the frames**

Create `src/render/sprites/character.ts` importing the primitives from `parts.ts`, the
A0 body/face/hair/outfit construction from `a0.ts`, and the anchor discipline from
`sprite-spec.ts` unchanged. **The layer order, the head/hand anchors, and `deriveSlim`
are not re-litigated** — A0 proved them and P3 depends on them.

Frames, by pose (48 total, matching design.md §6's recount):

- **walk ×4 dir × 4 frames (16)** — extend A0's 2-frame alternation to the standard
  contact/down/pass/up cycle. Frames 0 and 2 are the existing pair; 1 and 3 add the
  1-px body bob at the pass positions, which is what makes the cycle read as walking
  rather than shuffling.
- **sleep (2)** — horizontal, head on the pillow anchor, one breathing frame 1 px apart.
- **sit (2)** — closes the A0 deferral. The seated block gets a lap: the thigh line runs
  forward and the shin drops, so the outline has an L, not a rectangle (`boxiness < 0.72`).
- **eat (2)** — seated at the counter, hand rising to the head anchor and back.
- **brush (2)** — standing at the sink, hand at head anchor, elbow alternating.
- **shower (2) + steam overlay** — the overlay is an `AnchoredOverlay` on the head anchor,
  authored once, drawn above the body; it is what makes shower distinct from quick-wash.
- **lift (3)** — bar at hand anchors: down, mid, up.
- **run (4)** — the walk cycle with a longer stride and both feet off contact on 1 and 3.
- **stretch (2)** — reach up, fold forward.
- **practice (3)** — guitar prop on the hand anchors, strum arm at three positions. This
  is the pose the whole Practice system is about; it gets the most attention.
- **idle (2)** — weight shift, 1 px.
- **toilet (1)**, **quick-wash (1)** — single frames, per the bill.
- **nap (2)** — seated-slumped on the couch, distinct from `sit` and from `sleep`.
- **preference idle variants (4)** — `window-gazing`, `slow-stretching`, `air-guitar`,
  and one droop variant of standing. These are what make `content/identity.json`'s
  preferences and Goal 4's reward *visible*; today they are save data with no pixels.

- [ ] **Step 6: Drive frames from the index, not from a constant**

`scene-layout.ts`'s `characterSprite` currently hard-codes the two-frame alternation and
maps `sleep` onto `char.sit-down`. Replace with a lookup against a `poses` block the atlas
builder now emits into `atlas-index.json`:

First extend the `AtlasIndex` interface — declared in **both** `scene-layout.ts` and
`build-atlas.ts`, and they must stay identical — with:

```ts
/** Frame count per pose key, emitted by the atlas builder so the renderer never guesses. */
poses: Record<string, number>;
```

Then replace `characterSprite`:

```ts
export function characterSprite(
  pose: Pose, facing: Facing, phase: number, droop: boolean, index: AtlasIndex,
): string {
  // `stand` spends no frames of its own: it is walk frame 0, exactly as P3 had it. Only
  // `walk` is directional in the v1 bill; every other pose faces its object by definition.
  if (pose === 'stand') {
    return droop && index.poses['stand-droop'] !== undefined
      ? 'char.stand-droop'
      : `char.walk-${facing}-0`;
  }
  const key = pose === 'walk' ? `walk-${facing}` : pose;
  if (droop && index.poses[`${key}-droop`] !== undefined) return `char.${key}-droop`;
  const frames = index.poses[key];
  if (frames === undefined) throw new Error(`atlas has no frames for pose "${key}"`);
  const wrapped = ((phase % 1) + 1) % 1;
  const frame = Math.min(frames - 1, Math.floor(wrapped * frames));
  return `char.${key}-${frame}`;
}
```

The throw matters: a pose with no frames is a loud failure, not a silently reused walk
frame. Silent reuse is exactly the mechanism that made `sleep` look like sitting for three
phases (`scene-layout.ts:154`). `WorldScene`'s `CHAR_SPRITES` table enumerates every pose
key at module load, so the throw fires at startup in dev and in the mount tests, not
mid-frame in a player's session.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest src/render/__tests__ src/sim/__tests__/pose-mapping.test.ts`
Expected: PASS.

- [ ] **Step 8: Prove the goldens did not move**

Run: `npm run harness && npx jest src/application/__tests__/scripted-player-golden.test.ts`
Expected: PASS with **no snapshot update**. Canonical digest still
`141101f2b3b8b6a81c990b886c44e0fe6e03f7e2b67eb0a35f50034af6c3324e`. If it moved, a render
concern leaked into `SimState` — stop and fix that, do not accept the new digest.

- [ ] **Step 9: Commit**

```bash
git add src/render/sprites/character.ts src/sim/render-view.ts src/sim/content-schemas.ts \
        content/activities.json scripts/validate-content.ts src/render/scene-layout.ts \
        scripts/art/build-atlas.ts src/render/__tests__/ src/sim/__tests__/pose-mapping.test.ts \
        assets/generated/
git commit -m "feat(P6): the 48-frame character bill, one pose per activity"
```

---

### Task 5: Four appearance presets and three idle variants

`content/identity.json` has offered four appearances since P5 and every one of them draws
the same auburn-haired sprite. Per Q2, all four are baked.

**Files:**
- Create: `src/render/appearance.ts`
- Modify: `scripts/art/build-atlas.ts`, `src/render/scene-layout.ts`, `src/render/WorldScene.tsx`, `src/application/GameScreen.tsx`
- Test: `src/render/__tests__/appearance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { content } from '../../sim/content';
import { APPEARANCE_PALETTES, characterSpriteFor } from '../appearance';
import atlasIndex from '../../../assets/generated/atlas-index.json';

describe('appearance presets (design.md §6, SPEC §9.1)', () => {
  it('maps every content preset to a palette', () => {
    for (const p of content.identity.appearancePresets) {
      expect(APPEARANCE_PALETTES[p.paletteId]).toBeDefined();
    }
    expect(Object.keys(APPEARANCE_PALETTES).length)
      .toBe(content.identity.appearancePresets.length);
  });

  it('gives each preset a distinct skin/hair/outfit combination', () => {
    const seen = new Set<string>();
    for (const p of content.identity.appearancePresets) {
      const m = APPEARANCE_PALETTES[p.paletteId]!;
      const key = `${m.skin.base}/${m.hair.base}/${m.outfit.base}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('bakes every frame for every preset into the atlas', () => {
    for (const p of content.identity.appearancePresets) {
      expect(atlasIndex.sprites[`char.${p.paletteId}.stand-down-0`]).toBeDefined();
      expect(atlasIndex.sprites[`char.${p.paletteId}.practice-0`]).toBeDefined();
    }
  });

  it('renders the same shapes for every preset — zero redrawn frames (design.md §6)', () => {
    // Geometry only: every frame's shape list with the colour field stripped. If two
    // presets share geometry, no frame was redrawn — which is the literal design rule.
    const geometryOf = (paletteId: string) =>
      JSON.stringify(
        CHARACTER_BILL.map((id) =>
          characterFrameShapes(id, APPEARANCE_PALETTES[paletteId]!).map(
            ({ c, ...geometry }) => geometry,
          ),
        ),
      );
    expect(geometryOf('morning-blue')).toBe(geometryOf('plum-night'));
    expect(geometryOf('moss-green')).toBe(geometryOf('warm-clay'));
  });

  it('draws every idle variant the game can grant', () => {
    // window-gazing and slow-stretching come from content/identity.json; air-guitar is
    // Goal 4's entire reward. All three were save data with no pixels before P6.
    for (const v of ['window-gazing', 'slow-stretching', 'air-guitar']) {
      expect(atlasIndex.poses[`idle-${v}`]).toBeGreaterThan(0);
    }
  });

  it('picks the active variant, and the base idle when there is none', () => {
    expect(characterSpriteFor(
      { pose: 'idle', facing: 'down', variantId: null, paletteId: 'morning-blue', droop: false },
      0,
    )).toBe('char.morning-blue.idle-0');

    expect(characterSpriteFor(
      { pose: 'idle', facing: 'down', variantId: 'air-guitar', paletteId: 'morning-blue', droop: false },
      0,
    )).toBe('char.morning-blue.idle-air-guitar-0');
  });

  it('falls back to the base idle for a variant with no authored frames', () => {
    expect(characterSpriteFor(
      { pose: 'idle', facing: 'down', variantId: 'not-authored', paletteId: 'morning-blue', droop: false },
      0,
    )).toBe('char.morning-blue.idle-0');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/render/__tests__/appearance.test.ts`
Expected: FAIL — `../appearance` does not exist.

- [ ] **Step 3: Implement the palette maps**

```ts
/**
 * design.md §6: "Skin/hair recolors are palette-index swaps — zero redrawn frames."
 *
 * Taken literally: the four presets share one set of authored shapes and differ only in
 * which §2 palette entries those shapes are painted with. The `paletteId` field has been
 * in `content/identity.json` and `content-schemas.ts` since P5 with no consumer; this is
 * the consumer.
 *
 * Names come from the content presets, so a fifth preset is a content edit plus one row.
 */
export interface AppearancePalette {
  skin: Ramp;
  hair: Ramp;
  outfit: Ramp;
}

export const APPEARANCE_PALETTES: Record<string, AppearancePalette> = {
  'morning-blue': { skin: SKIN_RAMPS[0]!, hair: HAIR_BLACK,  outfit: WATER_BLUE },
  'moss-green':   { skin: SKIN_RAMPS[2]!, hair: HAIR_AUBURN, outfit: LEAF_GREEN },
  'warm-clay':    { skin: SKIN_RAMPS[4]!, hair: HAIR_BLONDE, outfit: TERRACOTTA },
  'plum-night':   { skin: SKIN_RAMPS[5]!, hair: DUSK_PLUM,   outfit: DUSK_PLUM },
};
```

Each combination is checked against design.md §2's character-only list — the six skin
ramps and the eight hair sets are enumerated there and the validator admits exactly them.

- [ ] **Step 4: Bake the presets**

In `build-atlas.ts`, wrap the character loop so each frame is rasterized once per
appearance, naming sprites `char.<paletteId>.<pose>-<frame>`. Expected census: 48 frames
× 4 presets = 192 character sprites. `renderCharacterFrame` takes the palette as a
parameter and the geometry is untouched, which is what the "same shapes" test asserts.

- [ ] **Step 5: Route the renderer through the active preset**

`WorldScene` takes `paletteId` and `idleVariantId` props from the career's identity and
granted rewards. `CHAR_SPRITES` / `CHAR_RECTS` — the worklet's flat lookup tables — are
memoized on `[paletteId]`, so they rebuild once on career load and never per frame.

Add the appearance-aware wrapper in `src/render/appearance.ts`. It is a thin shell over
T4's `characterSprite`, which stays the single place that resolves a pose to a frame:

```ts
export interface CharacterDraw {
  pose: Pose;
  facing: Facing;
  /** Active idle variant, or null. From identity preferences or Goal 4's reward. */
  variantId: string | null;
  paletteId: string;
  droop: boolean;
}

/**
 * Appearance + idle variant, layered over `characterSprite`.
 *
 * **Missing frames are handled differently on purpose, and the difference is the point:**
 *  - a missing *pose* throws (T4) — an activity with no authored animation is a build
 *    defect, and P3's silent walk-frame reuse is exactly the failure to prevent;
 *  - a missing *variant* falls back to the base idle — a variant is decoration on a pose
 *    that already exists, and a save carrying an unknown variant id (a migrated career, a
 *    reward from a later version) must not take the session down for a flourish.
 */
export function characterSpriteFor(draw: CharacterDraw, phase: number, index: AtlasIndex): string {
  const base = characterSprite(draw.pose, draw.facing, phase, draw.droop, index);
  const [, poseKey] = base.split('.');            // "char.idle-0" -> "idle-0"
  if (draw.pose === 'idle' && draw.variantId !== null) {
    const variantKey = `idle-${draw.variantId}`;
    const frames = index.poses[variantKey];
    if (frames !== undefined) {
      const wrapped = ((phase % 1) + 1) % 1;
      const frame = Math.min(frames - 1, Math.floor(wrapped * frames));
      return `char.${draw.paletteId}.${variantKey}-${frame}`;
    }
  }
  return `char.${draw.paletteId}.${poseKey}`;
}
```

`characterFrameShapes(id, palette)` — the geometry-plus-palette accessor the "zero redrawn
frames" test uses — is exported from `sprites/character.ts` alongside
`renderCharacterFrame`, which calls it and rasterizes the result.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/render/__tests__/appearance.test.ts && npm test`
Expected: PASS. Atlas census now ~230 sprites.

- [ ] **Step 7: See all four**

Run the export, and with `?playtestSeed=` values that roll each preset, confirm four
visibly different people. Screenshot to
`docs/superpowers/evidence/p6-appearances-1366x768.png`.

- [ ] **Step 8: Commit**

```bash
git add src/render/appearance.ts src/render/__tests__/appearance.test.ts \
        scripts/art/build-atlas.ts src/render/ src/application/GameScreen.tsx \
        assets/generated/ docs/superpowers/evidence/
git commit -m "feat(P6): four appearance presets and the idle variants they promised"
```

---

### Task 6: Distinct decorations

Six grants currently share two sprites (`scene-layout.ts:118`, `evidence/P5.md:312`).
Goal 3's *choice* between two rewards is meaningless when both are the same vase.

**Files:**
- Create: `src/render/sprites/decorations.ts`
- Modify: `src/render/scene-layout.ts`, `scripts/art/build-atlas.ts`
- Test: `src/render/__tests__/decorations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { DECORATION_PLACEMENTS } from '../scene-layout';
import { DECORATION_SPRITES, renderDecoration } from '../sprites/decorations';
import { auditBitmap, reportIsClean, silhouetteSignature } from '../../../scripts/art/validate-palette';

describe('decorations (design.md §7, §11)', () => {
  it('authors a unique sprite for every grantable placement', () => {
    const sprites = new Set(Object.values(DECORATION_PLACEMENTS).map((p) => p.sprite));
    expect(sprites.size).toBe(Object.keys(DECORATION_PLACEMENTS).length);
  });

  it('never reuses one sprite for two rewards', () => {
    const seen = new Map<string, string>();
    for (const id of Object.keys(DECORATION_PLACEMENTS)) {
      const sig = silhouetteSignature(renderDecoration(DECORATION_PLACEMENTS[id]!.sprite));
      expect(seen.get(sig)).toBeUndefined();
      seen.set(sig, id);
    }
  });

  it('keeps each on-palette and outline-legal', () => {
    for (const name of Object.keys(DECORATION_SPRITES)) {
      const report = auditBitmap(name, renderDecoration(name));
      if (!reportIsClean(report)) throw new Error(`${name}: ${JSON.stringify(report)}`);
    }
  });

  it('fits every decoration inside one tile plus its authored overhang', () => {
    for (const name of Object.keys(DECORATION_SPRITES)) {
      const bmp = renderDecoration(name);
      expect(bmp.width).toBeLessThanOrEqual(32);
      expect(bmp.height).toBeLessThanOrEqual(32);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/render/__tests__/decorations.test.ts`
Expected: FAIL — sprite set is 2, placements are 6.

- [ ] **Step 3: Author six distinct decorations**

| Placement id | Sprite | Ramp | Shape |
|---|---|---|---|
| `leafy-plant` | `decoration.leafy-plant` | Leaf green + terracotta pot | broad-leaf plant, three fronds, tapered pot (keep A0-era art, re-audited) |
| `sunny-vase` | `decoration.sunny-vase` | Lantern gold + dusk plum | three round blooms on stems in a bellied vase (keep, re-audited) |
| `bedroom-plant` | `decoration.trailing-vine` | Leaf green | **new** — trailing vine spilling over the wardrobe edge, silhouette runs sideways |
| `wrinkle-keepsake` | `decoration.keepsake-box` | Wood + gold clasp | **new** — small lidded box, gold clasp (a reward, so gold is sanctioned) |
| `wrinkle-print` | `decoration.framed-print` | Wood frame + water blue | **new** — rectangular frame with a visible mount border and a hanging hook |
| `practice-poster` | `decoration.practice-poster` | Terracotta + gold pick | **new** — wall poster, torn lower corner, gold plectrum motif |

The keepsake box and the framed print must not share a silhouette — the box is wider than
tall with a lid seam; the print is taller than wide with a hook above the frame line.

- [ ] **Step 4: Point the placements at their own sprites**

Update `DECORATION_PLACEMENTS` in `scene-layout.ts` and delete the "until P6 authors their
final sprites" comment — the deferral it records is now closed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/render/__tests__/decorations.test.ts && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/render/sprites/decorations.ts src/render/scene-layout.ts \
        src/render/__tests__/decorations.test.ts scripts/art/build-atlas.ts assets/generated/
git commit -m "feat(P6): six rewards, six sprites — Goal 3's choice is now a real choice"
```

---

### Task 7: Pixel font, icon set, and the UI chrome kit

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/Icon.tsx`, `src/render/sprites/icons.ts`
- Add: `assets/fonts/Silkscreen-Regular.ttf`, `assets/fonts/Silkscreen-Bold.ttf`
- Modify: every `src/ui/*.tsx` with hex literals; `src/render/scale.ts`; `SPEC.md` §11.5 (only if the measured HUD height changes)
- Test: `src/ui/__tests__/theme.test.ts`, `src/ui/__tests__/icons.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { PALETTE_57 } from '../../render/palette';
import { CHROME, TYPE_SCALE, theme } from '../theme';

describe('theme (design.md §3 Track A, §4, Joe global rules)', () => {
  it('uses only §2 palette colours', () => {
    for (const hex of Object.values(theme.color)) {
      expect(PALETTE_57).toContain(hex);
    }
  });

  it('ships at most four type sizes and two weights', () => {
    expect(new Set(Object.values(TYPE_SCALE).map((t) => t.fontSize)).size).toBeLessThanOrEqual(4);
    expect(new Set(Object.values(TYPE_SCALE).map((t) => t.fontWeight)).size).toBeLessThanOrEqual(2);
  });

  it('keeps every Silkscreen size on a crisp multiple of its 8 px design em', () => {
    for (const t of Object.values(TYPE_SCALE)) {
      if (t.fontFamily !== 'Silkscreen') continue;
      expect(t.fontSize % 8).toBe(0);
    }
  });

  it('uses tabular numerals everywhere numbers appear', () => {
    for (const t of Object.values(TYPE_SCALE)) {
      expect(t.fontVariant).toContain('tabular-nums');
    }
  });

  it('keeps every spacing token on the 8-point grid', () => {
    for (const v of Object.values(theme.space)) expect(v % 4).toBe(0);
  });

  it('outlines UI chrome in Ink, never in a ramp shadow (design.md §3 Track A)', () => {
    for (const recipe of Object.values(CHROME)) {
      expect(recipe.borderColor).toBe(theme.color.ink);
    }
  });

  it('reserves gold for rewards and red for urgent/destructive only', () => {
    expect(CHROME.rewardButton.backgroundColor).toBe(theme.color.gold);
    expect(CHROME.destructiveButton.backgroundColor).toBe(theme.color.red);
    expect(CHROME.neutralButton.backgroundColor).not.toBe(theme.color.gold);
    expect(CHROME.neutralButton.backgroundColor).not.toBe(theme.color.red);
  });

  it('keeps every hit target at 44 px or more (SPEC §11.2)', () => {
    for (const recipe of Object.values(CHROME)) {
      if (recipe.minHeight === undefined) continue;
      expect(recipe.minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
```

And for icons — the point is that alert states differ by *shape*, per SPEC §11.6:

```ts
it('gives each bar icon an alert variant with a different silhouette', () => {
  for (const bar of ['energy', 'nutrition', 'movement', 'hygiene'] as const) {
    expect(silhouetteSignature(renderIcon(`${bar}.normal`)))
      .not.toBe(silhouetteSignature(renderIcon(`${bar}.alert`)));
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/ui/__tests__/theme.test.ts src/ui/__tests__/icons.test.ts`
Expected: FAIL — `../theme` does not exist.

- [ ] **Step 3: Vendor Silkscreen and load it**

Silkscreen is SIL OFL 1.1. Copy `Silkscreen-Regular.ttf` and `Silkscreen-Bold.ttf` into
`assets/fonts/` with the licence file beside them, install `expo-font`, and load in
`ApplicationRoot` before first paint. Web export needs the fonts in the bundle — verify
in step 8 that the exported page renders Silkscreen and not a fallback, because a silent
fallback is exactly the kind of thing that looks fine locally and ships wrong.

- [ ] **Step 4: Build the theme module**

`src/ui/theme.ts` re-exports the palette (no new hexes — it imports `src/render/palette.ts`
so there is one source), defines the 4-size / 2-weight type scale at Silkscreen-crisp
sizes 8/16/24/32, the 8-point spacing scale, and the design.md §8 component recipes as
plain style objects: bars, queue cards, chips, buttons (cream/red/gold), panels, event
cards, and bubbles.

- [ ] **Step 5: Replace the copied hexes**

Fourteen files carry palette hexes as literals — `AppShell.tsx` (36), `PauseSettings.tsx`
(33), `QueueStrip.tsx` (24), `FirstSessionUI.tsx` (12), `GameScreen.tsx` (10), `Hud.tsx`
(6), and eight more. Replace each with a theme token. **This is a substitution, not a
redesign:** the mounted tests, test IDs, accessibility labels, and focus behaviour P5
verified must not change. Run the mount suites after each file.

- [ ] **Step 6: Draw the icon set**

`src/render/sprites/icons.ts` authors 12 px icons per design.md §9 — Energy moon (alert:
drooping), Nutrition fork (alert: empty bowl), Movement shoe (alert: stiff boot), Hygiene
droplet (alert: squiggle), Practice pick in gold, plus the AUTO gear, PINNED pin, URGENT
warning, and adjacency chip marks. They join the atlas; `Icon.tsx` draws them from it.
This retires the Unicode glyphs in `bands.ts:63`, which were never on-palette and never
guaranteed to have the same shape across platforms.

- [ ] **Step 7: Re-measure the HUD**

`scale.ts:34` carries a standing instruction: *"If P4's layout work changes the HUD's real
height, change it here AND in §11.5. One number, two places, and they must never disagree
again."* A font change is exactly that. Measure the rendered HUD in the exported build at
1366×768 and at 200% text scaling. If it is no longer 148 px, update `HUD_H`, SPEC §11.5,
and the `scale.test.ts` expectations together in this step. If it is still 148, record the
measurement anyway — P3's fourth adversarial pass found the room drawn under the HUD when
that number was wrong.

- [ ] **Step 8: Run everything**

Run: `npm run check && npm run export:web`
Expected: green, with the mount suites unchanged.

Open the export and confirm: Silkscreen renders (not a fallback), numerals are tabular,
no anti-aliasing at 1×, buttons read as pressable chunky cards, and the HUD reserves what
`scale.ts` says it reserves.

- [ ] **Step 9: Commit**

```bash
git add assets/fonts/ src/ui/ src/render/sprites/icons.ts src/render/scale.ts \
        SPEC.md package.json package-lock.json assets/generated/
git commit -m "feat(P6): Silkscreen, the icon set, and one theme instead of fourteen"
```

---

### Gate A — the legible build

- [ ] Run `npm run verify`. Record suite/test counts and the export hash.
- [ ] Run `npm run art:bill` (added in T13; if not yet present, run the four bill tests
      directly). Every object, pose, appearance, decoration, and icon accounted for.
- [ ] Export and observe at **1366×768 and 1024×768**: name every object without help;
      watch a full day including the 19:00 change; confirm all four appearances; complete
      one Practice session and watch the practice pose; trigger one decoration reward.
- [ ] Record screenshots + SHA-256s and the Gate A section of `evidence/P6.md`.
- [ ] **The comprehension check.** Joe reads the room at 1366×768 and names every object
      without consulting `objects.json`, then watches one full day. Under Q1's ruling this
      is the last cheap point to find out that legibility is still wrong — everything after
      it (audio, juice, performance) is spent on top. **If any object cannot be named, go
      back to T2 step 5 before starting Milestone B.** No build is frozen here.

---

### Task 8: The real audio bus

**Files:**
- Create: `src/application/audio/expo-audio-bus.ts`, `content/audio.json`
- Create: `src/application/__tests__/helpers/fake-audio-bus.ts` — the recording double T9
  and T10 both drive. It implements `AudioBus` and records `playing()`, `paused()`,
  `fired()`, `crossfades()`, `eventOrder()`, `startCount(id)`, and `playbackRates()`, so
  the music and cue tests assert on ordered facts instead of on mock call shapes.
- Modify: `src/sim/content-schemas.ts`, `src/sim/content.ts`, `src/application/boot.ts`, `scripts/validate-content.ts`, `package.json`
- Test: `src/application/__tests__/audio-bus-expo.test.ts`

- [ ] **Step 1: Re-confirm the API against the installed version**

Install `expo-audio` at the SDK 57-compatible version and read its own type declarations
before writing any wiring — master convention 8. The expected surface (confirmed
2026-07-30 against Expo docs) is `createAudioPlayer(source, options)`, `preload(source)`,
`setAudioModeAsync(mode)`, and mutable `player.volume` / `player.loop` plus
`play()` / `pause()` / `seekTo()` / `release()`. Record any difference in `evidence/P6.md`
and adapt this task rather than the docs.

- [ ] **Step 2: Write the failing test**

```ts
// The factory must build its own players. Jest hoists `jest.mock` above every import, so
// a factory may only close over names prefixed `mock` — referencing an ordinary helper
// here fails with "The module factory of jest.mock() is not allowed to reference…".
const mockPlayers: { volume: number; loop: boolean; play: jest.Mock; pause: jest.Mock; release: jest.Mock }[] = [];

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => {
    const player = {
      volume: 1, loop: false,
      play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(), release: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
  setAudioModeAsync: jest.fn(async () => {}),
  preload: jest.fn(),
}));

beforeEach(() => { mockPlayers.length = 0; });

describe('ExpoAudioBus (SPEC §14)', () => {
  it('multiplies each channel by master, and mute wins over both', () => {
    const bus = new ExpoAudioBus(content.audio, { master: 0.8, music: 0.5, sfx: 1, muted: false });
    bus.playMusic('day');
    const dayGain = content.audio.music.day.gain;
    expect(mockPlayers[0]!.volume).toBeCloseTo(0.8 * 0.5 * dayGain, 5);
    bus.apply({ master: 0.8, music: 0.5, sfx: 1, muted: true });
    expect(mockPlayers[0]!.volume).toBe(0);
  });

  it('restores the previous mix when unmuted, not full volume', () => {
    const mix = { master: 0.8, music: 0.5, sfx: 1, muted: false };
    const bus = new ExpoAudioBus(content.audio, mix);
    bus.playMusic('day');
    const before = mockPlayers[0]!.volume;
    bus.apply({ ...mix, muted: true });
    bus.apply({ ...mix, muted: false });
    expect(mockPlayers[0]!.volume).toBeCloseTo(before, 5);
    expect(mockPlayers[0]!.volume).toBeLessThan(1);
  });

  it('applies the SFX channel to cues and the music channel to beds', () => {
    const bus = new ExpoAudioBus(content.audio, { master: 1, music: 0, sfx: 1, muted: false });
    bus.playMusic('day');
    bus.playCue('queue.insert');
    expect(mockPlayers[0]!.volume).toBe(0);
    expect(mockPlayers[1]!.volume).toBeGreaterThan(0);
  });

  it('starts muted in a dev web build (SPEC §14 dev hygiene)', () => {
    const bus = new ExpoAudioBus(content.audio, defaults, { dev: true, platform: 'web' });
    expect(bus.muted).toBe(true);
    const shipped = new ExpoAudioBus(content.audio, defaults, { dev: false, platform: 'web' });
    expect(shipped.muted).toBe(false);
  });

  it('releases every player on shutdown — no orphaned audio after tab close', () => {
    const bus = new ExpoAudioBus(content.audio, defaults);
    bus.playMusic('day');
    bus.playLoop('shower');
    bus.shutdown();
    expect(mockPlayers.length).toBeGreaterThan(0);
    for (const p of mockPlayers) expect(p.release).toHaveBeenCalled();
  });

  it('names a missing asset instead of throwing mid-frame', () => {
    const bus = new ExpoAudioBus(content.audio, defaults);
    expect(() => bus.playCue('nope')).not.toThrow();
    expect(bus.missingAssets()).toContain('nope');
  });

  it('satisfies the AudioBus interface P5 already persists against', () => {
    const bus: AudioBus = new ExpoAudioBus(content.audio, defaults);
    expect(bus.muted).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/audio-bus-expo.test.ts`
Expected: FAIL — `ExpoAudioBus` does not exist.

- [ ] **Step 4: Add the audio content file and schema**

`content/audio.json` declares asset ids, per-asset gains, loop flags, the crossfade
minute (imported from `lighting.ts`'s `EVENING_START_MINUTE`, asserted equal at the
content gate so the music and the lights can never disagree), the four Practice riff
layers by level, ambience, footsteps per floor material, activity loops keyed by activity
id, and the six UI cues. Schema in `content-schemas.ts`, registered in `content.ts`.

`scripts/validate-content.ts` gains three cross-checks: every activity with an authored
loop names a real activity; every `home-map.json` material has a footstep; and the
crossfade minute equals `EVENING_START_MINUTE`.

- [ ] **Step 5: Implement the bus**

`ExpoAudioBus implements AudioBus` — the interface P5 defined in `audio-bus.ts` and
already persists settings against, so `boot.ts` swaps one constructor and nothing else
moves. Volume is `master × channel × assetGain`, clamped to [0,1]; mute sets 0 without
losing the mix; dev web starts muted; `shutdown()` releases every player and is called
from P5's existing `pagehide` / visibility lifecycle barrier.

**Missing assets do not throw.** Until Joe supplies files (Q4), every id is missing —
`missingAssets()` is how T13 proves the set is complete, and a thrown error inside a
frame callback would take the app down for a sound.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/application/__tests__/audio-bus-expo.test.ts && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/application/audio/ content/audio.json src/sim/content-schemas.ts \
        src/sim/content.ts src/application/boot.ts scripts/validate-content.ts \
        package.json package-lock.json src/application/__tests__/
git commit -m "feat(P6): the real audio bus behind P5's silent interface"
```

---

### Task 9: Music, crossfade, and the Practice riff

**Files:**
- Modify: `src/application/audio/cue-router.ts`
- Test: `src/application/__tests__/music-controller.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { EVENING_START_MINUTE } from '../../render/lighting';
import { MusicController } from '../audio/cue-router';
import { FakeAudioBus } from './helpers/fake-audio-bus';

describe('music (SPEC §14)', () => {
  it('plays the day bed before 19:00 and only that', () => {
    const bus = new FakeAudioBus();
    new MusicController(bus).onMinute(12 * 60, { practiceLevel: 0, paused: false });
    expect(bus.playing()).toEqual(['music:day']);
  });

  it('crossfades at the same minute the lighting changes', () => {
    const bus = new FakeAudioBus();
    const music = new MusicController(bus);
    music.onMinute(EVENING_START_MINUTE - 1, { practiceLevel: 0, paused: false });
    music.onMinute(EVENING_START_MINUTE, { practiceLevel: 0, paused: false });
    expect(bus.crossfades()).toEqual([{ from: 'music:day', to: 'music:evening' }]);
  });

  it('never double-plays a bed across repeated minutes', () => {
    const bus = new FakeAudioBus();
    const music = new MusicController(bus);
    for (const m of [20 * 60, 20 * 60 + 1, 20 * 60 + 2]) {
      music.onMinute(m, { practiceLevel: 0, paused: false });
    }
    expect(bus.startCount('music:evening')).toBe(1);
  });

  it('leaves no gap: the outgoing bed stops only after the incoming one starts', () => {
    const bus = new FakeAudioBus();
    const music = new MusicController(bus);
    music.onMinute(EVENING_START_MINUTE - 1, { practiceLevel: 0, paused: false });
    music.onMinute(EVENING_START_MINUTE, { practiceLevel: 0, paused: false });
    expect(bus.eventOrder()).toEqual(['start:music:day', 'start:music:evening', 'fade:music:day']);
  });

  it('layers the Practice riff over the bed instead of replacing it', () => {
    const bus = new FakeAudioBus();
    const music = new MusicController(bus);
    music.onMinute(12 * 60, { practiceLevel: 2, paused: false, practicing: true });
    expect(bus.playing()).toEqual(['music:day', 'riff:l2']);
  });

  it('picks the riff by Practice level (L3 is the one that sounds good)', () => {
    for (const level of [0, 1, 2, 3] as const) {
      const bus = new FakeAudioBus();
      new MusicController(bus).onMinute(12 * 60, { practiceLevel: level, paused: false, practicing: true });
      expect(bus.playing()).toContain(`riff:l${level}`);
    }
  });

  it('drops the riff when the Practice session ends', () => {
    const bus = new FakeAudioBus();
    const music = new MusicController(bus);
    music.onMinute(12 * 60, { practiceLevel: 1, paused: false, practicing: true });
    music.onMinute(12 * 60 + 30, { practiceLevel: 1, paused: false, practicing: false });
    expect(bus.playing()).toEqual(['music:day']);
  });

  it('pauses with the game and resumes where it was', () => {
    const bus = new FakeAudioBus();
    const music = new MusicController(bus);
    music.onMinute(12 * 60, { practiceLevel: 0, paused: false });
    music.onMinute(12 * 60, { practiceLevel: 0, paused: true });
    expect(bus.paused()).toEqual(['music:day']);
    music.onMinute(12 * 60, { practiceLevel: 0, paused: false });
    expect(bus.startCount('music:day')).toBe(1); // resumed, not restarted
  });

  it('does not resample music when the playback speed changes', () => {
    const bus = new FakeAudioBus();
    const music = new MusicController(bus);
    music.onMinute(12 * 60, { practiceLevel: 0, paused: false });
    music.onSpeed(4);
    expect(bus.playbackRates()).toEqual([1]); // game time is not musical time
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/music-controller.test.ts`
Expected: FAIL — `MusicController` is not exported.

- [ ] **Step 3: Implement the music controller**

`MusicController` holds the currently-playing bed and riff ids, is driven by the published
snapshot's clock minute, and reads the day/evening boundary from `lightingAt()` — the same
function T3 gave the tiles, so the lights and the music physically cannot disagree about
when evening starts. Riff level comes from `practiceLevel()`, which P5 already derives.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/application/__tests__/music-controller.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Listen**

Export and listen across 18:55 → 19:05 at 1× and at 4×, then through one Practice session
at each level. Confirm no gap, no double-play, no pitch change at 4×. Record in
`evidence/P6.md`.

- [ ] **Step 6: Commit**

```bash
git add src/application/audio/cue-router.ts src/application/__tests__/music-controller.test.ts
git commit -m "feat(P6): music bed, 19:00 crossfade, Practice riff by level"
```

---

### Task 10: SFX, ambience, and footsteps

**Files:**
- Modify: `src/application/audio/cue-router.ts`
- Test: `src/application/__tests__/cue-router.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('cue router (SPEC §14)', () => {
  it('fires a footstep per walk contact frame, using the tile material', () => {
    const bus = new FakeAudioBus();
    const router = new CueRouter(bus, content);
    // living room is wood; bathroom is tile (content/home-map.json materials, T3)
    router.onFrame({ pose: 'walk', contact: true, tile: { x: 4, y: 9 } });
    router.onFrame({ pose: 'walk', contact: false, tile: { x: 4, y: 9 } });
    router.onFrame({ pose: 'walk', contact: true, tile: { x: 18, y: 2 } });
    expect(bus.fired()).toEqual(['sfx:footstep.wood', 'sfx:footstep.tile']);
  });

  it('starts an activity loop on start and stops it on completion', () => {
    const bus = new FakeAudioBus();
    const router = new CueRouter(bus, content);
    router.onEvents([{ kind: 'activity-started', activityId: 'shower' }]);
    expect(bus.playing()).toEqual(['loop:shower']);
    router.onEvents([{ kind: 'activity-completed', activityId: 'shower' }]);
    expect(bus.playing()).toEqual([]);
  });

  it('stops an activity loop when the player hits Stop, not just on completion', () => {
    const bus = new FakeAudioBus();
    const router = new CueRouter(bus, content);
    router.onEvents([{ kind: 'activity-started', activityId: 'treadmill' }]);
    router.onEvents([{ kind: 'activity-stopped', activityId: 'treadmill' }]);
    expect(bus.playing()).toEqual([]);
  });

  it('fires each UI cue exactly once per triggering event', () => {
    const bus = new FakeAudioBus();
    const router = new CueRouter(bus, content);
    router.onEvents([
      { kind: 'queue-card-inserted' },
      { kind: 'queue-card-removed' },
      { kind: 'activity-completed', activityId: 'brush' },
      { kind: 'adjacency-granted', pairId: 'it-sticks' },
      { kind: 'urgent-raised', barId: 'hygiene' },
      { kind: 'recap-shown' },
    ]);
    expect(bus.fired()).toEqual([
      'sfx:queue.insert', 'sfx:queue.remove', 'sfx:queue.complete',
      'sfx:adjacency', 'sfx:urgency', 'sfx:recap',
    ]);
  });

  it('is silent while the game is paused', () => {
    const bus = new FakeAudioBus();
    const router = new CueRouter(bus, content);
    router.setPaused(true);
    router.onEvents([{ kind: 'queue-card-inserted' }]);
    expect(bus.fired()).toEqual([]);
  });

  // The bug this prevents: P5 restores a career by replaying pending boundary work, so a
  // reload would replay a day's worth of completions and fire a day's worth of sounds.
  it('is silent for events replayed during hydration', () => {
    const bus = new FakeAudioBus();
    const router = new CueRouter(bus, content);
    router.setHydrating(true);
    router.onEvents([
      { kind: 'activity-completed', activityId: 'meal' },
      { kind: 'adjacency-granted', pairId: 'it-sticks' },
    ]);
    router.setHydrating(false);
    expect(bus.fired()).toEqual([]);
  });

  it('plays room tone continuously and swaps to rain for the rain wrinkle', () => {
    const bus = new FakeAudioBus();
    const router = new CueRouter(bus, content);
    router.onAmbience({ rain: false });
    expect(bus.playing()).toEqual(['ambience:room']);
    router.onAmbience({ rain: true });
    expect(bus.playing()).toEqual(['ambience:room', 'ambience:rain']);
  });

  it('names an activity with no authored loop instead of failing silently', () => {
    const bus = new FakeAudioBus();
    const router = new CueRouter(bus, content);
    router.onEvents([{ kind: 'activity-started', activityId: 'toilet' }]);
    expect(bus.fired()).toEqual([]);
    expect(router.unauthored()).toContain('toilet');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/cue-router.test.ts`
Expected: FAIL — `CueRouter` is not exported.

- [ ] **Step 3: Implement the router**

It consumes the same domain events the save controller already consumes, so no new event
plumbing is added — subscribe alongside it in `boot.ts`. `unauthored()` is how T13 proves
the ~8 activity loops SPEC §14 asks for are all present; until Joe supplies files (Q4) it
reports the full set, and that is the honest state, not a failure.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/application/__tests__/cue-router.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Verify dev hygiene in the browser**

SPEC §14: a dev web build starts muted — confirm. Then close the tab mid-shower and
confirm no audio survives, and open two tabs and confirm the stale one (which P5 parks at
"This life is open elsewhere") also goes silent.

- [ ] **Step 6: Run the wider checks**

Run: `npm run check`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/application/audio/cue-router.ts src/application/__tests__/cue-router.test.ts \
        src/application/boot.ts
git commit -m "feat(P6): footsteps, activity loops, ambience, and UI cues"
```

---

### Task 11: Juice and the world bubble layer

**Files:**
- Create: `src/render/motion.ts`, `src/render/bubbles.ts`
- Modify: `src/render/WorldScene.tsx`, `src/ui/QueueStripCards.tsx`, `src/ui/FirstSessionPanels.tsx`, `src/ui/Hud.tsx`, `src/application/GameScreen.tsx`
- Test: `src/render/__tests__/motion.test.ts`, `src/render/__tests__/bubbles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('motion (design.md §10, SPEC §11.3, §11.6)', () => {
  it('slides and squashes cards over 90 ms', () => {
    expect(MOTION.cardSlide.durationMs).toBe(90);
  });

  it('runs the completion poof for four frames', () => {
    expect(MOTION.poof.frames).toBe(4);
  });

  it('uses gold sparkle only for reward moments', () => {
    expect(MOTION.sparkle.trigger).toBe('reward');
    for (const [name, m] of Object.entries(MOTION)) {
      if (name === 'sparkle') continue;
      expect(m.color).not.toBe(theme.color.gold);
    }
  });

  it('has no screen shake anywhere', () => {
    expect(Object.keys(MOTION)).not.toContain('shake');
  });

  it('reduced motion kills pulses and keeps state changes', () => {
    const reduced = resolveMotion(MOTION.urgentPulse, { reducedMotion: true });
    expect(reduced.durationMs).toBe(0);
    expect(resolveMotion(MOTION.cardSlide, { reducedMotion: true }).endState)
      .toEqual(MOTION.cardSlide.endState);
  });

  it('crossfades the lighting rather than cutting it', () => {
    expect(MOTION.lightingCrossfade.durationMs).toBeGreaterThan(0);
  });

  it('makes the sim glance at the queue when it changes (SPEC §11.3)', () => {
    expect(MOTION.queueGlance.trigger).toBe('queue-changed');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/render/__tests__/motion.test.ts`
Expected: FAIL — `../motion` does not exist.

- [ ] **Step 3: Implement `motion.ts`**

One table of named motions with durations, frame counts, colours, and end states, plus
`resolveMotion(m, {reducedMotion})` that zeroes durations while preserving end state. One
switch, one place — so the P5 reduced-motion setting keeps working and no component grows
its own reduced-motion branch to drift out of sync.

- [ ] **Step 4: Write the failing bubble test (Q5)**

Create `src/render/__tests__/bubbles.test.ts`:

```ts
import { bubbleFor, BUBBLE_PRIORITY } from '../bubbles';
import { content } from '../../sim/content';

const rested = { energy: 90, nutrition: 90, movement: 90, hygiene: 90 };

describe('world bubbles (SPEC §11.1, design.md §8, owner assigned in Q5)', () => {
  it('shows nothing when there is nothing to say', () => {
    expect(bubbleFor({ bars: rested, preferenceReaction: null, warning: null }, content))
      .toBeNull();
  });

  it('raises a need bubble when a bar drops below its alert band', () => {
    const bubble = bubbleFor(
      { bars: { ...rested, hygiene: 30 }, preferenceReaction: null, warning: null },
      content,
    );
    expect(bubble).toEqual({ kind: 'need', barId: 'hygiene', icon: 'hygiene.alert', tint: 'plum' });
  });

  it('uses Energy’s own band, not the default one', () => {
    // §11.1: Energy at 20 by bedtime is designed. The default <40 rule would cry every
    // healthy evening — `bands.ts` already encodes this and the bubble must not disagree.
    expect(bubbleFor({ bars: { ...rested, energy: 20 }, preferenceReaction: null, warning: null }, content))
      .toBeNull();
    expect(bubbleFor({ bars: { ...rested, energy: 10 }, preferenceReaction: null, warning: null }, content)?.kind)
      .toBe('need');
  });

  it('shows exactly one bubble at a time, by priority', () => {
    const bubble = bubbleFor(
      {
        bars: { ...rested, hygiene: 20, nutrition: 25 },
        preferenceReaction: { kind: 'happy', label: 'Proper meals' },
        warning: { kind: 'cap-waste', barId: 'nutrition' },
      },
      content,
    );
    expect(bubble?.kind).toBe(BUBBLE_PRIORITY[0]);
    expect(Array.isArray(bubble)).toBe(false);
  });

  it('ranks need above warning above preference above hint', () => {
    expect(BUBBLE_PRIORITY).toEqual(['need', 'warning', 'preference', 'hint']);
  });

  it('tints happy leaf and grumpy plum, and never red (design.md §8)', () => {
    const happy = bubbleFor({ bars: rested, preferenceReaction: { kind: 'happy', label: 'x' }, warning: null }, content);
    const grumpy = bubbleFor({ bars: rested, preferenceReaction: { kind: 'grumble', label: 'x' }, warning: null }, content);
    expect(happy?.tint).toBe('leaf');
    expect(grumpy?.tint).toBe('plum');
    for (const b of [happy, grumpy]) expect(b?.tint).not.toBe('red');
  });

  it('is derived only from state the engine already publishes', () => {
    // Q5's bound: no new domain state, no new content, no new event. If this signature
    // ever needs a field SimSnapshot does not have, the feature is out of scope.
    const before = JSON.stringify(content);
    bubbleFor({ bars: rested, preferenceReaction: null, warning: null }, content);
    expect(JSON.stringify(content)).toBe(before);
  });
});
```

- [ ] **Step 5: Run it and verify it fails**

Run: `npx jest src/render/__tests__/bubbles.test.ts`
Expected: FAIL — `../bubbles` does not exist.

- [ ] **Step 6: Implement the bubble layer**

`bubbles.ts` is pure selection logic — bars in, at most one bubble out — so the priority
rule is unit-testable without a canvas, the same split `scene-layout.ts` already uses. The
bubble reuses `bandFor()` from `src/ui/bands.ts` so Energy's special band cannot be
re-derived and re-broken here. `WorldScene` draws it as one quad anchored to the
character's head anchor, above the character and below nothing.

The existing `GameScreen.tsx:373` preference bubble is **replaced**, not duplicated — its
accessibility label and `preference-bubble:<kind>` test ID move onto the world bubble so
P5's mounted assertions keep passing and the screen-reader path does not regress.

- [ ] **Step 7: Wire the rest of the juice**

Card slide/squash and poof into `QueueStripCards`, the recap slide into
`FirstSessionPanels`, the sparkle into reward grants, lamp pools and the day/evening
crossfade into `WorldScene`, and the queue glance into the character's facing.

- [ ] **Step 8: Run the tests green**

Run: `npx jest src/render/__tests__/motion.test.ts src/render/__tests__/bubbles.test.ts && npm test`
Expected: PASS, with the P5 mount suites unchanged.

- [ ] **Step 9: Watch it**

Export and observe with reduced motion off, then on: pulses stop, state changes remain,
bubbles still appear. Let one bar fall below its alert band and confirm the bubble reads
at true size in both the day and evening palettes. Record both.

- [ ] **Step 10: Commit**

```bash
git add src/render/motion.ts src/render/bubbles.ts src/render/WorldScene.tsx \
        src/ui/ src/application/GameScreen.tsx src/render/__tests__/
git commit -m "feat(P6): juice, lamp glow, crossfade, and the world bubbles §11.1 asked for"
```

---

### Task 12: Desktop performance

**Files:**
- Create: `src/application/perf-probe.ts`
- Modify: `src/render/WorldScene.tsx`, `src/application/ApplicationRoot.tsx`
- Test: `src/application/__tests__/perf-probe.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { FRAME_BUDGET_MS, summarizeFrames } from '../perf-probe';

describe('frame probe', () => {
  it('uses the 60 fps budget SPEC §18 names', () => {
    expect(FRAME_BUDGET_MS).toBeCloseTo(1000 / 60, 3);
  });

  it('reports p50, p95, worst, and dropped over a sample', () => {
    const deltas = Array.from({ length: 100 }, (_, i) => (i < 95 ? 16 : 40));
    expect(summarizeFrames(deltas)).toEqual({
      samples: 100, p50: 16, p95: 16, worst: 40, dropped: 5,
    });
  });

  it('counts a frame as dropped only when it exceeds the budget', () => {
    expect(summarizeFrames([16.6, 16.7, 16.8]).dropped).toBe(1);
  });

  it('survives hostile deltas rather than poisoning the summary', () => {
    // `advancePhase` carries guards for exactly these because both were observed:
    // a non-finite first-frame delta and a backward timestamp source.
    const s = summarizeFrames([16, Number.NaN, -5, Number.POSITIVE_INFINITY, 16]);
    expect(s.samples).toBe(2);
    expect(Number.isFinite(s.p50)).toBe(true);
    expect(Number.isFinite(s.worst)).toBe(true);
  });

  it('returns an empty summary rather than NaN for no samples', () => {
    expect(summarizeFrames([])).toEqual({ samples: 0, p50: 0, p95: 0, worst: 0, dropped: 0 });
  });

  it('publishes to window only in probe mode', () => {
    expect(shouldProbe(new URLSearchParams(''))).toBe(false);
    expect(shouldProbe(new URLSearchParams('perfProbe=1'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/application/__tests__/perf-probe.test.ts`
Expected: FAIL — `../perf-probe` does not exist.
- [ ] **Step 3: Measure before changing anything.** Export, run the probe at 1366×768 and
      on MacBook Air 13, at 1× and 4×, idle and mid-travel. Record the baseline. *A
      performance task that optimises before measuring cannot prove it helped.*
- [ ] **Step 4: Move the per-frame maths into a Reanimated frame callback.** Publish the
      render view into shared values once per tick; `useFrameCallback` runs interpolation,
      `advancePhase`, and the quad build.

      **State the honest limit in the code comment and the evidence:** on native this
      moves work to the UI thread. On web, Reanimated worklets run on the JS thread —
      there is no second thread to move to — so the measurable web win is fewer per-frame
      allocations and no React involvement, not off-thread execution. Desktop web is the
      v1 gate, so the numbers that count are the measured ones, not the architecture
      claim. `WorldScene.tsx:53` already carries a correction of exactly this kind of
      overclaim; do not add a new one.
- [ ] **Step 5: Re-measure** in the same conditions and record before/after.
- [ ] **Step 6: Meet the bar or report the gap.** SPEC §18 wants 60 fps on MBA-13 web and
      1366×768. If p95 misses after the worklet move, profile the actual cost (atlas
      buffer churn, tile quad rebuild at the lighting boundary, HUD re-render rate) and
      fix the largest term. If it still misses, record the exact number as a NOT MET
      result — do not soften the DoD.
- [ ] **Step 7: Commit** — `perf(P6): frame-callback interpolation, with measurements`

---

### Task 13: Ship pass, bill gate, and evidence

- [ ] **Step 1: Write the bill-of-materials gate**

Create `scripts/__tests__/atlas-bill.test.ts` — the single test that makes "no
placeholders" mechanical rather than asserted:

```ts
describe('v1 bill of materials (design.md §11, SPEC §18)', () => {
  it('contains no debug or placeholder sprites', () => {
    for (const name of Object.keys(atlasIndex.sprites)) {
      expect(name).not.toMatch(/^debug\./);
      expect(name).not.toMatch(/placeholder/i);
    }
  });

  it('draws every object, pose, appearance, decoration, and icon the game can reach', () => {
    for (const o of content.objects.objects) expect(atlasIndex.sprites[`object.${o.id}`]).toBeDefined();
    for (const a of content.activities.activities) {
      if (a.pose !== 'stand') expect(atlasIndex.poses[a.pose]).toBeGreaterThan(0);
    }
    for (const p of content.identity.appearancePresets) {
      expect(atlasIndex.sprites[`char.${p.paletteId}.stand-down-0`]).toBeDefined();
    }
    for (const id of Object.keys(DECORATION_PLACEMENTS)) {
      expect(atlasIndex.sprites[DECORATION_PLACEMENTS[id]!.sprite]).toBeDefined();
    }
  });

  it('has a file on disk for every declared audio asset', () => {
    // content/audio.json names ids; this asserts the actual files exist, because a bus
    // that reports missing assets gracefully (T8) is exactly why a missing file would
    // otherwise ship silently.
    for (const id of declaredAudioAssetIds(content.audio)) {
      expect(existsSync(resolve(__dirname, `../../assets/audio/${id}.m4a`))).toBe(true);
    }
  });

  it('leaves no unclosed P6 deferral in the render, ui, or audio rings', () => {
    // The repo's own convention: a deferral is written as a comment naming its owner.
    // Every one naming P6 is this phase's, so none may survive it.
    const offenders: string[] = [];
    for (const dir of ['src/render', 'src/ui', 'src/application/audio', 'scripts/art']) {
      for (const file of walkSourceFiles(dir)) {
        const text = readFileSync(file, 'utf8');
        for (const [i, line] of text.split('\n').entries()) {
          if (/\bP6\b/.test(line) || /\bplaceholder\b/i.test(line)) {
            offenders.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

`declaredAudioAssetIds` flattens every id in `content/audio.json` — music beds, riff
layers, ambience, footsteps, activity loops, and UI cues — and is exported from
`src/application/audio/cue-router.ts` so T8's `missingAssets()` and this gate read one
list. `walkSourceFiles` is a five-line recursive `readdirSync` filter for `.ts`/`.tsx`,
local to this test file.

Expect this test to fail loudly the first time. That is its job: each hit is a real
comment that named P6 as owner (`build-atlas.ts:29` and `:190`, `scene-layout.ts:118` and
`:151`, `WorldScene.tsx:53`, `render-view.ts:29`, `audio-bus.ts:10`), and closing the
deferral means deleting the comment along with the thing it was apologising for.

Add `"art:bill": "jest --runTestsByPath scripts/__tests__/atlas-bill.test.ts"` and fold
it into `verify`.

- [ ] **Step 2: Run it and fix what it finds.** Remove `debug.interact` from
      `build-atlas.ts` and every "until P6" comment whose deferral this phase closed.
- [ ] **Step 3: Re-run both goldens.** Unattended seven-day golden and the scripted-player
      replay must be **byte-identical** — canonical digest still
      `141101f2b3b8b6a81c990b886c44e0fe6e03f7e2b67eb0a35f50034af6c3324e`, `ENGINE_VERSION`
      still 8. P6 is presentation; if a digest moved, presentation leaked into the domain.
- [ ] **Step 4: Walk SPEC §18's technical list** — harness + both goldens green; all §7.4
      interactions via mouse, touch, and keyboard; save/resume mid-activity; pause-on-close;
      §11.5 scaling verified on MBA-13 and 1366×768; 60 fps; audio mixes with working
      sliders. Record each with its command or observation.
- [ ] **Step 5: Walk design.md §12's checklist per asset class** — palette, one ramp per
      shape, outline role, silhouette in flat Ink, gold/red discipline, layered character
      with keyed anchors, on-grid with no AA, "simple enough", and **reads at true size in
      the evening palette**. The last one is the easiest to skip and the one the evening
      tile set makes newly relevant.
- [ ] **Step 6: Full verify + export.** Record suite/test counts, atlas census (against
      T0's `512×162, 33 sprites, 29 colours`), app bundle SHA-256, and `dist/` manifest.
- [ ] **Step 7: Freeze the build and run P4.5 — as a first run, not a re-run**

Under Q1's ruling this is the sole fun gate's only execution, so it is the full protocol,
not master §5's lighter "re-run playtest criteria pass":

- fill P4.5 protocol §1's build table from this build — app bundle SHA-256, `dist/`
  manifest SHA-256, seed via `?playtestSeed=`, starting state, `ENGINE_VERSION`, exact
  Chrome version, and the frozen viewport;
- confirm `?playtestSeed=<uint32>` still reproduces an identical starting career twice
  through the real Pause → New Game → Yes, start over → Randomize path (P5 T14 found this
  broken once — production New Game used browser crypto, so three testers could not share
  a seed; re-prove it rather than assume it survived P6);
- Joe runs the diagnostic session, then **at least three fresh people who have not played,
  watched, or been told about the game, and are not Joe**, under master §6's controls;
- judge against master §6's six conditions verbatim. No partial pass.

**If it fails,** master §6's loop applies unchanged: classify the failure, change the
smallest implicated P2–P4 behaviour, re-freeze, and re-run with fresh testers. Note the
exposure §2 Q1 accepted — a mechanics retune now lands beneath finished art. DoR row 5 is
what limits the damage: `ENGINE_VERSION` is still 8 and both goldens are byte-identical,
so the retune happens in `sim/`, `game/`, and `content/`, and the art does not have to be
re-authored to survive it.

**P6 does not exit until P4.5 passes.**
- [ ] **Step 8: Complete `evidence/P6.md`** — every command and result, browser/version/
      viewport, screenshots with hashes, before/after frame times, the Q1 ruling, honest
      NOT VERIFIED limits (physical iPhone stays v1.1; remote CI and deployment remain
      unproven locally), and the exit verdict.
- [ ] **Step 9: Commit** — `feat(P6): ship pass — bill gate, DoD walk, and P6 evidence`

---

## 6. Required edge-case matrix

| Area | Cases that must be explicit |
|---|---|
| Objects | every footprint size; multi-tile; `blocksMovement: false` (rug); objects with no activities (counter, tv, wardrobe); active state during Stop; two objects adjacent on screen |
| Tiles | boundary minute 18:59/19:00; midnight wrap; 05:59/06:00; sleep-skip crossing the boundary; a run started in evening and reloaded in day |
| Character | every pose; every facing; droop at each energy band edge; pose during travel; pose on the completion tick; unknown pose (must throw at build, never silently fall back); slim derivation on every new frame |
| Appearance | all four presets; migrated career with an unknown `paletteId`; the synthetic neutral chronotype fixture P5 T3 found; preset change is impossible mid-career (identity is creation-only) |
| Decorations | none granted; all six granted; granted then reloaded; a decoration whose placement tile is occupied |
| Font | font load failure (must fall back visibly, not silently); 200% text scaling; HUD height at both scales; long strings in the pixel face |
| Audio | every slider at 0 and 1; mute during playback; unmute restoring the mix; missing asset; tab hidden; tab closed mid-loop; two tabs (P5 parks the stale one — audio must stop there too); playback during hydration replay; paused game |
| Juice | reduced motion on/off; motion during pause; a reward and a completion in the same tick; crossfade interrupted by sleep-skip |
| Bubbles | none due; two needs at once; a need and a warning at once; Energy at 20 (must be silent) and at 10 (must speak); bubble while asleep; bubble while travelling; bubble in the evening palette; screen-reader announcement preserved from P5 |
| Perf | 1× and 4×; idle, travelling, and mid-activity; panel open over live ticks; the lighting boundary; a long GC pause (probe must report, not crash) |
| Regression | both goldens byte-identical; `ENGINE_VERSION` still 8; full P4 interaction matrix; full P5 flow matrix; `scale.ts` ↔ SPEC §11.5 agreement |

---

## 7. Deliberately not P6

- Physical iPhone acceptance, portrait, and fractional-scale mobile visual acceptance →
  **v1.1 mobile pass** (master §9: desktop web is the v1 gate; P6 must not restore iPhone).
- v2–v6 art (venues, park, crowds, upgrade tiers, partner portraits, the full paper-doll
  editor) → their versions, per design.md §11.
- The buff and slim *shipped* body layers → v4 and v6. P6 authors average only; `deriveSlim`
  stays proven and exercised by the A0 sheet, as A0 accepted.
- design.md §11's "~10 decorations" against the 6 the game can actually grant: **P6 authors
  the 6 that are reachable.** Four unreachable sprites would be placeholder art by another
  name. Recorded as a deliberate bill variance with **v2** as owner (v2 adds shop and
  reward decorations that need them).
- AI-generated assets → not used (Q3), route stays documented.
- Remote CI and deployment → unchanged; all P6 evidence is local, stated as such.
- If audio is cut at the §17 cut line, the honest reduced set is **music bed + mute +
  sliders wired**, with ambience, footsteps, activity loops, and UI cues → **v1.1**. The
  sliders and `M` binding P5 shipped must control something real either way.

---

## 8. P6 completion definition

P6 is complete only when:

1. Q1's order ruling and Q5's ownership assignment for SPEC §11.1's world bubbles are both
   written into the master plan, not only into this document;
2. Gate A produced a build in which Joe can name every object unaided, and **P4.5 has been
   run in full on the final build and passed all six of master §6's unchanged conditions
   with at least three fresh external testers** — under Q1's ruling this is the fun gate's
   only execution, so P6 cannot exit without it;
3. the bill gate is green: no debug sprite, no placeholder comment, and an authored asset
   for every object, pose, appearance, decoration, icon, and audio cue the game can reach;
4. both goldens are byte-identical and `ENGINE_VERSION` is still 8;
5. measured desktop frame times are recorded for MBA-13 and 1366×768, and either meet
   60 fps or are recorded as a named NOT MET result;
6. audio mixes with working sliders and a persisted mute, with no orphaned audio after
   tab close;
7. SPEC §18's technical and game lists are walked with evidence per line;
8. `docs/superpowers/evidence/P6.md` records commands, hashes, observations, screenshots,
   the Q1 ruling, and every honest limit.
