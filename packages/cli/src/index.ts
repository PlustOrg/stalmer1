#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './init';
import { generateCommand } from './generate';
import { testCommand } from './commands/testCommand';
import { serveCommand } from './serve';
import { validateCommand } from './commands/validate';
import { version } from '../package.json';

const program = new Command();

program
  .name('stalmer1')
  .description('Stalmer1: DSL-driven full-stack web-app generator')
  .version(version);

program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(testCommand);
program.addCommand(serveCommand);
program.addCommand(validateCommand());

program.parse(process.argv);
