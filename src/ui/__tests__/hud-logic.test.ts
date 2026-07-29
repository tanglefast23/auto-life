import { content } from '../../sim/content';
import { BAR_ICON, BAR_ORDER, bandFor } from '../bands';
import { formatClock, formatTimeOfDay, weekdayForDay } from '../clock-format';

/**
 * P3 T7 — the HUD's decisions, tested without rendering.
 *
 * The band rule is the load-bearing one: SPEC §11.1 records that Energy is *designed*
 * to reach 20 by bedtime, so the default `<40 = red` band would cry red every healthy
 * evening. These tests are what stop that regressing.
 */

describe('display bands come from rates.json (SPEC §11.1)', () => {
  test('the default band is 70 / 40 for the three non-Energy bars', () => {
    for (const bar of BAR_ORDER.filter((b) => b !== 'energy')) {
      expect(bandFor(bar, 100, content.rates).band).toBe('normal');
      expect(bandFor(bar, 70, content.rates).band).toBe('normal');
      expect(bandFor(bar, 69, content.rates).band).toBe('tick');
      expect(bandFor(bar, 40, content.rates).band).toBe('tick');
      expect(bandFor(bar, 39, content.rates).band).toBe('alert');
    }
  });

  test('Energy uses its own 30 / 15 bands', () => {
    expect(bandFor('energy', 30, content.rates).band).toBe('normal');
    expect(bandFor('energy', 29, content.rates).band).toBe('tick');
    expect(bandFor('energy', 15, content.rates).band).toBe('tick');
    expect(bandFor('energy', 14, content.rates).band).toBe('alert');
  });

  test('the designed bedtime Energy of 20 does not read as an emergency', () => {
    // §6.1's verified closure puts Energy at exactly 20 every night. Under the default
    // band that is red; under Energy's own band it is a tick. This is the whole reason
    // the per-bar override exists.
    expect(bandFor('energy', 20, content.rates).band).toBe('tick');
    expect(bandFor('energy', 20, content.rates).pulse).toBe(false);
    expect(bandFor('nutrition', 20, content.rates).band).toBe('alert');
  });

  test('alert carries a non-colour signal too (SPEC §11.6)', () => {
    const alert = bandFor('nutrition', 10, content.rates);
    expect(alert.pulse).toBe(true);
    expect(alert.alertGlyph).toBe(true);
    // And the glyph actually differs from the normal one, so shape alone distinguishes it.
    for (const bar of BAR_ORDER) {
      expect(BAR_ICON[bar].alert).not.toBe(BAR_ICON[bar].normal);
    }
  });

  test('every bar has an icon, a label and an alert variant', () => {
    for (const bar of BAR_ORDER) {
      expect(BAR_ICON[bar].normal.length).toBeGreaterThan(0);
      expect(BAR_ICON[bar].alert.length).toBeGreaterThan(0);
      expect(BAR_ICON[bar].label.length).toBeGreaterThan(0);
    }
    expect(BAR_ORDER).toHaveLength(4);
  });

  test('out-of-range values do not produce a missing band', () => {
    for (const v of [-10, 0, 100, 150, Number.NaN]) {
      const b = bandFor('hygiene', v, content.rates);
      expect(['normal', 'tick', 'alert']).toContain(b.band);
    }
  });
});

describe('clock format (SPEC §5)', () => {
  test('matches the spec example exactly', () => {
    // "Day 3 · Wed · 14:32" — Day 1 is Monday, so Day 3 is Wednesday.
    expect(formatClock(3, 14 * 60 + 32)).toBe('Day 3 · Wed · 14:32');
  });

  test('Day 1 is Monday and the week wraps', () => {
    expect(weekdayForDay(1)).toBe('Mon');
    expect(weekdayForDay(6)).toBe('Sat');
    expect(weekdayForDay(7)).toBe('Sun');
    expect(weekdayForDay(8)).toBe('Mon'); // the Day-8 letter lands on a Monday
  });

  test('times are zero-padded across the whole day', () => {
    expect(formatTimeOfDay(0)).toBe('00:00');
    expect(formatTimeOfDay(7 * 60)).toBe('07:00');
    expect(formatTimeOfDay(23 * 60 + 5)).toBe('23:05');
    expect(formatTimeOfDay(1439)).toBe('23:59');
  });

  test('minute values outside a day wrap rather than printing nonsense', () => {
    expect(formatTimeOfDay(1440)).toBe('00:00');
    expect(formatTimeOfDay(1440 + 90)).toBe('01:30');
    expect(formatTimeOfDay(-30)).toBe('23:30');
  });
});
