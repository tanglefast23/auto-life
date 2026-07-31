import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { authoredIdleVariantIds } from '../../game/idle-variant';
import { content } from '../../sim/content';
import { declaredAudioAssetIds } from '../../sim/content-schemas';
import { PrngStreams } from '../../sim/prng';
import { deriveRenderView } from '../../sim/render-view';
import { newGameState } from '../../sim/state';
import atlasIndexJson from '../../../assets/generated/atlas-index.json';
import { APPEARANCE_PALETTES } from '../appearance';
import { CHARACTER_BILL } from '../sprites/character';
import { DECORATION_SPRITES } from '../sprites/decorations';
import { ICON_SPRITES } from '../sprites/icons';
import { DECORATION_PLACEMENTS, type AtlasIndex } from '../scene-layout';
import { AUDIO_ASSETS } from '../../application/audio/assets';

/**
 * The bill of materials gate (P6 T13, design.md §11).
 *
 * SPEC §18's Definition of Done says "no placeholders". This is what makes that a test
 * result rather than a claim: every object, pose, appearance, decoration, icon and audio
 * cue the game can actually reach must exist as a real asset, and nothing named
 * placeholder or debug may survive.
 *
 * Run on its own by `npm run art:bill`, and folded into `npm run verify`.
 */

const index = atlasIndexJson as AtlasIndex;
const repoRoot = resolve(__dirname, '../../..');

function sourceFiles(dir: string): string[] {
  const full = resolve(repoRoot, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).flatMap((entry) => {
    const path = resolve(full, entry);
    if (statSync(path).isDirectory()) return sourceFiles(`${dir}/${entry}`);
    return /\.tsx?$/.test(entry) ? [`${dir}/${entry}`] : [];
  });
}

