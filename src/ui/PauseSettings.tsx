import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  AppPreferencesEnvelope,
  IdentityState,
} from '../application/career-state';
import type { AutonomyMode } from '../sim/rules';
import { ENGINE_VERSION } from '../sim/version';
import { APP_VERSION } from '../application/app-version';
import { settingsStrings } from './settings-copy';
import { CHROME, FONT, TYPE_SCALE, theme } from './theme';
import { LAYER } from './layout';

type Page = 'pause' | 'settings';
type Confirmation = 'new-game' | 'reset' | null;

interface PauseSettingsProps {
  preferences: AppPreferencesEnvelope;
  identity: IdentityState;
  autonomy: AutonomyMode;
  lastSavedAt: number | null;
  error: string | null;
  busy?: boolean;
  onResume: () => void;
  onOpenGoals: () => void;
  onNewGame: () => void;
  onReturnToTitle: () => void;
  onPreferences: (next: AppPreferencesEnvelope) => void;
  onIdentity: (identity: IdentityState) => void;
  onAutonomy: (autonomy: AutonomyMode) => void;
  initialPage?: Page;
  showPauseMenu?: boolean;
  careerAvailable?: boolean;
}

function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.actionSecondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.actionText,
          secondary && styles.actionTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Toggle({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        aria-checked={value}
        onPress={() => onChange(!value)}
        style={[styles.toggle, value && styles.toggleOn]}
        testID={testID}
      >
        <Text style={styles.toggleText}>
          {value
            ? settingsStrings.settings.display.on
            : settingsStrings.settings.display.off}
        </Text>
      </Pressable>
    </View>
  );
}

