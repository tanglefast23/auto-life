# Auto Life — design.md (the binding art bible) · v2

**Every asset — generated, drawn, or licensed — must pass §12's checklist before it enters the game.** This file is canon for how everything *looks*; SPEC.md §11 owns layout/interaction; Joe's global rules (60-30-10, ≤4 font sizes, 2 weights, 8-pt grid, tabular numerals) apply everywhere and win ties.

**v2 direction change (Joe, 2026-07-29):** the AI-generated week-plan concept image (`output/imagegen/…`) is **rejected as art direction** — its detailed-illustration look is explicitly not this game. Auto Life uses **simple, chunky pixel art in Hero Football Manager's style**: bright, flat, hand-built, readable. Mystia's Izakaya (`~/.claude/design-library/mystias-izakaya.md`) is demoted to a *mood and UI-layout reference* (warm home feeling; the bottom card-dock idea) — not a rendering target. HFM's pixel bible is the rendering lineage.

---

## 1. The look, in one paragraph

Simple and chunky. Flat color fields from a locked warm palette, thick readable shapes, a big-headed chibi person you can parse from across the room, one cozy room-screen at a time. No texture noise, no ornament, no gradients — warmth comes from the palette and the lighting states, not from detail. **Every UI element is a fat, flat, obviously-tappable card or button** in the HFM manner. When in doubt: fewer pixels, bolder silhouette.

## 2. Master palette (indexed, locked — core 31 + character-only 26 = 57)

Author all art as indexed PNG against this palette. **No one-off colors, ever.** Extend a ramp only by editing this file first. World scenes and UI use the **core 31**; skin/hair swap sets are character-layer-only.

### Neutrals (4)

| Name | Hex | Use |
|---|---|---|
| Ink | `#2e2119` | text, UI outlines, darkest structure — **never pure black** |
| Cream light | `#faf1dc` | card highlights |
| Cream base | `#f2e4c2` | UI surfaces — the 60% canvas |
| Cream shadow | `#d9c493` | card lips, edge ticks |

### World ramps (6 × 3 = 18) — shadow / base / light; pick a ramp, use its 3 steps + Ink

| Ramp | Shadow | Base | Light | Owns |
|---|---|---|---|---|
| Wood | `#5d3a1e` | `#8a5a30` | `#b07c46` | floors, furniture, guitar |
| Grey | `#6f6a75` | `#9a95a2` | `#c8c4cd` | appliances, metal, treadmill |
| Dusk plum | `#4a3550` | `#6b4f74` | `#9678a0` | night states, bedding, **Energy** |
| Leaf green | `#3f7a44` | `#5ca860` | `#98d194` | plants, park, **Nutrition** |
| Water blue | `#3a6d94` | `#5b95c0` | `#a8d0e8` | shower, sink, **Hygiene** |
| Terracotta | `#8a4a2e` | `#bc6b42` | `#e09a6e` | rugs, pots, **Movement** |

### Meaning ramps (3 × 3 = 9) — reserved; strong colors carry meaning only

| Ramp | Shadow | Base | Light | Reserved for |
|---|---|---|---|---|
| Lantern gold | `#c07f28` | `#f0a840` | `#ffd27a` | light sources + **reward moments only** (Practice/level-ups, goals, GP/coins). Never generic emphasis. |
| Izakaya red | `#962e20` | `#c8402e` | `#e8705a` | **URGENT**, destructive confirms. Nothing decorative is ever red. |
| Rose | `#a34a5e` | `#d4708a` | `#f0a8bc` | **Connection bar (SPEC C11), Love meter & romance chrome (v5)** |

### Character-only swaps (26)

Six skin ramps — the §12 validator admits exactly these 18:
`#cf9268/#eab48c/#f7d7ba` · `#c08058/#e0a276/#f2c79e` · `#a06844/#c08a5c/#e0b184` · `#7c4c34/#9c6a48/#c08a62` · `#6b4030/#8a5a42/#a87858` · `#4c2e22/#664234/#845844`

Eight hair sets (8 net-new hexes; the rest reuse ramps): **Black** `#2e2119/#4a3d33/#665648` · **Brown** = Wood · **Auburn** `#8a3c28/#b85a38/#d98a5e` · **Blonde** `#b08a3a/#d9b05c/#f0d494` · **Rose** = Rose · **Plum** = Dusk plum · **Blue** = Water blue · **Green** = Leaf green.

Soft skin outline = that ramp's shadow, never Ink.

