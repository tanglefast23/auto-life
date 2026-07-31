# P7 evidence — HFM art and UI fidelity correction (2026-07-31)

**Outcome:** the old narrow, dot-faced in-room character is superseded. The current v1
hero directly adapts HFM portrait look F82, renders at 1.5× over the world, and carries
named expression swaps. The home palette, tiles, props, UI cards, controls, typography,
and semantic colour roles now follow `design.md` v3. The spatial correction also separates
navigation geometry from presentation geometry: furniture is human-scale, paired objects
face one another, the door crosses its wall, and activity poses make physical contact.

## Source comparison and binding choices

- Reference inspected: HFM's reviewed player-redesign sheet, specifically F82's top knot,
  angled eyes, and tooth smile.
- Source atlas cell remains 32×48 so the existing 48-frame bill, anchors, appearance
  swaps, and deterministic atlas contract remain intact.
- Live draw footprint is 48×72. The head—including hair—owns about half the source height
  and three quarters of its width, so expression survives the full-room view.
- Face swaps are `rest`, `joy`, `effort`, `focus`, `awkward`, and `tired`; activities pick
  an appropriate swap instead of relying on a speech bubble to provide all emotion.
- Day rooms are cream-first. Props use hard upper-left bands, coloured structure, a
  squashed contact shadow, and one oversized or wonky identity feature.
- The couch faces the nearby TV; the TV's rear faces the player; the mat is full-body
  length; the bed, fixtures, bench, and treadmill are proportioned against the live hero;
  the front door intersects the bottom wall.
- Per-activity hero origins are renderer-only. The sim still walks to the original
  interact point, then the drawing stages the body on the cushion, mattress, deck, mat,
  or fixture. Visible bounds own the pointer hotspots. No presentation coordinate enters
  save data, pathfinding, activity timing, or replay math.
- Track-A UI uses the HFM palette backbone and bevel: Ink outline, hard top highlight,
  face colour, dark bottom lip; Water blue primary, Cream secondary, Red destructive,
  Gold reward-only. Action and heading text uses uppercase Silkscreen.

## Generated review evidence

| Evidence | What it proves |
|---|---|
| `p7-hfm-room-day-live-2x.png` | Live ratio: room at 2×, hero at 3×; broad head and room-scale legibility |
| `p7-hfm-room-evening-live-2x.png` | Same hero and props remain readable in the evening palette |
| `p7-hfm-interactions-live-2x.png` | Every v1 activity staged against its actual object at the live 2× room / 3× hero ratio |
| `p7-hfm-poses-moss-green-2x.png` | All 48 poses retain the F82 silhouette and activity expressions |
| `p7-hfm-poses-silhouette-2x.png` | Pose bill reads without colour |
| `p7-hfm-objects-2x.png` | Every v1 prop plus its flat silhouette and contact edge |
| `p7-hfm-title-1366.png` | HFM cream/blue title chrome and type hierarchy at 1366×768 |
| `p7-hfm-identity-1366.png` | Selected-control grammar, fields, chips, and primary/secondary buttons |
| `p7-hfm-settings-1366.png` | Full settings surface using HFM colour roles and Silkscreen hierarchy |
| `p7-hfm-activity-cards-1366.png` | Queue activity panel and card grid using the HFM Track-A recipe |
| `p7-hfm-live-game-1366.png` | Live room, hero, HUD, rail, and action control at the minimum desktop gate |
| `p7-hfm-live-game-1470.png` | Live room and UI at the MacBook Air desktop viewport |
| `p7-hfm-live-spatial-1366.png` | Exported build after the spatial pass: enlarged/reoriented room objects and wall-mounted door at 1366×768 |
| `p7-hfm-live-room-muted-1366.png` | Final exported-room capture with the test session visibly muted before shutdown |

## Verification

- `npm run art:atlas` — green; 1024×637 atlas, 251 sprites, 44 colours.
- Focused spatial/art tests — 5 suites, 78 tests green: presentation bounds, hit areas,
  activity origins, object legibility, palette, and the complete sprite bill.
- `npm run typecheck` — green.
- `npm test` — 105 suites, 924 tests, 2 snapshots green.
- `npm run export:web` — green.
- Headless Chromium at 1366×768 and 1470×956 — title, identity, Settings, live room,
  activity palette, HUD, rail, and the revised room composition observed. No page errors.
  Three existing React Native Skia path-deprecation warnings remain; they do not affect
  this visual pass. The test browser was muted and closed after capture.

## Historical evidence boundary

`A0.md` remains proof of the source-cell/layer/anchor pipeline, and `P6.md` remains proof
of its then-current bill and performance work. Neither is current proof of HFM visual
fidelity; this record and `design.md` v3 supersede that claim.
