import { Position } from './ast';
import { Token, TokenType, keywords } from './token';
import { DSLParsingError } from '../errors';

export { Token } from './token';

/**
 * Convert a DSL string into a stream of tokens.
 */
export function tokenize(dslText: string, filePath?: string): Token[] {
  const tokens: Token[] = [];
  const lines = dslText.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    let column = 1;
    const currentLine = lines[i];
    let j = 0;
    
    while (j < currentLine.length) {
      const startColumn = column;
      
      // Skip whitespace
      if (/\s/.test(currentLine[j])) {
        j++;
        column++;
        continue;
      }
      
      // Skip comments
      if (currentLine[j] === '/' && currentLine[j + 1] === '/') {
        break; // Skip the rest of this line
      }
      
      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(currentLine[j])) {
        const start = j;
        while (j < currentLine.length && /[a-zA-Z0-9_]/.test(currentLine[j])) {
          j++;
        }
        const value = currentLine.substring(start, j);
        const position: Position = { line, column: startColumn };
        
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
      
      // String literals
      if (currentLine[j] === '"') {
        const start = j;
        j++; // Skip the opening quote
        
        while (j < currentLine.length && (currentLine[j] !== '"' || currentLine[j-1] === '\\')) {
          j++;
        }
        
        if (j >= currentLine.length) {
          throw new DSLParsingError('Unterminated string literal', filePath, line, startColumn, currentLine);
        }
        
        j++; // Include the closing quote
        const value = currentLine.substring(start + 1, j - 1);
        tokens.push({ type: TokenType.STRING_LITERAL, value, position: { line, column: startColumn } });
        column += (j - start);
        continue;
      }
      
      // Number literals
      if (/[0-9]/.test(currentLine[j])) {
        const start = j;
        while (j < currentLine.length && /[0-9.]/.test(currentLine[j])) {
          j++;
        }
        const value = currentLine.substring(start, j);
        tokens.push({ type: TokenType.NUMBER_LITERAL, value, position: { line, column: startColumn } });
        column += (j - start);
        continue;
      }
      
      // Symbols
      const symbolMap: Record<string, TokenType> = {
        '{': TokenType.BRACE_OPEN,
        '}': TokenType.BRACE_CLOSE,
        '[': TokenType.BRACKET_OPEN,
        ']': TokenType.BRACKET_CLOSE,
        '(': TokenType.PARENTHESIS_OPEN,
        ')': TokenType.PARENTHESIS_CLOSE,
        ':': TokenType.COLON,
        ',': TokenType.COMMA,
        '@': TokenType.AT_SIGN,
        '.': TokenType.DOT
      };
      
      if (symbolMap[currentLine[j]]) {
        tokens.push({ type: symbolMap[currentLine[j]], value: currentLine[j], position: { line, column } });
        j++;
        column++;
        continue;
      }
      
      // Unknown characters
      throw new DSLParsingError(`Unknown character: ${currentLine[j]}`, filePath, line, column, currentLine);
    }
  }
  
  tokens.push({ type: TokenType.EOF, value: '', position: { line: lines.length, column: lines[lines.length - 1]?.length + 1 || 1 } });
  return tokens;
}