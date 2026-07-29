/** Build-time content gate: parses the full registry, exits non-zero on any error. */
try {
  const { content } = require('../src/sim/content') as typeof import('../src/sim/content');
  const files = Object.keys(content);
  console.log(`content OK (${files.length} file${files.length === 1 ? '' : 's'}: ${files.join(', ')})`);
} catch (err) {
  console.error('content INVALID');
  console.error(err);
  process.exit(1);
}
