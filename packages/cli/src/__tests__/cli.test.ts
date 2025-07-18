import { generateCommand } from '../generate';
import { initCommand } from '../init';
import { Command } from 'commander';

// Mock the fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'), // Import and retain default behavior
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  rmSync: jest.fn(),
}));

// Use mocked fs with proper typing for Jest mocks
import * as fsModule from 'fs';
const fs = fsModule as jest.Mocked<typeof fsModule>;

// Manually create and clean up temp directories for chdir tests
const createTempDir = (prefix: string) => {
  const tempDir = jest.requireActual('fs').mkdtempSync(prefix);
  return tempDir;
};  // Helper function to set up common test spies and mocks
const setupTestEnvironment = (existingProject: boolean) => {
  const tmpDir = createTempDir(`stalmer1-test-${existingProject ? 'exists-' : ''}`);
  fs.existsSync.mockReturnValue(existingProject);
  fs.writeFileSync.mockClear();
  
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  // Define a type-safe mock for process.exit
  const processExitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation((() => {}) as unknown as () => never);
  
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  
  return { 
    tmpDir, 
    consoleErrorSpy, 
    consoleLogSpy, 
    processExitSpy, 
    originalCwd 
  };
};

describe('CLI tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should have a generate command', () => {
    expect(generateCommand).toBeInstanceOf(Command);
  });
  it('should have an init command', () => {
    expect(initCommand).toBeInstanceOf(Command);
  });

  it('should set db in stalmer1.json when using --db', () => {
    const { tmpDir, originalCwd } = setupTestEnvironment(false);

    try {
      // Test execution using the command directly
      const program = new Command();
      program.addCommand(initCommand);
      program.parse(['node', 'stalmer1', 'init', '--db', 'postgresql']);

      expect(fs.writeFileSync).toHaveBeenCalled();
      // Find the config file write operation
      const configWriteCall = fs.writeFileSync.mock.calls.find(call => 
        typeof call[0] === 'string' && call[0].endsWith('stalmer1.json')
      );
      expect(configWriteCall).toBeDefined();
      if (configWriteCall) {
        const configContent = configWriteCall[1] as string;
        const config = JSON.parse(configContent);
        expect(config.db).toBe('postgresql');
      }
    } finally {
      process.chdir(originalCwd);
      try {
        jest.requireActual('fs').rmSync(tmpDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to clean up test directory', err);
      }
      // Clean up
      jest.restoreAllMocks();
    }
  });

  it('should exit if project already initialized', () => {
    const { tmpDir, consoleErrorSpy, processExitSpy, originalCwd } = setupTestEnvironment(true);

    try {
      // Test using the command directly
      const program = new Command();
      program.addCommand(initCommand);
      program.parse(['node', 'stalmer1', 'init', '--db', 'postgresql']);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('already initialized')
      );
    } finally {
      process.chdir(originalCwd);
      try {
        jest.requireActual('fs').rmSync(tmpDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to clean up test directory', err);
      }
      jest.restoreAllMocks();
    }
  });
});
