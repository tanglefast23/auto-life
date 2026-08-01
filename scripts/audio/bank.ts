import {
  join,
  mix,
  normalize,
  note,
  place,
  seamless,
  silence,
  tone,
  type Samples,
} from './wav';

/**
 * The authored cue bank (SPEC §14, P6 T9/T10).
 *
 * SPEC §14's required set in full: one chill home loop with a day and an evening variant
 * crossfading at 19:00, a Practice riff that layers and is level-dependent (L3 sounds
 * *good*), room tone plus a rain-on-window wrinkle variant, footsteps per floor material,
 * activity loops, and six UI cues.
 *
 * Two rules from HFM's handover shape everything here
 * (docs/lessons-from-hero-football-manager.md §3.1–3.2):
 *
 *  - **Feedback is semantic.** A cue's character has to match what it means. Cancel and
 *    remove do not get the confirm sound; only rewards get the bright ascending figure.
 *    HFM shipped cancel-inherits-celebration and had to fix it.
 *  - **Preserve the attack.** Every cue is shaped, because an abrupt start is the "heavy
 *    click" HFM had to replace and an abrupt end pops.
 *
 * Everything is a pure function of its parameters, so `npm run audio:check` can diff a
 * fresh render against the committed bank.
 */

/** A gentle four-chord progression in A minor — the "chill home loop" §14 asks for. */
const DAY_CHORDS: readonly (readonly number[])[] = [
  [-12, -5, 0], // Am
  [-10, -3, 3], // C
  [-7, -2, 5], // F
  [-5, 0, 7], // G
];

function pad(semitones: readonly number[], duration: number, gain: number, wave: 'sine' | 'triangle'): Samples {
  return mix(
    ...semitones.map((s, i) =>
      tone({ wave, freq: note(s), duration, gain: gain / (i + 1.4), attack: 0.35, release: 0.5 }),
    ),
  );
}

/** Day bed: brighter triangle pad, one chord every two seconds. */
function musicDay(): Samples {
  const bar = 2;
  const bed = silence(bar * DAY_CHORDS.length);
  DAY_CHORDS.forEach((chord, i) => place(bed, pad(chord, bar, 0.5, 'triangle'), i * bar));
  return normalize(seamless(bed), 0.55);
}

/**
 * Evening bed: same progression, lower octave, softer sine.
 *
 * Deliberately the same harmony as the day bed — the 19:00 change is "the coziest beat of
 * the day" (SPEC §11.3), not a different piece of music, so the crossfade lands on a
 * chord the player already knows.
 */
function musicEvening(): Samples {
  const bar = 2.5;
  const bed = silence(bar * DAY_CHORDS.length);
  DAY_CHORDS.forEach((chord, i) =>
    place(bed, pad(chord.map((s) => s - 12), bar, 0.55, 'sine'), i * bar),
  );
  return normalize(seamless(bed), 0.5);
}

/**
 * The Practice riff, by level. §14: "level-dependent — L3 sounds *good*."
 *
 * L0 is two hesitant notes with one deliberately flat; each level adds notes, tightens
 * timing, and drops the fluff. This is the one place the audio carries a mechanic rather
 * than decorating one, so the progression has to be audible, not just labelled.
 */
function practiceRiff(level: 0 | 1 | 2 | 3): Samples {
  const pluck = (semitone: number, at: number, dur: number, gain: number) =>
    tone({ wave: 'saw', freq: note(semitone), duration: dur, gain, attack: 0.004, release: dur * 0.8 });

  const bar = 2;
  const out = silence(bar);
  const figures: Record<number, readonly (readonly [number, number, number])[]> = {
    // [semitone, startSeconds, durationSeconds]
    0: [[-12, 0.0, 0.5], [-6, 0.75, 0.5]], // the flat note is the point
    1: [[-12, 0.0, 0.4], [-5, 0.5, 0.4], [0, 1.0, 0.5]],
    2: [[-12, 0.0, 0.3], [-5, 0.35, 0.3], [0, 0.7, 0.3], [3, 1.05, 0.45]],
    3: [[-12, 0.0, 0.25], [-5, 0.3, 0.25], [0, 0.6, 0.25], [3, 0.9, 0.25], [7, 1.2, 0.6], [12, 1.45, 0.5]],
  };
  for (const [semitone, at, dur] of figures[level]!) {
    place(out, pluck(semitone, at, dur, 0.42), at);
  }
  return normalize(seamless(out, 0.05), 0.45 + level * 0.05);
}

