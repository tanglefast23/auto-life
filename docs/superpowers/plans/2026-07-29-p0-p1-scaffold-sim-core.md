# Auto Life P0 + P1 — Platform Proof and Simulation Core

> **Implementation contract:** Execute in order and stop at each phase gate. A task may use an available plan-execution skill, but no named skill is required. Within a task: write a focused failing test, observe the intended failure, implement minimally, make the focused and wider checks green, then checkpoint. Never commit an expected-red tree. Git initialization and commits require Joe's explicit authorization for that implementation run.

**Goal:** First prove the chosen desktop-web stack in an exported build (P0), then build a deterministic, save-safe simulation-math core (P1).

**P0 success:** From a clean install, strict TypeScript, content validation, Jest, and web export pass. The exported page visibly renders Skia, reports `crossOriginIsolated: true`, and an `expo-sqlite` value survives both a hard reload and browser close/reopen on the same origin.

**P1 success:** Fixed math, direct-state PRNG streams, clock semantics, passive decay, Health/multipliers, typed activities, phased signed effects, Sleep, and Nap are covered by a SPEC-to-test table. Runtime state survives a JSON round-trip mid-activity, and the exact 16-hour-awake/8-hour-asleep closure test passes.

**Deliberately not in P1:** planner/queue/anchors/adjacency/forecaster (P2), rendered walking (P3), Practice as a playable system (P4), goals/wrinkle deck/persistence storage (P4–P5). P1 may provide their pure numerical prerequisites; it must not create placeholder versions of those systems.

---

## Preflight — before Task 1

- [ ] Confirm C12 remains fixed: no P−1 work is introduced.
- [ ] Inventory the existing folder. It already contains `SPEC.md`, `design.md`, `writing.md`, `docs/`, `.claude/`, and `output/`; none may be overwritten or swept into a scaffold commit.
- [ ] Confirm whether Joe authorizes `git init` and implementation commits. If not, skip every Git substep while keeping the same green checkpoints.
- [ ] Record `node --version` and `npm --version`. Use Node 22 via `.nvmrc`; if the current Expo SDK's official requirement has changed, update the pin deliberately and record why.
- [ ] Re-check the current official setup pages before installing:
  - Expo SQLite web setup: <https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup>
  - React Native Skia web setup: <https://shopify.github.io/react-native-skia/docs/getting-started/web/>
- [ ] Define the evidence paths when implementation begins: `docs/superpowers/evidence/P0.md` and `docs/superpowers/evidence/P1.md`. Do not create empty placeholders.

---

# P0 — prove the platform before simulation work

### Task 1: Safe Expo scaffold and locked dependency set

**Files:** Create `package.json`, lockfile, `.nvmrc`, `tsconfig.json`, `app.json`, `App.tsx`, `index.ts`, `.gitignore`, scaffold assets. Preserve all existing files.

- [ ] **Step 1: Generate outside the project root contents.**

The known non-empty root is not a valid direct `create-expo-app` target. Do not intentionally run a command expected to fail and do not broadly merge a generated Git directory.

```bash
test ! -e /tmp/auto-life-scaffold
npx create-expo-app@latest /tmp/auto-life-scaffold --template blank-typescript --no-install --yes
rg --files /tmp/auto-life-scaffold
```

Copy only the named scaffold files/directories after confirming their destinations do not exist:

```bash
cp /tmp/auto-life-scaffold/App.tsx .
cp /tmp/auto-life-scaffold/app.json .
cp /tmp/auto-life-scaffold/index.ts .
cp /tmp/auto-life-scaffold/package.json .
cp /tmp/auto-life-scaffold/tsconfig.json .
cp /tmp/auto-life-scaffold/.gitignore .
cp -R /tmp/auto-life-scaffold/assets .
```

Do **not** copy a nested `.git`, `node_modules`, generated docs, or unreviewed dotfiles. Inspect the copied files, then delete only the exact, preflighted `/tmp/auto-life-scaffold` directory before running the project checks.

- [ ] **Step 2: Pin the runtime and install only P0/P1 dependencies.**

Create `.nvmrc` containing `22`. Install the scaffold, then use Expo's resolver for Expo-coupled packages:

```bash
npm install
npx expo install react-dom react-native-web @expo/metro-runtime @shopify/react-native-skia expo-sqlite
npm install zod@^4
npx expo install jest-expo jest -- --save-dev
npm install --save-dev @types/jest tsx serve
```

