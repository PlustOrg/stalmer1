/**
 * Parser for the DSL
 * 
 * The parser converts a stream of tokens into an AST.
 */
import { DSLParsingError } from '../../errors';
import * as AST from './ast';
import { Position, Token, TokenType } from './token';

export class Parser {
  private tokens: Token[];
  private current: number = 0;
  private filePath?: string;

  constructor(tokens: Token[], filePath?: string) {
    this.tokens = tokens;
    this.filePath = filePath;
  }

  /**
   * Parse tokens into an AST
   */
  parse(): AST.Program {
    try {
      const declarations: AST.Declaration[] = [];
      
      while (!this.isAtEnd()) {
        declarations.push(this.declaration());
      }
      
      return {
        type: 'Program',
        declarations,
        location: {
          start: declarations.length > 0 
            ? declarations[0].location.start 
            : { line: 1, column: 1 },
          end: declarations.length > 0 
            ? declarations[declarations.length - 1].location.end 
            : { line: 1, column: 1 }
        }
      };
    } catch (error) {
      // Rethrow DSLParsingErrors, wrap other errors
      if (error instanceof DSLParsingError) {
        throw error;
      }
      
      const token = this.peek();
      const message = error instanceof Error ? error.message : String(error);
      throw this.createError(message, token.position);
    }
  }

  /**
   * Parse a top-level declaration
   */
  private declaration(): AST.Declaration {
    const token = this.peek();
    
    switch (token.type) {
      case TokenType.ENTITY:
        return this.entityDeclaration();
      case TokenType.VIEW:
        return this.viewDeclaration();
      case TokenType.PAGE:
        return this.pageDeclaration();
      case TokenType.WORKFLOW:
        return this.workflowDeclaration();
      case TokenType.CONFIG:
        return this.configDeclaration();
      case TokenType.ENUM:
        return this.enumDeclaration();
      default:
        throw this.createError(
          `Expected declaration, found ${token.lexeme}`,
          token.position
        );
    }
  }

  /**
   * Parse an entity declaration
   */
  private entityDeclaration(): AST.EntityDeclaration {
    const startToken = this.consume(TokenType.ENTITY, "Expected 'entity' keyword");
    const name = this.identifier();
    
    this.consume(TokenType.LEFT_BRACE, "Expected '{' after entity name");
    
    const members: AST.EntityMember[] = [];
    
    while (this.peek().type !== TokenType.RIGHT_BRACE && !this.isAtEnd()) {
      members.push(this.fieldDeclaration());
    }
    
    const endToken = this.consume(TokenType.RIGHT_BRACE, "Expected '}' after entity body");
    
    return {
      type: 'EntityDeclaration',
      name,
      members,
      location: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Parse a field declaration within an entity
   */
  private fieldDeclaration(): AST.FieldDeclaration {
    const name = this.identifier();
    
    // Expect a colon after the field name
    this.consume(TokenType.COLON, "Expected ':' after field name");
    
    // Parse the field type
    const fieldType = this.parseTypeAnnotation();
    
    // Parse attributes (primaryKey, unique, etc.)
    const attributes: AST.Attribute[] = [];
    
    // Continue collecting attributes until we hit a comma, newline, or closing brace
    while (!this.check(TokenType.COMMA) && !this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.AT)) {
        attributes.push(this.parseAttributeWithArgs());
      } else if (this.check(TokenType.IDENTIFIER)) {
        attributes.push(this.parseSimpleAttribute());
      } else {
        break;
      }
    }
    
    // Optional comma
    this.match(TokenType.COMMA);
    
    return {
      type: 'FieldDeclaration',
      name,
      fieldType,
      attributes,
      location: {
        start: name.location.start,
        end: attributes.length > 0 
          ? attributes[attributes.length - 1].location.end
          : fieldType.location.end
      }
    };
  }

  /**
   * Parse a type annotation (e.g., String, User[], etc.)
   */
  private parseTypeAnnotation(): AST.TypeAnnotation {
    const typeName = this.identifier();
    let isArray = false;
    let endPos = typeName.location.end;
    
    // Check for array type notation
    if (this.match(TokenType.LEFT_BRACKET)) {
      this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after '['");
      isArray = true;
      endPos = this.previous().position;
    }
    
    return {
      type: 'TypeAnnotation',
      typeName,
      isArray,
      location: {
        start: typeName.location.start,
        end: endPos
      }
    };
  }

