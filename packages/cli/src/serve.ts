import { Command } from 'commander';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export const serveCommand = new Command('serve')
  .description('Run the generated application locally')
  .option('--backend-only', 'Start only the backend server')
  .option('--frontend-only', 'Start only the frontend server')
  .action((options) => {
    const cwd = process.cwd();
    const srcDir = path.join(cwd, 'src');
    
    // Check if project has been generated
    if (!fs.existsSync(srcDir)) {
      console.error('Error: No generated project found in src directory.');
      console.error('Please run `stalmer1 generate` first to generate the project.');
      process.exit(1);
    }
    
    if (options.backendOnly) {
      // Run only backend
      console.log('Starting backend server...');
      spawnSync('npm', ['run', 'start:backend'], {
        cwd,
        stdio: 'inherit'
      });
    } else if (options.frontendOnly) {
      // Run only frontend
      console.log('Starting frontend server...');
      spawnSync('npm', ['run', 'start:frontend'], {
        cwd,
        stdio: 'inherit'
      });
    } else {
      // Run both using docker-compose
      console.log('Starting the application with docker-compose...');
      console.log('Press Ctrl+C to stop the application');
      
      spawnSync('docker-compose', ['up'], {
        cwd,
        stdio: 'inherit',
      });
    }
  });
