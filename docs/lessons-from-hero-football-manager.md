# Lessons from Hero Football Manager — binding rules for Auto Life

> **Source:** a read-only review of 569 commits across the Hero Football Manager
> repository, its current code, and its design docs, handed over 2026-07-31. HFM shares
> this project's stack (Expo · react-native-web · Skia Atlas · Reanimated · pure
> TypeScript sim core) and its art direction, so its repeated mistakes are this
> project's most likely repeated mistakes.
>
> **Status: binding.** SPEC §16 references this file. Rules below marked **[GATED]** have
> an automated check in this repository; the rest are review obligations. A phase plan
> that touches one of these areas must say which rule it is honouring and how.

The handover's own summary of the verdict: *keep the stack and art direction; do not copy
the implementation without its hard-won guardrails.* The pure simulation architecture held
up well. Almost every repeated mistake happened where React Native, Skia, artwork, audio,
and interaction feel meet.

---

## 1. Stack

### 1.1 The pure core is the thing that worked — protect it [GATED]

Keeping `sim/` and `game/` free of React Native, Expo, and Skia meant visual and
performance fixes shipped without changing match results or replays. Seeded randomness,
fixed ticks, replay envelopes, engine versions, and golden tests are what made that true.

*Auto Life status:* held since P1. `ENGINE_VERSION`, five serializable PRNG streams, the
unattended golden and the scripted-player golden all exist. **Every phase must re-prove
byte-identical goldens rather than assume them.**

### 1.2 Put every Skia sharp edge behind one shared renderer layer [GATED, partial]

HFM hit invisible sprites from cross-context GPU textures, blurred sprites from default
sampling, fractional-pixel shimmer, and expensive atlas rebuilding. The required
guardrails:

| Guardrail | Auto Life status |
|---|---|
| `makeNonTextureImage()` for offscreen snapshots | not applicable yet — no offscreen snapshot path exists. **Required the moment one is added.** |
| Atlas batching only, never one component per sprite | held since P3 (master §9) |
| Nearest-neighbour sampling, no mipmaps | held — `WorldScene.tsx` pins `FilterMode.Nearest` |
| Integer magnification and rounded screen positions | held — `scale.ts` searches integer physical-pixels-per-art-pixel; `snapToPhysicalPixel` rounds animated coordinates |
| Bounded caches with an explicit image-lifetime and disposal policy | **NOT held.** Auto Life has one committed atlas and no cache, which is why it has not bitten yet. Any future runtime-generated image needs the policy *before* it ships. |
| Animation updates on the UI worklet | partial — paint is off the React path; per-frame maths moved to a frame callback in P6 T12 |

**The sampling rule is enforced by scanning every use site, not by maintaining a list.**
HFM's `pixel-art-sampling` test is the pattern: a list of screens is something a new screen
can escape.

### 1.3 Web, simulator, and physical device are separate acceptance surfaces

HFM shipped a facility grid that rendered on web and was invisible and untappable on
native iOS because of a NativeWind/Pressable style difference. A green web export never
clears native layout, font scaling, gestures, audio lifecycle, or frame pacing.

*Auto Life status:* SPEC §18 already makes desktop web the v1 gate and moves iPhone to the
v1.1 mobile pass. **The rule this adds: v1.1 may not treat the web result as evidence.**

### 1.4 Do not block the whole app on CanvasKit

HFM's `index.web.ts` gates the entire app on the Skia loader. Ordinary UI should mount
immediately and Skia screens should lazy-load.

*Auto Life status:* **the same pattern is present** in this repo's `index.web.ts`. It was
deliberate in P0 — a Skia `Canvas` rendered before CanvasKit is a silent blank, which was
the exact failure P0's kill-gate existed to catch — but the cost is that the title screen,
identity screen, and settings all wait on a CanvasKit download they do not need. Hardened
in P6 T0A: the loader gates only the world renderer, and the shell mounts first.

### 1.5 Profile before redesigning performance architecture

HFM's 3× jumping looked like excessive React work; measurement found interpolation
retargeting was the real fix and the proposed large React refactor was unnecessary.

*Auto Life status:* P6 T12 measures a baseline **before** changing anything, and records
before/after. Keep that order in every later performance pass.

---

## 2. Artwork

### 2.1 Prove the native sprite size before generating the cast

HFM began with 16×20 players and redrew every one as 24×30 two days later. Make a handful
of deliberately difficult subjects first, test them at 1× on the real target viewports, and
lock cell size, proportions, outline, feet, expressions, and on-screen footprint before
generating hundreds.

