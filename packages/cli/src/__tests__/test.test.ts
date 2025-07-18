import { testCommand } from '../commands/testCommand';

// Mock child_process
jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
  exec: jest.fn()
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

describe('test command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be properly defined', () => {
    expect(testCommand).toBeDefined();
    expect(testCommand.name()).toBe('test');
    expect(testCommand.description()).toBe('Runs tests for the generated application');
  });

  it('should have the correct options', () => {
    
    // Check if all the expected options are defined
    expect(testCommand.options.some(opt => opt.long === '--watch')).toBe(true);
    expect(testCommand.options.some(opt => opt.long === '--coverage')).toBe(true);
    expect(testCommand.options.some(opt => opt.long === '--backend-only')).toBe(true);
    expect(testCommand.options.some(opt => opt.long === '--frontend-only')).toBe(true);
    expect(testCommand.options.some(opt => opt.long === '--ci')).toBe(true);
    expect(testCommand.options.some(opt => opt.long === '--verbose')).toBe(true);
  });
});
