#!/usr/bin/env node

/**
 * This script handles the release process for Stalmer1.
 * It performs the following:
 * 1. Bumps version in all package.json files
 * 2. Updates CHANGELOG.md with date
 * 3. Creates git tag
 * 4. Pushes changes and tag
 *
 * Usage:
 * node scripts/release.js [patch|minor|major|<version>]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const semver = require('semver');

// Configuration
const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');
const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const packages = fs.readdirSync(packagesDir).filter(name => {
  return fs.statSync(path.join(packagesDir, name)).isDirectory();
});

// Get current version
const pkg = require(packageJsonPath);
const currentVersion = pkg.version;

// Determine new version
const versionArg = process.argv[2] || 'patch';
let newVersion;

if (['major', 'minor', 'patch'].includes(versionArg)) {
  newVersion = semver.inc(currentVersion, versionArg);
} else if (semver.valid(versionArg)) {
  newVersion = versionArg;
} else {
  console.error('Invalid version argument. Use major, minor, patch, or a specific semver version.');
  process.exit(1);
}

console.log(`Preparing release v${newVersion} (current: v${currentVersion})`);

// Update root package.json
pkg.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ Updated root package.json`);

// Update all package.json files in packages/
packages.forEach(packageName => {
  const packageJsonPath = path.join(packagesDir, packageName, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = require(packageJsonPath);
    packageJson.version = newVersion;
    
    // Update dependencies on other local packages
    for (const dep of Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
      if (dep.startsWith('@stalmer1/')) {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          packageJson.dependencies[dep] = `^${newVersion}`;
        }
        if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
          packageJson.devDependencies[dep] = `^${newVersion}`;
        }
      }
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✓ Updated ${packageName}/package.json`);
  }
});

// Update CHANGELOG.md with release date
const today = new Date().toISOString().slice(0, 10);
let changelog = fs.readFileSync(changelogPath, 'utf8');
changelog = changelog.replace(/## \[([0-9.]+)\] - (?:Unreleased|[0-9-]+)/, `## [$1] - ${today}`);
fs.writeFileSync(changelogPath, changelog);
console.log(`✓ Updated CHANGELOG.md with release date ${today}`);

// Git commit
try {
  execSync(`git add .`, { stdio: 'inherit' });
  execSync(`git commit -m "chore(release): v${newVersion}"`, { stdio: 'inherit' });
  execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });
  console.log(`✓ Committed and tagged v${newVersion}`);
  
  console.log('\nRelease preparation complete. To finish the release:');
  console.log(`1. Run: git push origin main v${newVersion}`);
  console.log('2. Create a GitHub release');
  console.log('3. The GitHub Actions workflow will publish to npm automatically');
} catch (error) {
  console.error('Error during git operations:', error);
  process.exit(1);
}
