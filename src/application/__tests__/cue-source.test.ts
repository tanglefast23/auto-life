import { content } from '../../sim/content';
import type { CommandOutcome, DomainEvent } from '../../sim/step';
import {
  domainCueEvents,
  musicInputsFor,
  type CueBoundary,
  type CueView,
} from '../audio/cue-source';

/**
 * P6 audit — the half of the audio system that did not exist.
 *
 * `cue-router.test.ts` proved which sound a `DomainCueEvent` earns. Nothing produced a
 * `DomainCueEvent`: `ApplicationRoot` built a router and referenced it nowhere, so the whole
 * bank drove a bus that was never asked to make a sound. These tests pin the adapter that
 * closes that gap, and they are pure — two views and a boundary decide everything.
 */

const view = (over: Partial<CueView> = {}): CueView => ({
  minuteOfDay: 8 * 60,
  currentCardId: 'c1',
  currentActivityId: 'shower',
  practiceLevel: 0,
  practicing: false,
  ...over,
});

const boundary = (over: Partial<CueBoundary> = {}): CueBoundary => ({
  events: [],
  outcomes: [],
  ...over,
});

const event = (type: DomainEvent['type'], detail: string): DomainEvent => ({
  type,
  detail,
  atMinute: 480,
});

describe('activity lifecycle', () => {
  it('starts a cue when a different card begins running', () => {
    const cues = domainCueEvents(
      view({ currentCardId: 'c1', currentActivityId: 'shower' }),
      view({ currentCardId: 'c2', currentActivityId: 'meal' }),
      boundary(),
    );
    expect(cues).toContainEqual({ kind: 'activity-started', activityId: 'meal' });
  });

  it('does not re-announce the same card on every minute it keeps running', () => {
    // A three-tick shower is one start, not three. The router's loop key would survive it
    // either way; the completion cue would not.
    const running = view({ currentCardId: 'c1', currentActivityId: 'shower' });
    expect(domainCueEvents(running, running, boundary())).toEqual([]);
  });

  it('treats the first published minute as continuity, not as a start', () => {
    // A restored save arrives mid-activity. Announcing it as a start would sound a loop for
    // something the player never watched begin — the hydration failure, one layer down.
    expect(domainCueEvents(null, view(), boundary())).toEqual([]);
  });

  it('completes from the engine event, so the loop closes on the tick it really ended', () => {
    const cues = domainCueEvents(
      view(),
      view({ currentCardId: null, currentActivityId: null }),
      boundary({ events: [event('activityCompleted', 'shower')] }),
    );
    expect(cues).toContainEqual({ kind: 'activity-completed', activityId: 'shower' });
  });

  it('names what WAS running when the player stops it', () => {
    // `stopCurrent` reports a card id and, by the time the boundary lands, nothing is
    // running — so the activity has to come from the previous view.
    const cues = domainCueEvents(
      view({ currentActivityId: 'treadmill' }),
      view({ currentCardId: null, currentActivityId: null }),
      boundary({
        outcomes: [{ type: 'stopCurrent', status: 'accepted', cardId: 'c1' }],
      }),
    );
    expect(cues).toContainEqual({ kind: 'activity-stopped', activityId: 'treadmill' });
    expect(cues).not.toContainEqual(
      expect.objectContaining({ kind: 'activity-completed' }),
    );
  });

  it('opens a loop before the completion that closes it, within one tick', () => {
    // A one-tick activity produces both in the same boundary. Emitted the other way round,
    // the completion would close nothing and the loop would be left sounding.
    const cues = domainCueEvents(
      view({ currentCardId: 'c0', currentActivityId: null }),
      view({ currentCardId: 'c1', currentActivityId: 'snack' }),
      boundary({ events: [event('activityCompleted', 'snack')] }),
    );
    const started = cues.findIndex((c) => c.kind === 'activity-started');
    const completed = cues.findIndex((c) => c.kind === 'activity-completed');
    expect(started).toBeGreaterThanOrEqual(0);
    expect(completed).toBeGreaterThan(started);
  });
});

describe('queue verbs and engine events', () => {
  it.each<[CommandOutcome, string]>([
    [{ type: 'insertPlayer', status: 'accepted', cardId: 'c9' }, 'queue-card-inserted'],
    [
      { type: 'objectClick', status: 'accepted', cardId: 'c9', effect: 'inserted' },
      'queue-card-inserted',
    ],
    [
      { type: 'undoLastRemove', status: 'accepted', receiptId: 'r1', cardId: 'c9' },
      'queue-card-inserted',
    ],
    [
      { type: 'removeCard', status: 'accepted', cardId: 'c9', effect: 'removed', receiptId: 'r1' },
      'queue-card-removed',
    ],
  ])('routes %o to the %s cue', (outcome, kind) => {
    const cues = domainCueEvents(view(), view(), boundary({ outcomes: [outcome] }));
    expect(cues).toContainEqual({ kind });
  });

  it('stays silent for a rejected command — nothing happened, so nothing sounds', () => {
    const cues = domainCueEvents(
      view(),
      view(),
      boundary({
        outcomes: [
          { type: 'insertPlayer', status: 'rejected', reason: 'playerCardCap' },
          { type: 'removeCard', status: 'rejected', reason: 'unknownCard' },
        ],
      }),
    );
    expect(cues).toEqual([]);
  });

  it('raises the urgency cue from the engine, not from a bar reading', () => {
    const cues = domainCueEvents(
      view(),
      view(),
      boundary({ events: [event('urgent', 'hygiene')] }),
    );
    expect(cues).toContainEqual({ kind: 'urgent-raised' });
  });

  it('sounds adjacency only when a pair actually paid out', () => {
    // The forecast predicts pairs the real end-to-start gap can still miss. Reading the
    // engine's own event is what keeps the reward sound from lying about a bonus.
    expect(
      domainCueEvents(view(), view(), boundary({ events: [event('adjacencyGranted', 'minty-fresh')] })),
    ).toContainEqual({ kind: 'adjacency-granted' });
    expect(domainCueEvents(view(), view(), boundary())).toEqual([]);
  });

  it('ignores engine events with no cue of their own', () => {
    const cues = domainCueEvents(
      view(),
      view(),
      boundary({
        events: [
          event('wakeBoundary', '2'),
          event('slept', 'start'),
          event('practiceAwarded', '40'),
        ],
      }),
    );
    expect(cues).toEqual([]);
  });
});

describe('music inputs', () => {
  it('carries the minute and the practice level the riff is chosen by', () => {
    const inputs = musicInputsFor(
      view({ minuteOfDay: 19 * 60, practiceLevel: 2, practicing: true }),
      false,
    );
    expect(inputs).toEqual({
      minuteOfDay: 19 * 60,
      practiceLevel: 2,
      practicing: true,
      paused: false,
    });
  });

  it('leaves rain unset, because v1 content deals no weather wrinkle to read', () => {
    // `audio.json` authors a rain ambience for a wrinkle that does not exist yet. Wiring a
    // hard `false` would read as "checked and it is not raining"; omitting it is honest and
    // the router already treats it as off.
    expect(musicInputsFor(view(), false).rain).toBeUndefined();
    expect(content.audio.ambience.rain.assetId).toBeDefined();
  });
});