**Per-shape rule:** one ramp + Ink + at most one neutral (contact shadow). A bar, a sprite, a card — same law.

## 3. Two tracks, never mixed (HFM's rule, inherited)

- **Track A — UI chrome** (buttons, cards, panels, chips): the **HFM chunky recipe** — thick Ink outline, rounded chunky corners, bold two-tone face (Cream light top, Cream shadow lip), pixel-font label. Fat, flat, unmistakably pressable. No ornament, no parchment texture, no corner flourishes — the v1 doc's decorative language is retired with the art pivot.
- **Track B — world & characters**: soft **colored** outlines (the fill's ramp-shadow, never Ink), flat fills with the 3-step ramp for form, chunky silhouettes, personality over accuracy.
- A face is never outlined like a button; a button is never shaded like a sprite.

## 4. Typography

- **Silkscreen Bold** (HFM's house pixel face) — labels, headings, buttons, numerals; `tabular-nums` always; integer sizes; never anti-aliased at 1×.
- **Readable sans** for anything longer than a sentence (storylets, letters, settings copy).
- ≤4 sizes, 2 weights; text always sits on a Track-A surface.

## 5. Grid, scale, resolution

- World: 32×32 tiles; rooms 24×14 single screens. Character 32×48 (~2-head chibi).
- Scaling per SPEC §11.5: integer/DPR-half-steps on desktop; sharp-bilinear fractional on phones (v1.1). Author at 1× only.
- UI: 8-pt grid; hit targets ≥44 px; UI floats over the world, not snapped to its grid.

## 6. Character construction (the v6 bet — binding since sprite #1)

Layer stack in the Skia Atlas: **base body → face → hair → outfit → accessory**, plus per-frame **anchor points** (head, hands) every overlay keys to.

- 3 body builds eventually (slim/average/buff — buff arrives v4); v1 ships average only, anchor spec ships day one. **Slim is generated from average via documented per-frame offsets, never redrawn.**
- Skin/hair recolors are palette-index swaps — zero redrawn frames.
- Proportions: big head (≈45% height), dot mouth, large eyes, mitten hands. Emotion lives in eyes/brows + bubbles.
- Loops are 2–4 frames. **v1 bill ≈ 48 frames** (round-2 recount): walk×4dir (16) · sleep (2) · sit (2) · eat (2) · brush (2) · shower (2 + steam overlay) · lift (3) · run (4) · stretch (2) · practice (3) · idle (2) · toilet (1) · quick-wash (1) · nap (2) · preference idle variants (4).
- **Silhouette-first test:** every frame must read in flat Ink at zoom-out. If it needs color to parse, redraw it.
- **Authoring pipeline: HFM's SVG-authored route is primary** — sprites drawn as simple SVG shapes on the palette, rendered to indexed PNG (this is how HFM built its whole roster, and it is the most controllable route to "simple"). AI generation is the secondary route and must survive quantize + §12 unchanged.

## 7. World & objects

- **Silhouette stability across upgrade tiers** (v4): a bed L1→L3 keeps footprint and outline; materials improve within the ramp.
- Objects declare footprint + interact-point + facing; active states 1–2 frames.
- **Lighting is palette states, not shaders:** day tiles (cream-bright) and evening tiles (plum-dim + gold pools) as swapped tile sets; the 19:00 crossfade is the coziest beat of the day.
- Decorations have slots per room; each is one 1-tile sprite + a journal line.

## 8. UI component recipes

| Component | Recipe |
|---|---|
| Health/sub-bars | Track-A troughs; fill = the bar's ramp base; 40–69 Cream-shadow edge tick; <40 red edge pulse **and** alert-glyph icon swap (non-color signal). Energy bands per SPEC §11.1. |
| Queue cards | Flat chunky cards in the bottom dock (the Mystia dock *layout*, HFM *rendering*). Current: 64 px + radial progress. AUTO gear glyph · PINNED pin glyph · URGENT red pulse. Predicted start time at card foot. Anchor blocks: one expandable card (`Morning routine ▸ ×4`). |
| Chips | Rounded tag chips: adjacency (gold only while granting), preferences (wood), warnings (red ⚠), routine-reward label (SPEC §6.7 honesty rule). |
| Buttons | HFM chunky lozenge; cream = neutral, red = destructive, gold = reward-claim only. |
| Panels (shop, contacts, journal, Week Plan, settings) | Full-height cream panel over a plum-dimmed room; item grid + detail pane. |
| Event cards (letters, level-ups, endings) | Oversized Track-A card with a sprite vignette; one gold accent mark iff it's a reward moment — the sole sanctioned decoration in the game; slide+squash entry. |
| Bubbles | Cream rounds, 12-px icons, Ink tail; grumpy = plum tint, happy = leaf tint — never red. |
| Recap/journal | Morning card + journal entries in readable sans on cream rules. |

## 9. Per-bar identity (12-px icons, redrawn per state)

Energy = moon (alert: drooping) · Nutrition = fork (alert: empty bowl) · Movement = shoe (alert: stiff boot) · Hygiene = droplet (alert: squiggle). Practice = guitar pick, gold. Funds = coin. Connection (SPEC C11) = two dots holding hands, Rose fill; battery = face icon, 5 shapes. Love (v5) = heart outline, **Rose — never izakaya red**.

## 10. Motion & juice

Card slide+squash (90 ms), completion poof (4 f), gold sparkle strictly for rewards, no screen shake, reduced-motion kills pulses but keeps state changes. Walk/act tempo tracks `m_speed` — tiredness is an animation state (droop frames), not a filter.

## 11. Per-version art scope (bill of materials)

| Version | Net-new art |
|---|---|
| v1 | Home tileset (day/evening) · ~16 objects (+guitar, rug) · character layer set (~48 frames, §6) · 4 identity presets (palette swaps) · ~10 decorations · full UI chrome kit · icon set · bubbles |
| v2 | 5 venue backdrops · per-venue lighting tile variants · crowd set (6 bodies × swaps, 2 f loops) · 2 guitars + case · commute vignette · shop chrome · Week Plan panel chrome · job-HUD GP-meter chrome · rain overlay · coin/GP icons |
| v3 | Park scene · café table set · picnic props · 3 friend chibis (layered) + 2 emotes each · phone/contacts chrome · battery faces (C11) · invitation card back |
| v4 | Community-center scene · 12 upgrade sprites (6 objects × 2 tiers, silhouette-stable) · buff body layer · 5 plated-food sprites · meal-prep containers · membership card chrome · hobby progress pips · 2 instructor chibis |
| v5 | 4 candidate chibis + **portraits** (layer-composed, portrait recipe below) · restaurant scene · wedding dressing · nursery set + baby (3 poses/states — not an aging system) · ring/gift icons · household-queue chrome · gallery frames |
| v6 | slim body layer (offset-derived, §6) · 10 hair × 8 swaps · 9 face options · 6 accessories · 12 outfit overlay sets · mirror scene chrome |

**Portrait recipe** (v5/v6): portraits recompose the same layer stack at 2× head scale, same palette, soft-outline rule — never freehand-generated per character.

**A0 art-risk spike** (SPEC §17): walk 4-dir + one seated activity + hair layer + outfit on average *and* offset-derived slim — validates §6 before anything depends on it.

## 12. The asset checklist (binding — every asset passes or it doesn't ship)

Pipeline: 1) author as SVG shapes on the palette (primary) or AI-generate (secondary) → 2) render/quantize to indexed palette → 3) hand-clean on the 32-px grid → 4) run `scripts/art/validate-palette.ts` (CI: every pixel ∈ §2; every world outline ∈ its ramp-shadow or approved skin outline) → 5) checklist:

- [ ] Only §2 palette indices (validator green)
- [ ] One ramp + Ink + ≤1 neutral per shape
- [ ] Outline: colored ramp-shadow (world) / Ink (UI) — never pure black, never mixed
- [ ] Silhouette reads in flat Ink
- [ ] Gold only for light sources or reward moments; Red only for URGENT/destructive
- [ ] Character art: layers separated, anchors keyed, swaps index-based
- [ ] Upgrade tiers: silhouette matches prior tier
- [ ] On-grid at 1×, no anti-aliasing, no gradients, no soft shadows
- [ ] **Simple enough:** if HFM wouldn't draw this much detail, neither do we
- [ ] Reads at true size in the evening palette, not just zoomed daylight

## 13. Anti-patterns (instant rejection)

Pure black or white anywhere · gradients, glows, drop shadows · hues outside §2 · gold on a settings button · red as decoration or mood · button-shaded sprites / sprite-shaded buttons · anti-aliased pixel type · UI text floating on the world · silhouette drift across tiers · freehand portraits · screen shake · **illustration-grade detail (the rejected concept image is the canonical counterexample)** · ornament for its own sake.
