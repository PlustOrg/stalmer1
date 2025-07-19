import { generateFrontend } from '..';
import * as fs from 'fs';
import { IApp, parseDSL } from '@stalmer1/core';
import path from 'path';
import os from 'os';

describe('generateFrontend', () => {
  let parsedApp: IApp;
  let tempDir: string;

  beforeAll(() => {
    const dslFilePath = path.join(__dirname, 'test-app.dsl');
    const dslContent = fs.readFileSync(dslFilePath, 'utf-8');
    
    try {
      parsedApp = parseDSL(dslContent);
    } catch (error) {
      console.error('Error parsing DSL file:', error);
      throw error;
    }
  });

  beforeEach(() => {
    // Create a unique temporary directory for each test run
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-test-'));
  });

  afterEach(() => {
    // Clean up the temporary directory after each test
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate frontend files in a temporary directory', () => {
    generateFrontend(parsedApp, tempDir);

    // Verify that some expected files and directories were created
    const uiComponentsPath = path.join(tempDir, 'src', 'components', 'ui');
    expect(fs.existsSync(path.join(uiComponentsPath, 'button.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(uiComponentsPath, 'card.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(uiComponentsPath, 'input.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(uiComponentsPath, 'label.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(uiComponentsPath, 'table.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'package.json'))).toBe(true);
  });
});
