import {
  DUSK_PLUM,
  HAIR_AUBURN,
  HAIR_BLACK,
  HAIR_BLONDE,
  LEAF_GREEN,
  SKIN_RAMPS,
  TERRACOTTA,
  WATER_BLUE,
} from './palette';

/**
 * The four appearance presets, as palette maps (P6 T5).
 *
 * design.md §6: **"Skin/hair recolors are palette-index swaps — zero redrawn frames."**
 * Taken literally: all four presets share one set of authored shapes and differ only in
 * which §2 palette entries those shapes are painted with. `characterFrameShapes` takes the
 * palette as a parameter, so the geometry is provably identical across presets — asserted
 * in `appearance.test.ts` rather than assumed.
 *
 * `paletteId` has been in `content/identity.json` and `content-schemas.ts` since P5 with
 * **no consumer at all** — every preset drew the same auburn-haired sim. This is that
 * consumer.
 *
 * Baked at build time rather than tinted at draw time (P6 plan Q2). Skia's `<Atlas>` can
 * apply a per-quad colour, but that is a multiply across the whole quad, which would drag
 * skin, hair and outfit through one tint and break design.md §2's per-shape ramp rule.
 * Baking costs atlas rows and keeps the bible intact.
 */

export interface Ramp {
  readonly shadow: string;
  readonly base: string;
  readonly light: string;
}

export interface AppearancePalette {
  readonly skin: Ramp;
  readonly hair: Ramp;
  readonly outfit: Ramp;
}

/**
 * Keyed by `paletteId` in `content/identity.json`. A fifth preset is a content edit plus
 * one row here; the bill test fails until the row exists, so the two cannot drift apart.
 *
 * Every skin ramp is one of §2's six and every hair set is one of its eight — the palette
 * validator admits exactly those, so an invented combination fails the art gate.
 */
export const APPEARANCE_PALETTES: Record<string, AppearancePalette> = {
  'morning-blue': { skin: SKIN_RAMPS[0]!, hair: HAIR_BLACK, outfit: WATER_BLUE },
  'moss-green': { skin: SKIN_RAMPS[2]!, hair: HAIR_AUBURN, outfit: LEAF_GREEN },
  'warm-clay': { skin: SKIN_RAMPS[4]!, hair: HAIR_BLONDE, outfit: TERRACOTTA },
  'plum-night': { skin: SKIN_RAMPS[5]!, hair: DUSK_PLUM, outfit: DUSK_PLUM },
};

/** The preset used when a save carries an unknown id — a migrated or future career. */
export const FALLBACK_PALETTE_ID = 'moss-green';

export function paletteFor(paletteId: string | null | undefined): AppearancePalette {
  return APPEARANCE_PALETTES[paletteId ?? ''] ?? APPEARANCE_PALETTES[FALLBACK_PALETTE_ID]!;
}

export function resolvePaletteId(paletteId: string | null | undefined): string {
  return paletteId !== null && paletteId !== undefined && APPEARANCE_PALETTES[paletteId] !== undefined
    ? paletteId
    : FALLBACK_PALETTE_ID;
}