describe('bill of materials — no placeholders (SPEC §18)', () => {
  it('packs no debug or placeholder sprite', () => {
    const offenders = Object.keys(index.sprites).filter(
      (name) => /^debug\./.test(name) || /placeholder/i.test(name),
    );
    expect(offenders).toEqual([]);
  });

  it('draws every object the home contains, plus an active state for every one that hosts an activity', () => {
    for (const object of content.objects.objects) {
      expect(index.sprites[`object.${object.id}`]).toBeDefined();
      if (object.activities.length > 0) {
        expect(index.sprites[`object.${object.id}.active`]).toBeDefined();
      }
    }
  });

  it('animates every activity the game can run', () => {
    const unanimated = content.activities.activities
      .filter((a) => a.pose !== 'stand' && (index.poses[a.pose] ?? 0) === 0)
      .map((a) => `${a.id} -> ${a.pose}`);
    expect(unanimated).toEqual([]);
  });

  it('bakes the full character bill into every appearance a player can be given', () => {
    for (const preset of content.identity.appearancePresets) {
      expect(APPEARANCE_PALETTES[preset.paletteId]).toBeDefined();
      for (const frame of CHARACTER_BILL) {
        expect(index.sprites[`char.${preset.paletteId}.${frame}`]).toBeDefined();
      }
    }
    expect(index.appearances.sort()).toEqual(
      content.identity.appearancePresets.map((p) => p.paletteId).sort(),
    );
  });

  it('draws every idle variant the game can grant', () => {
    // window-gazing and slow-stretching come from identity preferences; air-guitar is
    // Goal 4's entire reward. All three were save data with no pixels before P6.
    for (const variant of ['window-gazing', 'slow-stretching', 'air-guitar']) {
      expect(index.poses[`idle-${variant}`]).toBeGreaterThan(0);
    }
  });

  /**
   * The bill runs one way only, and the ship pass found the other direction open.
   *
   * Every test above asks "does an asset exist for what the game declares?". None asks
   * "can the game reach every asset we authored?" — so art that nothing can display passes
   * the whole gate. It is the same class of hole as a placeholder, arriving from the
   * opposite side: not a missing sprite, a sprite with no way in.
   */
  it('can actually reach every pose it packs', () => {
    const reachable = new Set<string>();
    // Travel drives the four walk cycles; the droop frame is the tiredness flag, not an
    // activity. Neither is declared in `activities.json`, and both are genuinely drawn.
    for (const facing of ['up', 'down', 'left', 'right']) reachable.add(`walk-${facing}`);
    reachable.add('stand-droop');
    // Asked of the production read-model rather than asserted here. A sim with empty
    // hands is exactly what `derivePose` has to answer, and a gate that hard-codes the
    // answer is a gate that cannot notice it changing back — which is how these four
    // poses stayed undrawable through an entire phase in the first place.
    reachable.add(
      deriveRenderView(
        newGameState('baseline', content.rates, 1234, PrngStreams.create(1234).serialize()),
        content,
      ).pose,
    );
    // Which flourish decorates that pose is `activeIdleVariantId`'s decision: an identity
    // preference, or Goal 4's reward once "First chord" is rewarded.
    for (const variant of authoredIdleVariantIds(content)) reachable.add(`idle-${variant}`);
    for (const activity of content.activities.activities) {
      // An `idle`-kind activity still never becomes current — `step.ts` removes the card.
      // The idle pose is reached through the empty-hands path above, not through this one,
      // so declaring a pose is still not the same as being able to strike it.
      if (activity.kind === 'idle') continue;
      reachable.add(activity.pose);
    }

    const unreachable = Object.keys(index.poses).filter((pose) => !reachable.has(pose));

    // Was an accepted exception of 20 sprites — `idle` plus its three variants — carrying
    // both a creation preference and Goal 4's entire reward with no way to display either.
    // Joe ruled the render-only fix on 2026-07-31; the exception is now closed. Exact
    // rather than a subset, so a NEW unreachable pose still fails.
    expect(unreachable.sort()).toEqual([]);
  });

  it('gives every grantable decoration its own sprite', () => {
    const used = new Set<string>();
    for (const [id, placement] of Object.entries(DECORATION_PLACEMENTS)) {
      expect(index.sprites[placement.sprite]).toBeDefined();
      // P5 shipped six rewards sharing two sprites, so Goal 3's "choice" drew the same
      // vase either way. One reward, one sprite.
      expect(used.has(placement.sprite)).toBe(false);
      used.add(placement.sprite);
      expect(id.length).toBeGreaterThan(0);
    }
    expect(used.size).toBe(Object.keys(DECORATION_SPRITES).length);
  });

  it('packs every icon, including a distinct alert variant per bar', () => {
    for (const name of Object.keys(ICON_SPRITES)) {
      expect(index.sprites[`icon.${name}`]).toBeDefined();
    }
    for (const bar of ['energy', 'nutrition', 'movement', 'hygiene']) {
      expect(index.sprites[`icon.${bar}.normal`]).toBeDefined();
      expect(index.sprites[`icon.${bar}.alert`]).toBeDefined();
    }
  });

  it('has a rendered file on disk for every declared audio asset', () => {
    const missing = declaredAudioAssetIds(content.audio).filter(
      (id) => !existsSync(resolve(repoRoot, `assets/audio/${id}.wav`)),
    );
    expect(missing).toEqual([]);
  });

  it('keeps the static require map in step with what content declares', () => {
    // Metro resolves `require` at build time, so a computed path bundles nothing. The map
    // is hand-listed by necessity; this is what stops it drifting.
    const declared = new Set(declaredAudioAssetIds(content.audio));
    const mapped = new Set(Object.keys(AUDIO_ASSETS));
    expect([...declared].filter((id) => !mapped.has(id))).toEqual([]);
    expect([...mapped].filter((id) => !declared.has(id))).toEqual([]);
  });

  it('leaves no unclosed phase deferral in the runtime rings', () => {
    // The repo's own convention: a deferral is a comment naming its owner phase, and every
    // one naming this phase is work that must not survive it.
    //
    // Two details, both learned the hard way. The marker is an explicit TODO form rather
    // than a bare phase name, because otherwise prose *about* the phase trips the gate —
    // an audit predicted exactly that, and the first version of this test then proved it
    // by failing on its own comment. And the pattern is assembled at runtime rather than
    // written as a literal, so this file cannot match itself.
    const marker = new RegExp(`TODO\\(${'P'}6\\)`);
    const offenders: string[] = [];
    for (const dir of ['src/render', 'src/ui', 'src/application/audio', 'scripts/art', 'scripts/audio']) {
      for (const file of sourceFiles(dir)) {
        if (file.includes('__tests__')) continue;
        readFileSync(resolve(repoRoot, file), 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (marker.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
          });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('records an atlas census that grew past the placeholder set', () => {
    // P5's atlas was 512x162 with 33 sprites: 15 flat object boxes, 6 flat tiles, 9
    // character frames, 2 decorations and a debug marker.
    expect(Object.keys(index.sprites).length).toBeGreaterThan(200);
    expect(index.appearances.length).toBe(4);
    expect(CHARACTER_BILL.length).toBe(48);
  });
});
