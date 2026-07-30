import { create } from 'zustand';
import {
  GameLoop,
  type CompletedBoundary,
  type Speed,
  type UndoToast,
} from './loop';
import { content } from '../sim/content';
import type { GameSnapshot } from './snapshot';
import {
  deriveSimRules,
  StoredCareerSchema,
  type AppPreferencesEnvelope,
  type StoredCareer,
} from './career-state';

/**
 * The UI's view of the game (SPEC §3: "UI mirrors sim snapshots; sim owns truth").
 *
 * The `GameLoop` lives OUTSIDE the store. Zustand holds only the latest snapshot and
 * the chosen speed, so React re-renders at snapshot rate — at most 8 per second at 4× —
 * rather than at frame rate. Sub-tick motion is read straight off the loop by the
 * renderer's animation frame and never travels through React state.
 */

function createLoop(
  career: StoredCareer,
  preferences: AppPreferencesEnvelope,
  observer: (s: GameSnapshot) => void,
  onUndoToast: (toast: UndoToast | null) => void,
  careerPayload: () => StoredCareer['payload'],
  onBoundary?: (boundary: CompletedBoundary) => void,
): GameLoop {
  return new GameLoop(
    career.payload,
    content,
    { onSnapshot: observer, onUndoToast, onBoundary },
    {
      sleepSkipEnabled: preferences.preferences.gameplay.sleepAutoSkip,
      simRules: deriveSimRules(career.payload, content),
      simRulesForBoundary: (sim, session) =>
        deriveSimRules(
          {
            ...careerPayload(),
            sim,
            game: session,
          },
          content,
        ),
    },
  );
}

