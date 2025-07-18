#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './init';
import { generateCommand } from './generate';
import { testCommand } from './commands/testCommand';

const program = new Command();

program
  .name('stalmer1')
  .description('Stalmer1: DSL-driven full-stack web-app generator')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(testCommand);

program.parse(process.argv);
