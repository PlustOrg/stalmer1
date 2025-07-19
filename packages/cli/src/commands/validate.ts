import { Command } from 'commander';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Command to validate EJS templates in the project
 */
export function validateCommand() {
  const command = new Command('validate');
  command
    .description('Validate EJS templates for compilation errors')
    .option('-v, --verbose', 'Output more detailed information')
    .action((options) => {
      const _verbose = options.verbose; // Available for future use
      console.log('Validating EJS templates...');
      
      // Find the validate-templates.sh script
      const scriptPath = path.join(__dirname, '..', '..', '..', 'scripts', 'validate-templates.sh');
      const fallbackPath = path.join(__dirname, '..', '..', 'scripts', 'validate-templates.sh');
      
      let validScriptPath;
      if (fs.existsSync(scriptPath)) {
        validScriptPath = scriptPath;
      } else if (fs.existsSync(fallbackPath)) {
        validScriptPath = fallbackPath;
      } else {
        console.error('Error: Could not find validate-templates.sh script');
        process.exit(1);
      }
      
      // Make sure the script is executable
      try {
        fs.chmodSync(validScriptPath, '755');
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`Error making script executable: ${error.message}`);
        } else {
          console.error('Unknown error making script executable');
        }
      }
      
      // Run the validation script
      const validate = spawn(validScriptPath, [], {
        stdio: 'inherit',
        shell: true
      });
      
      validate.on('close', (code) => {
        if (code === 0) {
          console.log('All templates validated successfully!');
        } else {
          console.error('Template validation failed!');
          process.exit(1);
        }
      });
    });
    
  return command;
}
