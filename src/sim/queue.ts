import { z } from 'zod';
import { BarIdSchema } from './content-schemas';

/**
 * Structured queue provenance used by the forecast/read-model. T2 owns the
 * wrinkle variant; T3 extends this union for anchor and reactive reasons.
 *
 * It lives on the card — not in application state or a parallel lookup — so a
 * save, replay, reorder, and T4's removal receipt all carry the explanation with
 * the unit they are explaining.
 */
export const QueueReasonSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('anchorWindow'),
    anchorId: z.string().min(1),
    /** Absolute game minute, so a restored cross-day card stays unambiguous. */
    targetMinute: z.number().int().min(0),
  }),
  z.strictObject({
    kind: z.literal('reactiveTrigger'),
    bar: BarIdSchema,
    threshold: z.number().min(0).max(100),
    /** Absolute minute at which the planner authored this explanation. */
    atMinute: z.number().int().min(0),
  }),
  z.strictObject({
    kind: z.literal('routinePlan'),
    /** Null means the productive free-time fallback, not a need correction. */
    bar: BarIdSchema.nullable(),
    threshold: z.number().min(0).max(100),
    /** Absolute minute at which the planner authored this explanation. */
    atMinute: z.number().int().min(0),
  }),
  z.strictObject({
    kind: z.literal('wrinkle'),
    wrinkleId: z.string().min(1),
  }),
]);
export type QueueReason = z.infer<typeof QueueReasonSchema>;

/**
 * The queue model (SPEC §7.4). Anchor blocks share a blockId — that is what makes
 * "one expandable card" and "blocks hold their fixed internal order" expressible
 * without nesting. Every mutation is a pure (queue, args) => queue function so the
 * T12 reducer can compose them.
 */
export const QueueCardSchema = z.strictObject({
  id: z.string().min(1),
  activityId: z.string().min(1),
  owner: z.enum(['AUTO', 'PINNED']),
  urgent: z.boolean(),
  source: z.enum(['anchor', 'reactive', 'routine', 'player', 'wrinkle']),
  reason: QueueReasonSchema.optional(),
  blockId: z.string().min(1).optional(),
  enqueuedTick: z.number().int().min(0),
}).superRefine((card, ctx) => {
  if (card.source === 'wrinkle' && card.reason?.kind !== 'wrinkle') {
    ctx.addIssue({ code: 'custom', message: 'wrinkle cards require a wrinkle reason' });
  } else if (card.source !== 'wrinkle' && card.reason?.kind === 'wrinkle') {
    ctx.addIssue({ code: 'custom', message: 'wrinkle reasons belong only on wrinkle cards' });
  } else if (card.source === 'anchor' && card.reason !== undefined && card.reason.kind !== 'anchorWindow') {
    ctx.addIssue({ code: 'custom', message: 'anchor cards require anchor-window reasons' });
  } else if (card.source === 'reactive' && card.reason !== undefined && card.reason.kind !== 'reactiveTrigger') {
    ctx.addIssue({ code: 'custom', message: 'reactive cards require reactive-trigger reasons' });
  } else if (card.source === 'routine' && card.reason?.kind !== 'routinePlan') {
    ctx.addIssue({ code: 'custom', message: 'routine cards require routine-plan reasons' });
  } else if (card.source === 'player' && card.reason !== undefined) {
    ctx.addIssue({ code: 'custom', message: 'player cards do not carry planner reasons' });
  }
});
export type QueueCard = z.infer<typeof QueueCardSchema>;

export const RemovalReceiptSchema = z.strictObject({
  id: z.string().min(1),
  card: QueueCardSchema,
  originalIndex: z.number().int().min(0),
  previousNeighborId: z.string().min(1).nullable(),
  nextNeighborId: z.string().min(1).nullable(),
  suppressionMutation: z
    .strictObject({
      activityId: z.string().min(1),
      previousUntil: z.number().int().nullable(),
      writtenUntil: z.number().int(),
    })
    .nullable(),
  anchorMutation: z
    .strictObject({
      anchorId: z.string().min(1),
      previousDay: z.number().int().nullable(),
      previousGeneration: z.number().int().positive().nullable(),
      writtenDay: z.number().int(),
      writtenGeneration: z.number().int().positive(),
    })
    .nullable(),
});
export type RemovalReceipt = z.infer<typeof RemovalReceiptSchema>;

export const PLAYER_CARD_CAP = 10;

/**
 * §7.4 cap row, made consistent (audit round 4): `source` is ORIGINAL PROVENANCE
 * and never rewritten; `owner` is current control. The cap counts only cards the
 * player INSERTED (source 'player'). Promoting or moving an existing anchor or
 * reactive card pins it (owner) but keeps its provenance — those cards live
 * outside the cap, exactly as anchor blocks and urgent cards always have.
 */
export const playerCardCount = (queue: readonly QueueCard[]): number =>
  queue.filter((c) => c.source === 'player').length;

