import { Command } from 'commander';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

/**
 * Finds the test directories in the generated project
 * @param baseDir - The base directory of the generated project
 * @returns An object containing the paths to the backend and frontend directories if they exist
 */
function findTestDirectories(baseDir: string): { backend?: string, frontend?: string } {
  const result: { backend?: string, frontend?: string } = {};
  
  // Check for backend tests
  const backendDir = path.join(baseDir, 'src', 'backend');
  if (fs.existsSync(backendDir) && 
      (fs.existsSync(path.join(backendDir, 'jest.config.js')) || 
       fs.existsSync(path.join(backendDir, 'package.json')))) {
    result.backend = backendDir;
  }
  
  // Check for frontend tests
  const frontendDir = path.join(baseDir, 'src', 'frontend');
  if (fs.existsSync(frontendDir) && 
      (fs.existsSync(path.join(frontendDir, 'vitest.config.ts')) || 
       fs.existsSync(path.join(frontendDir, 'vitest.config.js')) || 
       fs.existsSync(path.join(frontendDir, 'package.json')))) {
    result.frontend = frontendDir;
  }
  
  return result;
}

/**
 * Checks if the directory has the specified package installed
 * @param dir - The directory to check
 * @param pkg - The package name to check for
 * @returns A boolean indicating whether the package is installed
 */
function hasPackage(dir: string, pkg: string): boolean {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
    return !!(packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg]);
  } catch (error) {
    return false;
  }
}

/**
 * Installs test dependencies if needed
 * @param dir - The directory to install dependencies in
 * @returns A promise that resolves when dependencies are installed
 */
function installTestDependencies(dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Installing test dependencies in ${dir}...`);
    exec('npm install --no-audit', { cwd: dir }, (error) => {
      if (error) {
        console.error(`Failed to install dependencies: ${error.message}`);
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export const testCommand = new Command('test')
  .description('Runs tests for the generated application')
  .option('--watch', 'Run tests in watch mode')
  .option('--coverage', 'Generate a code coverage report')
  .option('--backend-only', 'Only run the backend (NestJS/Jest) tests')
  .option('--frontend-only', 'Only run the frontend (React/Vitest) tests')
  .option('--ci', 'Run tests in CI mode (non-interactive)')
  .option('--verbose', 'Show verbose test output')
  .action(async (opts) => {
    const cwd = process.cwd();
    const testDirs = findTestDirectories(cwd);
    
    if (!testDirs.backend && !testDirs.frontend) {
      console.error('Error: No test directories found in the generated project.');
      console.error('Make sure you are running this command from the root of a Stalmer1 project.');
      process.exit(1);
    }
    
    // Build test command args
    const backendArgs = ['test'];
    const frontendArgs = ['run', 'test'];
    
    if (opts.watch) {
      backendArgs.push('--watch');
      frontendArgs.push('--watch');
    }
    
    if (opts.coverage) {
      backendArgs.push('--coverage');
      frontendArgs.push('--coverage');
    }
    
    if (opts.ci) {
      backendArgs.push('--ci', '--runInBand');
      frontendArgs.push('--run');
    }
    
    if (opts.verbose) {
      backendArgs.push('--verbose');
      frontendArgs.push('--reporter=verbose');
    }
    
    // Run backend tests if requested
    if (testDirs.backend && (!opts.frontendOnly || opts.backendOnly)) {
      console.log('\n=== Running Backend Tests ===\n');
      
      // Check if Jest is installed
      if (!hasPackage(testDirs.backend, 'jest')) {
        try {
          await installTestDependencies(testDirs.backend);
        } catch (error) {
          console.error('Failed to install backend test dependencies');
          process.exit(1);
        }
      }
      
      const result = spawnSync('npm', backendArgs, { cwd: testDirs.backend, stdio: 'inherit' });
      if (result.status !== 0 && !opts.frontendOnly) {
        console.error('Backend tests failed.');
        if (!opts.frontendOnly) {
          process.exit(result.status || 1);
        }
      }
    }
    
    // Run frontend tests if requested
    if (testDirs.frontend && (!opts.backendOnly || opts.frontendOnly)) {
      console.log('\n=== Running Frontend Tests ===\n');
      
      // Check if Vitest is installed
      if (!hasPackage(testDirs.frontend, 'vitest')) {
        try {
          await installTestDependencies(testDirs.frontend);
        } catch (error) {
          console.error('Failed to install frontend test dependencies');
          process.exit(1);
        }
      }
      
      const result = spawnSync('npm', frontendArgs, { cwd: testDirs.frontend, stdio: 'inherit' });
      if (result.status !== 0) {
        console.error('Frontend tests failed.');
        process.exit(result.status || 1);
      }
    }
    
    console.log('\n✅ All tests passed successfully!');
  });