Set `package.json`'s package name to `auto-life`, and set `app.json`'s display name/slug to `Auto Life` / `auto-life`. Do not install Zustand, Reanimated, NativeWind, or audio yet; their first consumers are later phases. The lockfile, not an unbounded future `latest`, freezes the resolved SDK/package set after this task.

- [ ] **Step 3: Strict TypeScript.**

Merge these into `compilerOptions` without discarding the Expo base config:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noFallthroughCasesInSwitch": true,
  "resolveJsonModule": true
}
```

- [ ] **Step 4: Repository safety.**

Extend `.gitignore` for at least:

```text
node_modules/
.expo/
dist/
.DS_Store
.claude/settings.local.json
```

If Git was authorized, initialize only now and review `git status --short`. Existing specs, docs, `.claude`, and generated output require a separate explicit staging decision; never use `git add -A`.

- [ ] **Step 5: Verify.**

```bash
npx tsc --noEmit
npm ls --depth=0
```

Expected: both exit 0; dependency/peer errors are resolved now, not deferred.

- [ ] **Checkpoint:** If authorized, stage only the reviewed scaffold, dependency manifests, `.nvmrc`, and `.gitignore`. Commit only while green.

### Task 2: Green test runner and canonical verification commands

**Files:** Create `jest.config.js`, `src/sim/__tests__/test-runner.test.ts`. Modify `package.json`.

- [ ] **Step 1: Configure Jest for pure TypeScript tests.**

Use Expo's supported Jest transform while keeping this suite in Node and out of React Native:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/{src,scripts}/**/__tests__/**/*.test.ts'],
  clearMocks: true,
};
```

Do not declare a Jest `roots` directory before it exists.

- [ ] **Step 2: Add a self-contained runner test.**

```ts
test('the TypeScript test runner is wired', () => {
  const scale: number = 6000;
  expect(scale).toBe(6000);
});
```

This task validates the runner and ends green. It does not commit a missing-module test for a future task.

- [ ] **Step 3: Add scripts.**

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "jest --runInBand",
    "test:watch": "jest --watch"
  }
}
```

- [ ] **Step 4: Verify.**

```bash
npm run typecheck
npm test
```

Expected: both pass. Remove the runner-only test in Task 6 after real sim tests exist.

- [ ] **Checkpoint:** reviewed Task 2 files only, if commits are authorized.

### Task 3: One strict, runtime-used content pipeline

**Files:** Create `content/rates.json`, `src/sim/content-schemas.ts`, `src/sim/content.ts`, `scripts/validate-content.ts`, `scripts/__tests__/validate-content.test.ts`. Modify `package.json`.

- [ ] **Step 1: Create `rates.json` from SPEC §6.1, §6.5, and §9.2.**

```json
{
  "rates": {
    "energy":    { "awake": 5.0, "asleep": 0 },
    "nutrition": { "awake": 4.0, "asleep": 4.0 },
    "hygiene":   { "awake": 3.0, "asleep": 1.0 },
    "movement":  { "awake": 2.0, "asleep": 2.0 }
  },
  "sleepRestorePerHour": 10.0,
  "weights": { "energy": 1, "nutrition": 1, "movement": 1, "hygiene": 1 },
  "wellFed": { "threshold": 70, "outputBonus": 0.10 },
  "displayBands": {
    "default": { "tick": 70, "alert": 40 },
    "energy": { "tick": 30, "alert": 15 }
  },
  "urgentThreshold": 15,
  "chronotype": {
    "baseline": { "wake": 420, "bed": 1380 },
    "early": { "wake": 390, "bed": 1350 },
    "owl": { "wake": 450, "bed": 1410 }
  }
}
```

- [ ] **Step 2: Write failing schema tests.**

Tests must prove:

- the real file parses;
- an unknown key fails;
- a missing weight fails;
- a non-finite, negative rate fails;
- `alert < tick` for each display band;
- every target minute is an integer in `0...1439`.

- [ ] **Step 3: Implement strict Zod 4 schemas.**

Use `z.strictObject` for objects. Use an exhaustive `z.record(BarIdSchema, ...)` for the four required weights. Later optional effect maps must use `z.partialRecord`, not `z.record`: in Zod 4, an enum-keyed `z.record` requires every enum key.

```ts
import { z } from 'zod';

export const BarIdSchema = z.enum(['energy', 'nutrition', 'movement', 'hygiene']);
const finiteNonNegative = z.number().finite().min(0);
const BarRateSchema = z.strictObject({
  awake: finiteNonNegative,
  asleep: finiteNonNegative,
});
const TargetSchema = z.strictObject({
  wake: z.number().int().min(0).max(1439),
  bed: z.number().int().min(0).max(1439),
});
const BandSchema = z.strictObject({
  tick: z.number().finite().min(0).max(100),
  alert: z.number().finite().min(0).max(100),
}).refine((band) => band.alert < band.tick, 'alert must be below tick');

