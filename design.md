# Auto Life — design.md (the binding art bible) · v3

**Every asset — generated, drawn, or licensed — must pass §12's checklist before it enters the game.** This file is canon for how everything *looks*; SPEC.md §11 owns layout/interaction; Joe's global rules (60-30-10, ≤4 font sizes, 2 weights, 8-pt grid, tabular numerals) apply everywhere and win ties.

**v2 direction change (Joe, 2026-07-29):** the AI-generated week-plan concept image (`output/imagegen/…`) is **rejected as art direction** — its detailed-illustration look is explicitly not this game. Auto Life uses **simple, chunky pixel art in Hero Football Manager's style**: bright, flat, hand-built, readable. Mystia's Izakaya (`~/.claude/design-library/mystias-izakaya.md`) is demoted to a *mood and UI-layout reference* (warm home feeling; the bottom card-dock idea) — not a rendering target. HFM's pixel bible is the rendering lineage.

**v3 fidelity correction (Joe, 2026-07-31):** naming HFM as inspiration was not enough. The shipped narrow-headed, dot-faced character did not resemble HFM's players. Auto Life now inherits HFM's actual palette backbone and both of its rendering tracks. The v1 hero directly adapts **HFM portrait look F82**—top knot, angled eyes, toothy smile—into the activity sprite system. The source cell stays 32×48 for the atlas but is drawn at 1.5× in the room, with a head that occupies half the source height and three quarters of its width. Every house object also gets HFM's upper-left hard shading, ground-contact shadow, and one exaggerated character feature. Every player-facing card, panel, field, chip, and button uses the same HFM cream/blue/red/gold chrome grammar and Silkscreen hierarchy. This paragraph supersedes every older “generic big-head chibi” or merely HFM-inspired interpretation.

---

## 1. The look, in one paragraph

HFM heroic-chibi, at home. Bright hard-banded pixels on a cream-first canvas, thick readable shapes, and one broad-headed caricature hero you can identify and emotionally read from across the room. No texture noise, no gradients—warmth comes from palette states, wonky handmade silhouettes, and the cozy lighting swap. **Every UI element is a fat, obviously-tappable HFM button or card.** When in doubt: one bigger defining feature, fewer filler pixels.

## 2. Master palette (indexed, locked — core 31 + character-only 26 = 57)

Author all art as indexed PNG against this palette. **No one-off colors, ever.** Extend a ramp only by editing this file first. World scenes and UI use the **core 31**; skin/hair swap sets are character-layer-only.

### Neutrals (4)

| Name | Hex | Use |
|---|---|---|
| Ink | `#241f2e` | HFM text, UI outlines, darkest structure — **never pure black** |
| Cream light / White | `#ffffff` | HFM eye sparkles, teeth, card highlights |
| Cream base | `#f4f1ea` | HFM's primary 60% canvas |
| Cream shadow | `#d9d5cf` | soft structure, card lips, contact shadows |

### World ramps (6 × 3 = 18) — shadow / base / light; pick a ramp, use its 3 steps + Ink

| Ramp | Shadow | Base | Light | Owns |
|---|---|---|---|---|
| Wood | `#6a4326` | `#8a5a30` | `#a9743d` | HFM wood/leather/hair; furniture, guitar, floor seams |
| Grey | `#6b6675` | `#9a95a4` | `#c9c5d0` | HFM structure; appliances, metal, treadmill |
| Dusk plum | `#4a3550` | `#6b4f74` | `#9678a0` | night states, bedding, **Energy** |
| Leaf green | `#3f8a4a` | `#5cb85c` | `#8fd98f` | HFM turf family; plants, park, **Nutrition** |
| Water blue | `#3f6fb5` | `#5a8fd6` | `#a3c8f0` | HFM blue family; shower, sink, **Hygiene** |
| Terracotta | `#8a4a2e` | `#bc6b42` | `#e09a6e` | rugs, pots, **Movement** |

### Meaning ramps (3 × 3 = 9) — reserved; strong colors carry meaning only

| Ramp | Shadow | Base | Light | Reserved for |
|---|---|---|---|---|
| Lantern gold | `#c8862a` | `#edb54a` | `#f7d894` | HFM hero gold: light sources + **reward moments only**. Never generic emphasis. |
| Izakaya red | `#a83440` | `#d94f52` | `#f2938c` | HFM red family: **URGENT**, destructive confirms. Nothing decorative is ever red. |
| Rose | `#a34a5e` | `#d4708a` | `#f0a8bc` | **Connection bar (SPEC C11), Love meter & romance chrome (v5)** |

### Character-only swaps (26)

Six skin ramps — the §12 validator admits exactly these 18:
`#cf9268/#eab48c/#f7d7ba` · `#c08058/#e0a276/#f2c79e` · `#a06844/#c08a5c/#e0b184` · `#7c4c34/#9c6a48/#c08a62` · `#6b4030/#8a5a42/#a87858` · `#4c2e22/#664234/#845844`

