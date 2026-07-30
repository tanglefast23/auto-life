import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { kv } from '../persistence/kv';
import { content } from '../sim/content';
import {
  beginIdentity,
  bootApplication,
  type BootState,
} from './boot';
import {
  AppPreferencesRepository,
  CareerRepository,
  StaleCareerWriterError,
} from './career-repository';
import { GameScreen } from './GameScreen';
import { useGameStore } from './game-store';
import {
  AppPreferencesEnvelopeSchema,
  IdentityStateSchema,
  StoredCareerSchema,
  defaultIdentity,
  newAppPreferencesEnvelope,
  type AppPreferencesEnvelope,
  type IdentityState,
  type StoredCareer,
} from './career-state';
import {
  CryptoSeedSource,
  finishIdentityCareer,
  prepareIdentityDraft,
  skipIdentityCareer,
  type IdentityDraft,
  type IdentityForm,
  type SeedSource,
} from './new-career';
import {
  ConflictShell,
  IdentityShell,
  LoadingShell,
  RecoveryShell,
  ResumeNotice,
  TitleShell,
} from '../ui/AppShell';
import { appShellStrings } from '../ui/app-shell-copy';
import { CareerSaveController } from './save-controller';
import { PauseSettings } from '../ui/PauseSettings';
import { settingsStrings } from '../ui/settings-copy';
import { SilentAudioBus } from './audio-bus';
import { careerPreferenceTags } from '../ui/preference-tags';
import type { GameLoop } from './loop';

function writerId(): string {
  const cryptoValue = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  return cryptoValue?.randomUUID?.() ?? 'single-process-writer';
}

function isHidden(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  );
}

/**
 * The load-before-loop composition root. A GameLoop is constructed only after
 * preferences and one complete career generation have both been selected.
 */
