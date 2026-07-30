import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * One motion preference for every presentation surface.
 *
 * Web reads the browser media query directly; native uses React Native's
 * AccessibilityInfo event. State changes never touch deterministic sim/game data.
 */
export function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

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
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (live) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
