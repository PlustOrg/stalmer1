import { generateBackend, generateDockerFiles } from '..';
import * as fs from 'fs';
import { IApp, parseDSL } from '@stalmer1/core';
import path from 'path';
import os from 'os';

describe('generateBackend', () => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-test-'));
  });

  afterEach(() => {
    // Clean up the temporary directory after each test
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate backend files in a temporary directory', async () => {
    await generateBackend(parsedApp, tempDir);

    // Verify that some expected files and directories were created
    expect(fs.existsSync(path.join(tempDir, 'prisma/schema.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'src/user/user.module.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'src/user/user.controller.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'src/user/user.service.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'src/post/post.module.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'src/post/post.controller.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'src/post/post.service.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'src/app.module.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'src/main.ts'))).toBe(true);
  });

  it('should generate Docker files in a temporary directory', () => {
    generateDockerFiles(parsedApp, tempDir, parsedApp.config?.db);

    // Verify that some expected files and directories were created
    expect(fs.existsSync(path.join(tempDir, 'backend/Dockerfile'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'frontend/Dockerfile'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'docker-compose.yml'))).toBe(true);
  });
});
