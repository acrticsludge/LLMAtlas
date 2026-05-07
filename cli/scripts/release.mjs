// scripts/release.mjs
// Cross-platform release script: bump version, tag, push, trigger npm publish
//
// Usage:        node scripts/release.mjs [patch|minor|major]
// Example:      node scripts/release.mjs patch
// npm script:   npm run release patch
//
// What it does:
//   1. Bumps version in package.json + package-lock.json
//   2. Commits with message "chore: release v<version>"
//   3. Creates git tag "v<version>"
//   4. Pushes commit + tags to origin
//
// On tag push, .github/workflows/publish.yml runs tests and publishes to npm.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const bump = process.argv[2] || 'patch';
const validBumps = ['patch', 'minor', 'major'];
if (!validBumps.includes(bump)) {
  console.error(`Invalid bump: "${bump}". Use: patch, minor, or major`);
  process.exit(1);
}

// Read current version
const pkgPath = join(projectRoot, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const oldVersion = pkg.version;

// Bump version using npm (without auto-git to control it ourselves)
console.log(`\n  Bumping: ${oldVersion} → ${bump}\n`);
execSync(`npm version ${bump} --no-git-tag-version --no-commit-hooks`, {
  stdio: 'inherit',
  cwd: projectRoot,
});

// Read new version
const newPkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const newVersion = newPkg.version;

if (oldVersion === newVersion) {
  console.log('  No change. Nothing to release.');
  process.exit(0);
}

// Run tests before releasing
console.log(`\n  Running tests...\n`);
try {
  execSync(`npm test`, { stdio: 'inherit', cwd: projectRoot });
} catch (err) {
  console.error(`  ✗ Tests failed. Aborting release.`);
  process.exit(1);
}
console.log(`  ✓ All tests passed\n`);

// Commit, tag, push
const steps = [
  `git add -A`,
  `git commit -m "chore: release v${newVersion}"`,
  `git tag v${newVersion}`,
  `git push`,
  `git push --tags`,
];

for (const cmd of steps) {
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: projectRoot });
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

console.log(`\n  ✅ v${oldVersion} → v${newVersion} released`);
console.log(`  🌐 GitHub Actions will publish to npm\n`);
