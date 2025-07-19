import { generateFrontend } from '..';
import * as fs from 'fs';
import { IApp } from '@stalmer1/core';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('generateFrontend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate frontend files', async () => {
    const app: IApp = {
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

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('');
    mockedFs.readdirSync.mockReturnValue(['button.tsx.ejs', 'card.tsx.ejs', 'input.tsx.ejs', 'label.tsx.ejs', 'table.tsx.ejs'] as any);

    generateFrontend(app, '/out');

    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });
});
