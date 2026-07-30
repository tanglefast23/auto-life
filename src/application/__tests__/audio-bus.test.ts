import { DEFAULT_APP_PREFERENCES } from '../career-state';
import { SilentAudioBus } from '../audio-bus';

test('silent audio bus keeps the state a future mixer will consume', () => {
  const bus = new SilentAudioBus(DEFAULT_APP_PREFERENCES.audio);
  expect(bus.muted).toBe(false);
  bus.apply({
    ...DEFAULT_APP_PREFERENCES.audio,
    master: 0.4,
    music: 0.2,
    sfx: 0.7,
    muted: true,
  });
  expect(bus.muted).toBe(true);
});
