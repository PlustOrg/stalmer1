import { generateBackend } from '../';
import { parseDSL } from '@stalmer1/core';
import * as fs from 'fs';
import * as path from 'path';

describe('Virtual Fields', () => {
  const outDir = path.join(__dirname, 'test-output/virtual-fields');

  beforeEach(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('should generate a resolver file and call the resolver function', async () => {
    const dsl = `
      entity User {
        id: UUID primaryKey,
        firstName: String,
        lastName: String,
        fullName: String @virtual(from: "firstName + \" \" + lastName")
      }
    `;
    const app = parseDSL(dsl);
    await generateBackend(app, outDir);

    // Check if the resolver file is created
    const resolverPath = path.join(outDir, 'src/user/user.resolvers.ts');
    expect(fs.existsSync(resolverPath)).toBe(true);

    const resolverContent = fs.readFileSync(resolverPath, 'utf-8');
    expect(resolverContent).toContain('export function getFullName(entity: User): String {');

    // Check if the service file imports and calls the resolver
    const servicePath = path.join(outDir, 'src/user/user.service.ts');
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    expect(serviceContent).toContain('import { getFullName } from \'./user.resolvers\';');
    expect(serviceContent).toContain('result[\'fullName\'] = await getFullName(entity);');
  });
});
