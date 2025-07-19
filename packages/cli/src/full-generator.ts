import { generateBackend } from '@stalmer1/backend-generator';
import { generateFrontend } from '@stalmer1/frontend-generator';
import { generateDockerFiles } from '@stalmer1/backend-generator';
import { IApp } from '@stalmer1/core';
import * as path from 'path';
import { generateGitHubActions } from './github-actions';
import * as fs from 'fs';

/**
 * Generates the complete project based on the application IR
 * @param app - The application IR
 * @param outDir - The output directory for the generated files
 * @param verbose - Enable verbose logging
 * @returns A promise that resolves when the generation is complete
 */
export async function generateFullProject(app: IApp, outDir: string, verbose: boolean = false) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  // Generate backend code
  console.log('Generating backend code...');
  await generateBackend(app, path.join(outDir, 'backend'), verbose);
  
  // Generate frontend code
  console.log('Generating frontend code...');
  await generateFrontend(app, path.join(outDir, 'frontend'), verbose);
  
  // Generate Docker files
  console.log('Generating Docker files...');
  const db = app.config?.db === 'postgresql' ? 'postgresql' : 'sqlite';
  generateDockerFiles(app, outDir, db);
  
  // Generate GitHub Actions workflows
  console.log('Generating CI/CD workflows...');
  generateGitHubActions(app, outDir);
  
  // Generate package.json for the root directory
  generateRootPackageJson(outDir, app.name || 'stalmer1-app');
  
  console.log('Project generation complete.');
}

/**
 * Generates a package.json file for the root directory with scripts for the entire application
 * @param outDir - The output directory
 * @param appName - The name of the application
 */
function generateRootPackageJson(outDir: string, appName: string): void {
  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true,
    scripts: {
      "start": "docker-compose up",
      "start:backend": "cd backend && npm start",
      "start:frontend": "cd frontend && npm start",
      "build": "npm run build:backend && npm run build:frontend",
      "build:backend": "cd backend && npm run build",
      "build:frontend": "cd frontend && npm run build",
      "test": "npm run test:backend && npm run test:frontend",
      "test:backend": "cd backend && npm test",
      "test:frontend": "cd frontend && npm test",
      "test:e2e": "cd e2e && npm test",
      "lint": "npm run lint:backend && npm run lint:frontend",
      "lint:backend": "cd backend && npm run lint",
      "lint:frontend": "cd frontend && npm run lint"
    }
  };
  
  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}
