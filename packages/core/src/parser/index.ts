/**
 * Entry point for the new modular DSL parser
 *
 * This file orchestrates the multi-stage parsing pipeline:
 * DSL Text → Lexer → Token Stream → Parser → AST → Validator → Validated AST → IR Builder → IR
 */
import { DSLParsingError } from '../errors';
import { IApp } from '../ir';
import * as AST from './ast';
import { Token, tokenize } from './lexer';
import { parse } from './parser';
import { Diagnostic, validate } from './validator';
import { buildIR } from './ir-builder';

/**
 * Parse a DSL string into the IR
 */
export function parseDSL(dslText: string, filePath?: string): IApp {
  try {
    // Check for empty or comment-only files
    if (!dslText.trim() || dslText.trim().split('\n').every(line => line.trim() === '' || line.trim().startsWith('//'))) {
      throw new DSLParsingError('DSL file is empty or contains only comments. At least one entity block is required.', filePath);
    }
    
    // Step 1: Tokenize the DSL text
    const tokens: Token[] = tokenize(dslText, filePath);
    
    // Step 2: Parse tokens into an AST
    const ast: AST.SourceFileNode = parse(tokens, filePath);
    
    // Step 3: Validate the AST
    const diagnostics: Diagnostic[] = validate(ast, filePath);
    
    // If there are validation errors, throw an error with all diagnostics
    if (diagnostics.length > 0) {
      // For now, throw only the first error to maintain backward compatibility
      const firstDiagnostic = diagnostics[0];
      throw new DSLParsingError(
        firstDiagnostic.message,
        firstDiagnostic.filePath,
        firstDiagnostic.line,
        firstDiagnostic.column,
        firstDiagnostic.context
      );
    }
    
    // Step 4: Build the IR from the validated AST
    const ir: IApp = buildIR(ast);
    
    return ir;
  } catch (error) {
    // Pass through DSLParsingError instances
    if (error instanceof DSLParsingError) {
      throw error;
    }
    
    // Wrap other errors with less context
    throw new DSLParsingError(
      `Error parsing DSL: ${error instanceof Error ? error.message : String(error)}`,
      filePath
    );
  }
}