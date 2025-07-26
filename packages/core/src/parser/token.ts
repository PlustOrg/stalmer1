import { Position } from './ast';

export enum TokenType {
  // Keywords
  KEYWORD_ENTITY = 'KEYWORD_ENTITY',
  KEYWORD_VIEW = 'KEYWORD_VIEW',
  KEYWORD_PAGE = 'KEYWORD_PAGE',
  KEYWORD_WORKFLOW = 'KEYWORD_WORKFLOW',
  KEYWORD_CONFIG = 'KEYWORD_CONFIG',
  KEYWORD_ENUM = 'KEYWORD_ENUM',

  // Identifiers and literals
  IDENTIFIER = 'IDENTIFIER',
  STRING_LITERAL = 'STRING_LITERAL',
  NUMBER_LITERAL = 'NUMBER_LITERAL',
  BOOLEAN_LITERAL = 'BOOLEAN_LITERAL',

  // Symbols
  BRACE_OPEN = 'BRACE_OPEN',
  BRACE_CLOSE = 'BRACE_CLOSE',
  BRACKET_OPEN = 'BRACKET_OPEN',
  BRACKET_CLOSE = 'BRACKET_CLOSE',
  PARENTHESIS_OPEN = 'PARENTHESIS_OPEN',
  PARENTHESIS_CLOSE = 'PARENTHESIS_CLOSE',
  COLON = 'COLON',
  COMMA = 'COMMA',
  AT_SIGN = 'AT_SIGN',
  DOT = 'DOT',

  // Special
  EOF = 'EOF',
  UNKNOWN = 'UNKNOWN'
}

export interface Token {
  type: TokenType;
  value: string;
  position: Position;
}

export const keywords: Record<string, TokenType> = {
  'entity': TokenType.KEYWORD_ENTITY,
  'view': TokenType.KEYWORD_VIEW,
  'page': TokenType.KEYWORD_PAGE,
  'workflow': TokenType.KEYWORD_WORKFLOW,
  'config': TokenType.KEYWORD_CONFIG,
  'enum': TokenType.KEYWORD_ENUM
};
