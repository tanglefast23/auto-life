// Self-contained runner check (removed once real sim tests exist — plan Task 2).
test('the TypeScript test runner is wired', () => {
  const scale: number = 6000;
  expect(scale).toBe(6000);
});
