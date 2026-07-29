export type BarId = 'energy' | 'nutrition' | 'movement' | 'hygiene';
export const BAR_IDS = ['energy', 'nutrition', 'movement', 'hygiene'] as const;

/** All values are ×6000 fixed integers (SPEC §16.2). */
export type Bars = Record<BarId, number>;

export type Chronotype = 'baseline' | 'early' | 'owl';
