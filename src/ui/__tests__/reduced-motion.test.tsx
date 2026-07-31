import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { Platform } from 'react-native';
import { useReducedMotionPreference } from '../accessibility';

/**
 * Reduced motion has to be true on the FIRST render, not one effect later.
 *
 * The hook initialised to `false` and asked the system in an effect, so every animated
 * surface received "motion is fine" for its opening frame — the slide, pulse or crossfade
 * a reduced-motion user set the preference to never see. Web can answer synchronously;
 * this pins that it does.
 */

const originalMatchMedia = globalThis.matchMedia;
const originalOS = Platform.OS;

/** The suite runs under the native preset; these cases are about the web driver. */
function asWeb(): void {
  (Platform as { OS: string }).OS = 'web';
}

afterEach(() => {
  (Platform as { OS: string }).OS = originalOS;
  if (originalMatchMedia === undefined) {
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
  } else {
    globalThis.matchMedia = originalMatchMedia;
  }
  jest.restoreAllMocks();
});

function stubMatchMedia(matches: boolean): void {
  globalThis.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof globalThis.matchMedia;
}

/** Records what every render saw, so the first one can be asserted on its own. */
function renderedValues(
  override?: 'system' | 'on' | 'off',
): { values: boolean[]; unmount: () => void } {
  const values: boolean[] = [];
  function Probe() {
    values.push(useReducedMotionPreference(override));
    return <Text>probe</Text>;
  }
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(<Probe />);
  });
  return { values, unmount: () => act(() => tree!.unmount()) };
}

test('system reduced motion is already true on the first render', () => {
  asWeb();
  stubMatchMedia(true);

  const { values, unmount } = renderedValues();
  expect(values[0]).toBe(true);
  expect(values).not.toContain(false);
  unmount();
});

test('no system reduced motion stays false throughout', () => {
  asWeb();
  stubMatchMedia(false);

  const { values, unmount } = renderedValues();
  expect(values[0]).toBe(false);
  expect(values).not.toContain(true);
  unmount();
});

test('an explicit preference still overrides the system on the first render', () => {
  asWeb();
  stubMatchMedia(true);

  const off = renderedValues('off');
  expect(off.values[0]).toBe(false);
  off.unmount();

  stubMatchMedia(false);
  const on = renderedValues('on');
  expect(on.values[0]).toBe(true);
  on.unmount();
});
