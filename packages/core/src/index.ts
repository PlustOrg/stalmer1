// Export all types and functions from the IR and parser modules
export * from './ir';
export * from './parser/index'; // This exports from the new modular parser
export * from './errors';

// Export additional AST types for tools like formatters and language servers
export * as AST from './parser/ast';