Eight hair sets (8 net-new hexes; the rest reuse ramps): **F82 Black** `#241f2e/#3d2a22/#534537` · **Brown** = Wood · **Auburn** `#8a3c28/#b85a38/#d98a5e` · **Blonde** `#b08a3a/#d9b05c/#f0d494` · **Rose** = Rose · **Plum** = Dusk plum · **Blue** = Water blue · **Green** = Leaf green.

Soft skin outline = that ramp's shadow, never Ink.

**Per-shape rule:** one ramp + Ink + at most one neutral (contact shadow). A bar, a sprite, a card — same law.

## 3. Two tracks, never mixed (HFM's rule, inherited)

- **Track A — UI chrome** (buttons, cards, panels, chips): the **HFM chunky recipe** — 2 px Ink outline, a hard 4 px upper-left highlight band, stepped 4 px corners, and a 4 px darker bottom lip. Primary/confirm actions use HFM Water blue; secondary/back controls use Cream; destructive uses HFM Red; reward claims alone use HFM Gold. Labels use uppercase Silkscreen with deliberate tracking. Fat, flat, unmistakably pressable. No ornament, parchment texture, gradients, soft shadow, or corner flourishes.
- **Track B — world & characters**: HFM's soft **colored** outlines, 3–4 hard value bands lit from upper-left, a ground-contact shadow, chunky silhouette, and **one exaggerated identity feature**. Personality over accuracy. Character facial Ink and black hair are the named exceptions to the world-outline rule.
- A face is never outlined like a button; a button is never shaded like a sprite.

## 4. Typography

**The scale is 12 / 16 / 24 / 32 [AMENDED 2026-07-31, P7].** It was 8/16/24/32 through P6.

| Token | Size | Face | Owns |
|---|---:|---|---|
| `caption` | 12 px | readable sans | Times, effects, secondary explanations, metadata, diagnostics |
| `body` | 16 px | pixel bold for short labels; sans for prose | Buttons, card names, HUD values, field labels |
| `heading` | 24 px | pixel bold | Panel and section titles |
| `display` | 32 px | pixel bold | Logo and major event headings |