/** Room tone: very low filtered noise, barely there. */
function ambienceRoom(): Samples {
  return normalize(
    seamless(
      mix(
        tone({ wave: 'noise', freq: 0, duration: 4, gain: 0.05, attack: 1, release: 1, seed: 7 }),
        tone({ wave: 'sine', freq: 55, duration: 4, gain: 0.03, attack: 1, release: 1 }),
      ),
    ),
    0.12,
  );
}

/** Rain on the window — the §14 wrinkle variant. Denser noise, no tonal centre. */
function ambienceRain(): Samples {
  return normalize(
    seamless(
      mix(
        tone({ wave: 'noise', freq: 0, duration: 4, gain: 0.22, attack: 0.8, release: 0.8, seed: 31 }),
        tone({ wave: 'noise', freq: 0, duration: 4, gain: 0.1, attack: 0.4, release: 0.4, seed: 977 }),
      ),
    ),
    0.28,
  );
}

/** A footstep is a short noise burst; the material sets its pitch and decay. */
function footstep(material: 'wood' | 'tile' | 'carpet'): Samples {
  const spec = {
    wood: { duration: 0.09, gain: 0.5, seed: 11, body: 180 },
    tile: { duration: 0.07, gain: 0.55, seed: 23, body: 320 },
    carpet: { duration: 0.11, gain: 0.32, seed: 41, body: 110 },
  }[material];
  return normalize(
    mix(
      tone({ wave: 'noise', freq: 0, duration: spec.duration, gain: spec.gain, attack: 0.001, release: spec.duration, seed: spec.seed }),
      tone({ wave: 'sine', freq: spec.body, duration: spec.duration, gain: 0.3, attack: 0.001, release: spec.duration }),
    ),
    0.45,
  );
}

/** Activity loops — the ~8 §14 names, each recognisable from its texture alone. */
const ACTIVITY_LOOPS: Record<string, () => Samples> = {
  shower: () =>
    normalize(seamless(tone({ wave: 'noise', freq: 0, duration: 2, gain: 0.4, attack: 0.3, release: 0.3, seed: 5 })), 0.3),
  meal: () =>
    normalize(seamless(mix(
      tone({ wave: 'sine', freq: 220, duration: 2, gain: 0.12, attack: 0.5, release: 0.5 }),
      tone({ wave: 'noise', freq: 0, duration: 2, gain: 0.06, attack: 0.5, release: 0.5, seed: 71 }),
    )), 0.2),
  snack: () =>
    normalize(seamless(tone({ wave: 'noise', freq: 0, duration: 1.2, gain: 0.18, attack: 0.2, release: 0.3, seed: 83 })), 0.2),
  treadmill: () => {
    const loop = silence(1.6);
    for (let i = 0; i < 4; i++) place(loop, footstep('tile'), i * 0.4);
    return normalize(seamless(loop, 0.05), 0.35);
  },
  weights: () =>
    normalize(seamless(mix(
      tone({ wave: 'square', freq: 70, duration: 2, gain: 0.12, attack: 0.6, release: 0.6 }),
      tone({ wave: 'sine', freq: 140, duration: 2, gain: 0.06, attack: 0.6, release: 0.6 }),
    )), 0.22),
  stretch: () =>
    normalize(seamless(tone({ wave: 'sine', freq: 165, duration: 2.4, gain: 0.14, attack: 0.9, release: 0.9 })), 0.18),
  brush: () =>
    normalize(seamless(tone({ wave: 'noise', freq: 0, duration: 1, gain: 0.22, attack: 0.15, release: 0.2, seed: 97 })), 0.24),
  quickwash: () =>
    normalize(seamless(tone({ wave: 'noise', freq: 0, duration: 1, gain: 0.28, attack: 0.1, release: 0.2, seed: 109 })), 0.26),
};

/**
 * The six UI cues from §14, written semantically.
 *
 * `queue.insert` rises and `queue.remove` falls — the pair has to be legible as opposites
 * without looking at the screen. `queue.complete` is a soft two-note settle, **not** the
 * reward figure: completing a queued card is routine, and giving it a celebration is
 * precisely the "cancel inherits celebration" mistake in the other direction.
 */
