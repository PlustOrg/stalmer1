import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parseDSL, DSLParsingError } from '@stalmer1/core';
import { generateFullProject } from './full-generator';
import { spawn } from 'child_process';

/**
 * Runs Prisma database migrations
 * @param outDir - The output directory where the backend code is generated
 * @returns A promise that resolves when the migrations are complete
 */
async function runDatabaseMigrations(outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('Running database migrations...');
    const backendDir = path.join(outDir, 'backend');
    
    // Initialize steps for progress tracking
    const steps = [
      { name: 'Installing Prisma client', done: false },
      { name: 'Initializing database', done: false },
      { name: 'Running migrations', done: false },
      { name: 'Generating Prisma client', done: false }
    ];
    
    function updateProgress(stepIndex: number) {
      steps[stepIndex].done = true;
      const completedSteps = steps.filter(step => step.done).length;
      const totalSteps = steps.length;
      const percent = Math.round((completedSteps / totalSteps) * 100);
      console.log(`[${percent}%] ${steps[stepIndex].name} - Completed`);
    }
    
    // Step 1: Ensure that prisma client is installed
    console.log(`[0%] ${steps[0].name}...`);
    const npmInstall = spawn('npm', ['install', '@prisma/client'], {
      cwd: backendDir,
      stdio: 'inherit'
    });
    
    npmInstall.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Failed to install @prisma/client. Please check your npm configuration and try again.'));
        return;
      }
      
      updateProgress(0);
      
      // Step 2: Initialize the database
      console.log(`[25%] ${steps[1].name}...`);
      const prismaInit = spawn('npx', ['prisma', 'db', 'push', '--preview-feature'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      
      prismaInit.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to initialize the database. Please check your database configuration and permissions.'));
          return;
        }
        
        updateProgress(1);
        
        // Step 3: Run prisma migrate dev
        console.log(`[50%] ${steps[2].name}...`);
        const prisma = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'initial'], {
          cwd: backendDir,
          stdio: 'inherit',
          env: { ...process.env, PRISMA_MIGRATION_SKIP_GENERATE: '1' } // Skip client generation during migration
        });
        
        prisma.on('close', (code) => {
          if (code !== 0) {
            reject(new Error('Failed to run prisma migrations. The schema may have validation errors or the database may be inaccessible.'));
            return;
          }
          
          updateProgress(2);
          
          // Step 4: Generate Prisma client
          console.log(`[75%] ${steps[3].name}...`);
          const prismaGenerate = spawn('npx', ['prisma', 'generate'], {
            cwd: backendDir,
            stdio: 'inherit'
          });
          
          prismaGenerate.on('close', (code) => {
            if (code !== 0) {
              reject(new Error('Failed to generate Prisma client. The schema may have validation errors.'));
              return;
            }
            
            updateProgress(3);
            console.log('[100%] Database migrations completed successfully.');
            resolve();
          });
        });
      });
    });
  });
}

export const generateCommand = new Command('generate')
  .description('Generate or update the application source code from the .dsl files.')
  .option('--clean', 'Perform a clean build, removing all existing generated files.')
  .option('--skip-migrations', 'Skip running database migrations after code generation.')
  .option('--migrations-only', 'Only run database migrations without generating code.')
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const cwd = process.cwd();
    const schemaPath = path.join(cwd, 'schema.dsl');
    const outDir = path.join(cwd, 'src'); // Default output directory
    
    // Handle migrations-only case first
    if (options.migrationsOnly) {
      try {
        if (!fs.existsSync(path.join(outDir, 'backend', 'prisma', 'schema.prisma'))) {
          console.error('Error: No schema.prisma found. Please generate the code first.');
          process.exit(1);
        }
        await runDatabaseMigrations(outDir);
        process.exit(0);
      } catch (migrateError) {
        console.error('Error during database migration:', migrateError instanceof Error ? migrateError.message : "Unknown error occurred");
        process.exit(1);
      }
    }

    if (!fs.existsSync(schemaPath)) {
      console.error('Error: No schema.dsl found in the current directory.');
      console.error('Please create a schema.dsl file or run `stalmer1 init` to generate one.');
      process.exit(1);
    }

    const dsl = fs.readFileSync(schemaPath, 'utf-8');

    try {
      console.log('Parsing DSL schema...');
      const ir = parseDSL(dsl, schemaPath);
      console.log('Schema parsed successfully.');

      if (options.clean) {
        console.log(`Cleaning output directory: ${outDir}`);
        fs.rmSync(outDir, { recursive: true, force: true });
      }

      console.log(`Generating application code to: ${outDir}`);
      await generateFullProject(ir, outDir, options.verbose);
      console.log('Code generation complete.');
      
      // Run database migrations unless skipped
      if (!options.skipMigrations) {
        try {
          await runDatabaseMigrations(outDir);
        } catch (migrateError) {
          console.error('Error during database migration:', migrateError instanceof Error ? migrateError.message : "Unknown error occurred");
          console.log('You can skip migrations next time using the --skip-migrations flag');
          console.log('Or run migrations separately with the --migrations-only flag');
          process.exit(1);
        }
      } else {
        console.log('Database migrations skipped. Run them later with `stalmer1 generate --migrations-only`.');
      }
      
      console.log('\nSuccess! Your application has been generated. To start it, run:');
      console.log('  stalmer1 serve');
    } catch (err) {
      if (err instanceof DSLParsingError) {
        console.error(`\nError parsing DSL file: ${err.message}`);
      } else if (err instanceof Error) {
        console.error(`\nError during code generation: ${err.message}`);
      } else {
        console.error('\nAn unknown error occurred during code generation.');
      }
      process.exit(1);
    }
  });