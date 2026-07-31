import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ContentRegistry } from '../sim/content';
import type { IdentityDraft, IdentityForm } from '../application/new-career';
import type { RecoveryBlob } from '../application/career-repository';
import { appShellStrings } from './app-shell-copy';
import { identityString } from './identity-copy';
import { settingsStrings } from './settings-copy';
import { CHROME, FONT, TYPE_SCALE, theme } from './theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  testID?: string;
}

function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  testID,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.buttonTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function LoadingShell({
  stage,
}: {
  stage: 'preferences' | 'career';
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={styles.root}
      testID={`loading-${stage}`}
    >
      <Text style={styles.body}>{appShellStrings.loading[stage]}</Text>
    </View>
  );
}

export function TitleShell({
  onNewGame,
  onResume,
  onSettings,
  error,
}: {
  onNewGame: () => void;
  onResume?: () => void;
  onSettings?: () => void;
  error?: string | null;
}) {
  return (
    <View style={styles.root} testID="title-screen">
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{appShellStrings.title.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {appShellStrings.title.name}
        </Text>
        <Text style={styles.body}>{appShellStrings.title.body}</Text>
        {error != null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          label={appShellStrings.title.newGame}
          onPress={onNewGame}
          testID="title-new-game"
        />
        {onResume !== undefined && (
          <Button
            label={appShellStrings.title.resume}
            onPress={onResume}
            secondary
            testID="title-resume"
          />
        )}
        {onSettings !== undefined && (
          <Button
            label={settingsStrings.pause.settings}
            onPress={onSettings}
            secondary
            testID="title-settings"
          />
        )}
      </View>
    </View>
  );
}

const PRONOUNS: ReadonlyArray<{
  label: string;
  value: IdentityForm['pronouns'];
}> = [
  {
    label: appShellStrings.identity.theyThem,
    value: { subject: 'they', object: 'them', possessive: 'their' },
  },
  {
    label: appShellStrings.identity.sheHer,
    value: { subject: 'she', object: 'her', possessive: 'her' },
  },
  {
    label: appShellStrings.identity.heHim,
    value: { subject: 'he', object: 'him', possessive: 'his' },
  },
];

const APPEARANCE_COLORS: Record<string, string> = {
  'morning-blue': theme.color.water,
  'moss-green': theme.color.leaf,
  'warm-clay': theme.color.terracotta,
  'plum-night': theme.color.plum,
};

export function IdentityShell({
  draft,
  content,
  busy,
  error,
  onBack,
  onComplete,
  onSkip,
}: {
  draft: IdentityDraft;
  content: ContentRegistry;
  busy: boolean;
  error: string | null;
  onBack?: () => void;
  onComplete: (form: IdentityForm) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState('Alex');
  const [pronouns, setPronouns] = useState(PRONOUNS[0]!.value);
  const [appearancePresetId, setAppearancePresetId] = useState(
    content.identity.appearancePresets[0]!.id,
  );
  const preferenceLabels = useMemo(() => {
    const chronotypeCategory = content.identity.preferenceCategories.find(
      (category) => category.id === 'chronotype',
    );
    const chronotypeOption = chronotypeCategory?.options.find(
      (option) =>
        option.mechanic.kind === 'chronotype' &&
        option.mechanic.value === draft.chronotype,
    );
    const secondOption = content.identity.preferenceCategories
      .find((category) => category.id === draft.secondCategoryId)
      ?.options.find((option) => option.id === draft.secondOptionId);
    if (chronotypeOption === undefined || secondOption === undefined) {
      throw new Error('identity preference labels are missing');
    }
    return [
      identityString(chronotypeOption.labelStringId),
      identityString(secondOption.labelStringId),
    ];
  }, [content, draft]);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onComplete({
      name: trimmed,
      pronouns,
      appearancePresetId,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollRoot}
      keyboardShouldPersistTaps="handled"
      testID="identity-screen"
    >
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{appShellStrings.identity.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {appShellStrings.identity.title}
        </Text>
        <Text style={styles.body}>{appShellStrings.identity.body}</Text>

        <Text style={styles.label}>{appShellStrings.identity.name}</Text>
        <TextInput
          accessibilityLabel={appShellStrings.identity.name}
          autoCapitalize="words"
          maxLength={40}
          onChangeText={setName}
          style={styles.input}
          testID="identity-name"
          value={name}
        />

        <Text style={styles.label}>{appShellStrings.identity.pronouns}</Text>
        <View style={styles.choiceRow}>
          {PRONOUNS.map((option) => {
            const selected =
              option.value.subject === pronouns.subject;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                key={option.value.subject}
                onPress={() => setPronouns(option.value)}
                style={[
                  styles.choice,
                  selected && styles.choiceSelected,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    selected && styles.choiceTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{appShellStrings.identity.appearance}</Text>
        <View style={styles.choiceRow}>
          {content.identity.appearancePresets.map((preset) => {
            const selected = preset.id === appearancePresetId;
            return (
              <Pressable
                accessibilityLabel={identityString(preset.labelStringId)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                key={preset.id}
                onPress={() => setAppearancePresetId(preset.id)}
                style={[
                  styles.appearance,
                  {
                    backgroundColor:
                      APPEARANCE_COLORS[preset.id] ?? theme.color.greyShadow,
                  },
                  selected && styles.choiceSelected,
                ]}
                testID={`appearance-${preset.id}`}
              />
            );
          })}
        </View>

        <Text style={styles.label}>{appShellStrings.identity.preferences}</Text>
        <View
          accessibilityLabel={preferenceLabels.join(', ')}
          style={styles.tagRow}
          testID="identity-preference-tags"
        >
          {preferenceLabels.map((label) => (
            <View
              key={label}
              style={styles.tag}
              testID="identity-preference-tag"
            >
              <Text style={styles.tagText}>{label}</Text>
            </View>
          ))}
        </View>

        {error !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          disabled={busy || name.trim().length === 0}
          label={appShellStrings.identity.start}
          onPress={submit}
          testID="identity-start"
        />
        <Button
          disabled={busy}
          label={appShellStrings.identity.skip}
          onPress={onSkip}
          secondary
          testID="identity-skip"
        />
        {onBack !== undefined && (
          <Button
            disabled={busy}
            label={appShellStrings.identity.back}
            onPress={onBack}
            secondary
            testID="identity-back"
          />
        )}
      </View>
    </ScrollView>
  );
}

export function RecoveryShell({
  blobs,
  copyState,
  onCopy,
  onStartFresh,
}: {
  blobs: RecoveryBlob[];
  copyState: 'idle' | 'copied' | 'show-raw';
  onCopy: () => void;
  onStartFresh: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const raw = blobs
    .map((blob) => `${blob.key}\n${blob.error}\n${blob.raw}`)
    .join('\n\n');
  return (
    <ScrollView
      contentContainerStyle={styles.scrollRoot}
      testID="career-recovery"
    >
      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>
          {confirming
            ? appShellStrings.recovery.confirmTitle
            : appShellStrings.recovery.title}
        </Text>
        <Text style={styles.body}>
          {confirming
            ? appShellStrings.recovery.confirmBody
            : appShellStrings.recovery.body}
        </Text>
        {confirming ? (
          <>
            <Button
              label={appShellStrings.recovery.confirm}
              onPress={onStartFresh}
              testID="recovery-confirm-fresh"
            />
            <Button
              label={appShellStrings.recovery.cancel}
              onPress={() => setConfirming(false)}
              secondary
            />
          </>
        ) : (
          <>
            <Button
              label={
                copyState === 'copied'
                  ? appShellStrings.recovery.copied
                  : appShellStrings.recovery.copyRaw
              }
              onPress={onCopy}
              secondary
              testID="recovery-copy"
            />
            <Button
              label={appShellStrings.recovery.startFresh}
              onPress={() => setConfirming(true)}
              testID="recovery-start-fresh"
            />
          </>
        )}
        {copyState === 'show-raw' && (
          <Text selectable style={styles.diagnostic}>
            {raw}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

export function ResumeNotice({
  fallback,
  onDismiss,
}: {
  fallback: boolean;
  onDismiss: () => void;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={styles.notice}
      testID="resume-notice"
    >
      <Text style={styles.noticeTitle}>{appShellStrings.resume.title}</Text>
      <Text style={styles.noticeBody}>
        {fallback
          ? appShellStrings.resume.fallback
          : appShellStrings.resume.body}
      </Text>
      <Button
        label={appShellStrings.resume.dismiss}
        onPress={onDismiss}
        secondary
      />
    </View>
  );
}

export function ConflictShell() {
  return (
    <View
      accessibilityRole="alert"
      style={styles.root}
      testID="career-writer-conflict"
    >
      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>
          {appShellStrings.conflict.title}
        </Text>
        <Text style={styles.body}>{appShellStrings.conflict.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.color.creamBase,
    justifyContent: 'center',
    padding: 24,
  },
  scrollRoot: {
    alignItems: 'center',
    backgroundColor: theme.color.creamBase,
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    ...CHROME.panel,
    maxWidth: 560,
    padding: 24,
    width: '100%',
  },
  eyebrow: {
    color: theme.color.waterShadow,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.color.ink,
    ...TYPE_SCALE.display,
    marginTop: 6,
  },
  body: {
    color: theme.color.ink,
    fontFamily: FONT.prose,
    fontSize: TYPE_SCALE.body.fontSize,
    lineHeight: 24,
    marginBottom: 22,
    marginTop: 10,
  },
  label: {
    color: theme.color.ink,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    ...CHROME.field,
    color: theme.color.ink,
    fontFamily: FONT.prose,
    fontSize: TYPE_SCALE.body.fontSize,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choice: {
    ...CHROME.secondaryButton,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceSelected: {
    ...CHROME.selectedControl,
  },
  choiceText: {
    color: theme.color.ink,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  choiceTextSelected: { color: theme.color.creamLight },
  appearance: {
    borderColor: theme.color.ink,
    borderRadius: 4,
    borderWidth: 3,
    borderBottomWidth: 5,
    height: 52,
    width: 52,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    ...CHROME.chip,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: {
    color: theme.color.ink,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  button: {
    ...CHROME.neutralButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  buttonSecondary: {
    ...CHROME.secondaryButton,
  },
  buttonPressed: {
    borderTopWidth: 2,
    transform: [{ translateY: 2 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: theme.color.creamLight,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  buttonTextSecondary: {
    color: theme.color.ink,
  },
  error: {
    color: theme.color.redShadow,
    fontSize: TYPE_SCALE.body.fontSize,
    marginTop: 16,
  },
  // Recovery diagnostics are dense technical copy, which is exactly what design.md §4
  // licenses the sans face for. It was the one surface where 8px was almost defensible
  // and still the one where a player is most stressed and least able to read it.
  diagnostic: {
    backgroundColor: theme.color.creamLight,
    color: theme.color.woodShadow,
    ...TYPE_SCALE.caption,
    marginTop: 16,
    maxHeight: 240,
    padding: 12,
  },
  notice: {
    ...CHROME.card,
    left: 24,
    maxWidth: 360,
    padding: 16,
    position: 'absolute',
    top: 24,
    zIndex: 200,
  },
  noticeTitle: {
    color: theme.color.ink,
    fontSize: TYPE_SCALE.body.fontSize,
    fontFamily: FONT.pixelBold,
    textTransform: 'uppercase',
  },
  noticeBody: {
    color: theme.color.ink,
    fontFamily: FONT.prose,
    fontSize: TYPE_SCALE.body.fontSize,
    marginTop: 6,
  },
});
