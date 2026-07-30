import { content } from '../../sim/content';
import { PrngStreams } from '../../sim/prng';
import { restoreSession, newSession } from '../session';
import { dealWrinkleForDay } from '../wrinkles';

test('Day 2+ dealing is seeded, saved, and idempotent per day', () => {
  const prng = PrngStreams.create(4821).serialize();
  const first = dealWrinkleForDay(
    newSession(),
    prng,
    2,
    content,
  );
  const restored = restoreSession(
    JSON.parse(JSON.stringify(first.session)),
  );
  const repeated = dealWrinkleForDay(
    restored,
    first.prng,
    2,
    content,
  );

  expect(first.changed).toBe(true);
  expect(first.session.wrinkles.dealt).toHaveLength(1);
  expect(repeated).toEqual({
    session: restored,
    prng: first.prng,
    changed: false,
  });
  expect(first.session.wrinkles.announced).toEqual(
    first.session.wrinkles.dealt[0]?.wrinkleId === null
      ? null
      : expect.objectContaining({
          day: 2,
          wrinkleId:
            first.session.wrinkles.dealt[0]?.wrinkleId,
          variantId:
            first.session.wrinkles.dealt[0]?.variantId,
        }),
  );
});

test('the saved deck allows quiet days and never repeats inside six calendar days', () => {
  let session = newSession();
  let prng = PrngStreams.create(31).serialize();
  const dealtIds: string[] = [];
  const lastDealtDay = new Map<string, number>();
  let quietDays = 0;

  for (let day = 2; day <= 40; day += 1) {
    const result = dealWrinkleForDay(
      session,
      prng,
      day,
      content,
    );
    session = result.session;
    prng = result.prng;
    const dealt = session.wrinkles.dealt.find(
      (entry) => entry.day === day,
    )!;
    if (dealt.wrinkleId === null) {
      quietDays += 1;
    } else {
      const previousDay = lastDealtDay.get(dealt.wrinkleId);
      if (previousDay !== undefined) {
        expect(day - previousDay).toBeGreaterThan(
          content.wrinkles.noRepeatDays,
        );
      }
      lastDealtDay.set(dealt.wrinkleId, day);
      dealtIds.push(dealt.wrinkleId);
    }
    session = {
      ...session,
      wrinkles: {
        ...session.wrinkles,
        pendingId: null,
        choiceReadyId: null,
        announced: null,
      },
    };
  }

  expect(quietDays).toBeGreaterThan(0);
  expect(dealtIds.length).toBeGreaterThan(10);
  expect(session.wrinkles.recentDealtIds).toEqual(
    session.wrinkles.dealt
      .filter(
        (entry) =>
          entry.wrinkleId !== null &&
          entry.day >
            40 - content.wrinkles.noRepeatDays,
      )
      .map((entry) => entry.wrinkleId),
  );
});

test('the scripted package never re-enters the reusable deck', () => {
  const result = dealWrinkleForDay(
    newSession(),
    PrngStreams.create(9).serialize(),
    2,
    content,
  );

  expect(result.session.wrinkles.remainingDeckIds).not.toContain(
    'package-delivery',
  );
  expect(
    result.session.wrinkles.dealt[0]?.wrinkleId,
  ).not.toBe('package-delivery');
});
