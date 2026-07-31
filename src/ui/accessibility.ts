import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import type { AppPreferences } from '../application/career-state';

/**
 * One motion preference for every presentation surface.
 *
 * Web reads the browser media query directly; native uses React Native's
 * AccessibilityInfo event. State changes never touch deterministic sim/game data.
 *
 * The initial value is **not** a hardcoded `false`. It was, and an audit caught what
 * that costs: every animated surface receives `false` on its very first render, so a
 * system reduced-motion user watches the opening slide/pulse/crossfade play before the
 * effect lands and switches it off — the one frame the setting exists to prevent.
 * Web can answer synchronously, so it does. Native's only API is asynchronous, so the
 * first answer is cached at module scope and every later mount starts from it.
 */

/** Last value native reported. Only the first mount of a session can miss it. */
let lastNativePreference = false;

function initialReducedMotion(): boolean {
  if (
    Platform.OS === 'web' &&
    typeof globalThis.matchMedia === 'function'
  ) {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return lastNativePreference;
}

export function useReducedMotionPreference(
  override: AppPreferences['display']['reducedMotion'] = 'system',
): boolean {
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);

  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      typeof globalThis.matchMedia === 'function'
    ) {
      const query = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReducedMotion(query.matches);
      update();
      query.addEventListener?.('change', update);
      return () => query.removeEventListener?.('change', update);
    }

    let live = true;
    const remember = (enabled: boolean) => {
      lastNativePreference = enabled;
      setReducedMotion(enabled);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (live) remember(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      remember,
    );
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  if (override === 'on') return true;
  if (override === 'off') return false;
  return reducedMotion;
}
