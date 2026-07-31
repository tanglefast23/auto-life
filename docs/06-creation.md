# v6 — "You" (expanded customization)

**Fantasy:** the little person is *yours*, top to bottom — and always was. v6 is *expanded* customization: identity basics (name, pronouns, presets, preferences) shipped in v1 §9.1; v6 opens the whole wardrobe.
**Depends on:** the layered paper-doll discipline and F82-derived broad-head/expression anchors held since the v1 fidelity correction (design.md §6). If those structural rules are kept, v6 is cheap; customization may swap identity features but may never shrink the emotional face back into a generic dot-face rectangle.

---

## 1. The editor

Framed in-world: the sim stands at the bedroom mirror (new-game entry and revisitable anytime — people change).

| Layer | Options | Source |
|---|---|---|
| Body | 3 builds (slim / average / buff — **buff stays greyed out until Gym L3 has been reached once in this save**, preserving v4's Transformation reveal; slim is offset-derived from average per design.md §6, never redrawn) | base layer |
| Skin | 6 ramp swaps (design.md skin ramps — palette-indexed, zero redraw) | palette |
| Hair | 10 styles × 8 colors | hair layer |
| Face | 5 eye sets, 4 extras (freckles, glasses…) | face layer |
| Outfit | per wardrobe tier owned (v4): 4 / 8 / 12 fits | outfit layer |
| Accessory | 6 (headphones, cap, scarf…) | accessory layer |

- Live preview on the actual in-world doll (not a mockup — the same Atlas layers).
- **Randomize die** + "surprise me" full-random.
- Identity: name · pronouns · chronotype/personality re-pick · **preference tags chosen** (2 picks replace the v1 roll) · dating-pool preferences (feeds v5's pool filter) · starting aspiration pick (v5 gallery hook).

## 2. New game & existing saves

- New game: editor replaces the 4-preset identity-lite (presets remain as quick-picks in the editor's first row).
- Existing save: mirror unlocks the full editor free once ("new haircut energy" storylet); after that, outfit/hair changes are free, body/identity changes always free but journal-noted (the game remembers who you've been — gently, never punitively).

## 3. Systems honesty

v6 adds one mechanic: **NG+** [DECIDED round 2 — promoted from parked]. Framing an aspiration ending (docs/05 §5) offers a fresh life that carries the endings gallery, the journal archive, and one chosen keepsake decoration. Endings that don't end don't land — with aging out of scope, the gallery is the game's only shape, and NG+ is what makes a single save slot a replay loop. Otherwise v6 is pure expression + pool filtering, shipping **bundled with or immediately after v5**.

## 4. UI/UX

Mirror scene chrome per design.md event-card recipe · category tabs with sprite-thumb grids (no text walls) · compare toggle (before/after) · all controls keyboard/touch complete (same a11y bar as the queue).

## 5. Art scope — the layer-matrix bill

The combinatorics are palette-and-layer math, not sprite explosions (design.md is binding):

- Every animation frame exists once per **body build** (3×), not per appearance: ~48 v1 frames (design.md §6 canonical) + later-version frames × 3 builds.
- Hair/face/accessory are overlay layers keyed to head position per frame (design.md anchor-point spec).
- Skin/hair colors are **palette-index swaps** — zero additional frames.
- Outfits: 12 overlay sets keyed to the body frames.
- Portraits (v5) recompose from the same layer recipe at portrait scale.

The expensive number is 3 builds × frame set — which is why "buff" already exists from v4 and slim/average share most frames with offset tweaks. Estimated net-new art: hair 10 + face 9 + accessories 6 + outfits 12 overlay sets + mirror scene.

## 6. Harness / QA

Layer combinatorial snapshot test: every (build × outfit × hair) renders without clipping at all 4 facings (automated golden-image grid) · palette-swap integrity: no swap escapes its ramp (design.md validator) · editor round-trip: save → load → identical composition.

## 7. Open questions

Q1: ship v6 with v5 (creation sells the dating fantasy) or after (breathing room)? Recommend with-or-immediately-after v5. Q2: ~~NG+~~ — decided in §3 (round 2). Q3: seasonal outfit drops as post-launch content cadence?
