import { generateFrontend } from '../index';
import * as fs from 'fs';
import * as path from 'path';
import { IApp } from '@stalmer1/core';

// Mock fs and path
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('mock template content'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true)
}));

jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('mocked/path')
}));

// Mock ejs
jest.mock('ejs', () => ({
  render: jest.fn().mockReturnValue('mock rendered content')
}));

describe('generateFrontend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate frontend files', async () => {
    const mockApp: IApp = {
      name: 'TestApp',
      entities: [],
      pages: [],
      config: {
        auth: {
          provider: 'jwt',
          props: {
            clerkPublishableKey: 'test-key',
            auth0Domain: 'test-domain',
            auth0ClientId: 'test-client-id'
          }
        }
      }
    };

    await generateFrontend(mockApp, 'output-dir');

    // Check that directories were created
    expect(fs.mkdirSync).toHaveBeenCalled();
    
    // Check that templates were read
    expect(fs.readFileSync).toHaveBeenCalled();
    
    // Check that files were written
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