export function ApplicationRoot({
  seedSource: injectedSeedSource,
}: {
  seedSource?: SeedSource;
} = {}) {
  const [boot, setBoot] = useState<BootState>({
    status: 'loading-preferences',
  });
  const [writerConflict, setWriterConflict] = useState(false);
  const [identityDraft, setIdentityDraft] =
    useState<IdentityDraft | null>(null);
  const [creatingCareer, setCreatingCareer] = useState(false);
  const [shellError, setShellError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<
    'idle' | 'copied' | 'show-raw'
  >('idle');
  const [showResumeNotice, setShowResumeNotice] = useState(false);
  const [preferences, setPreferences] =
    useState<AppPreferencesEnvelope>(() => newAppPreferencesEnvelope());
  const [careerView, setCareerView] = useState<StoredCareer | null>(
    null,
  );
  const [pauseOpen, setPauseOpen] = useState(false);
  const [titleSettingsOpen, setTitleSettingsOpen] = useState(false);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [openGoalsRequest, setOpenGoalsRequest] = useState(0);
  const [muteAnnouncement, setMuteAnnouncement] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const resetBeforeSave = useRef(false);
  const hydratedKey = useRef<string | null>(null);
  const currentCareer = useRef<
    Extract<BootState, { status: 'resume' }>['career'] | null
  >(null);
  const saveController = useRef<CareerSaveController | null>(null);
  const titleCareer = useRef<StoredCareer | null>(null);
  const identityReturnLoop = useRef<GameLoop | null>(null);
  const hydrateCareer = useGameStore((state) => state.hydrateCareer);
  const loop = useGameStore((state) => state.loop);
  const clearHydratedCareer = useGameStore(
    (state) => state.clearHydratedCareer,
  );
  const replaceHydratedCareer = useGameStore(
    (state) => state.replaceHydratedCareer,
  );
  const repositories = useMemo(() => {
    const careers = new CareerRepository(kv, content, writerId());
    return {
      careers,
      preferences: new AppPreferencesRepository(kv),
    };
  }, []);
  const cryptoSeedSource = useMemo(() => new CryptoSeedSource(), []);
  const seedSource = injectedSeedSource ?? cryptoSeedSource;
  const audioBus = useMemo(
    () => new SilentAudioBus(preferences.preferences.audio),
    [],
  );

  useEffect(() => {
    audioBus.apply(preferences.preferences.audio);
  }, [audioBus, preferences.preferences.audio]);

  useEffect(() => {
    let active = true;
    void bootApplication(
      {
        ...repositories,
        isHidden,
      },
      (state) => {
        if (!active) return;
        if ('preferences' in state) setPreferences(state.preferences);
        if (state.status === 'resume') setShowResumeNotice(true);
        setBoot(state);
      },
    ).catch(() => {
      if (!active) return;
      setBoot((state) => ({
        status: 'recovery',
        preferences:
          'preferences' in state
            ? state.preferences
            : newAppPreferencesEnvelope(),
        resetFence: 0,
        blobs: [],
      }));
    });
    return () => {
      active = false;
    };
  }, [repositories]);

  useEffect(() => {
    if (boot.status !== 'resume') {
      saveController.current?.stop();
      saveController.current = null;
      currentCareer.current = null;
      setCareerView(null);
      hydratedKey.current = null;
      clearHydratedCareer();
      return;
    }
    const key = `${boot.career.careerId}:${boot.career.generation}`;
    if (hydratedKey.current === key) return;
    currentCareer.current = boot.career;
    setCareerView(boot.career);
    setLastSavedAt(boot.career.savedAtEpochMs);
    const controller = new CareerSaveController(
      repositories.careers,
      () => useGameStore.getState().exportCareer(),
      (saved) => {
        currentCareer.current = saved;
        setCareerView(saved);
        replaceHydratedCareer(saved);
        setLastSavedAt(saved.savedAtEpochMs);
        setSaveError(null);
      },
      (error) => {
        if (error instanceof StaleCareerWriterError) {
          useGameStore.getState().setSystemPaused(true);
          setWriterConflict(true);
          return;
        }
        setSaveError(appShellStrings.errors.save);
      },
    );
    saveController.current = controller;
    hydrateCareer(
      boot.career,
      boot.preferences,
      boot.startSystemPaused,
      (boundary) => controller.observeBoundary(boundary),
    );
    hydratedKey.current = key;
    controller.start();
    return () => {
      controller.stop();
      if (saveController.current === controller) {
        saveController.current = null;
      }
    };
  }, [
    boot,
    clearHydratedCareer,
    hydrateCareer,
    replaceHydratedCareer,
    repositories,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      void saveController.current?.requestImmediate(
        'visibility-hidden',
      );
    };
    const onPageHide = () => {
      void saveController.current?.requestImmediate('pagehide');
    };
    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );
    globalThis.addEventListener?.('pagehide', onPageHide);
    return () => {
      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );
      globalThis.removeEventListener?.('pagehide', onPageHide);
    };
  }, []);

  useEffect(
    () =>
      repositories.careers.watch(() => {
        useGameStore.getState().setSystemPaused(true);
        setWriterConflict(true);
      }),
    [repositories],
  );

  const startIdentity = (reset: boolean) => {
    if (boot.status !== 'title' && boot.status !== 'recovery') return;
    try {
      const draft = prepareIdentityDraft(seedSource, content);
      const activePreferences = preferences;
      identityReturnLoop.current = null;
      resetBeforeSave.current = reset;
      setShellError(null);
      setIdentityDraft(draft);
      setBoot(
        beginIdentity({
          status: 'title',
          preferences: activePreferences,
        }),
      );
    } catch {
      setShellError(appShellStrings.errors.seed);
    }
  };

  const persistNewCareer = async (
    careerFactory: () => ReturnType<typeof finishIdentityCareer>,
  ) => {
    if (
      boot.status !== 'identity' &&
      identityReturnLoop.current === null
    ) {
      return;
    }
    setCreatingCareer(true);
    setShellError(null);
    try {
      const career = careerFactory();
      const saved = resetBeforeSave.current
        ? await repositories.careers.resetWithCareer(career, Date.now())
        : await repositories.careers.save(career, Date.now());
      identityReturnLoop.current = null;
      setIdentityDraft(null);
      setShowResumeNotice(false);
      setLastSavedAt(saved.savedAtEpochMs);
      setBoot({
        status: 'resume',
        preferences,
        career: saved,
        fallbackNotice: false,
        startSystemPaused: isHidden(),
      });
    } catch {
      setShellError(appShellStrings.errors.save);
    } finally {
      setCreatingCareer(false);
    }
  };

  const startIdentityFromCareer = () => {
    if (boot.status !== 'resume' || loop === null) return;
    try {
      const draft = prepareIdentityDraft(seedSource, content);
      identityReturnLoop.current = loop;
      resetBeforeSave.current = true;
      setPauseOpen(false);
      setShellError(null);
      setIdentityDraft(draft);
    } catch {
      setSaveError(appShellStrings.errors.seed);
    }
  };

  const returnFromIdentity = () => {
    if (
      boot.status !== 'resume' ||
      identityReturnLoop.current === null
    ) {
      return;
    }
    identityReturnLoop.current = null;
    resetBeforeSave.current = false;
    setIdentityDraft(null);
    setShellError(null);
    setSaveError(null);
    if (!isHidden()) useGameStore.getState().setSystemPaused(false);
  };

  const updatePreferences = (next: AppPreferencesEnvelope) => {
    let parsed: AppPreferencesEnvelope;
    try {
      parsed = AppPreferencesEnvelopeSchema.parse(next);
    } catch {
      setSaveError(settingsStrings.errors.settingsSave);
      return;
    }
    void repositories.preferences.save(parsed).then(
      (saved) => {
        setPreferences(saved);
        useGameStore.getState().updatePreferences(saved);
        setSaveError(null);
      },
      () => setSaveError(settingsStrings.errors.settingsSave),
    );
  };

  const replaceCareer = (
    update: (career: StoredCareer) => StoredCareer,
  ) => {
    const exported = useGameStore.getState().exportCareer();
    if (exported === null) return;
    try {
      const next = StoredCareerSchema.parse(update(exported));
      currentCareer.current = next;
      setCareerView(next);
      replaceHydratedCareer(next);
      void saveController.current?.requestImmediate('major-decision');
    } catch {
      setSaveError(settingsStrings.errors.careerSave);
    }
  };

  const updateIdentity = (identity: IdentityState) => {
    const parsed = IdentityStateSchema.parse(identity);
    replaceCareer((career) => ({
      ...career,
      payload: { ...career.payload, identity: parsed },
    }));
  };

  const updateAutonomy = (
    autonomy: StoredCareer['payload']['autonomy'],
  ) => {
    replaceCareer((career) => {
      if (career.payload.autonomy === autonomy) return career;
      return {
        ...career,
        payload: {
          ...career.payload,
          autonomy,
          rulesRevision: career.payload.rulesRevision + 1,
        },
      };
    });
  };

  const openPause = () => {
    useGameStore.getState().setSystemPaused(true);
    setPauseOpen(true);
    setSaveError(null);
  };

  const resumeFromPause = () => {
    setPauseOpen(false);
    if (!isHidden()) useGameStore.getState().setSystemPaused(false);
  };

  const toggleMute = () => {
    const muted = !preferences.preferences.audio.muted;
    updatePreferences({
      ...preferences,
      preferences: {
        ...preferences.preferences,
        audio: { ...preferences.preferences.audio, muted },
      },
    });
    setMuteAnnouncement(
      muted
        ? settingsStrings.settings.audio.muted
        : settingsStrings.settings.audio.unmuted,
    );
  };

  const returnToTitle = () => {
    setTransitionBusy(true);
    setSaveError(null);
    void saveController.current
      ?.requestImmediate('return-to-title')
      .then((saved) => {
        if (!saved || currentCareer.current === null) {
          setSaveError(settingsStrings.errors.returnTitle);
          return;
        }
        titleCareer.current = currentCareer.current;
        setPauseOpen(false);
        setBoot({ status: 'title', preferences });
      })
      .finally(() => setTransitionBusy(false));
  };

  const resumeFromTitle = () => {
    if (titleCareer.current === null) return;
    setTitleSettingsOpen(false);
    setBoot({
      status: 'resume',
      preferences,
      career: titleCareer.current,
      fallbackNotice: false,
      startSystemPaused: isHidden(),
    });
  };

  const completeIdentity = (form: IdentityForm) => {
    if (identityDraft === null) return;
    void persistNewCareer(() =>
      finishIdentityCareer(identityDraft, form, content),
    );
  };

  const skipIdentity = () => {
    if (identityDraft === null) return;
    void persistNewCareer(() =>
      skipIdentityCareer(identityDraft, content),
    );
  };

  const copyRecovery = () => {
    if (boot.status !== 'recovery') return;
    const text = boot.blobs
      .map((blob) => `${blob.key}\n${blob.error}\n${blob.raw}`)
      .join('\n\n');
    const clipboard = (
      globalThis.navigator as
        | { clipboard?: { writeText: (value: string) => Promise<void> } }
        | undefined
    )?.clipboard;
    if (clipboard === undefined) {
      setCopyState('show-raw');
      return;
    }
    void clipboard.writeText(text).then(
      () => setCopyState('copied'),
      () => setCopyState('show-raw'),
    );
  };

  if (writerConflict) {
    return <ConflictShell />;
  }
  if (
    boot.status === 'resume' &&
    loop !== null &&
    identityDraft !== null &&
    identityReturnLoop.current === loop
  ) {
    return (
      <IdentityShell
        busy={creatingCareer}
        content={content}
        draft={identityDraft}
        error={shellError}
        onBack={returnFromIdentity}
        onComplete={completeIdentity}
        onSkip={skipIdentity}
      />
    );
  }
  if (boot.status === 'resume' && loop !== null) {
    const visibleCareer =
      careerView ?? currentCareer.current ?? boot.career;
    return (
      <View style={styles.root}>
        <GameScreen
          onOpenPause={openPause}
          onToggleMute={toggleMute}
          openGoalsRequest={openGoalsRequest}
          preferences={preferences.preferences}
          preferenceTags={careerPreferenceTags(visibleCareer)}
          autonomy={visibleCareer.payload.autonomy}
        />
        <View
          accessibilityLiveRegion="polite"
          style={styles.srOnly}
        >
          {muteAnnouncement}
        </View>
        {pauseOpen && careerView !== null && (
          <PauseSettings
            autonomy={careerView.payload.autonomy}
            busy={transitionBusy}
            error={saveError}
            identity={careerView.payload.identity}
            lastSavedAt={lastSavedAt}
            onAutonomy={updateAutonomy}
            onIdentity={updateIdentity}
            onNewGame={startIdentityFromCareer}
            onOpenGoals={() => {
              resumeFromPause();
              setOpenGoalsRequest((value) => value + 1);
            }}
            onPreferences={updatePreferences}
            onResume={resumeFromPause}
            onReturnToTitle={returnToTitle}
            preferences={preferences}
          />
        )}
        {showResumeNotice && (
          <ResumeNotice
            fallback={boot.fallbackNotice}
            onDismiss={() => setShowResumeNotice(false)}
          />
        )}
      </View>
    );
  }
  if (boot.status === 'loading-preferences') {
    return <LoadingShell stage="preferences" />;
  }
  if (boot.status === 'loading-career') {
    return <LoadingShell stage="career" />;
  }
  if (boot.status === 'title') {
    if (titleSettingsOpen) {
      return (
        <PauseSettings
          autonomy="full-routine"
          careerAvailable={false}
          error={saveError}
          identity={defaultIdentity()}
          initialPage="settings"
          lastSavedAt={null}
          onAutonomy={() => undefined}
          onIdentity={() => undefined}
          onNewGame={() => undefined}
          onOpenGoals={() => undefined}
          onPreferences={updatePreferences}
          onResume={() => setTitleSettingsOpen(false)}
          onReturnToTitle={() => undefined}
          preferences={preferences}
          showPauseMenu={false}
        />
      );
    }
    return (
      <TitleShell
        error={shellError}
        onNewGame={() => startIdentity(titleCareer.current !== null)}
        onResume={
          titleCareer.current === null ? undefined : resumeFromTitle
        }
        onSettings={() => setTitleSettingsOpen(true)}
      />
    );
  }
  if (boot.status === 'identity' && identityDraft !== null) {
    return (
      <IdentityShell
        busy={creatingCareer}
        content={content}
        draft={identityDraft}
        error={shellError}
        onComplete={completeIdentity}
        onSkip={skipIdentity}
      />
    );
  }
  if (boot.status === 'recovery') {
    return (
      <RecoveryShell
        blobs={boot.blobs}
        copyState={copyState}
        onCopy={copyRecovery}
        onStartFresh={() => startIdentity(true)}
      />
    );
  }
  return <View style={styles.root} testID={`boot-${boot.status}`} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#2e2119',
  },
  srOnly: {
    height: 1,
    left: -10_000,
    overflow: 'hidden',
    position: 'absolute',
    width: 1,
  },
});
