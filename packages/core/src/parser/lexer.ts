/**
 * Lexer for the DSL
 * 
 * The lexer's sole responsibility is to convert the raw DSL string into
 * a stream of tokens, ignoring whitespace and comments.
 */
import { Position } from './ast';
import { DSLParsingError } from '../errors';

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

  // Special
  EOF = 'EOF',
  UNKNOWN = 'UNKNOWN'
}

export interface Token {
  type: TokenType;
  value: string;
  position: Position;
}

const keywords: Record<string, TokenType> = {
  'entity': TokenType.KEYWORD_ENTITY,
  'view': TokenType.KEYWORD_VIEW,
  'page': TokenType.KEYWORD_PAGE,
  'workflow': TokenType.KEYWORD_WORKFLOW,
  'config': TokenType.KEYWORD_CONFIG,
  'enum': TokenType.KEYWORD_ENUM
};

/**
 * Convert a DSL string into a stream of tokens.
 */
export function tokenize(dslText: string, filePath?: string): Token[] {
  const tokens: Token[] = [];
  const lines = dslText.split('\n');
  
  let line = 1;
  let column = 1;
  
  for (let i = 0; i < lines.length; i++) {
    line = i + 1;
    column = 1;
    
    // Current line and its length
    const currentLine = lines[i];
    let j = 0;
    
    while (j < currentLine.length) {
      // Skip whitespace
      if (/\s/.test(currentLine[j])) {
        j++;
        column++;
        continue;
      }
      
      // Skip comments
      if (currentLine[j] === '/' && currentLine[j + 1] === '/') {
        break;  // Skip the rest of this line
      }
      
      // Handle identifiers and keywords
      if (/[a-zA-Z_]/.test(currentLine[j])) {
        const start = j;
        while (j < currentLine.length && /[a-zA-Z0-9_]/.test(currentLine[j])) {
          j++;
        }
        
        const value = currentLine.substring(start, j);
        const position: Position = { line, column: column };
        
        // Check if it's a keyword or a boolean literal
        if (keywords[value]) {
          tokens.push({ type: keywords[value], value, position });
        } else if (value === 'true' || value === 'false') {
          tokens.push({ type: TokenType.BOOLEAN_LITERAL, value, position });
        } else {
          tokens.push({ type: TokenType.IDENTIFIER, value, position });
        }
        
        column += (j - start);
        continue;
      }
      
      // Handle string literals
      if (currentLine[j] === '"') {
        const start = j;
        j++;  // Skip the opening quote
        
        // Find the closing quote, handling escaped quotes
        while (j < currentLine.length && (currentLine[j] !== '"' || currentLine[j-1] === '\\')) {
          j++;
        }
        
        if (j >= currentLine.length) {
          throw new DSLParsingError(
            'Unterminated string literal', 
            filePath, 
            line, 
            column,
            currentLine
          );
        }
        
        j++;  // Include the closing quote
        
        const value = currentLine.substring(start + 1, j - 1);  // Remove quotes
        tokens.push({ 
          type: TokenType.STRING_LITERAL, 
          value, 
          position: { line, column: column } 
        });
        
        column += (j - start);
        continue;
      }
      
      // Handle number literals
      if (/[0-9]/.test(currentLine[j])) {
        const start = j;
        while (j < currentLine.length && /[0-9.]/.test(currentLine[j])) {
          j++;
        }
        
        const value = currentLine.substring(start, j);
        tokens.push({ 
          type: TokenType.NUMBER_LITERAL, 
          value, 
          position: { line, column: column } 
        });
        
        column += (j - start);
        continue;
      }
      
      // Handle symbols
      const symbolMap: Record<string, TokenType> = {
        '{': TokenType.BRACE_OPEN,
        '}': TokenType.BRACE_CLOSE,
        '[': TokenType.BRACKET_OPEN,
        ']': TokenType.BRACKET_CLOSE,
        '(': TokenType.PARENTHESIS_OPEN,
        ')': TokenType.PARENTHESIS_CLOSE,
        ':': TokenType.COLON,
        ',': TokenType.COMMA,
        '@': TokenType.AT_SIGN
      };
      
      if (symbolMap[currentLine[j]]) {
        tokens.push({
          type: symbolMap[currentLine[j]],
          value: currentLine[j],
          position: { line, column }
        });
        
        j++;
        column++;
        continue;
      }
      
      // Handle unknown characters
      tokens.push({
        type: TokenType.UNKNOWN,
        value: currentLine[j],
        position: { line, column }
      });
      
      j++;
      column++;
    }
  }
  
  // Add EOF token
  tokens.push({ 
    type: TokenType.EOF, 
    value: '', 
    position: { line, column } 
  });
  
  return tokens;
}
