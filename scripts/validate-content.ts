/** Build-time content gate: parses the full registry, exits non-zero on any error. */
try {
  const { content } = require('../src/sim/content') as typeof import('../src/sim/content');
  const { queueStrings } = require('../src/ui/queue-copy') as typeof import('../src/ui/queue-copy');
  const { firstSessionStrings } = require('../src/ui/first-session-copy') as typeof import('../src/ui/first-session-copy');
  const { validateWritingReviews } = require('./validate-writing') as typeof import('./validate-writing');
  const reviews = validateWritingReviews();
  const files = Object.keys(content);
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
