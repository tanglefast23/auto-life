import { RatesSchema } from '../../src/sim/content-schemas';
import rawRates from '../../content/rates.json';

// Deep-clone helper so each negative case mutates its own copy.
const cloned = (): Record<string, unknown> => JSON.parse(JSON.stringify(rawRates));

test('the real rates.json parses', () => {
  expect(() => RatesSchema.parse(rawRates)).not.toThrow();
});

test('the parsed content module exposes the typed result', () => {
  // Import here (not top-level) so the schema failure above stays the first signal.
  const { content } = require('../../src/sim/content') as typeof import('../../src/sim/content');
  expect(content.rates.rates.energy.awake).toBe(5.0);
  expect(content.rates.chronotype.owl.wake).toBe(450);
});

test('an unknown key fails (strict objects)', () => {
  const bad = cloned();
  bad.surprise = true;
  expect(() => RatesSchema.parse(bad)).toThrow();
});

test('a missing weight fails (exhaustive enum record)', () => {
  const bad = cloned();
  delete (bad.weights as Record<string, unknown>).movement;
  expect(() => RatesSchema.parse(bad)).toThrow();
});

test('rates with more than two decimals fail (must survive ratePerMinuteFixed)', () => {
  const bad = cloned();
  (bad.rates as Record<string, { awake: number }>).energy!.awake = 3.333;
  expect(() => RatesSchema.parse(bad)).toThrow();
  const badSleep = cloned();
  badSleep.sleepRestorePerHour = 10.005;
  expect(() => RatesSchema.parse(badSleep)).toThrow();
});

test('negative and non-finite rates fail', () => {
  const neg = cloned();
  (neg.rates as Record<string, { awake: number }>).energy!.awake = -1;
  expect(() => RatesSchema.parse(neg)).toThrow();

  const inf = cloned();
  (inf.rates as Record<string, { awake: number }>).energy!.awake = Infinity;
  expect(() => RatesSchema.parse(inf)).toThrow();
});

test('a display band with alert >= tick fails', () => {
  const bad = cloned();
  (bad.displayBands as Record<string, { tick: number; alert: number }>).default!.alert = 70;
  expect(() => RatesSchema.parse(bad)).toThrow();
});

test('chronotype minutes must be integers within a day', () => {
  const frac = cloned();
  (frac.chronotype as Record<string, { wake: number }>).owl!.wake = 450.5;
  expect(() => RatesSchema.parse(frac)).toThrow();

  const oob = cloned();
  (oob.chronotype as Record<string, { wake: number }>).owl!.wake = 1500;
  expect(() => RatesSchema.parse(oob)).toThrow();
});