export interface GameStore {
  snapshot: GameSnapshot | null;
  speed: Speed;
  /** A loop invariant escaped. The sim stays parked until the app is reloaded. */
  fatalError: string | null;
  /** Ticks the loop has run — lets evidence report "a full day was watched". */
  ticksRun: number;
  undoToast: UndoToast | null;
  advanceFrame: (elapsedMs: number) => void;
  setSpeed: (speed: Speed) => void;
  togglePause: () => void;
  setSystemPaused: (paused: boolean) => void;
  insertActivity: (activityId: string) => void;
  stopCurrent: () => void;
  removeCard: (cardId: string) => void;
  moveCard: (cardId: string, toIndex: number) => void;
  undoLastRemove: (receiptId: string) => boolean;
  observeWhyLine: (cardId: string) => void;
  observeForecastChange: () => void;
  selectIntention: (intentionId: string) => void;
  addProtectedPractice: () => boolean;
  takeWrinkleAction: (
    wrinkleId: string,
    actionId: string,
  ) => void;
  chooseGoalReward: (
    goalId: string,
    choiceId: string,
  ) => void;
  respondToLetter: (
    decision: 'accept' | 'decline',
  ) => void;
  chooseDecoration: (
    decorationId: 'leafy-plant' | 'sunny-vase',
  ) => void;
  /** Progress through the current tick, 0..1, for interpolation. Read per frame. */
  alpha: () => number;
  loop: GameLoop | null;
  hydrateCareer: (
    career: StoredCareer,
    preferences: AppPreferencesEnvelope,
    startSystemPaused?: boolean,
    onBoundary?: (boundary: CompletedBoundary) => void,
  ) => void;
  clearHydratedCareer: () => void;
  exportCareer: () => StoredCareer | null;
  replaceHydratedCareer: (career: StoredCareer) => void;
  updatePreferences: (preferences: AppPreferencesEnvelope) => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  let resumeSpeed: Exclude<Speed, 0> = 1;
  let hydratedCareer: StoredCareer | null = null;
  return {
    snapshot: null,
    speed: 1,
    fatalError: null,
    ticksRun: 0,
    undoToast: null,
    loop: null,
    hydrateCareer: (
      career,
      preferences,
      startSystemPaused = false,
      onBoundary,
    ) => {
      hydratedCareer = StoredCareerSchema.parse(career);
      let hydrated!: GameLoop;
      hydrated = createLoop(
        career,
        preferences,
        (snapshot) => {
          if (get().loop !== hydrated) return;
          set({
            snapshot,
            ticksRun: hydrated.stats.ticksRun,
          });
        },
        (undoToast) => {
          if (get().loop !== hydrated) return;
          set({ undoToast });
        },
        () => hydratedCareer?.payload ?? career.payload,
        onBoundary,
      );
      const defaultSpeed =
        preferences.preferences.gameplay.defaultSpeed;
      resumeSpeed = defaultSpeed;
      hydrated.setSpeed(defaultSpeed);
      hydrated.setSystemPaused(startSystemPaused);
      set({
        loop: hydrated,
        snapshot: hydrated.snapshot,
        speed: defaultSpeed,
        fatalError: null,
        ticksRun: 0,
        undoToast: null,
      });
    },
    clearHydratedCareer: () => {
      hydratedCareer = null;
      set({
        loop: null,
        snapshot: null,
        speed: 1,
        fatalError: null,
        ticksRun: 0,
        undoToast: null,
      });
    },
    exportCareer: () => {
      const loop = get().loop;
      if (loop === null || hydratedCareer === null) return null;
      return StoredCareerSchema.parse({
        ...hydratedCareer,
        payload: loop.exportCareerPayload(hydratedCareer.payload),
      });
    },
    replaceHydratedCareer: (career) => {
      hydratedCareer = StoredCareerSchema.parse(career);
      const loop = get().loop;
      if (loop === null) return;
      const payload = loop.exportCareerPayload(hydratedCareer.payload);
      loop.setSimRules(deriveSimRules(payload, content));
    },
    updatePreferences: (preferences) => {
      get().loop?.setSleepSkipEnabled(
        preferences.preferences.gameplay.sleepAutoSkip,
      );
    },
    advanceFrame: (elapsedMs) => {
      if (get().fatalError !== null || get().loop === null) return;
      try {
        get().loop?.advance(elapsedMs);
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Unknown simulation error';
        get().loop?.setSpeed(0);
        set({ speed: 0, fatalError: message });
        console.error('Simulation paused after an error.', error);
      }
    },
    setSpeed: (speed) => {
      const loop = get().loop;
      if (get().fatalError !== null || loop === null) return;
      if (
        loop.session.letter.status === 'due' &&
        speed !== 0
      ) {
        return;
      }
      if (speed !== 0) resumeSpeed = speed;
      loop.setSpeed(speed);
      set({ speed });
    },
    togglePause: () => {
      const loop = get().loop;
      if (get().fatalError !== null || loop === null) return;
      if (loop.session.letter.status === 'due') return;
      const current = get().speed;
      const next = current === 0 ? resumeSpeed : 0;
      if (current !== 0) resumeSpeed = current;
      loop.setSpeed(next);
      set({ speed: next });
    },
    setSystemPaused: (paused) => {
      get().loop?.setSystemPaused(paused);
    },
    insertActivity: (activityId) => {
      get().loop?.enqueue({ type: 'insertPlayer', activityId });
    },
    stopCurrent: () => {
      get().loop?.enqueue({ type: 'stopCurrent' });
    },
    removeCard: (cardId) => {
      get().loop?.enqueue({ type: 'removeCard', cardId });
    },
    moveCard: (cardId, toIndex) => {
      get().loop?.enqueue({ type: 'moveCard', cardId, toIndex });
    },
    undoLastRemove: (receiptId) =>
      get().loop?.undoLastRemove(receiptId) ?? false,
    observeWhyLine: (cardId) => {
      get().loop?.enqueueAction({ type: 'whyLineOpened', cardId });
    },
    observeForecastChange: () => {
      get().loop?.enqueueAction({ type: 'forecastChangeObserved' });
    },
    selectIntention: (intentionId) => {
      const loop = get().loop;
      const day = get().snapshot?.day;
      if (loop === null || day === undefined) return;
      loop.enqueueAction({
        type: 'intentionSelected',
        intentionId,
        day,
        deliberate: true,
      });
    },
    addProtectedPractice: () => {
      const loop = get().loop;
      const snapshot = get().snapshot;
      if (loop === null || snapshot === null) return false;
      const playerCards = snapshot.queue.filter(
        (card) => card.source === 'player',
      ).length;
      if (playerCards > 8) return false;
      loop.enqueue({ type: 'insertPlayer', activityId: 'practice' });
      loop.enqueue({ type: 'insertPlayer', activityId: 'practice' });
      return true;
    },
    takeWrinkleAction: (wrinkleId, actionId) => {
      get().loop?.enqueueAction({
        type: 'wrinkleAction',
        wrinkleId,
        actionId,
      });
    },
    chooseGoalReward: (goalId, choiceId) => {
      get().loop?.enqueueAction({
        type: 'goalRewardChosen',
        goalId,
        choiceId,
      });
    },
    respondToLetter: (decision) => {
      const loop = get().loop;
      if (
        get().fatalError !== null ||
        loop === null ||
        loop.session.letter.status !== 'due'
      ) {
        return;
      }
      loop.enqueueAction({ type: 'letterResponded', decision });
      loop.runOneTick();
    },
    chooseDecoration: (decorationId) => {
      get().loop?.enqueueAction({
        type: 'decorationChosen',
        wrinkleId: 'package-delivery',
        decorationId,
      });
    },
    // The loop owns alpha now: it freezes the value on pause instead of snapping the
    // sim back to the start of its tick (adversarial pass 2).
    alpha: () => get().loop?.alpha ?? 0,
  };
});
