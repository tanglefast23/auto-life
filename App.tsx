import { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ApplicationRoot } from './src/application/ApplicationRoot';
import {
  FixedSeedSource,
  playtestSeedFromSearch,
  type SeedSource,
} from './src/application/new-career';

function playtestSeedSource(): SeedSource | undefined {
  if (typeof globalThis.location === 'undefined') return undefined;
  const seed = playtestSeedFromSearch(globalThis.location.search);
  return seed === null ? undefined : new FixedSeedSource(seed);
}

export default function App() {
  const seedSource = useMemo(playtestSeedSource, []);
  return (
    <>
      <ApplicationRoot seedSource={seedSource} />
      <StatusBar style="auto" />
    </>
  );
}
