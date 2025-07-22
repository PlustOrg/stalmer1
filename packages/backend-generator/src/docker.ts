import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import { IApp } from 'packages/core/src/ir';

export function generateDockerFiles(app: IApp, outDir: string, db: 'sqlite' | 'postgresql' = 'sqlite', backendPort: number = 4000) {
  // Backend Dockerfile
  const backendDockerfile = fs.readFileSync(path.join(__dirname, '..', 'templates', 'Dockerfile.ejs'), 'utf-8');
  fs.mkdirSync(path.join(outDir, 'backend'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'backend/Dockerfile'), ejs.render(backendDockerfile, { backendPort }));

  // Frontend Dockerfile
  const frontendDockerfile = fs.readFileSync(path.join(__dirname, '../../frontend-generator/templates/Dockerfile.ejs'), 'utf-8');
  fs.mkdirSync(path.join(outDir, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'frontend/Dockerfile'), ejs.render(frontendDockerfile, {}));

  // docker-compose.yml
  const composeTemplate = fs.readFileSync(path.join(__dirname, '..', 'templates', 'docker-compose.yml.ejs'), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'docker-compose.yml'), ejs.render(composeTemplate, { db, backendPort, authProvider: app.config?.auth?.provider }));
}
