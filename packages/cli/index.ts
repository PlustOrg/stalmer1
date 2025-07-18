import { Command } from 'commander';
import { version } from '../package.json';

const program = new Command();

program
  .name('stalmer1')
  .description('Stalmer1: DSL-driven full-stack web-app generator.')
  .version(version);

program.parse(process.argv);