function Options<T extends string | number>({
  label,
  value,
  options,
  onChange,
  testID,
}: {
  label: string;
  value: T;
  options: readonly { label: string; value: T }[];
  onChange: (value: T) => void;
  testID?: string;
}) {
  return (
    <View style={styles.optionBlock} testID={testID}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: option.value === value }}
            aria-checked={option.value === value}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              option.value === value && styles.optionSelected,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                option.value === value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Level({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.1,
  testID,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  testID?: string;
}) {
  const clamp = (next: number) =>
    Math.max(min, Math.min(max, Number(next.toFixed(2))));
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.levelControls}>
        <Pressable
          accessibilityLabel={`Lower ${label}`}
          accessibilityRole="button"
          onPress={() => onChange(clamp(value - step))}
          style={styles.smallButton}
        >
          <Text style={styles.smallButtonText}>−</Text>
        </Pressable>
        <Text
          accessibilityLabel={`${label} ${Math.round(value * 100)} percent`}
          style={styles.levelValue}
        >
          {Math.round(value * 100)}%
        </Text>
        <Pressable
          accessibilityLabel={`Raise ${label}`}
          accessibilityRole="button"
          onPress={() => onChange(clamp(value + step))}
          style={styles.smallButton}
        >
          <Text style={styles.smallButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function PauseSettings({
  preferences,
  identity,
  autonomy,
  lastSavedAt,
  error,
  busy = false,
  onResume,
  onOpenGoals,
  onNewGame,
  onReturnToTitle,
  onPreferences,
  onIdentity,
  onAutonomy,
  initialPage = 'pause',
  showPauseMenu = true,
  careerAvailable = true,
}: PauseSettingsProps) {
  const [page, setPage] = useState<Page>(initialPage);
  const [confirmation, setConfirmation] =
    useState<Confirmation>(null);
  const [name, setName] = useState(identity.name);
  const [pronouns, setPronouns] = useState(identity.pronouns);
  const [audioAnnouncement, setAudioAnnouncement] = useState('');

  useEffect(() => {
    setName(identity.name);
    setPronouns(identity.pronouns);
  }, [identity]);

  const updatePreferences = (
    update: (
      value: AppPreferencesEnvelope['preferences'],
    ) => AppPreferencesEnvelope['preferences'],
  ) => {
    onPreferences({
      ...preferences,
      preferences: update(preferences.preferences),
    });
  };

  const setAudio = (
    key: 'master' | 'music' | 'sfx',
    value: number,
  ) => {
    updatePreferences((current) => ({
      ...current,
      audio: { ...current.audio, [key]: value },
    }));
  };

  const confirmIdentity = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onIdentity({ ...identity, name: trimmed, pronouns });
  };

  if (confirmation !== null) {
    const reset = confirmation === 'reset';
    return (
      <View
        accessibilityViewIsModal
        style={styles.overlay}
        testID={`${confirmation}-confirmation`}
      >
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.title}>
            {reset
              ? settingsStrings.confirm.resetTitle
              : settingsStrings.confirm.newGameTitle}
          </Text>
          <Text style={styles.body}>
            {reset
              ? settingsStrings.confirm.resetBody
              : settingsStrings.confirm.newGameBody}
          </Text>
          <Action
            disabled={busy}
            label={settingsStrings.confirm.continue}
            onPress={onNewGame}
            testID="confirm-new-game"
          />
          <Action
            label={settingsStrings.confirm.cancel}
            onPress={() => setConfirmation(null)}
            secondary
          />
        </View>
      </View>
    );
  }

  if (page === 'pause') {
    return (
      <View
        accessibilityViewIsModal
        style={styles.overlay}
        testID="pause-menu"
      >
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.title}>
            {settingsStrings.pause.title}
          </Text>
          {error !== null && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Action
            label={settingsStrings.pause.resume}
            onPress={onResume}
            testID="pause-resume"
          />
          <Action
            label={settingsStrings.pause.settings}
            onPress={() => setPage('settings')}
            secondary
            testID="pause-settings"
          />
          <Action
            label={settingsStrings.pause.goals}
            onPress={onOpenGoals}
            secondary
            testID="pause-goals"
          />
          <Action
            label={settingsStrings.pause.newGame}
            onPress={() => setConfirmation('new-game')}
            secondary
            testID="pause-new-game"
          />
          <Action
            disabled={busy}
            label={settingsStrings.pause.returnTitle}
            onPress={onReturnToTitle}
            secondary
            testID="pause-return-title"
          />
        </View>
      </View>
    );
  }

  const p = preferences.preferences;
  const savedLabel =
    lastSavedAt === null || lastSavedAt === 0
      ? settingsStrings.settings.data.neverSaved
      : new Date(lastSavedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
  return (
    <View
      accessibilityViewIsModal
      style={styles.overlay}
      testID="settings-screen"
    >
      <ScrollView contentContainerStyle={styles.settingsPanel}>
        <Text accessibilityRole="header" style={styles.title}>
          {settingsStrings.settings.title}
        </Text>
        {error !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}

        <Section title={settingsStrings.settings.audio.title}>
          <Level
            label={settingsStrings.settings.audio.master}
            onChange={(value) => setAudio('master', value)}
            value={p.audio.master}
          />
          <Level
            label={settingsStrings.settings.audio.music}
            onChange={(value) => setAudio('music', value)}
            value={p.audio.music}
          />
          <Level
            label={settingsStrings.settings.audio.sfx}
            onChange={(value) => setAudio('sfx', value)}
            value={p.audio.sfx}
          />
          <Toggle
            label={settingsStrings.settings.audio.mute}
            onChange={(muted) => {
              updatePreferences((current) => ({
                ...current,
                audio: { ...current.audio, muted },
              }));
              setAudioAnnouncement(
                muted
                  ? settingsStrings.settings.audio.muted
                  : settingsStrings.settings.audio.unmuted,
              );
            }}
            testID="settings-mute"
            value={p.audio.muted}
          />
          <Text accessibilityLiveRegion="polite" style={styles.srStatus}>
            {audioAnnouncement}
          </Text>
        </Section>

        <Section title={settingsStrings.settings.gameplay.title}>
          <Options
            label={settingsStrings.settings.gameplay.defaultSpeed}
            onChange={(defaultSpeed) =>
              updatePreferences((current) => ({
                ...current,
                gameplay: { ...current.gameplay, defaultSpeed },
              }))
            }
            options={[
              { label: '1×', value: 1 },
              { label: '2×', value: 2 },
              { label: '4×', value: 4 },
            ]}
            testID="settings-default-speed"
            value={p.gameplay.defaultSpeed}
          />
          <Toggle
            label={settingsStrings.settings.gameplay.sleepSkip}
            onChange={(sleepAutoSkip) =>
              updatePreferences((current) => ({
                ...current,
                gameplay: { ...current.gameplay, sleepAutoSkip },
              }))
            }
            value={p.gameplay.sleepAutoSkip}
          />
          <Toggle
            label={settingsStrings.settings.gameplay.intentionPrompt}
            onChange={(dailyIntentionPrompt) =>
              updatePreferences((current) => ({
                ...current,
                gameplay: {
                  ...current.gameplay,
                  dailyIntentionPrompt,
                },
              }))
            }
            value={p.gameplay.dailyIntentionPrompt}
          />
          {careerAvailable && (
            <Options
              label={settingsStrings.settings.gameplay.autonomy}
              onChange={onAutonomy}
              options={[
                {
                  label:
                    settingsStrings.settings.gameplay.fullRoutine,
                  value: 'full-routine',
                },
                {
                  label:
                    settingsStrings.settings.gameplay.essentialsOnly,
                  value: 'essentials-only',
                },
                {
                  label:
                    settingsStrings.settings.gameplay.reactiveOnly,
                  value: 'reactive-only',
                },
              ]}
              testID="settings-autonomy"
              value={autonomy}
            />
          )}
        </Section>

        <Section title={settingsStrings.settings.display.title}>
          <Options
            label={settingsStrings.settings.display.reducedMotion}
            onChange={(reducedMotion) =>
              updatePreferences((current) => ({
                ...current,
                display: { ...current.display, reducedMotion },
              }))
            }
            options={[
              {
                label: settingsStrings.settings.display.system,
                value: 'system',
              },
              {
                label: settingsStrings.settings.display.on,
                value: 'on',
              },
              {
                label: settingsStrings.settings.display.off,
                value: 'off',
              },
            ]}
            value={p.display.reducedMotion}
          />
          <Level
            label={settingsStrings.settings.display.hudScale}
            max={1.5}
            min={0.75}
            onChange={(hudTextScale) =>
              updatePreferences((current) => ({
                ...current,
                display: { ...current.display, hudTextScale },
              }))
            }
            step={0.25}
            value={p.display.hudTextScale}
          />
          <Toggle
            label={settingsStrings.settings.display.fractionalScaling}
            onChange={(fractionalScaling) =>
              updatePreferences((current) => ({
                ...current,
                display: {
                  ...current.display,
                  fractionalScaling,
                },
              }))
            }
            value={p.display.fractionalScaling}
          />
        </Section>

        <Section
          title={settingsStrings.settings.accessibility.title}
        >
          <Toggle
            label={
              settingsStrings.settings.accessibility.nonColorUrgency
            }
            onChange={(nonColorUrgency) =>
              updatePreferences((current) => ({
                ...current,
                accessibility: {
                  ...current.accessibility,
                  nonColorUrgency,
                },
              }))
            }
            value={p.accessibility.nonColorUrgency}
          />
          <Options
            label={settingsStrings.settings.accessibility.verbosity}
            onChange={(screenReaderVerbosity) =>
              updatePreferences((current) => ({
                ...current,
                accessibility: {
                  ...current.accessibility,
                  screenReaderVerbosity,
                },
              }))
            }
            options={[
              {
                label:
                  settingsStrings.settings.accessibility.brief,
                value: 'brief',
              },
              {
                label:
                  settingsStrings.settings.accessibility.full,
                value: 'full',
              },
            ]}
            value={p.accessibility.screenReaderVerbosity}
          />
        </Section>

        <Section title={settingsStrings.settings.controls.title}>
          <Text style={styles.reference}>
            {settingsStrings.settings.controls.reference}
          </Text>
        </Section>

        {careerAvailable && (
        <Section title={settingsStrings.settings.sim.title}>
          <Text style={styles.rowLabel}>
            {settingsStrings.settings.sim.name}
          </Text>
          <TextInput
            accessibilityLabel={settingsStrings.settings.sim.name}
            maxLength={40}
            onChangeText={setName}
            style={styles.input}
            testID="settings-name"
            value={name}
          />
          <Options
            label={settingsStrings.settings.sim.pronouns}
            onChange={(subject) => {
              setPronouns(
                subject === 'she'
                  ? { subject: 'she', object: 'her', possessive: 'her' }
                  : subject === 'he'
                    ? { subject: 'he', object: 'him', possessive: 'his' }
                    : {
                        subject: 'they',
                        object: 'them',
                        possessive: 'their',
                      },
              );
            }}
            options={[
              { label: 'They / them', value: 'they' },
              { label: 'She / her', value: 'she' },
              { label: 'He / him', value: 'he' },
            ]}
            value={pronouns.subject as 'they' | 'she' | 'he'}
          />
          <Action
            disabled={name.trim().length === 0}
            label={settingsStrings.settings.sim.save}
            onPress={confirmIdentity}
            secondary
            testID="settings-save-identity"
          />
        </Section>
        )}

        {careerAvailable && (
        <Section title={settingsStrings.settings.data.title}>
          <Text style={styles.reference}>
            {`${settingsStrings.settings.data.lastSaved}: ${savedLabel}`}
          </Text>
          <Action
            label={settingsStrings.settings.data.reset}
            onPress={() => setConfirmation('reset')}
            secondary
            testID="settings-reset"
          />
        </Section>
        )}

        <Section title={settingsStrings.settings.about.title}>
          <Text style={styles.reference}>
            {`${settingsStrings.settings.about.appVersion}: ${APP_VERSION}`}
          </Text>
          <Text style={styles.reference}>
            {`${settingsStrings.settings.about.engineVersion}: ${ENGINE_VERSION}`}
          </Text>
          <Text style={styles.reference}>
            {settingsStrings.settings.about.credits}
          </Text>
        </Section>

        <Action
          label={settingsStrings.settings.back}
          onPress={() =>
            showPauseMenu ? setPage('pause') : onResume()
          }
          testID="settings-back"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(36, 31, 46, 0.9)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: 24,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: LAYER.modal,
  },
  panel: {
    ...CHROME.panel,
    gap: 10,
    maxWidth: 520,
    padding: 24,
    width: '100%',
  },
  settingsPanel: {
    alignSelf: 'center',
    ...CHROME.panel,
    gap: 16,
    maxWidth: 760,
    padding: 24,
    width: '100%',
  },
  title: {
    color: theme.color.ink,
    ...TYPE_SCALE.display,
    marginBottom: 10,
  },
  body: {
    color: theme.color.ink,
    fontFamily: FONT.prose,
    fontSize: TYPE_SCALE.body.fontSize,
    lineHeight: 24,
    marginBottom: 8,
  },
  error: {
    color: theme.color.redShadow,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
  },
  action: {
    ...CHROME.neutralButton,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionSecondary: {
    ...CHROME.secondaryButton,
  },
  actionText: {
    color: theme.color.creamLight,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionTextSecondary: {
    color: theme.color.ink,
  },
  pressed: { borderTopWidth: 2, transform: [{ translateY: 2 }] },
  disabled: { opacity: 0.45 },
  section: {
    borderColor: theme.color.grey,
    borderTopWidth: 2,
    gap: 10,
    paddingTop: 14,
  },
  sectionTitle: {
    color: theme.color.waterShadow,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowLabel: {
    color: theme.color.ink,
    flexShrink: 1,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
  },
  toggle: {
    alignItems: 'center',
    backgroundColor: theme.color.grey,
    borderColor: theme.color.ink,
    borderRadius: 4,
    borderWidth: 2,
    borderBottomWidth: 4,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 12,
  },
  toggleOn: {
    backgroundColor: theme.color.water,
    borderBottomColor: theme.color.waterShadow,
    borderTopColor: theme.color.waterLight,
  },
  toggleText: {
    color: theme.color.creamLight,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  optionBlock: { gap: 8 },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    ...CHROME.secondaryButton,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  optionSelected: {
    ...CHROME.selectedControl,
  },
  optionText: {
    color: theme.color.ink,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  optionTextSelected: { color: theme.color.creamLight },
  levelControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    ...CHROME.secondaryButton,
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  smallButtonText: {
    color: theme.color.ink,
    fontSize: TYPE_SCALE.heading.fontSize,
    fontFamily: FONT.pixelBold,
  },
  levelValue: {
    color: theme.color.ink,
    fontVariant: ['tabular-nums'],
    minWidth: 48,
    textAlign: 'center',
  },
  input: {
    ...CHROME.field,
    color: theme.color.ink,
    fontSize: TYPE_SCALE.body.fontSize,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  reference: {
    color: theme.color.ink,
    fontFamily: FONT.prose,
    fontSize: TYPE_SCALE.body.fontSize,
    lineHeight: 21,
  },
  srStatus: {
    color: theme.color.ink,
    fontSize: TYPE_SCALE.body.fontSize,
    minHeight: 18,
  },
});
