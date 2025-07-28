/**
 * Token definitions for the DSL lexer
 */

/**
 * Position in the source code
 */
export interface Position {
  line: number;   // 1-based line number
  column: number; // 1-based column number
}

/**
 * Token types for the DSL
 */
export enum TokenType {
  // Keywords
  ENTITY = 'ENTITY',
  VIEW = 'VIEW',
  PAGE = 'PAGE',
  WORKFLOW = 'WORKFLOW',
  CONFIG = 'CONFIG',
  ENUM = 'ENUM',

  // Identifiers and literals
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',

  // Punctuation and operators
  LEFT_BRACE = '{',
  RIGHT_BRACE = '}',
  LEFT_BRACKET = '[',
  RIGHT_BRACKET = ']',
  LEFT_PAREN = '(',
  RIGHT_PAREN = ')',
  COLON = ':',
  COMMA = ',',
  AT = '@',
  DOT = '.',

  // Special
  EOF = 'EOF',
}

/**
 * Token representation
 */
export interface Token {
  type: TokenType;
  lexeme: string;
  literal?: any;
  position: Position;
}

/**
 * List of keywords in the DSL
 */
export const keywords: Record<string, TokenType> = {
  'entity': TokenType.ENTITY,
  'view': TokenType.VIEW,
  'page': TokenType.PAGE,
  'workflow': TokenType.WORKFLOW,
  'config': TokenType.CONFIG,
  'enum': TokenType.ENUM,
  'true': TokenType.BOOLEAN,
  'false': TokenType.BOOLEAN,
};