export const RatesSchema = z.strictObject({
  rates: z.strictObject({
    energy: BarRateSchema,
    nutrition: BarRateSchema,
    movement: BarRateSchema,
    hygiene: BarRateSchema,
  }),
  sleepRestorePerHour: z.number().finite().positive(),
  weights: z.record(BarIdSchema, z.number().finite().positive()),
  wellFed: z.strictObject({
    threshold: z.number().finite().min(0).max(100),
    outputBonus: z.number().finite().min(0),
  }),
  displayBands: z.strictObject({
    default: BandSchema,
    energy: BandSchema,
  }),
  urgentThreshold: z.number().finite().min(0).max(100),
  chronotype: z.strictObject({
    baseline: TargetSchema,
    early: TargetSchema,
    owl: TargetSchema,
  }),
});

export type RatesConfig = z.infer<typeof RatesSchema>;
```

- [ ] **Step 4: Make parsed content the only runtime import path.**

`src/sim/content.ts` imports raw JSON, parses it, and exports the typed result. Tests and runtime code must import that parsed object—not raw JSON directly.

`scripts/validate-content.ts` imports the same registry and exits non-zero on any parse error. As more content files arrive, they are added once to this registry; do not maintain a second list only in tests.

- [ ] **Step 5: Add scripts and verify.**

```json
{
  "scripts": {
    "validate:content": "tsx scripts/validate-content.ts",
    "check": "npm run validate:content && npm run typecheck && npm test"
  }
}
```

```bash
npm run validate:content
npm run check
```

Expected: the focused test first fails for the intended missing schema, then all checks finish green.

- [ ] **Checkpoint:** reviewed Task 3 files only, if authorized.

### Task 4: Exported Skia + SQLite reload proof

**Files:** Create `metro.config.js`, `index.web.ts`, `public/canvaskit.wasm` via the official setup command, `serve.json`, `vercel.json`, `src/application/ProofScreen.tsx`. Modify `package.json`, `App.tsx`.

This task is a technical kill gate. If the chosen static-web persistence path cannot pass, stop P0 and decide the persistence adapter before writing P1.

- [ ] **Step 1: Configure SQLite WASM and isolation headers for Metro.**

```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
```

- [ ] **Step 2: Give the exported server and production target equivalent headers.**

`serve.json`:

```json
{
  "headers": [
    {
      "source": "**/*",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```

`vercel.json` uses the same values with source `/(.*)`. P0 does not deploy; this only makes the intended host contract explicit.

- [ ] **Step 3: Make CanvasKit setup mandatory, not a failure fallback.**

Add:

```json
{
  "scripts": {
    "postinstall": "setup-skia-web",
    "setup:skia-web": "setup-skia-web"
  }
}
```

Run `npm run setup:skia-web`. The current official setup must place `canvaskit.wasm` where Expo's static export can serve it. Re-run after every Skia upgrade.

- [ ] **Step 4: Defer web app registration until Skia loads.**

Use the current official `LoadSkiaWeb()` entry pattern. `index.web.ts` must load Skia before dynamically importing `App`; native keeps the scaffold `index.ts` fallback. Set `package.json`'s `main` to the extensionless `"index"` so Metro applies its `.web.ts` platform resolution, then prove both typecheck and web export rather than assuming resolution.

```ts
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

void LoadSkiaWeb().then(async () => {
  const App = (await import('./App')).default;
  registerRootComponent(App);
});
```

- [ ] **Step 5: Build a proof that can fail honestly.**

The proof screen must:

- draw a visible terracotta Skia rectangle;
- display `crossOriginIsolated: true`;
- open `proof.db`;
- create a counter row if absent;
- **read the old value before writing the incremented value**;
- display `persistence: prior=N next=N+1`;
- display a useful failure state and log the caught error.

The first load should show `prior=0 next=1`; a hard reload must show `prior=1 next=2`. A proof that writes `"ok"` before reading is rejected because an in-memory database would pass it.

- [ ] **Step 6: Add export/serve commands.**

```json
{
  "scripts": {
    "export:web": "expo export --platform web",
    "serve:dist": "serve dist --listen 4173",
    "verify": "npm run validate:content && npm run typecheck && npm test && npm run export:web"
  }
}
```

- [ ] **Step 7: Verify development and the exported artifact separately.**

1. Run `npx expo start --web`; confirm draw, isolation, and first reload.
2. Run `npm run export:web`.
3. Run `npm run serve:dist`; use the served `dist/`, not the dev server.
4. Confirm the Skia draw and `crossOriginIsolated: true`.
5. Hard reload: require the prior counter.
6. Close the browser completely, reopen the exact same origin/port, and require the next prior counter.
7. Record browser/version, commands, observed counter sequence, console errors (none expected), and a screenshot in `docs/superpowers/evidence/P0.md`.

Do not call this deployed; it is an exported local proof.

- [ ] **Checkpoint:** only after the exported artifact passes. If authorized, stage reviewed Task 4 files—not `dist/`.

### Task 5: CI and the P0 exit gate

**Files:** Create `.github/workflows/ci.yml`. Finalize `docs/superpowers/evidence/P0.md` during implementation.

- [ ] **Step 1: Add one clean-install workflow.**

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run verify
```

At implementation time, confirm current supported action majors rather than copying stale versions blindly.

- [ ] **Step 2: Prove the clean path locally.**

Use a disposable copy/worktree or a clean checkout once Git exists; do not delete the live `node_modules` or user files merely to simulate cleanliness. Run:

```bash
npm ci
npm run verify
```

- [ ] **Step 3: Record the honest CI boundary.**

A local `npm run verify` is not CI. If no remote runner is connected or pushing has not been authorized, mark remote CI **NOT VERIFIED** in P0 evidence. P0 is not “CI green” until the workflow actually runs; Joe may explicitly accept that external dependency as a recorded deferral.

- [ ] **P0 EXIT — all required:**

  - `npm run verify` passes after a clean install.
  - Exported Skia draw is observed.
  - Exported SQLite counter survives hard reload and browser close/reopen.
  - `crossOriginIsolated` is true under the same headers intended for Vercel.
  - CI status is truthfully recorded.
  - Resolved Node, Expo SDK, Skia, SQLite, Zod, and Jest versions are recorded.

**Do not begin Task 6 until P0 exits.**

---

# P1 — deterministic simulation arithmetic

### Task 6: Fixed-point arithmetic and initial engine version

**Files:** Create `src/sim/fixed.ts`, `src/sim/version.ts`, `src/sim/__tests__/fixed.test.ts`. Remove `test-runner.test.ts`.

- [ ] **Step 1: Write failing tests for:**

```ts
expect(toFixed(100)).toBe(600_000);
expect(toDisplay(toFixed(72.5))).toBe(72.5);
expect(ratePerMinuteFixed(5)).toBe(500);
expect(ratePerMinuteFixed(0.4)).toBe(40);
expect(ratePerMinuteFixed(0.29)).toBe(29); // binary-float edge
expect(() => ratePerMinuteFixed(5.001)).toThrow();
```

Also sum `fillDelta(...)` across 18 Meal fill ticks and require exactly `toFixed(35)`. Repeat with a negative total and require the exact signed total. Invalid total-tick counts and indices outside `1...totalTicks` must throw.

- [ ] **Step 2: Implement pure arithmetic, not a stateful accumulator.**

```ts
export const SCALE = 6000;
const DECIMAL_TOLERANCE = 1e-9;

export function toFixed(display: number): number {
  if (!Number.isFinite(display)) throw new Error('display value must be finite');
  return Math.round(display * SCALE);
}

export const toDisplay = (fixed: number): number => fixed / SCALE;

export function ratePerMinuteFixed(perHour: number): number {
  if (!Number.isFinite(perHour) || perHour < 0) throw new Error('invalid hourly rate');
  const hundredths = Math.round(perHour * 100);
  if (Math.abs(perHour * 100 - hundredths) > DECIMAL_TOLERANCE) {
    throw new Error(`rate ${perHour}/h has more than two decimal places`);
  }
  return hundredths; // SCALE / 60 = 100
}

export function fillDelta(totalFixed: number, totalTicks: number, tickIndex: number): number {
  if (!Number.isSafeInteger(totalFixed)) throw new Error('total must be a safe integer');
  if (!Number.isInteger(totalTicks) || totalTicks < 1) throw new Error('totalTicks must be positive');
  if (!Number.isInteger(tickIndex) || tickIndex < 1 || tickIndex > totalTicks) {
    throw new Error('tickIndex out of range');
  }
  const sign = Math.sign(totalFixed);
  const magnitude = Math.abs(totalFixed);
  if (!Number.isSafeInteger(magnitude * tickIndex)) {
    throw new Error('fill arithmetic exceeds safe integer range');
  }
  const now = Math.floor((magnitude * tickIndex) / totalTicks);
  const before = Math.floor((magnitude * (tickIndex - 1)) / totalTicks);
  return sign * (now - before);
}
```

This is JSON/save/forecast safe: active state stores only elapsed time and total values; no class instance needs reconstruction.

- [ ] **Step 3: Initialize `ENGINE_VERSION`.**

```ts
export const ENGINE_VERSION = 1 as const;
```

After P1, any behavior-changing code or balance-data change requires an explicit version/golden decision. During the initial unshipped P1 build, do not churn the number for every red-green edit.

- [ ] **Step 4: Verify.**

Run the fixed test, then `npm run check`. Both must pass before checkpoint.

### Task 7: Five O(1) serializable PRNG streams

**Files:** Create `src/sim/prng.ts`, `src/sim/__tests__/prng.test.ts`.

- [ ] **Step 1: Write failing tests for:**

- same root seed + stream produces the same known vector;
- draws in `storylets` do not shift `wrinkles`;
- JSON serialize/restore resumes exactly;
- clone draws do not mutate the original;
- state size and restore work are constant regardless of historical draw count;
- the five exact stream names exist.

Lock at least one vector independent of a second instance. For root seed `1234`, the first three `wrinkles` draws using the salts/algorithm below are:

```ts
[0.8918027963954955, 0.9189240359701216, 0.3371217066887766]
```

- [ ] **Step 2: Store current uint32 state, never replay call history.**

Use stable, name-owned salts:

```ts
export const STREAM_NAMES = [
  'wrinkles',
  'storylets',
  'relationships',
  'careerEvents',
  'cosmetic',
] as const;

const STREAM_SALTS = {
  wrinkles: 0x243f6a88,
  storylets: 0x85a308d3,
  relationships: 0x13198a2e,
  careerEvents: 0x03707344,
  cosmetic: 0xa4093822,
} as const;
```

Each snapshot stores `{ state: uint32, calls: nonNegativeInteger }` for each stream plus the normalized root seed. `next(name)` advances only that stream's stored state. `serialize()` deep-copies five small records; `restore()` and `clone()` copy them directly in O(5). Adding a future stream must not reseed existing streams by array position.

- [ ] **Step 3: Validate untrusted snapshots.**

Provide a Zod schema or explicit guard for root seed, every stream key, uint32 states, and call counts. Persistence later consumes validated plain data.

- [ ] **Step 4: Verify.**

Run focused PRNG tests, JSON-round-trip test, then `npm run check`.

### Task 8: Clock semantics and canonical Day-1 state

**Files:** Create `src/sim/types.ts`, `src/sim/clock.ts`, `src/sim/initial-state.ts`, tests.

- [ ] **Step 1: Define the core plain types.**

```ts
export type BarId = 'energy' | 'nutrition' | 'movement' | 'hygiene';
export const BAR_IDS = ['energy', 'nutrition', 'movement', 'hygiene'] as const;
export type Bars = Record<BarId, number>; // ×6000 integers
export type Chronotype = 'baseline' | 'early' | 'owl';
```

- [ ] **Step 2: Write failing tests for:**

- 1440 ticks/day; tick 0 is Day 1 Monday 00:00;
- the neutral game starts Day 1 Monday 07:00 (`absoluteMinute = 420`);
- early/owl starts use their own wake target;
- Day 8 begins at absolute minute `7 × 1440`;
- minute/day/weekday calculations at boundaries;
- morning check = wake target + 120 minutes;
- invalid negative/non-integer absolute minutes are rejected;
- Day-1 bars are exactly Energy 100, Nutrition 70, Hygiene 70, Movement 60.

- [ ] **Step 3: Implement the locked minute meaning.**

`clock.absoluteMinute` is the minute about to be simulated. Triggers evaluate that value; advancement happens after the tick's deltas are applied. This prevents the future P2 engine from skipping the first 07:00 wake trigger.

- [ ] **Step 4: Verify.**

Run clock/initial-state tests, then `npm run check`.

### Task 9: Named bar deltas and one reducer commit

**Files:** Create `src/sim/bar-deltas.ts`, `src/sim/rates.ts`, tests.

Leaf systems must not independently mutate `Bars`.

- [ ] **Step 1: Write failing tests for:**

- one awake minute returns exact passive deltas;
- asleep uses asleep rates for Nutrition/Hygiene/Movement and no passive Energy;
- an effective Nap suppresses passive Energy but keeps other **awake** decay;
- applying contributions returns new bars and leaves the input unchanged;
- multiple legal contributions to one bar are summed, then clamped once;
- non-integer/unsafe deltas are rejected;
- 16 awake hours drain Energy exactly 100 → 20;
- values clamp at 0 and 100.

- [ ] **Step 2: Define the seam.**

```ts
export interface BarContribution {
  source: string;
  deltas: Partial<Record<BarId, number>>;
}

export type BodyMode = 'awake' | 'asleep' | 'effectiveNap';

export function passiveContribution(
  mode: BodyMode,
  rates: RatesConfig,
): BarContribution;

export function applyBarContributions(
  bars: Bars,
  contributions: readonly BarContribution[],
): Bars;
```

Rules:

- `asleep`: Energy passive is zero; other bars use asleep rates.
- `effectiveNap`: Energy passive is zero; other bars use awake rates.
- `awake`: all awake passive rates apply.
- The reducer is the only function in P1 that clamps/commits a tick's combined bar result.

This replaces the impossible interpretation that a Meal and passive Nutrition decay cannot both affect the same tick. They may both contribute; only the reducer writes the final bar.

- [ ] **Step 3: Verify.**

Run focused rate/reducer tests, then `npm run check`.

### Task 10: Health, speed, output, Well-fed, and walk-speed math

**Files:** Create `src/sim/bars.ts`, `src/sim/__tests__/bars.test.ts`.

- [ ] **Step 1: Write failing tests for:**

- Day-1 Health: mean(100, 70, 60, 70) = 75;
- Health 0 and 100 bounds;
- `m_speed` anchors: Energy 0 → 0.5, 50 → 1.0, 100 → 1.5;
- `m_out` anchors: Health 0 → 0.5, 50 → 1.0, 100 → 1.5;
- Well-fed is true at Nutrition 70 and false one fixed unit below;
- walk speed: Movement 0 → 2.25 tiles/min, 100 → 3.75;
- weights are exhaustive validated content, not silently defaulted.

- [ ] **Step 2: Implement pure calculations.**

```ts
healthDisplay(bars, rates)
mSpeedAtStart(bars)
mOutAtStart(bars, rates)
isWellFedAtStart(bars, rates)
walkTilesPerMinute(bars)
```

Sampling values are captured by the consumer at activity/travel start. P1 proves the functions; P2's headless Practice math first consumes `m_out` and Hygiene modifiers, P3 makes walk speed visible, and P4 makes Practice player-visible.

- [ ] **Step 3: Verify.**

Run focused bar tests, then `npm run check`.

### Task 11: Strict activity content with signed effects

**Files:** Create `content/activities.json`, extend content schemas/registry/tests.

- [ ] **Step 1: Encode cross-effects as signed, pro-rata effects.**

Do not invent completion-only costs. Otherwise stopping a workout at 99% keeps almost all Movement while avoiding the entire cost.

Representative entries:

```json
{
  "activities": [
    { "id": "sleep", "kind": "sleepWindow", "object": "bed" },
    {
      "id": "nap",
      "kind": "timed",
      "object": "couch",
      "baseMin": 45,
      "effects": { "energy": 10 },
      "effectiveUsesPerDay": 1,
      "startBelow": { "energy": 50 },
      "effectiveWindow": { "wakeOffsetStart": 60, "wakeOffsetEnd": 780 },
      "suppressPassiveEnergyWhenEffective": true
    },
    {
      "id": "meal",
      "kind": "timed",
      "object": "microwave",
      "baseMin": 30,
      "effects": { "nutrition": 35 },
      "fillStartsAfterFraction": 0.4
    },
    { "id": "snack", "kind": "timed", "object": "fridge", "baseMin": 10, "effects": { "nutrition": 10 } },
    {
      "id": "weights",
      "kind": "timed",
      "object": "bench",
      "baseMin": 60,
      "tags": ["workout"],
      "effects": { "movement": 50, "nutrition": -5 }
    },
    {
      "id": "treadmill",
      "kind": "timed",
      "object": "treadmill",
      "baseMin": 60,
      "tags": ["workout"],
      "effects": { "movement": 50, "hygiene": -5 }
    },
    { "id": "stretch", "kind": "timed", "object": "rug", "baseMin": 15, "effects": { "movement": 8 } },
    { "id": "shower", "kind": "timed", "object": "shower", "baseMin": 20, "effects": { "hygiene": 40 } },
    { "id": "quickwash", "kind": "timed", "object": "sink", "baseMin": 8, "effects": { "hygiene": 15 } },
    { "id": "brush", "kind": "timed", "object": "sink", "baseMin": 5, "effects": { "hygiene": 10 } },
    { "id": "toilet", "kind": "timed", "object": "toilet", "baseMin": 3, "effects": {} },
    { "id": "practice", "kind": "practice", "object": "guitar", "baseMin": 60 },
    { "id": "idle", "kind": "idle", "object": "couch" }
  ]
}
```

The offsets reproduce baseline 08:00–20:00 while shifting with chronotype.

- [ ] **Step 2: Write failing validation tests for:**

- the real file parses;
- duplicate IDs fail;
- unknown keys fail;
- effect maps may contain some bars but no unknown bar;
- signed finite effects are accepted;
- timed `baseMin` is a positive integer;
- `fillStartsAfterFraction` is in `[0, 1)` and cannot leave zero fill ticks;
- `sleepWindow`/`idle` cannot masquerade as one-tick timed activities;
- Nap's effective-use/window/suppression fields form one coherent rule.

- [ ] **Step 3: Use Zod 4's partial record for effect maps.**

```ts
const BarEffectsSchema = z.partialRecord(
  BarIdSchema.or(z.never()),
  z.number().finite(),
);
```

Use a discriminated union on `kind`, strict objects, and an array `superRefine` for unique IDs. Add the parsed activities to the one content registry from Task 3.

- [ ] **Step 4: Test the quick-option invariant.**

From parsed content:

- Stretch `8/15 × 60 = 32/h` < workout `50/h`;
- Snack `10/10 × 60 = 60/h` < Meal `35/30 × 60 = 70/h`;
- Quick wash `15/8 × 60 = 112.5/h` < Shower `40/20 × 60 = 120/h`;
- Nap is the declared exception and has exactly one effective use/day.

- [ ] **Step 5: Verify.**

Run content/activity validation, then `npm run check`.

### Task 12: Serializable timed-activity lifecycle

**Files:** Create `src/sim/activities.ts`, `src/sim/__tests__/activities.test.ts`.

- [ ] **Step 1: Lock the plain runtime DTO.**

```ts
export interface ActiveTimedActivity {
  activityId: string;
  durationTicks: number;
  elapsedTicks: number;
  fillStartTick: number;
  effectTotalsFixed: Partial<Record<BarId, number>>;
  suppressPassiveEnergy: boolean;
  sampled: {
    mSpeed: number;
    wellFed: boolean;
    effectiveUse: boolean;
  };
}
```

It contains no content object, closure, accumulator instance, or redundant `completed` flag. Definitions are looked up by ID. Completion is the transition where `elapsedTicks` reaches `durationTicks`; a completed activity is no longer stored as current.

- [ ] **Step 2: Write failing tests for:**

- duration = `ceil(baseMin / m_speed)` sampled once at start;
- Sleep/Idle/Practice definitions are rejected by the P1 timed starter rather than silently becoming one-tick activities;
- Meal at Energy 100 lasts 20 ticks, first 8 grant no Nutrition, final 12 grant exactly +35;
- stopping Weights halfway has already produced exactly +25 Movement and −2.5 Nutrition;
- stopping one tick before completion cannot avoid the proportional cross-cost;
- Nutrition 70 at workout start gives +55 Movement; one fixed unit below gives +50;
- Well-fed is sampled at start and does not change mid-activity;
- input state is not mutated;
- JSON round-trip halfway through a Meal completes identically to uninterrupted execution;
- progressing a cloned activity never changes the original.

- [ ] **Step 3: Implement start as a sampler.**

At start:

- compute and store `durationTicks`;
- convert all signed effects to fixed totals;
- for a workout, multiply only its positive Movement output by the configured Well-fed bonus;
- keep the negative cross-effect unchanged;
- compute `fillStartTick` with an explicit rounding rule and ensure at least one fill tick;
- sample whether this Nap use is effective and whether Energy passive is suppressed.

- [ ] **Step 4: Implement progress as a pure transition.**

Conceptual return:

```ts
progressTimedActivity(active)
  -> {
       next: ActiveTimedActivity | null,
       contribution: BarContribution,
       completed: boolean
     }
```

Use Task 6's stateless `fillDelta` for each signed total. Do not clamp here; Task 9's reducer combines passive and activity contributions and clamps once.

Stopping removes the active DTO and emits no new final effect. Everything earned or spent so far remains because both positive and negative effects accrued proportionally.

- [ ] **Step 5: Add a composed tick test.**

During a Meal tick, combine passive Nutrition decay and Meal fill as two named contributions, apply them once through the reducer, and assert the exact net. This is the executable proof of the “one commit, multiple effects” rule.

- [ ] **Step 6: Verify.**

Run focused activity tests, JSON-round-trip tests, then `npm run check`.

### Task 13: Sleep, effective Nap, exact closure, and P1 traceability

**Files:** Extend `activities.ts` and tests. Create `src/sim/__tests__/closure-day.test.ts`. Create `docs/superpowers/evidence/P1.md` during implementation.

- [ ] **Step 1: Sleep tests.**

- Sleep emits `+10 Energy/hour` exactly, never scaled.
- Passive Energy is zero during Sleep.
- Nutrition/Hygiene/Movement continue at asleep rates.
- 480 sleep ticks from Energy 20 reach exactly 100.

- [ ] **Step 2: Nap eligibility/effect tests.**

- It is startable only below Energy 50 and inside the chronotype-shifted effective window.
- The first effective Nap of the day suppresses passive Energy and nets exactly +10 across 45 ticks; other bars keep awake decay.
- Later player-inserted naps are flavor-only: zero restore and ordinary awake Energy decay, so they cannot become an unlimited Energy-freeze exploit.
- The daily effective-use counter resets at the wake boundary, not arbitrary midnight.

This resolves the current “later naps are flavor only” wording into an implementable rule. If Joe wants later naps to freeze Energy despite restoring zero, record that as a design change before implementation.

- [ ] **Step 3: Exact closure-day integration test.**

Name this honestly; it is not the later seven-day golden replay.

```ts
test('16h awake + 8h asleep closes Energy exactly', () => {
  // Start all bars at 100 to isolate the daily budget.
  // 960 awake ticks: Energy 100 -> 20.
  // 480 asleep ticks combine asleep passive deltas + Sleep restore.
  // End: Energy 100, Nutrition 4, Hygiene 44, Movement 52.
});
```

Assert fixed integers, not approximate display floats. If it fails, first re-check the expectation against the current SPEC, then fix the source of disagreement; never decree that the test is infallible.

- [ ] **Step 4: Complete the P1 traceability table.**

Record each clause and its owner:

| SPEC clause | P1 evidence or later owner |
|---|---|
| §5 tick/day/start clock | clock tests |
| §6.1 passive rates, Sleep, effective Nap | exact unit + closure tests |
| §6.2 activity amounts/cross-effects | strict content + signed effect tests |
| §6.2 quick-option invariant | content rate test |
| §6.3 phased/pro-rata fill | Meal + early-stop tests |
| §6.4 Health | bars tests |
| §6.5 Energy speed/Movement walk/Well-fed | calculation + workout-consumer tests |
| §6.5 Hygiene focus | **P2 Practice-math owner; P4 player-visible integration** |
| §6.6 `m_out` and sampling | calculation tests; **P2 Practice first consumer** |
| §6.7 adjacency | **P2 owner** |
| §6.8 routine steady state | closure arithmetic here; **P2 unattended harness owns routine bands** |
| §16.2 direct PRNG state/fixed determinism | fixed vectors, JSON restore, version record |

- [ ] **Step 5: Full P1 gate.**

```bash
npm run verify
```

`docs/superpowers/evidence/P1.md` records:

- exact command results;
- the resolved `ENGINE_VERSION`;
- SPEC-to-test table;
- a saved JSON fixture halfway through Meal and its identical resumed outcome;
- known PRNG vector and serialized fixture;
- any later-owner rows (no unowned rows);
- remaining risks.

- [ ] **P1 EXIT:** all checks/evidence above pass. Only then author and audit the P2 plan against the real tree.

---

## Audit corrections embodied by this revision

- P0 completes before any P1 simulation work.
- CI and the standalone content validator now exist in the plan.
- Every task ends green; no deliberately broken commit crosses a task boundary.
- The non-empty folder is scaffolded without a known failed command or broad tree merge.
- SQLite is tested across reload/reopen with the WASM and isolation headers it actually needs.
- Skia CanvasKit setup and deferred web loading are requirements, not troubleshooting suggestions.
- Zod 4 partial records are used correctly for sparse bar effects.
- Fixed conversion tolerates valid two-decimal JavaScript values.
- PRNG restore/clone is O(5), not O(all historical draws), and has known vectors.
- Bars receive one combined commit per tick while allowing passive and activity effects to coexist.
- Nap's net restore is testable and unbounded nap-freeze is closed.
- Workout cross-costs are signed/pro-rata, closing the stop-at-99% exploit.
- Active activity state is plain JSON and forecast/save safe.
- P1 coverage is stated clause by clause instead of overclaimed.
