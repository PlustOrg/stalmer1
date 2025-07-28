/**
 * Lexer for the DSL
 * 
 * The lexer converts a DSL string into a stream of tokens.
 */
import { DSLParsingError } from '../../errors';
import { Position, Token, TokenType, keywords } from './token';

export class Lexer {
  private source: string;
  private tokens: Token[] = [];
  private start: number = 0;
  private current: number = 0;
  private line: number = 1;
  private column: number = 1;
  private filePath?: string;

  constructor(source: string, filePath?: string) {
    this.source = source;
    this.filePath = filePath;
  }

  /**
   * Scan the source and produce a list of tokens
   */
  scanTokens(): Token[] {
    while (!this.isAtEnd()) {
      // We are at the beginning of the next lexeme
      this.start = this.current;
      this.scanToken();
    }

    // Add EOF token
    this.tokens.push({
      type: TokenType.EOF,
      lexeme: '',
      position: { line: this.line, column: this.column },
    });

    return this.tokens;
  }

  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      // Handle single-character tokens
      case '{': this.addToken(TokenType.LEFT_BRACE); break;
      case '}': this.addToken(TokenType.RIGHT_BRACE); break;
      case '[': this.addToken(TokenType.LEFT_BRACKET); break;
      case ']': this.addToken(TokenType.RIGHT_BRACKET); break;
      case '(': this.addToken(TokenType.LEFT_PAREN); break;
      case ')': this.addToken(TokenType.RIGHT_PAREN); break;
      case ',': this.addToken(TokenType.COMMA); break;
      case '.': this.addToken(TokenType.DOT); break;
      case ':': this.addToken(TokenType.COLON); break;
      case '@': this.addToken(TokenType.AT); break;

      // Handle whitespace
      case ' ':
      case '\r':
      case '\t':
        // Ignore whitespace
        break;

      // Handle newlines
      case '\n':
        this.line++;
        this.column = 1;
        break;

      // Handle strings
      case '"': this.string(); break;
      case "'": this.string(); break;

      // Comments
      case '/':
        if (this.match('/')) {
          // A comment goes until the end of the line
          while (this.peek() !== '\n' && !this.isAtEnd()) {
            this.advance();
          }
        } else {
          this.error(`Unexpected character: '${c}'`);
        }
        break;

      // Handle identifiers, keywords, and numbers
      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          this.error(`Unexpected character: '${c}'`);
        }
        break;
    }
  }

  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    // See if the identifier is a reserved word
    const text = this.source.substring(this.start, this.current);
    const type = keywords[text] || TokenType.IDENTIFIER;
    
    // Special handling for booleans
    if (type === TokenType.BOOLEAN) {
      this.addToken(type, text === 'true');
    } else {
      this.addToken(type);
    }
  }

  private number(): void {
    // Consume digits
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Look for a decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      // Consume the '.'
      this.advance();

      // Consume the fraction
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const value = parseFloat(this.source.substring(this.start, this.current));
    this.addToken(TokenType.NUMBER, value);
  }

  private string(): void {
    const quote = this.source[this.start]; // Store the type of quote (single or double)
    
    // Look for the closing quote
    while (this.peek() !== quote && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      
      // Handle escaped quotes
      if (this.peek() === '\\' && this.peekNext() === quote) {
        this.advance(); // consume backslash
      }
      
      this.advance();
    }

    // Unterminated string
    if (this.isAtEnd()) {
      this.error('Unterminated string');
      return;
    }

    // Consume the closing quote
    this.advance();

    // Trim the quotes
    const value = this.source.substring(this.start + 1, this.current - 1);
    this.addToken(TokenType.STRING, value);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;

    this.current++;
    this.column++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.current];
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source[this.current + 1];
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') ||
           (c >= 'A' && c <= 'Z') ||
           c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    const char = this.source[this.current++];
    this.column++;
    return char;
  }

  private addToken(type: TokenType, literal?: any): void {
    const lexeme = this.source.substring(this.start, this.current);
    const position: Position = {
      line: this.line,
      column: this.column - (this.current - this.start),
    };
    
    this.tokens.push({
      type,
      lexeme,
      literal,
      position,
    });
  }

  private error(message: string): void {
    const position: Position = {
      line: this.line,
      column: this.column - (this.current - this.start),
    };
    
    // Get context from the line
    const lines = this.source.split('\n');
    const contextLine = lines[this.line - 1] || '';
    
    throw new DSLParsingError(
      message,
      this.filePath,
      position.line,
      position.column,
      contextLine.trim()
    );
  }
}

/**
 * Tokenize a DSL string
 */
export function tokenize(source: string, filePath?: string): Token[] {
  const lexer = new Lexer(source, filePath);
  return lexer.scanTokens();
}
