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
  'morning-blue': '#6f93ad',
  'moss-green': '#778a57',
  'warm-clay': '#bc6b42',
  'plum-night': '#70546f',
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
                <Text style={styles.choiceText}>{option.label}</Text>
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
                      APPEARANCE_COLORS[preset.id] ?? '#8d7a68',
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
    backgroundColor: '#2e2119',
    justifyContent: 'center',
    padding: 24,
  },
  scrollRoot: {
    alignItems: 'center',
    backgroundColor: '#2e2119',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: '#f4e4c1',
    borderColor: '#6d4334',
    borderRadius: 10,
    borderWidth: 2,
    maxWidth: 560,
    padding: 28,
    width: '100%',
  },
  eyebrow: {
    color: '#9d4e33',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: '#4b2e24',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 6,
  },
  body: {
    color: '#6d4334',
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 22,
    marginTop: 10,
  },
  label: {
    color: '#4b2e24',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff8e7',
    borderColor: '#9b765f',
    borderRadius: 6,
    borderWidth: 1,
    color: '#3c271f',
    fontSize: 18,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choice: {
    backgroundColor: '#fff8e7',
    borderColor: '#b58b68',
    borderRadius: 6,
    borderWidth: 2,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceSelected: {
    borderColor: '#3c6757',
    borderWidth: 3,
  },
  choiceText: {
    color: '#4b2e24',
    fontSize: 15,
    fontWeight: '600',
  },
  appearance: {
    borderColor: '#b58b68',
    borderRadius: 6,
    borderWidth: 2,
    height: 52,
    width: 52,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#d7e0b4',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: {
    color: '#3c4f35',
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#3c6757',
    borderColor: '#28463b',
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  buttonSecondary: {
    backgroundColor: '#f4e4c1',
    borderColor: '#7d5b49',
  },
  buttonPressed: {
    transform: [{ translateY: 1 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff8e7',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonTextSecondary: {
    color: '#5b3b2f',
  },
  error: {
    color: '#8a2f2f',
    fontSize: 14,
    marginTop: 16,
  },
  diagnostic: {
    backgroundColor: '#fff8e7',
    color: '#4b2e24',
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 18,
    maxHeight: 240,
    padding: 10,
  },
  notice: {
    backgroundColor: '#f4e4c1',
    borderColor: '#3c6757',
    borderRadius: 8,
    borderWidth: 2,
    left: 24,
    maxWidth: 360,
    padding: 16,
    position: 'absolute',
    top: 24,
    zIndex: 200,
  },
  noticeTitle: {
    color: '#4b2e24',
    fontSize: 18,
    fontWeight: '800',
  },
  noticeBody: {
    color: '#6d4334',
    fontSize: 14,
    marginTop: 6,
  },
});
