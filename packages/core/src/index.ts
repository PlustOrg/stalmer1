// Re-export all types and functions from the IR module
export * from './ir';
export * from './parser';

// Explicitly export named interfaces to ensure they're available
import { IApp, IREntity, IRField, IRRelation, IRPage, IRConfig, IRWorkflow } from './ir';
import { parseDSL } from './parser';
export { IApp, IREntity, IRField, IRRelation, IRPage, IRConfig, IRWorkflow, parseDSL };
