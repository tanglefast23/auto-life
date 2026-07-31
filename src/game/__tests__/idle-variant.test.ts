import { content } from '../../sim/content';
import {
  activeIdleVariantId,
  authoredIdleVariantIds,
  nextAvailableIdleVariantId,
  preferredIdleVariantId,
} from '../idle-variant';
import type { SessionState } from '../session';
import { newSession } from '../session';

/** The goal whose reward is Goal 4's air-guitar idle (SPEC §12). */
const FIRST_CHORD = content.goals.goals.find((goal) => {
  const reward = content.goals.rewards.find((r) => r.id === goal.rewardId);
  return reward?.kind === 'idle-variant';
})!;

function goalsWith(status: SessionState['goals'][string]['status']): SessionState['goals'] {
  const base = newSession().goals;
  return {
    ...base,
    [FIRST_CHORD.id]: { status, counters: {} },
  };
}

describe('idle variant resolution', () => {
  it('translates a creation preference option id into its authored variant id', () => {
    // `identity.json` gives the option the id `window-gazer` and its mechanic the variant
    // `window-gazing`. The atlas packs `idle-window-gazing`, so handing the option id
    // straight to the renderer silently drew the plain idle pose instead.
    expect(preferredIdleVariantId('window-gazer', content)).toBe('window-gazing');
    expect(preferredIdleVariantId('slow-stretcher', content)).toBe('slow-stretching');
    expect(preferredIdleVariantId(null, content)).toBeNull();
  });

  it('falls back rather than throwing on an option id it does not know', () => {
    expect(preferredIdleVariantId('rolled-in-a-later-version', content)).toBeNull();
  });

  it('collects every idle variant v1 content can put on the sim', () => {
    expect(authoredIdleVariantIds(content).sort()).toEqual([
      'air-guitar',
      'slow-stretching',
      'window-gazing',
    ]);
  });

  it('wears the creation preference until the goal is rewarded', () => {
    expect(
      activeIdleVariantId('window-gazer', goalsWith('complete'), content),
    ).toBe('window-gazing');
  });

  it('wears the goal reward once it is rewarded', () => {
    expect(
      activeIdleVariantId('window-gazer', goalsWith('rewarded'), content),
    ).toBe('air-guitar');
  });

  /**
   * SPEC §12 Goal 4: "air-guitar (or the next variant if already rolled at creation)".
   * `fallback: 'next-available'` is what stops the reward being a no-op — a reward that
   * grants what you already own is not a reward.
   *
   * The rule is tested directly rather than through `activeIdleVariantId`, because no v1
   * identity option grants `air-guitar`, so the collision cannot be reached through real
   * content. Standing up a fake registry to reach it would test the fake.
   */
  it('offers the next unheld variant when a reward duplicates one already worn', () => {
    expect(nextAvailableIdleVariantId(content, ['air-guitar'])).toBe('window-gazing');
    expect(
      nextAvailableIdleVariantId(content, ['air-guitar', 'window-gazing']),
    ).toBe('slow-stretching');
    expect(
      nextAvailableIdleVariantId(content, authoredIdleVariantIds(content)),
    ).toBeNull();
  });

  it('has no variant when the idle category never rolled and nothing is earned', () => {
    expect(activeIdleVariantId(null, goalsWith('active'), content)).toBeNull();
  });

  it('grants the reward even to a career whose idle category never rolled', () => {
    expect(activeIdleVariantId(null, goalsWith('rewarded'), content)).toBe('air-guitar');
  });
});