  /**
   * Parse a simple attribute (e.g., primaryKey, unique, optional)
   */
  private parseSimpleAttribute(): AST.Attribute {
    const token = this.consume(TokenType.IDENTIFIER, "Expected attribute name");
    
    return {
      type: 'Attribute',
      name: token.lexeme,
      location: {
        start: token.position,
        end: token.position
      }
    };
  }

  /**
   * Parse an attribute with arguments (e.g., @relation(...))
   */
  private parseAttributeWithArgs(): AST.Attribute {
    const startToken = this.previous(); // @ token
    
    // Get the attribute name
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected attribute name after '@'");
    
    let args: AST.Expression[] = [];
    let endPos = nameToken.position;
    
    // Check for arguments
    if (this.match(TokenType.LEFT_PAREN)) {
      args = this.parseArguments();
      this.consume(TokenType.RIGHT_PAREN, "Expected ')' after attribute arguments");
      endPos = this.previous().position;
    }
    
    return {
      type: 'Attribute',
      name: nameToken.lexeme,
      arguments: args,
      location: {
        start: startToken.position,
        end: endPos
      }
    };
  }

  /**
   * Parse a comma-separated list of arguments
   */
  private parseArguments(): AST.Expression[] {
    const args: AST.Expression[] = [];
    
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    
    return args;
  }

