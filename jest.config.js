/** @type {import('jest').Config} */
// Sim/game rings are pure TypeScript — node environment via jest-expo's transform,
// deliberately outside the React Native preset (no RN imports allowed in there anyway).
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/{src,scripts}/**/__tests__/**/*.test.ts'],
  clearMocks: true,
};
