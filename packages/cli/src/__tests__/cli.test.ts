import { generateCommand } from '../generate';
import { initCommand, initAction } from '../init';
import { Command } from 'commander';
import * as path from 'path';

// Mock the fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'), // Import and retain default behavior
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  rmSync: jest.fn(),
}));

const fs = require('fs'); // Re-import the mocked fs

// Manually create and clean up temp directories for chdir tests
const createTempDir = (prefix: string) => {
  const tempDir = jest.requireActual('fs').mkdtempSync(prefix);
  return tempDir;
};

describe('CLI commands', () => {
  it('should have a generate command', () => {
    expect(generateCommand).toBeInstanceOf(Command);
  });
  it('should have an init command', () => {
    expect(initCommand).toBeInstanceOf(Command);
  });

  it('should set db in stalmer1.json when using --db', () => {
    const tmpDir = createTempDir('stalmer1-test-');
    fs.existsSync.mockReturnValue(false);
    fs.writeFileSync.mockClear(); // Clear any previous mock calls
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      initAction({ db: 'postgresql' });

      // Check that writeFileSync was called twice
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);

      // Check the content of the first call (schema.dsl)
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('schema.dsl'),
        `# Example Stalmer1 DSL\nentity User {\n  id: ID!\n  name: String!\n}\n`
      );

      // Check the content of the second call (stalmer1.json)
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('stalmer1.json'),
        JSON.stringify({ name: 'stalmer1-app', version: '0.1.0', db: 'postgresql' }, null, 2)
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('Initialized new Stalmer1 project with database: postgresql');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(processExitSpy).not.toHaveBeenCalled();
    } finally {
      process.chdir(originalCwd);
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
      processExitSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true }); // Clean up the real temp directory
    }
  });

  it('should exit if project already initialized', () => {
    const tmpDir = createTempDir('stalmer1-test-exists-');
    fs.existsSync.mockReturnValue(true); // Simulate existing files
    fs.writeFileSync.mockClear(); // Clear any previous mock calls
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      initAction({ db: 'sqlite' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Project already initialized in this directory.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(0);
    } finally {
      process.chdir(originalCwd);
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
      processExitSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true }); // Clean up the real temp directory
    }
  });
});
