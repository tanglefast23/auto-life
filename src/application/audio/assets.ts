/**
 * Static require map for the rendered cue bank (P6 T8).
 *
 * Metro resolves `require` at build time, so an asset map has to be literal — a computed
 * `require(\`../../assets/audio/${id}.wav\`)` silently bundles nothing. Listing them is the
 * price of that, and the bill gate in T13 cross-checks this map against
 * `declaredAudioAssetIds(content.audio)` so the two cannot drift.
 */
export const AUDIO_ASSETS: Record<string, number> = {
  // Authored, not synthesised: lives outside `assets/audio/` because `build-bank` rebuilds
  // that directory from empty and would delete it. 34s mono AAC at 64 kbps — one tenth the
  // bytes the equivalent WAV bed would cost, and the format the loop actually ships in.
  'music.main': require('../../../assets/music/main.m4a'),
  'riff.l0': require('../../../assets/audio/riff.l0.wav'),
  'riff.l1': require('../../../assets/audio/riff.l1.wav'),
  'riff.l2': require('../../../assets/audio/riff.l2.wav'),
  'riff.l3': require('../../../assets/audio/riff.l3.wav'),
  'ambience.room': require('../../../assets/audio/ambience.room.wav'),
  'ambience.rain': require('../../../assets/audio/ambience.rain.wav'),
  'footstep.wood': require('../../../assets/audio/footstep.wood.wav'),
  'footstep.tile': require('../../../assets/audio/footstep.tile.wav'),
  'footstep.carpet': require('../../../assets/audio/footstep.carpet.wav'),
  'loop.shower': require('../../../assets/audio/loop.shower.wav'),
  'loop.meal': require('../../../assets/audio/loop.meal.wav'),
  'loop.snack': require('../../../assets/audio/loop.snack.wav'),
  'loop.treadmill': require('../../../assets/audio/loop.treadmill.wav'),
  'loop.weights': require('../../../assets/audio/loop.weights.wav'),
  'loop.stretch': require('../../../assets/audio/loop.stretch.wav'),
  'loop.brush': require('../../../assets/audio/loop.brush.wav'),
  'loop.quickwash': require('../../../assets/audio/loop.quickwash.wav'),
  'ui.queue.insert': require('../../../assets/audio/ui.queue.insert.wav'),
  'ui.queue.remove': require('../../../assets/audio/ui.queue.remove.wav'),
  'ui.queue.complete': require('../../../assets/audio/ui.queue.complete.wav'),
  'ui.adjacency': require('../../../assets/audio/ui.adjacency.wav'),
  'ui.urgency': require('../../../assets/audio/ui.urgency.wav'),
  'ui.recap': require('../../../assets/audio/ui.recap.wav'),
  'ui.grade.high': require('../../../assets/audio/ui.grade.high.wav'),
  'ui.grade.mid': require('../../../assets/audio/ui.grade.mid.wav'),
  'ui.grade.low': require('../../../assets/audio/ui.grade.low.wav'),
  'ui.bar.pop': require('../../../assets/audio/ui.bar.pop.wav'),
};