*Auto Life status:* A0 did exactly this for the character (32×48 locked, layer/anchor/offset
strategy proven before P3 depended on it). **P6 extends it to objects:** T2 authors and
reviews the object set at true size *before* T4 spends the 48-frame character bill, so a
silhouette rethink cannot cascade into a preset re-bake.

### 2.2 Generators are the source of truth [GATED]

Sprites, portraits, expressions, and contact sheets are generated from authored manifests.
Emitted JSON is never hand-edited. Every bulk change must be reproducible and idempotent.

*Auto Life status:* held. `assets/generated/atlas.png` and `atlas-index.json` are emitted by
`scripts/art/build-atlas.ts`, and `npm run art:check` fails if the committed output differs
from a fresh build.

### 2.3 Turn the pixel bible into tests [GATED]

Written rules drift. `design.md` §12's checklist is mechanically enforceable in part, and
the enforceable part must be enforced: palette membership, forbidden extremes, outline
role, silhouette distinctness, and bill completeness.

*Auto Life status:* palette membership and forbidden extremes since A0; outline role,
boxiness, silhouette distinctness, and the bill gate added in P6.

### 2.4 Inspect worst cases, not the average sprite

HFM's first automated hair recolour missed the densest hair-over-face designs because its
heuristic mistook hair for skin — and its test repeated the same faulty assumption, so the
test passed. A corrective commit followed minutes later.

**The rule: an automated art transform is reviewed against a named worst-case set, and the
test must not share the transform's assumption.** For Auto Life the worst cases are the
offset-derived slim build (3px limbs, mitten hands), the darkest skin ramp against Ink
detail, the profile facings, and every sprite read in the *evening* palette rather than
zoomed daylight.

### 2.5 Typography is part of the renderer

React Native does not inherit `fontFamily` through a `View`. Almost half of HFM's UI text
and its entire match HUD silently fell back to system fonts before dedicated fixes.

**Rules:** ship shared display/data/body text components rather than styling `Text` ad hoc;
audit the font's actual glyph coverage before relying on a character; and **never apply
synthetic bold to a one-weight bitmap font** — ship the real bold face.

*Auto Life status:* every `Text` in this repo already carries an explicit `fontFamily`.
P6 T7 keeps that property and **scans every use site** rather than trusting a root style.

---

## 3. Feel

### 3.1 Feedback is semantic, never a component default

Every action declares what it is: navigation, confirmation, warning, refusal, reward, or
destructive. Cancel and back must not inherit celebration audio. A blocked control explains
why. A disabled control is genuinely disabled.

### 3.2 One completed action owns exactly one sound [GATED]

HFM saw doubled clicks, missing clicks, sounds fired from inside React state updaters, and
a heavy click substituted for the intended light tap. Preserve the sound's character,
inspect its attack and waveform, bake loudness into the asset when runtime volume is
capped, and test "one press, one sound" across touch, mouse, keyboard, and synthetic
activation.

*Auto Life status:* enforced in P6 by the cue router's per-event tests and by its silence
during pause and during hydration replay.

### 3.3 Design the audio lifecycle on day one [GATED]

Test mute, background, foreground, reload, teardown, interrupted initialization, and
platform audio-session death for every audio bank. HFM needed recovery logic across four
separate banks after the fact.

*Auto Life status:* P5 built the control truth and persistence before any sound existed;
P6 adds the real mixer plus browser-autoplay unlock, `pagehide` teardown, and stale-tab
silence.

### 3.4 Every drag interaction needs a non-drag path

HFM's substitution board looked like buttons but required dragging, excluding phone
scrolling, keyboard users, and screen readers. Tap-select/tap-target is the baseline; drag
is an optional pointer enhancement.

*Auto Life status:* held — SPEC §11.2 and §11.6 require card menus at full parity with
dragging, and P4 shipped them.

### 3.5 Test complete sequences, not resting screenshots

HFM's title heroes were fixed once for their resting position, then needed a second fix for
clipping and z-order *while entering*. Check every important visual at entry, midpoint,
resting state, exit, with Reduce Motion, and at every supported viewport.

*Auto Life status:* P6 T11 observes juice at entry and exit, not only at rest, and repeats
the pass with reduced motion on.

---

## 4. The shape of a safe first milestone

The handover's closing judgement, kept because it generalises to every phase:

> The best first milestone is not "build several screens." It is one real screen, six
> final-quality sprites, one animation, real audio, touch/mouse/keyboard support,
> background recovery, and actual web plus physical-device acceptance. Once that
> foundation passes, scaling up becomes much safer.

Auto Life arrived at the same shape from the other direction — A0 before P3, the P4 minimum
first-session slice before P4.5 — which is the strongest available evidence that the phase
structure is sound. **The corollary is the part to keep honest: depth before breadth, and
acceptance on the real surface before the next layer is built on top.**