  /**
   * Parse a view declaration
   */
  private viewDeclaration(): AST.ViewDeclaration {
    const startToken = this.consume(TokenType.VIEW, "Expected 'view' keyword");
    const name = this.identifier();
    
    this.consume(TokenType.LEFT_BRACE, "Expected '{' after view name");
    
    // Parse required 'from' property
    const fromProp = this.parseProperty();
    if (fromProp.key.name !== 'from') {
      throw this.createError(
        "First property in view must be 'from'",
        fromProp.location.start
      );
    }
    
    // Ensure from is an identifier
    if (fromProp.value.type !== 'Identifier') {
      throw this.createError(
        "View 'from' property must be an entity name",
        fromProp.value.location.start
      );
    }
    
    const from = fromProp.value as AST.Identifier;
    const fields: AST.ViewField[] = [];
    const properties: AST.Property[] = [];
    
    while (this.peek().type !== TokenType.RIGHT_BRACE && !this.isAtEnd()) {
      const prop = this.parseProperty();
      
      // Check if this is a fields property
      if (prop.key.name === 'fields') {
        // Ensure it's an array
        if (prop.value.type !== 'ArrayLiteral') {
          throw this.createError(
            "View 'fields' property must be an array",
            prop.value.location.start
          );
        }
        
        // Parse each field definition
        for (const elem of (prop.value as AST.ArrayLiteral).elements) {
          if (elem.type === 'ObjectLiteral') {
            const field = this.viewFieldFromObject(elem as AST.ObjectLiteral);
            fields.push(field);
          } else {
            throw this.createError(
              "Each view field must be an object",
              elem.location.start
            );
          }
        }
      } else {
        properties.push(prop);
      }
    }
    
    const endToken = this.consume(TokenType.RIGHT_BRACE, "Expected '}' after view body");
    
    return {
      type: 'ViewDeclaration',
      name,
      from,
      fields,
      properties,
      location: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Convert an object literal to a ViewField
   */
  private viewFieldFromObject(obj: AST.ObjectLiteral): AST.ViewField {
    let name: AST.Identifier | undefined;
    let fieldType: AST.Identifier | undefined;
    let expression: string | undefined;
    
    for (const prop of obj.properties) {
      if (prop.key.name === 'name' && prop.value.type === 'Identifier') {
        name = prop.value as AST.Identifier;
      } else if (prop.key.name === 'type' && prop.value.type === 'Identifier') {
        fieldType = prop.value as AST.Identifier;
      } else if (prop.key.name === 'expression' && prop.value.type === 'StringLiteral') {
        expression = (prop.value as AST.StringLiteral).value;
      }
    }
    
    if (!name) {
      throw this.createError(
        "View field must have a 'name' property",
        obj.location.start
      );
    }
    
    if (!expression) {
      throw this.createError(
        "View field must have an 'expression' property",
        obj.location.start
      );
    }
    
    return {
      type: 'ViewField',
      name,
      fieldType,
      expression,
      location: obj.location
    };
  }

  /**
   * Parse a page declaration
   */
  private pageDeclaration(): AST.PageDeclaration {
    const startToken = this.consume(TokenType.PAGE, "Expected 'page' keyword");
    const name = this.identifier();
    
    this.consume(TokenType.LEFT_BRACE, "Expected '{' after page name");
    
    const properties: AST.Property[] = [];
    let entity: AST.Identifier | undefined;
    
    while (this.peek().type !== TokenType.RIGHT_BRACE && !this.isAtEnd()) {
      const prop = this.parseProperty();
      
      // Check if this is the entity property
      if (prop.key.name === 'entity' && prop.value.type === 'Identifier') {
        entity = prop.value as AST.Identifier;
      }
      
      properties.push(prop);
    }
    
    const endToken = this.consume(TokenType.RIGHT_BRACE, "Expected '}' after page body");
    
    return {
      type: 'PageDeclaration',
      name,
      properties,
      entity,
      location: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Parse a workflow declaration
   */
  private workflowDeclaration(): AST.WorkflowDeclaration {
    const startToken = this.consume(TokenType.WORKFLOW, "Expected 'workflow' keyword");
    const name = this.identifier();
    
    this.consume(TokenType.LEFT_BRACE, "Expected '{' after workflow name");
    
    const properties: AST.Property[] = [];
    
    while (this.peek().type !== TokenType.RIGHT_BRACE && !this.isAtEnd()) {
      properties.push(this.parseProperty());
    }
    
    const endToken = this.consume(TokenType.RIGHT_BRACE, "Expected '}' after workflow body");
    
    return {
      type: 'WorkflowDeclaration',
      name,
      properties,
      location: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Parse a config declaration
   */
  private configDeclaration(): AST.ConfigDeclaration {
    const startToken = this.consume(TokenType.CONFIG, "Expected 'config' keyword");
    const name = this.identifier();
    
    this.consume(TokenType.LEFT_BRACE, "Expected '{' after config name");
    
    const properties: AST.Property[] = [];
    
    while (this.peek().type !== TokenType.RIGHT_BRACE && !this.isAtEnd()) {
      properties.push(this.parseProperty());
    }
    
    const endToken = this.consume(TokenType.RIGHT_BRACE, "Expected '}' after config body");
    
    return {
      type: 'ConfigDeclaration',
      name,
      properties,
      location: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Parse an enum declaration
   */
  private enumDeclaration(): AST.EnumDeclaration {
    const startToken = this.consume(TokenType.ENUM, "Expected 'enum' keyword");
    const name = this.identifier();
    
    this.consume(TokenType.LEFT_BRACE, "Expected '{' after enum name");
    
    const values: AST.EnumValue[] = [];
    
    while (this.peek().type !== TokenType.RIGHT_BRACE && !this.isAtEnd()) {
      const valueName = this.identifier();
      
      values.push({
        type: 'EnumValue',
        name: valueName,
        location: valueName.location
      });
      
      // Optional comma
      this.match(TokenType.COMMA);
    }
    
    const endToken = this.consume(TokenType.RIGHT_BRACE, "Expected '}' after enum body");
    
    return {
      type: 'EnumDeclaration',
      name,
      values,
      location: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Parse a property (key-value pair)
   */
  private parseProperty(): AST.Property {
    const key = this.identifier();
    
    this.consume(TokenType.COLON, "Expected ':' after property key");
    
    const value = this.expression();
    
    // Optional comma
    this.match(TokenType.COMMA);
    
    return {
      type: 'Property',
      key,
      value,
      location: {
        start: key.location.start,
        end: value.location.end
      }
    };
  }

  /**
   * Parse an expression
   */
  private expression(): AST.Expression {
    const token = this.peek();
    
    if (this.match(TokenType.STRING)) {
      return {
        type: 'StringLiteral',
        value: token.literal || token.lexeme,
        location: {
          start: token.position,
          end: token.position
        }
      };
    } else if (this.match(TokenType.NUMBER)) {
      return {
        type: 'NumberLiteral',
        value: token.literal || parseFloat(token.lexeme),
        location: {
          start: token.position,
          end: token.position
        }
      };
    } else if (this.match(TokenType.BOOLEAN)) {
      return {
        type: 'BooleanLiteral',
        value: token.literal || token.lexeme === 'true',
        location: {
          start: token.position,
          end: token.position
        }
      };
    } else if (this.match(TokenType.LEFT_BRACKET)) {
      return this.parseArrayLiteral(token);
    } else if (this.match(TokenType.LEFT_BRACE)) {
      return this.parseObjectLiteral(token);
    } else if (this.match(TokenType.IDENTIFIER)) {
      // Check if this is a function call
      if (this.check(TokenType.LEFT_PAREN)) {
        return this.parseFunctionCall(token);
      }
      
      // Check if this is a qualified identifier
      if (this.match(TokenType.DOT)) {
        return this.parseQualifiedIdentifier(token);
      }
      
      // Simple identifier
      return {
        type: 'Identifier',
        name: token.lexeme,
        location: {
          start: token.position,
          end: token.position
        }
      };
    }
    
    throw this.createError(`Unexpected token: ${token.lexeme}`, token.position);
  }

  /**
   * Parse an array literal
   */
  private parseArrayLiteral(startToken: Token): AST.ArrayLiteral {
    const elements: AST.Expression[] = [];
    
    // Parse array elements
    if (!this.check(TokenType.RIGHT_BRACKET)) {
      do {
        elements.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    
    const endToken = this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array elements");
    
    return {
      type: 'ArrayLiteral',
      elements,
      location: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Parse an object literal
   */
  private parseObjectLiteral(startToken: Token): AST.ObjectLiteral {
    const properties: AST.Property[] = [];
    
    // Parse object properties
    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        properties.push(this.parseProperty());
      } while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd());
    }
    
    const endToken = this.consume(TokenType.RIGHT_BRACE, "Expected '}' after object properties");
    
    return {
      type: 'ObjectLiteral',
      properties,
      location: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Parse a function call expression
   */
  private parseFunctionCall(nameToken: Token): AST.FunctionCall {
    const callee: AST.Identifier = {
      type: 'Identifier',
      name: nameToken.lexeme,
      location: {
        start: nameToken.position,
        end: nameToken.position
      }
    };
    
    // Consume the opening parenthesis
    this.consume(TokenType.LEFT_PAREN, "Expected '(' after function name");
    
    const args = this.parseArguments();
    
    // Consume the closing parenthesis
    const endToken = this.consume(TokenType.RIGHT_PAREN, "Expected ')' after function arguments");
    
    return {
      type: 'FunctionCall',
      callee,
      arguments: args,
      location: {
        start: nameToken.position,
        end: endToken.position
      }
    };
  }

  /**
   * Parse a qualified identifier (dotted path)
   */
  private parseQualifiedIdentifier(firstToken: Token): AST.QualifiedIdentifier {
    const parts: string[] = [firstToken.lexeme];
    
    // Already consumed the first dot
    while (true) {
      const nameToken = this.consume(TokenType.IDENTIFIER, "Expected identifier after '.'");
      parts.push(nameToken.lexeme);
      
      if (!this.match(TokenType.DOT)) {
        break;
      }
    }
    
    return {
      type: 'QualifiedIdentifier',
      parts,
      location: {
        start: firstToken.position,
        end: this.previous().position
      }
    };
  }

  /**
   * Parse an identifier
   */
  private identifier(): AST.Identifier {
    const token = this.consume(TokenType.IDENTIFIER, "Expected identifier");
    
    return {
      type: 'Identifier',
      name: token.lexeme,
      location: {
        start: token.position,
        end: token.position
      }
    };
  }

  /**
   * Consume and return the current token if it matches the expected type
   */
  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    
    const token = this.peek();
    throw this.createError(errorMessage, token.position);
  }

  /**
   * Check if the current token is of the expected type
   */
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  /**
   * Consume the current token if it matches the expected type
   */
  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Advance to the next token and return the previous one
   */
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  /**
   * Get the current token without advancing
   */
  private peek(): Token {
    return this.tokens[this.current];
  }

  /**
   * Get the previous token
   */
  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  /**
   * Check if we've reached the end of the token stream
   */
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  /**
   * Create a parsing error with context
   */
  private createError(message: string, pos: Position): DSLParsingError {
    // Try to get context from the token's line
    let context: string | undefined;
    
    if (this.tokens.length > 0 && this.current < this.tokens.length) {
      const token = this.tokens[this.current];
      const line = token.position.line;
      
      // Find all tokens on this line
      const lineTokens = this.tokens.filter(t => t.position.line === line);
      
      if (lineTokens.length > 0) {
        // Join the lexemes to reconstruct the line
        context = lineTokens.map(t => t.lexeme).join(' ');
      }
    }
    
    return new DSLParsingError(
      message,
      this.filePath,
      pos.line,
      pos.column,
      context
    );
  }
}

/**
 * Parse a token stream into an AST
 */
export function parse(tokens: Token[], filePath?: string): AST.Program {
  const parser = new Parser(tokens, filePath);
  return parser.parse();
}
