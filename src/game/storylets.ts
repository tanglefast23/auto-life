import type { ContentRegistry } from '../sim/content';
import {
  PrngStreams,
  type PrngSnapshot,
} from '../sim/prng';
import type { DomainEvent } from '../sim/step';
import type {
  DailyRecap,
  GameObservation,
  SessionState,
} from './session';

export interface StoryletBoundaryResult {
  session: SessionState;
  prng: PrngSnapshot;
  changed: boolean;
}

/**
 * Selects at most one journal line for the day that just closed.
 *
 * The recap already contains every eligible wrinkle outcome and milestone, so
 * no parallel trigger store is needed. A day without either uses the authored
 * idle-moment pool. Selection consumes exactly one draw from `storylets`; a
 * reload sees the saved entry/recap marker and consumes none.
 */
export function appendDailyStorylet(
  session: SessionState,
  prng: PrngSnapshot,
  events: readonly DomainEvent[],
  observation: GameObservation,
  content: ContentRegistry,
): StoryletBoundaryResult {
  const target = recapTarget(session, events, observation);
  if (target === null || target.recap.journalEntryId !== null) {
    return { session, prng, changed: false };
  }

  const existing = session.journal.entries.find(
    (entry) => entry.day === target.recap.forDay,
  );
  if (existing !== undefined) {
    return {
      session: withJournalMarker(session, target.kind, existing.id),
      prng,
      changed: true,
    };
  }

  const candidates = candidatesForRecap(target.recap, content);
  if (candidates.length === 0) {
    return { session, prng, changed: false };
  }
  candidates.sort((a, b) =>
    a.id === b.id ? 0 : a.id < b.id ? -1 : 1,
  );
  const streams = PrngStreams.restore(
    JSON.parse(JSON.stringify(prng)) as unknown,
  );
  const draw = streams.next('storylets');
  const selected =
    candidates[
      Math.min(
        candidates.length - 1,
        Math.floor(draw * candidates.length),
      )
    ]!;
  const entryId = `journal-${session.journal.nextEntrySeq}`;
  const entry = {
    id: entryId,
    day: target.recap.forDay,
    // Daily selection happens at the closing boundary. Keep the timestamp on
    // the day being remembered rather than assigning it to tomorrow at 00:00.
    minuteOfDay: 1439,
    sourceKind: selected.source.kind,
    sourceId: selected.id,
    stringId: selected.stringId,
  } as const;
  const marked = withJournalMarker(session, target.kind, entryId);
  return {
    session: {
      ...marked,
      journal: {
        nextEntrySeq: session.journal.nextEntrySeq + 1,
        entries: [...session.journal.entries, entry],
      },
    },
    prng: streams.serialize(),
    changed: true,
  };
}

function recapTarget(
  session: SessionState,
  events: readonly DomainEvent[],
  observation: GameObservation,
):
  | { kind: 'recap'; recap: DailyRecap }
  | { kind: 'morningRecap'; recap: DailyRecap }
  | null {
  if (
    observation.isMidnight &&
    session.recap.forDay === observation.day - 1
  ) {
    return { kind: 'recap', recap: session.recap };
  }
  if (
    events.some((event) => event.type === 'wakeBoundary') &&
    session.morningRecap !== null
  ) {
    return {
      kind: 'morningRecap',
      recap: session.morningRecap,
    };
  }
  return null;
}

function candidatesForRecap(
  recap: DailyRecap,
  content: ContentRegistry,
): ContentRegistry['storylets']['storylets'] {
  const contextual = content.storylets.storylets.filter(
    (storylet) => {
      if (storylet.source.kind === 'wrinkle-outcome') {
        return storylet.source.wrinkleId === recap.wrinkleOutcomeId;
      }
      if (storylet.source.kind === 'milestone') {
        return recap.goalProgressIds.includes(
          storylet.source.goalId,
        );
      }
      return false;
    },
  );
  if (contextual.length > 0) return [...contextual];
  return content.storylets.storylets.filter(
    (storylet) => storylet.source.kind === 'idle-moment',
  );
}

function withJournalMarker(
  session: SessionState,
  kind: 'recap' | 'morningRecap',
  entryId: string,
): SessionState {
  if (kind === 'recap') {
    return {
      ...session,
      recap: { ...session.recap, journalEntryId: entryId },
    };
  }
  if (session.morningRecap === null) return session;
  return {
    ...session,
    morningRecap: {
      ...session.morningRecap,
      journalEntryId: entryId,
    },
  };
}
