#!/usr/bin/env node
// cli/bin/llm-atlas.js

import('../dist/index.js').catch((err) => {
  console.error('Failed to load llm-atlas. Did you run `npm run build`?');
  console.error(err);
  process.exit(1);
});