- **Silkscreen Bold** (HFM's house pixel face) — labels, headings, buttons, numerals; `tabular-nums` always; integer sizes; never anti-aliased at 1×.
- **Readable sans** for anything longer than a sentence (storylets, letters, settings copy) **and for the entire 12 px tier**.
- ≤4 sizes, 2 **weights**; text always sits on a Track-A surface. The sans is a third *face*, not a third weight — it carries no bold.
- **No player-facing text below 12 px. No actionable text below 16 px.**
- The HUD text-size preference must change rendered text, not only reserved space.

**Why the 8 px step was retired.** Silkscreen's em is 8 px, so 8 px is *legal, crisp* pixel type — which is exactly why it survived five phases of review. Crispness was the only property anyone checked, and the P7 desktop audit found 8 px carrying queue activity names, predicted times, need values and the Practice counter: 51 call sites of the most important information in the game, set at the smallest size the face permits.

12 px cannot be Silkscreen — 12 is not a multiple of the em, so it would anti-alias, which §13 rejects on sight. The 12 px tier therefore changes **face**, not just size. This is a deliberate trade: the alternative was promoting all 8 px metadata to 16 px pixel type, which stays purely on-brand and does not fit — the queue rail and the four-need HUD grid do not survive doubling their densest text. Readability wins, and the pixel face keeps everything a player acts on.

A 12 px size declared against the pixel face is the one combination that defeats this rule while passing every size check, so `theme.test.ts` asserts against it directly.

## 5. Grid, scale, resolution

- World: 32×32 tiles; rooms 24×14 single screens. Character source cell 32×48, drawn at **1.5×** in-world (48×72 footprint), feet centered on one tile. The head—including hair—owns ≈50% of source height and ≈75% of width.
- **A navigation tile is not a furniture scale.** Collision footprints stay on the 32 px simulation grid; presentation bounds may be larger, offset, or cross a wall edge. Any object the 48×72 hero uses must be visibly large enough to support the relevant body pose.
- Scaling per SPEC §11.5: integer/DPR-half-steps on desktop; sharp-bilinear fractional on phones (v1.1). Author at 1× only.
- UI: 8-pt grid; hit targets ≥44 px; UI floats over the world, not snapped to its grid.

## 6. Character construction (the v6 bet — binding since sprite #1)

Layer stack in the Skia Atlas: **base body → face → hair → outfit → accessory**, plus per-frame **anchor points** (head, hands) every overlay keys to.

- 3 body builds eventually (slim/average/buff — buff arrives v4); v1 ships average only, anchor spec ships day one. **Slim is generated from average via documented per-frame offsets, never redrawn.**
- Skin/hair recolors are palette-index swaps — zero redrawn frames.
- **Named v1 identity:** directly adapt HFM look **F82** as the off-pitch hero: structural top knot, asymmetric crown, angled all-pupil eyes, oversized tooth smile. Appearance presets may recolor skin/hair/outfit but never erase that silhouette. This is a real HFM player look, not a newly invented “similar” person.
- **Caricature rule, inherited verbatim in spirit:** break the facial thirds. One feature balloons and steals space; keep the rest quiet. For F82, the eye-and-smile band is the big move. Never return to an even rectangular face with two dots.
- **Expression set:** one fixed head with `rest / joy / effort / focus / awkward / tired` eye-and-mouth swaps. Activities choose a truthful face—food and Practice can show joy, lifting shows effort, quick-wash/toilet show awkwardness, low Energy shows tiredness. Bubbles supplement the face; they do not carry emotion alone.
- Proportions: extra-large broad head, squat torso, proper forward-toe feet, mitten hands. Head pixels must survive the full-room view.
- Interaction anatomy is part of the pose: seated hips meet the cushion, sleeping head/body/feet form one connected silhouette inside the mattress, treadmill feet meet the deck, and fixture poses overlap the fixture. A standing or crouched body parked on the interact tile is not an acceptable seated/sleeping substitute.
- Loops are 2–4 frames. **v1 bill ≈ 48 frames** (round-2 recount): walk×4dir (16) · sleep (2) · sit (2) · eat (2) · brush (2) · shower (2 + steam overlay) · lift (3) · run (4) · stretch (2) · practice (3) · idle (2) · toilet (1) · quick-wash (1) · nap (2) · preference idle variants (4).
- **Silhouette-first test:** every frame must read in flat Ink at zoom-out. If it needs color to parse, redraw it.
- **Authoring pipeline: HFM's SVG-authored route is primary** — sprites drawn as simple SVG shapes on the palette, rendered to indexed PNG (this is how HFM built its whole roster, and it is the most controllable route to "simple"). AI generation is the secondary route and must survive quantize + §12 unchanged.

## 7. World & objects

- Every prop follows HFM's object recipe: flat front elevation, upper-left hard highlight, colored material outline, squashed two-band contact shadow, and **one oversized or wonky defining feature**. Examples: the couch has swollen arms, the fridge has oversized handles, the guitar has a pinched waist and large lower bout. A sterile accurate miniature fails even if its palette is legal.
- **Scale against the hero, not the tile:** beds fit the full sleeping silhouette; couches hold a seated 48×72 hero; mats are full-body length; bathroom and kitchen fixtures reach believable body height; benches and treadmills support the feet/hands used in their activity pose.
- **Direction and relationship are reviewed as a room composition:** the couch faces down toward the nearby television; the television shows its rear to the player because its screen faces the couch; the treadmill deck follows the right-facing run; wall fixtures face into the room; the front door crosses the bottom wall instead of floating on the floor.
- Simulation `footprint`, `interactPoint`, and `facing` remain the deterministic movement contract. Renderer-only visual bounds and per-activity hero origins place the art correctly without changing pathfinding, saves, timing, or replays. Click targets follow the visible bounds.
- Day rooms are cream-first like HFM. Floor material is read from seams/inlays rather than filling most of the screen with dark brown; evening remains the plum palette swap.
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
| Buttons | HFM chunky lozenge; Water blue = primary/confirm/neutral action, Cream = secondary/back, Red = destructive, Gold = reward-claim only. Pressed state drops 2 px into the bottom lip. |
| Panels (shop, contacts, journal, Week Plan, settings) | Cream HFM bevel over an Ink/plum-dimmed room; item grid + detail pane. Heading is uppercase Silkscreen, body copy is readable sans. |
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
- [ ] Character is recognizably F82-derived: top knot + angled eyes + tooth smile; extra-large head reads in the full-room view
- [ ] Character pose uses one of the authored emotion swaps; no generic dot face
- [ ] Interaction contact is truthful: body sits on the seat, lies inside the bed, and plants feet/hands on the used object
- [ ] Object has upper-left hard shading + contact shadow + one exaggerated/handmade feature
- [ ] Object is proportioned against the 48×72 live hero, oriented toward its real user/partner object, and located against the correct wall/floor plane
- [ ] Gold only for light sources or reward moments; Red only for URGENT/destructive
- [ ] Character art: layers separated, anchors keyed, swaps index-based
- [ ] Upgrade tiers: silhouette matches prior tier
- [ ] On-grid at 1×, no anti-aliasing, no gradients, no soft shadows
- [ ] **Simple enough:** if HFM wouldn't draw this much detail, neither do we
- [ ] Reads at true size in the evening palette, not just zoomed daylight
- [ ] UI chrome uses exact Track-A bands: top highlight, face, dark bottom lip; primary blue / secondary cream / destructive red / reward gold

## 13. Anti-patterns (instant rejection)

Pure black anywhere · gradients, glows, blurred shadows · hues outside §2 · gold on a settings button · red as decoration or mood · button-shaded sprites / sprite-shaded buttons · narrow rectangular heads · generic dot faces · emotion delegated only to bubbles · sterile blueprint props · dollhouse furniture smaller than its user · seated/sleeping bodies staged on the floor · doors floating away from walls · every appliance facing the player regardless of use · anti-aliased pixel type · UI text floating on the world · silhouette drift across tiers · freehand portraits · screen shake · **illustration-grade detail (the rejected concept image is the canonical counterexample)** · ornament for its own sake.