export function canPlayerInsert(queue: readonly QueueCard[]): boolean {
  return playerCardCount(queue) < PLAYER_CARD_CAP;
}

/** Any queued card for an activity already represents a plan for that need. */
export const hasCardFor = (
  queue: readonly QueueCard[],
  activityId: string,
): boolean => queue.some((card) => card.activityId === activityId);

export interface SuppressionMap {
  [activityId: string]: number; // suppressed-until absoluteMinute
}

export const REMOVE_SUPPRESSION_MIN = 120;
export const STOP_SUPPRESSION_MIN = 60;

export function removeCard(
  queue: readonly QueueCard[],
  cardId: string,
  nowMinute: number,
  suppression: SuppressionMap,
): { queue: QueueCard[]; suppression: SuppressionMap } {
  const card = queue.find((c) => c.id === cardId);
  if (!card) return { queue: [...queue], suppression };
  const next = queue.filter((c) => c.id !== cardId);
  const nextSuppression = { ...suppression };
  if (card.owner === 'AUTO') {
    nextSuppression[card.activityId] = nowMinute + REMOVE_SUPPRESSION_MIN;
  }
  return { queue: next, suppression: nextSuppression };
}

export function isSuppressed(
  activityId: string,
  nowMinute: number,
  suppression: SuppressionMap,
  urgent: boolean,
): boolean {
  if (urgent) return false; // urgency overrides suppression (§7.4)
  const until = suppression[activityId];
  return until !== undefined && nowMinute < until;
}

/** Player insert (append at the end of the player-visible tail). */
export function insertPlayerCard(
  queue: readonly QueueCard[],
  card: Omit<QueueCard, 'owner' | 'source' | 'urgent'>,
): QueueCard[] {
  if (!canPlayerInsert(queue)) throw new Error('player card cap reached (10)');
  return [...queue, { ...card, owner: 'PINNED', source: 'player', urgent: false }];
}

/** Object-click (§7.4): promote an existing queued card for that activity, else insert at the front of the earliest AUTO run. */
export function objectClick(
  queue: readonly QueueCard[],
  activityId: string,
  newId: string,
  enqueuedTick: number,
): QueueCard[] {
  const existing = queue.find((c) => c.activityId === activityId);
  if (existing) {
    const rest = queue.filter((c) => c.id !== existing.id);
    // Provenance is never rewritten: promotion pins the card but a promoted
    // anchor/reactive stays outside the player cap (audit round 4).
    const promoted: QueueCard = { ...existing, owner: 'PINNED' };
    const firstAuto = rest.findIndex((c) => c.owner === 'AUTO');
    const at = firstAuto === -1 ? rest.length : firstAuto;
    return [...rest.slice(0, at), promoted, ...rest.slice(at)];
  }
  if (!canPlayerInsert(queue)) throw new Error('player card cap reached (10)');
  const card: QueueCard = { id: newId, activityId, owner: 'PINNED', source: 'player', urgent: false, enqueuedTick };
  const firstAuto = queue.findIndex((c) => c.owner === 'AUTO');
  const at = firstAuto === -1 ? queue.length : firstAuto;
  return [...queue.slice(0, at), card, ...queue.slice(at)];
}

/**
 * §7.4 reorder verb (audit round 3 — the fourth player verb the engine was
 * missing): moving a card PINS it ("anything the player inserted, moved, or
 * touched — that card only"), so the sorter durably respects the placement. A
 * moved block member detaches from its block's unit ordering by ownership;
 * blockId stays for Q4 consumption. toIndex clamps; unknown ids no-op.
 */
export function moveCard(queue: readonly QueueCard[], cardId: string, toIndex: number): QueueCard[] {
  const card = queue.find((c) => c.id === cardId);
  if (!card) return [...queue];
  const rest = queue.filter((c) => c.id !== cardId);
  const at = Math.max(0, Math.min(Math.trunc(toIndex), rest.length));
  const moved: QueueCard = card.owner === 'AUTO' ? { ...card, owner: 'PINNED' } : card;
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

/** Planner dedup guard: max one AUTO card per activity type (player duplicates are free). */
export function hasAutoCardFor(queue: readonly QueueCard[], activityId: string): boolean {
  return queue.some((c) => c.owner === 'AUTO' && c.activityId === activityId);
}

/** Auto-cleanup (§7.4): unstarted AUTO reactive cards whose bar recovered past trigger+10 poof. */
export function autoCleanup(
  queue: readonly QueueCard[],
  shouldPoof: (card: QueueCard) => boolean,
): QueueCard[] {
  return queue.filter((c) => !(c.owner === 'AUTO' && c.source === 'reactive' && shouldPoof(c)));
}

export const pinnedSubsequence = (queue: readonly QueueCard[]): string[] =>
  queue.filter((c) => c.owner === 'PINNED').map((c) => c.id);
