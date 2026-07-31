/** Build-time content gate: parses the full registry, exits non-zero on any error. */
try {
  const { content } = require('../src/sim/content') as typeof import('../src/sim/content');
  const { queueStrings } = require('../src/ui/queue-copy') as typeof import('../src/ui/queue-copy');
  const { firstSessionStrings } = require('../src/ui/first-session-copy') as typeof import('../src/ui/first-session-copy');
  const { validateWritingReviews } = require('./validate-writing') as typeof import('./validate-writing');
  const reviews = validateWritingReviews();
  const files = Object.keys(content);

  // ---- P6 cross-gates: content must agree with the art and audio actually built ----
  //
  // These are what make "no placeholders" a build failure rather than a promise. Before
  // P6, `sleep` silently reused the seated frame for three phases because nothing checked
  // that a declared animation existed.
  const { existsSync } = require('node:fs') as typeof import('node:fs');
  const { resolve } = require('node:path') as typeof import('node:path');
  const atlas = require('../assets/generated/atlas-index.json') as {
    poses: Record<string, number>;
    sprites: Record<string, unknown>;
  };
  const { EVENING_START_MINUTE } = require('../src/render/lighting') as typeof import('../src/render/lighting');
  const { declaredAudioAssetIds } = require('../src/sim/content-schemas') as typeof import('../src/sim/content-schemas');

  for (const activity of content.activities.activities) {
    // `stand` aliases walk frame 0 and is the one deliberate reuse.
    if (activity.pose === 'stand') continue;
    if ((atlas.poses[activity.pose] ?? 0) === 0) {
      throw new Error(`activity "${activity.id}" declares pose "${activity.pose}" with no authored frames`);
    }
  }
  for (const object of content.objects.objects) {
    if (atlas.sprites[`object.${object.id}`] === undefined) {
      throw new Error(`object "${object.id}" has no sprite in the atlas`);
    }
  }
  // The lights and the music must not disagree about when evening starts.
  if (content.audio.music.crossfadeMinute !== EVENING_START_MINUTE) {
    throw new Error(
      `audio.music.crossfadeMinute (${content.audio.music.crossfadeMinute}) must equal ` +
        `EVENING_START_MINUTE (${EVENING_START_MINUTE})`,
    );
  }
  for (const material of Object.values(content.homeMap.materials)) {
    if (content.audio.footsteps[material] === undefined) {
      throw new Error(`floor material "${material}" has no footstep cue`);
    }
  }
  // Generated cues live in `assets/audio/` as WAV; authored music lives in `assets/music/`
  // as AAC, because `build-bank` rebuilds the former from empty on every run.
  const missingAudio = declaredAudioAssetIds(content.audio).filter(
    (id) =>
      !existsSync(resolve(__dirname, `../assets/audio/${id}.wav`)) &&
      !existsSync(resolve(__dirname, `../assets/music/${id.replace(/^music\./, '')}.m4a`)),
  );
  if (missingAudio.length > 0) {
    throw new Error(`audio assets declared but not rendered: ${missingAudio.join(', ')} — run npm run audio:bank`);
  }
  if (Object.keys(queueStrings).length === 0) throw new Error('queue strings are empty');
  if (Object.keys(firstSessionStrings).length === 0) {
    throw new Error('first-session strings are empty');
  }
  console.log(
    `content OK (${files.length} files: ${files.join(', ')}; ${reviews} current writing review)`,
  );
} catch (err) {
  console.error('content INVALID');
  console.error(err);
  process.exit(1);
}
