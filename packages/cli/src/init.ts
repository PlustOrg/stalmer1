import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const initCommand = new Command('init')
  .description('Initialize a new Stalmer1 project')
  .option('--db <database>', 'Database to use (sqlite|postgresql)', 'sqlite')
  .action(initAction);

export function initAction(opts: { db?: string }) {
  const cwd = process.cwd();
  const schemaPath = path.join(cwd, 'schema.dsl');
  const configPath = path.join(cwd, 'stalmer1.json');
  if (fs.existsSync(schemaPath) || fs.existsSync(configPath)) {
    console.error('Project already initialized in this directory.');
    process.exit(1);
    return;
  }
  fs.writeFileSync(schemaPath, `# Example Stalmer1 DSL\nentity User {\n  id: ID!\n  name: String!\n}\n`);
  const db = opts.db && ['sqlite', 'postgresql'].includes(opts.db) ? opts.db : 'sqlite';
  fs.writeFileSync(
    configPath,
    JSON.stringify({ name: 'stalmer1-app', version: '0.1.0', db }, null, 2)
  );
  console.log(`Initialized new Stalmer1 project with database: ${db}`);
}