const UI_CUES: Record<string, () => Samples> = {
  'queue.insert': () =>
    normalize(join(
      tone({ wave: 'triangle', freq: note(4), duration: 0.06, gain: 0.5 }),
      tone({ wave: 'triangle', freq: note(11), duration: 0.09, gain: 0.45 }),
    ), 0.5),
  'queue.remove': () =>
    normalize(join(
      tone({ wave: 'triangle', freq: note(11), duration: 0.06, gain: 0.45 }),
      tone({ wave: 'triangle', freq: note(2), duration: 0.1, gain: 0.4 }),
    ), 0.45),
  'queue.complete': () =>
    normalize(join(
      tone({ wave: 'sine', freq: note(7), duration: 0.08, gain: 0.4 }),
      tone({ wave: 'sine', freq: note(12), duration: 0.16, gain: 0.35, release: 0.14 }),
    ), 0.4),
  // The one bright ascending figure in the game. design.md §2 reserves gold for reward
  // moments; this is its audible twin and it is spent just as carefully.
  adjacency: () =>
    normalize(join(
      tone({ wave: 'sine', freq: note(4), duration: 0.05, gain: 0.4 }),
      tone({ wave: 'sine', freq: note(9), duration: 0.05, gain: 0.42 }),
      tone({ wave: 'sine', freq: note(16), duration: 0.22, gain: 0.45, release: 0.2 }),
    ), 0.55),
  // "Gentle urgency cue" — a warning, not an alarm. Two soft falling notes.
  urgency: () =>
    normalize(join(
      tone({ wave: 'triangle', freq: note(-2), duration: 0.12, gain: 0.4 }),
      tone({ wave: 'triangle', freq: note(-7), duration: 0.2, gain: 0.42, release: 0.18 }),
    ), 0.5),
  recap: () =>
    normalize(mix(
      tone({ wave: 'sine', freq: (t) => 300 + 420 * t, duration: 0.3, gain: 0.28, attack: 0.02, release: 0.24 }),
      tone({ wave: 'noise', freq: 0, duration: 0.3, gain: 0.06, attack: 0.02, release: 0.28, seed: 131 }),
    ), 0.35),
  /**
   * The grade stamp (docs/08 §11.4). Three variants, and exactly one of them REPLACES
   * `queue.complete` on a graded completion — a completion still owns one sound.
   *
   * None of them is the adjacency figure. That bright ascending motif is reserved for reward
   * moments, in the palette and here; a good roll is a good roll, not a prize. So the high
   * variant rises by a fifth rather than the octave-and-a-half `adjacency` climbs, and it
   * stays on the same triangle voice the queue cues use.
   */
  'grade.high': () =>
    normalize(join(
      tone({ wave: 'triangle', freq: note(7), duration: 0.07, gain: 0.45 }),
      tone({ wave: 'triangle', freq: note(14), duration: 0.18, gain: 0.42, release: 0.15 }),
    ), 0.5),
  // Mid is one note, deliberately: an average result should not editorialise.
  'grade.mid': () =>
    normalize(tone({ wave: 'triangle', freq: note(7), duration: 0.14, gain: 0.4, release: 0.11 }), 0.42),
  // Low falls, but gently — a disappointing shower is not an alarm, and `urgency` already
  // owns the game's only warning shape.
  'grade.low': () =>
    normalize(join(
      tone({ wave: 'triangle', freq: note(7), duration: 0.07, gain: 0.38 }),
      tone({ wave: 'triangle', freq: note(2), duration: 0.18, gain: 0.36, release: 0.16 }),
    ), 0.42),
  // The bar beat: a short pluck with a touch of noise for the attack, so it reads as
  // something landing rather than another note in the melody.
  'bar.pop': () =>
    normalize(mix(
      tone({ wave: 'sine', freq: (t) => 520 - 140 * t, duration: 0.12, gain: 0.34, attack: 0.005, release: 0.1 }),
      tone({ wave: 'noise', freq: 0, duration: 0.05, gain: 0.05, attack: 0.002, release: 0.045, seed: 977 }),
    ), 0.4),
};

/** Every asset id the bank renders, and the samples for it. */
export function renderBank(): Record<string, Samples> {
  const bank: Record<string, Samples> = {
    'ambience.room': ambienceRoom(),
    'ambience.rain': ambienceRain(),
  };
  for (const level of [0, 1, 2, 3] as const) bank[`riff.l${level}`] = practiceRiff(level);
  for (const material of ['wood', 'tile', 'carpet'] as const) {
    bank[`footstep.${material}`] = footstep(material);
  }
  for (const [id, build] of Object.entries(ACTIVITY_LOOPS)) bank[`loop.${id}`] = build();
  for (const [id, build] of Object.entries(UI_CUES)) bank[`ui.${id}`] = build();
  return bank;
}
