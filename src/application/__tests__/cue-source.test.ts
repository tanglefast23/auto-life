import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { content } from '../../sim/content';
import type { CommandOutcome, DomainEvent } from '../../sim/step';
import type { DomainCueEvent } from '../audio/cue-router';
import {
  domainCueEvents,
  gradeBandOf,
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
  running: true,
  recapDay: null,
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

  /**
   * `currentCardId` is set the moment the sim starts *walking toward* a card, so a start
   * derived from it alone opened `loop.shower` while she was still crossing the house —
   * every one of the eight authored loops is an activity you travel to. Announcing what
   * the engine is about to do rather than what it did is the same class of mistake as a
   * reward sound for a bonus that was never granted, one layer earlier.
   */
  it('waits for arrival — no start cue while still travelling to the card', () => {
    const cues = domainCueEvents(
      view({ currentCardId: 'c1', currentActivityId: 'shower', running: true }),
      view({ currentCardId: 'c2', currentActivityId: 'meal', running: false }),
      boundary(),
    );
    expect(cues).not.toContainEqual(
      expect.objectContaining({ kind: 'activity-started' }),
    );
  });

  it('starts the loop on the tick the activity actually begins', () => {
    const travelling = view({ currentCardId: 'c2', currentActivityId: 'meal', running: false });
    const arrived = view({ currentCardId: 'c2', currentActivityId: 'meal', running: true });

    // The card id does not change on arrival — it was already the travel target — so a
    // rule keyed on the id alone would never fire at all once travel is excluded.
    expect(domainCueEvents(travelling, arrived, boundary())).toContainEqual({
      kind: 'activity-started',
      activityId: 'meal',
    });
  });

  it('does not re-announce the same card on every minute it keeps running', () => {
    // A three-tick shower is one start, not three. The router's loop key would survive it
    // either way; the completion cue would not.
    const running = view({ currentCardId: 'c1', currentActivityId: 'shower' });
    expect(domainCueEvents(running, running, boundary())).toEqual([]);
  });

  /**
   * The router has always known what a recap sounds like and `ui.recap` has always been a
   * committed WAV; nothing ever produced the event, so `recap-shown` was the last piece of
   * the bank still driving a bus that never heard from it.
   */
  it('sounds the recap once, on the morning it appears', () => {
    const before = view({ recapDay: null });
    const shown = view({ recapDay: 3 });

    expect(domainCueEvents(before, shown, boundary())).toContainEqual({
      kind: 'recap-shown',
    });
    // Still on screen a minute later is not a second recap.
    expect(domainCueEvents(shown, shown, boundary())).not.toContainEqual({
      kind: 'recap-shown',
    });
  });

  it('sounds a new day\'s recap even though the previous one never cleared', () => {
    expect(
      domainCueEvents(view({ recapDay: 3 }), view({ recapDay: 4 }), boundary()),
    ).toContainEqual({ kind: 'recap-shown' });
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

/**
 * The composition gate.
 *
 * Three times now a cue, a bubble or a motion has been built, unit-tested, and then
 * produced by nothing: the router was constructed and never handed an event, `bubbleFor`
 * had no caller, and `recap-shown` was handled by the router and emitted by no one while
 * `ui.recap` sat committed on disk. Every one of those suites was green throughout,
 * because each half was tested against the other half's *shape* rather than its use.
 *
 * `cue-router.test.ts` proves each kind earns the right sound. This proves each kind can
 * actually happen. A cue nothing produces is dead content, and dead content that a bank
 * test still counts is worse than none — it reads as covered.
 */
describe('every cue the router can route is one the game can raise', () => {
  const ROUTED_KINDS: DomainCueEvent['kind'][] = [
    'queue-card-inserted',
    'queue-card-removed',
    'activity-started',
    'activity-completed',
    'activity-stopped',
    'adjacency-granted',
    'urgent-raised',
    'recap-shown',
  ];

  const source = readFileSync(
    resolve(__dirname, '../audio/cue-source.ts'),
    'utf8',
  )
    // Comments stripped: this file documents itself heavily, and a gate a doc comment can
    // satisfy is the same failure it exists to catch, one level up.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each(ROUTED_KINDS)('%s is produced by cue-source', (kind) => {
    expect(source).toContain(`kind: '${kind}'`);
  });

  it('routes exactly the kinds the union declares, so a new cue cannot be forgotten', () => {
    const declared = readFileSync(
      resolve(__dirname, '../audio/cue-router.ts'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .matchAll(/\{ kind: '([a-z-]+)'/g);
    expect([...declared].map((m) => m[1]).sort()).toEqual([...ROUTED_KINDS].sort());
  });
});

// ---- docs/08 §11.4: the grade cue ----

test('the audio band derived from a grade letter agrees with the band content authors', () => {
  // The rule is duplicated on purpose — cue-source stays content-free — so this is what
  // makes the duplication safe rather than a drift waiting to happen.
  for (const grade of content.grades.grades) {
    expect(gradeBandOf(grade.id)).toBe(grade.band);
  }
});

test('a graded completion plays the grade instead of the generic settle, never both', () => {
  const cues = domainCueEvents(
    view({ currentCardId: 'c1', currentActivityId: 'meal', running: true }),
    view({ currentCardId: 'c1', currentActivityId: 'meal', running: true }),
    {
      events: [
        { type: 'activityCompleted', detail: 'meal', atMinute: 500 },
        { type: 'activityGraded', detail: 'meal:b-plus', atMinute: 500 },
      ],
      outcomes: [],
    },
  );
  const completions = cues.filter((c) => c.kind === 'activity-completed');
  expect(completions).toHaveLength(1);
  expect(completions[0]).toEqual({ kind: 'activity-completed', activityId: 'meal', graded: 'high' });
});

test('an ungraded completion still carries no band, so it keeps the settle cue', () => {
  const cues = domainCueEvents(
    view({ currentCardId: 'c1', currentActivityId: 'toilet', running: true }),
    view({ currentCardId: 'c1', currentActivityId: 'toilet', running: true }),
    { events: [{ type: 'activityCompleted', detail: 'toilet', atMinute: 500 }], outcomes: [] },
  );
  expect(cues).toContainEqual({ kind: 'activity-completed', activityId: 'toilet' });
});
