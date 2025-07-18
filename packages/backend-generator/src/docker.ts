import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';

export function generateDockerFiles(outDir: string, db: 'sqlite' | 'postgresql' = 'sqlite') {
  // Backend Dockerfile
  const backendDockerfile = fs.readFileSync(path.join(__dirname, '..', 'templates', 'Dockerfile.ejs'), 'utf-8');
  fs.mkdirSync(path.join(outDir, 'backend'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'backend/Dockerfile'), ejs.render(backendDockerfile, {}));

  // Frontend Dockerfile
  const frontendDockerfile = fs.readFileSync(path.join(__dirname, '../../frontend-generator/templates/Dockerfile.ejs'), 'utf-8');
  fs.mkdirSync(path.join(outDir, 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'frontend/Dockerfile'), ejs.render(frontendDockerfile, {}));

  // docker-compose.yml
  const composeTemplate = fs.readFileSync(path.join(__dirname, '..', 'templates', 'docker-compose.yml.ejs'), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'docker-compose.yml'), ejs.render(composeTemplate, { db }));
}
