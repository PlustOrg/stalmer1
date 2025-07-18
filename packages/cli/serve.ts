import { Command } from 'commander';
import { parseDSL } from '@stalmer1/core';
import { generateFullProject } from './src/full-generator';
import * as fs from 'fs';
import * as path from 'path';
import execa from 'execa';

const program = new Command();

program
  .command('serve')
  .description('Run docker-compose up in the generated project')
  .action(() => {
    const cwd = process.cwd();
    require('child_process').spawnSync('docker-compose', ['up'], {
      cwd,
      stdio: 'inherit',
    });
  });

program
  .command('generate')
  .description('Generate the full project (backend, frontend, docker)')
  .option('-s, --schema <file>', 'Path to schema.dsl', 'schema.dsl')
  .option('-o, --out <dir>', 'Output directory', 'generated')
  .action(async (opts) => {
    const dsl = fs.readFileSync(opts.schema, 'utf-8');
    const ir = parseDSL(dsl);
    await generateFullProject(ir, opts.out);
    console.log('Project generated in', opts.out);
    // Run prisma migrate dev if schema.prisma exists
    const backendPrismaDir = path.join(opts.out, 'backend', 'prisma');
    const schemaPath = path.join(backendPrismaDir, 'schema.prisma');
    if (fs.existsSync(schemaPath)) {
      try {
        console.log('Running `npx prisma migrate dev --name init --skip-seed` in backend...');
        await execa('npx', ['prisma', 'migrate', 'dev', '--name', 'init', '--skip-seed'], {
          cwd: path.join(opts.out, 'backend'),
          stdio: 'inherit',
        });
        console.log('Prisma migration complete.');
      } catch (err) {
        console.error('Prisma migration failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    } else {
      console.warn('No schema.prisma found, skipping migration.');
    }
  });

program.parse(process.argv);
