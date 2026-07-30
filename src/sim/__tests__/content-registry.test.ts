import {
  content,
  validateContentRegistry,
  type ContentRegistry,
} from '../content';

function cloneContent(): ContentRegistry {
  return JSON.parse(JSON.stringify(content)) as ContentRegistry;
}

test('the shipped registry passes cross-file validation', () => {
  expect(() => validateContentRegistry(cloneContent())).not.toThrow();
});

test('scaleDecay factors must preserve the integer grid for each passive rate', () => {
  const registry = cloneContent();
  registry.rates.rates.movement.awake = 0.01;
  const effect = registry.adjacency.pairs.find(
    (pair) => pair.effect.kind === 'scaleDecay',
  )?.effect;
  if (effect?.kind !== 'scaleDecay') {
    throw new Error('scaleDecay fixture missing');
  }
  effect.factor = 0.33;

  expect(() => validateContentRegistry(registry)).toThrow(
    /scaleDecay.*integer fixed-point grid/,
  );
});

test('co-active scaleDecay factors must preserve the grid in combination', () => {
  const registry = cloneContent();
  registry.rates.rates.movement.awake = 1;
  registry.adjacency.pairs.push({
    id: 'second-movement-decay',
    first: 'snack',
    second: 'stretch',
    gapMaxMin: 60,
    effect: {
      kind: 'scaleDecay',
      bar: 'movement',
      factor: 0.33,
      durationMin: 60,
    },
  });

  expect(() => validateContentRegistry(registry)).toThrow(
    /scaleDecay.*integer fixed-point grid/,
  );
});

test('anchor blocks cannot reference a missing activity', () => {
  const registry = cloneContent();
  registry.anchors.anchors[0]!.block[0] = 'missing-activity';

  expect(() => validateContentRegistry(registry)).toThrow(
    /anchor "wake".*"missing-activity"/,
  );
});

test('objects cannot claim a missing activity', () => {
  const registry = cloneContent();
  registry.objects.objects[0]!.activities.push('missing-activity');

  expect(() => validateContentRegistry(registry)).toThrow(
    /object "bed".*"missing-activity"/,
  );
});
