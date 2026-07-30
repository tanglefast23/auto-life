import { content } from '../../sim/content';
import { BUBBLE_PRIORITY, bubbleFor, type BubbleInputs } from '../bubbles';
import atlasIndexJson from '../../../assets/generated/atlas-index.json';
import { lookup, type AtlasIndex } from '../scene-layout';

/**
 * P6 T6b — SPEC §11.1's world bubbles, whose owner was assigned to P6 on 2026-07-31.
 *
 * The clause was in no phase's owned list: the progress ring shipped in P3, forecast
 * warnings shipped on P4's queue cards, and P5's preference bubble was a panel element.
 * Need and hint bubbles did not exist at all.
 */

const index = atlasIndexJson as AtlasIndex;
const rested = { energy: 90, nutrition: 90, movement: 90, hygiene: 90 };
const base: BubbleInputs = { bars: rested, preferenceReaction: null, warning: null };

describe('world bubbles (SPEC §11.1, design.md §8)', () => {
  it('says nothing when there is nothing to say', () => {
    expect(bubbleFor(base, content.rates)).toBeNull();
  });

  it('raises a need bubble when a bar enters its alert band', () => {
    const bubble = bubbleFor({ ...base, bars: { ...rested, hygiene: 20 } }, content.rates);
    expect(bubble).toMatchObject({ kind: 'need', barId: 'hygiene', icon: 'icon.hygiene.alert' });
  });

  it('uses Energy’s own band rather than the default one', () => {
    // SPEC §11.1: Energy at 20 by bedtime is designed. The default <40 rule "would cry red
    // every healthy evening", which is exactly the bug a second threshold here would
    // reintroduce. `rates.json` owns both numbers and this must not disagree with it.
    expect(bubbleFor({ ...base, bars: { ...rested, energy: 20 } }, content.rates)).toBeNull();
    expect(bubbleFor({ ...base, bars: { ...rested, energy: 10 } }, content.rates)?.kind).toBe('need');
  });

  it('ranks need above warning above preference above hint', () => {
    expect(BUBBLE_PRIORITY).toEqual(['need', 'warning', 'preference', 'hint']);
  });

  it('shows exactly one bubble when several could apply', () => {
    const bubble = bubbleFor(
      {
        bars: { ...rested, hygiene: 20, nutrition: 25 },
        preferenceReaction: { kind: 'happy', label: 'Proper meals' },
        warning: { kind: 'cap-waste', barId: 'nutrition' },
        idleWithEmptyQueue: true,
      },
      content.rates,
    );
    expect(bubble?.kind).toBe('need');
    // Two bubbles stacked over a 32px sim is unreadable at 1x; the contract is one head,
    // one bubble, loudest first.
    expect(Array.isArray(bubble)).toBe(false);
  });

  it('falls through each priority level as the louder cause clears', () => {
    const all: BubbleInputs = {
      bars: { ...rested, hygiene: 20 },
      preferenceReaction: { kind: 'grumble', label: 'x' },
      warning: { kind: 'conflict', barId: 'energy' },
      idleWithEmptyQueue: true,
    };
    expect(bubbleFor(all, content.rates)?.kind).toBe('need');
    expect(bubbleFor({ ...all, bars: rested }, content.rates)?.kind).toBe('warning');
    expect(bubbleFor({ ...all, bars: rested, warning: null }, content.rates)?.kind).toBe('preference');
    expect(
      bubbleFor({ ...all, bars: rested, warning: null, preferenceReaction: null }, content.rates)?.kind,
    ).toBe('hint');
  });

  it('tints happy leaf and grumpy plum, and never red (design.md §8)', () => {
    const happy = bubbleFor({ ...base, preferenceReaction: { kind: 'happy', label: 'x' } }, content.rates);
    const grumpy = bubbleFor({ ...base, preferenceReaction: { kind: 'grumble', label: 'x' } }, content.rates);
    expect(happy?.tint).toBe('leaf');
    expect(grumpy?.tint).toBe('plum');
  });

  it('stays quiet while the sim is asleep', () => {
    expect(bubbleFor({ ...base, bars: { ...rested, hygiene: 5 }, asleep: true }, content.rates)).toBeNull();
  });

  it('points at every icon it names, and every one is in the atlas', () => {
    const cases: BubbleInputs[] = [
      { ...base, bars: { ...rested, energy: 5 } },
      { ...base, bars: { ...rested, nutrition: 5 } },
      { ...base, bars: { ...rested, movement: 5 } },
      { ...base, bars: { ...rested, hygiene: 5 } },
      { ...base, warning: { kind: 'cap-waste', barId: 'nutrition' } },
      { ...base, preferenceReaction: { kind: 'happy', label: 'x' } },
      { ...base, preferenceReaction: { kind: 'grumble', label: 'x' } },
      { ...base, idleWithEmptyQueue: true },
    ];
    for (const input of cases) {
      const bubble = bubbleFor(input, content.rates);
      expect(bubble).not.toBeNull();
      expect(() => lookup(index, bubble!.icon)).not.toThrow();
    }
  });

  it('gives every bubble a stable id, so a screen reader and a test address the same thing', () => {
    const a = bubbleFor({ ...base, bars: { ...rested, hygiene: 20 } }, content.rates);
    const b = bubbleFor({ ...base, bars: { ...rested, hygiene: 19 } }, content.rates);
    expect(a?.id).toBe(b?.id);
  });

  it('reads nothing from the simulation it could mutate — derived only', () => {
    const bars = { ...rested, hygiene: 20 };
    const before = JSON.stringify(bars);
    bubbleFor({ ...base, bars }, content.rates);
    expect(JSON.stringify(bars)).toBe(before);
  });
});
