/**
 * Parser for the DSL
 * 
 * The parser consumes tokens from the lexer and produces an AST.
 * It should not perform any semantic validation, focusing only on syntax.
 */
import { DSLParsingError } from '../errors';
import * as AST from './ast';
import { Token, TokenType } from './token';

export class Parser {
  private tokens: Token[];
  private current = 0;
  private filePath?: string;

  constructor(tokens: Token[], filePath?: string) {
    this.tokens = tokens;
    this.filePath = filePath;
  }

  /**
   * Parse the token stream into an AST
   */
  parse(): AST.SourceFileNode {
    const statements: AST.StatementNode[] = [];

    while (!this.isAtEnd()) {
      try {
        statements.push(this.parseStatement());
      } catch (error) {
        if (error instanceof DSLParsingError) {
          throw error;
        }
        // Wrap unexpected errors in a DSLParsingError for consistent error handling
        throw new DSLParsingError(
          (error as Error).message,
          this.filePath,
          this.peek().position.line,
          this.peek().position.column
        );
      }
    }

    return {
      kind: 'SourceFile',
      statements,
      position: {
        start: statements.length > 0
          ? statements[0].position.start
          : { line: 1, column: 1 },
        end: statements.length > 0
          ? statements[statements.length - 1].position.end
          : { line: 1, column: 1 }
      }
    };
  }

  private getEnd(token: Token): AST.Position {
      return {
          line: token.position.line,
          column: token.position.column + token.value.length
      };
  }

  private createIdentifierNode(token: Token): AST.IdentifierNode {
    return { 
        kind: 'Identifier', 
        name: token.value, 
        position: {
            start: token.position,
            end: this.getEnd(token)
        }
    };
  }
  
  private createChainedIdentifierNode(parts: (AST.IdentifierNode | AST.ChainedIdentifierNode)[]): AST.ChainedIdentifierNode {
    const firstPart = parts[0];
    const lastPart = parts[parts.length - 1];
    return {
      kind: 'ChainedIdentifier',
      parts,
      position: { start: firstPart.position.start, end: lastPart.position.end }
    };
  }
  
  private parseStatement(): AST.StatementNode {
    const tokenType = this.peek().type;
    
    switch (tokenType) {
        case TokenType.KEYWORD_ENTITY:
            return this.parseEntityDeclaration();
        case TokenType.KEYWORD_VIEW:
            return this.parseViewDeclaration();
        case TokenType.KEYWORD_PAGE:
            return this.parsePageDeclaration();
        case TokenType.KEYWORD_WORKFLOW:
            return this.parseWorkflowDeclaration();
        case TokenType.KEYWORD_CONFIG:
            return this.parseConfigDeclaration();
        case TokenType.KEYWORD_ENUM:
            return this.parseEnumDeclaration();
        default:
            throw this.error(this.peek(), `Unexpected token "${this.peek().value}", expected a declaration keyword.`);
    }
  }

  private parseEntityDeclaration(): AST.EntityDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_ENTITY, 'Expected "entity" keyword');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected entity name');
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after entity name');
    
    const members: AST.EntityMemberNode[] = [];
    
    while (this.peek().type !== TokenType.BRACE_CLOSE && !this.isAtEnd()) {
      if (this.peek().type === TokenType.IDENTIFIER) {
        members.push(this.parseFieldDeclaration());
      } else {
        this.advance(); // Skip unexpected tokens
      }
    }

    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" to close the entity body');

    return {
      kind: 'EntityDeclaration',
      name: this.createIdentifierNode(nameToken),
      members,
      position: { start: startToken.position, end: this.getEnd(endToken) }
    };
  }

  private parseFieldDeclaration(): AST.FieldDeclarationNode {
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected field name');
    const nameNode = this.createIdentifierNode(nameToken);
    
    this.consume(TokenType.COLON, 'Expected ":" after field name');
    
    const typeToken = this.consume(TokenType.IDENTIFIER, 'Expected field type');
    let isArray = false;
    let typeEndPosition = this.getEnd(typeToken);

    if (this.peek().type === TokenType.BRACKET_OPEN && this.peekNext()?.type === TokenType.BRACKET_CLOSE) {
        this.advance(); // consume [
        const closeBracket = this.advance(); // consume ]
        isArray = true;
        typeEndPosition = this.getEnd(closeBracket);
    }

    const typeNode: AST.TypeNode = {
      kind: 'Type',
      name: typeToken.value,
      isArray,
      position: { start: typeToken.position, end: typeEndPosition }
    };
    
    const attributes: AST.AttributeNode[] = [];
    while (!this.isAtEnd() && this.peek().type !== TokenType.BRACE_CLOSE) {
        if (this.peek().type === TokenType.IDENTIFIER && this.peekNext()?.type === TokenType.COLON) {
            break; // Start of a new field
        }
        const attribute = this.tryParseAttribute();
        if (attribute) {
            attributes.push(attribute);
        } else {
            break; // No more attributes for this field
        }
    }
    
    const lastNode = attributes.length > 0 ? attributes[attributes.length - 1] : typeNode;

    return {
      kind: 'FieldDeclaration',
      name: nameNode,
      type: typeNode,
      attributes,
      position: { start: nameNode.position.start, end: lastNode.position.end }
    };
  }
  
  private tryParseAttribute(): AST.AttributeNode | null {
    const token = this.peek();

    const simpleAttributes = ['primaryKey', 'unique', 'optional', 'readonly', 'isPassword', 'isLongText', 'isDecimal', 'isDateOnly'];
    if (token.type === TokenType.IDENTIFIER && simpleAttributes.includes(token.value)) {
        const attrToken = this.advance();
        return { 
            kind: 'Attribute', 
            name: attrToken.value, 
            position: { start: attrToken.position, end: this.getEnd(attrToken) } 
        };
    }

    if (token.type === TokenType.IDENTIFIER && (token.value === 'default' || token.value === 'validate')) {
        const attrToken = this.advance();
        this.consume(TokenType.PARENTHESIS_OPEN, `Expected "(" after "${attrToken.value}"`);
        const args = this.parseArguments();
        const endToken = this.consume(TokenType.PARENTHESIS_CLOSE, `Expected ")" after "${attrToken.value}" argument`);

        return {
            kind: 'Attribute',
            name: attrToken.value,
            arguments: args,
            position: { start: attrToken.position, end: this.getEnd(endToken) }
        };
    }
    
    if (token.type === TokenType.AT_SIGN) {
        const atToken = this.advance();
        const directiveToken = this.consume(TokenType.IDENTIFIER, 'Expected directive name after "@"');
        let endToken = directiveToken;
        let args: AST.ValueNode[] = [];

        if (this.peek().type === TokenType.PARENTHESIS_OPEN) {
            this.advance(); // consume (
            args = this.parseArguments();
            endToken = this.consume(TokenType.PARENTHESIS_CLOSE, `Expected ")" to close the @${directiveToken.value} directive`);
        }
        
        return {
            kind: 'Attribute',
            name: directiveToken.value,
            arguments: args,
            position: { start: atToken.position, end: this.getEnd(endToken) }
        };
    }

    return null;
  }

  private parseArguments(): AST.ValueNode[] {
    const args: AST.ValueNode[] = [];
    if (this.peek().type === TokenType.PARENTHESIS_CLOSE) {
        return args;
    }

    do {
        args.push(this.parseValue(this.peek()));
        if (this.peek().type === TokenType.COMMA) {
            this.advance();
        } else {
            break;
        }
    } while (this.peek().type !== TokenType.PARENTHESIS_CLOSE && !this.isAtEnd());

    return args;
  }

  private parseViewDeclaration(): AST.ViewDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_VIEW, 'Expected "view"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected view name');
    const nameNode = this.createIdentifierNode(nameToken);
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after view name');
    
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after view body');
    
    let fromEntityNode: AST.IdentifierNode | undefined;
    const fields: AST.ViewFieldNode[] = [];
    
    for (const prop of properties) {
      if (prop.name === 'from' && prop.value.kind === 'Identifier') {
        fromEntityNode = prop.value;
      } else if (prop.name === 'fields' && prop.value.kind === 'ArrayLiteral') {
        for (const element of prop.value.elements) {
          if (element.kind === 'ObjectLiteral') {
            const nameProp = element.properties['name'];
            const typeProp = element.properties['type'];
            const exprProp = element.properties['expression'];

            if (nameProp?.kind === 'StringLiteral' && exprProp?.kind === 'StringLiteral') {
              fields.push({
                kind: 'ViewField',
                name: { kind: 'Identifier', name: nameProp.value, position: nameProp.position },
                type: typeProp?.kind === 'Identifier' ? typeProp.name : undefined,
                expression: exprProp.value,
                position: element.position
              });
            }
          }
        }
      }
    }
    
    return {
      kind: 'ViewDeclaration',
      name: nameNode,
      fromEntity: fromEntityNode || { kind: 'Identifier', name: '', position: { start: nameNode.position.end, end: nameNode.position.end } },
      fields,
      properties,
      position: { start: startToken.position, end: this.getEnd(endToken) }
    };
  }

  private parsePageDeclaration(): AST.PageDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_PAGE, 'Expected "page"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected page name');
    const nameNode = this.createIdentifierNode(nameToken);
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after page name');
    
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after page body');
    
    let entityNode: AST.IdentifierNode | undefined;
    for (const prop of properties) {
      if (prop.name === 'entity' && prop.value.kind === 'Identifier') {
        entityNode = prop.value;
      }
    }
    
    return {
      kind: 'PageDeclaration',
      name: nameNode,
      entity: entityNode || { kind: 'Identifier', name: '', position: { start: nameNode.position.end, end: nameNode.position.end } },
      properties,
      position: { start: startToken.position, end: this.getEnd(endToken) }
    };
  }

  private parseWorkflowDeclaration(): AST.WorkflowDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_WORKFLOW, 'Expected "workflow"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected workflow name');
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after workflow name');
    
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after workflow body');
    
    return {
      kind: 'WorkflowDeclaration',
      name: this.createIdentifierNode(nameToken),
      properties,
      position: { start: startToken.position, end: this.getEnd(endToken) }
    };
  }

  private parseConfigDeclaration(): AST.ConfigDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_CONFIG, 'Expected "config"');
    let nameNode: AST.IdentifierNode;

    if (this.peek().type === TokenType.IDENTIFIER) {
      nameNode = this.createIdentifierNode(this.advance());
    } else {
      const pos = this.getEnd(startToken);
      nameNode = { kind: 'Identifier', name: '', position: { start: pos, end: pos } };
    }

    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after config keyword or name');
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after config body');
    
    return {
      kind: 'ConfigDeclaration',
      name: nameNode,
      properties,
      position: { start: startToken.position, end: this.getEnd(endToken) }
    };
  }

  private parseEnumDeclaration(): AST.EnumDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_ENUM, 'Expected "enum"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected enum name');
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after enum name');
    
    const values: AST.EnumValueNode[] = [];
    while (this.peek().type !== TokenType.BRACE_CLOSE && !this.isAtEnd()) {
      if (this.peek().type === TokenType.IDENTIFIER) {
        const valueToken = this.advance();
        const identifierNode = this.createIdentifierNode(valueToken);
        values.push({
          kind: 'EnumValue',
          name: identifierNode,
          position: identifierNode.position
        });
        
        if (this.peek().type === TokenType.COMMA) this.advance();
      } else {
        this.advance();
      }
    }
    
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after enum body');
    
    return {
      kind: 'EnumDeclaration',
      name: this.createIdentifierNode(nameToken),
      values,
      position: { start: startToken.position, end: this.getEnd(endToken) }
    };
  }

  private parseProperties(): AST.PropertyNode[] {
    const properties: AST.PropertyNode[] = [];
    
    while (this.peek().type !== TokenType.BRACE_CLOSE && !this.isAtEnd()) {
      if (this.peek().type !== TokenType.IDENTIFIER && !this.peek().type.startsWith('KEYWORD_')) {
        this.advance();
        continue;
      }
      
      const nameToken = this.advance();
      let value: AST.ValueNode;

      if (this.peek().type === TokenType.BRACE_OPEN) {
        value = this.parseObjectLiteral(this.advance());
      } else {
        this.consume(TokenType.COLON, `Expected ":" after property name "${nameToken.value}"`);
        value = this.parseValue(this.peek());
      }
      
      properties.push({
        kind: 'Property',
        name: nameToken.value,
        value,
        position: { start: nameToken.position, end: value.position.end }
      });
    }
    return properties;
  }

  private parseValue(token: Token): AST.ValueNode {
    switch (token.type) {
      case TokenType.IDENTIFIER:
        let identifier: AST.IdentifierNode | AST.ChainedIdentifierNode = this.createIdentifierNode(this.advance());
        while (this.peek().type === TokenType.DOT) {
          this.advance(); // consume the dot
          const nextIdentifier = this.createIdentifierNode(this.consume(TokenType.IDENTIFIER, 'Expected identifier after "."'));
          identifier = this.createChainedIdentifierNode([identifier, nextIdentifier]);
        }
        // Handle env function call after potential chained identifiers
        if (identifier.kind === 'Identifier' && identifier.name === 'env' && this.peek().type === TokenType.PARENTHESIS_OPEN) {
          this.advance(); // consume (
          const args = this.parseArguments();
          const endToken = this.consume(TokenType.PARENTHESIS_CLOSE, 'Expected ")" after env variable');
          return {
            kind: 'FunctionCall',
            name: 'env',
            arguments: args,
            position: { start: identifier.position.start, end: this.getEnd(endToken) }
          };
        }
        return identifier;

      case TokenType.STRING_LITERAL: {
        const t = this.advance();
        return { kind: 'StringLiteral', value: t.value, position: { start: t.position, end: this.getEnd(t) } };
      }
        
      case TokenType.NUMBER_LITERAL: {
        const t = this.advance();
        return { kind: 'NumberLiteral', value: parseFloat(t.value), position: { start: t.position, end: this.getEnd(t) } };
      }
        
      case TokenType.BOOLEAN_LITERAL: {
        const t = this.advance();
        return { kind: 'BooleanLiteral', value: t.value === 'true', position: { start: t.position, end: this.getEnd(t) } };
      }
        
      case TokenType.BRACKET_OPEN:
        return this.parseArrayLiteral(this.advance());
        
      case TokenType.BRACE_OPEN:
        return this.parseObjectLiteral(this.advance());
        
      default:
        throw this.error(token, `Unexpected token "${token.value}" when expecting a value.`);
    }
  }
  
  private parseArrayLiteral(openBracketToken: Token): AST.ArrayLiteralNode {
    const elements: AST.ValueNode[] = [];
    
    while (this.peek().type !== TokenType.BRACKET_CLOSE && !this.isAtEnd()) {
        elements.push(this.parseValue(this.peek()));
        if (this.peek().type === TokenType.COMMA) {
            this.advance();
        } else if (this.peek().type !== TokenType.BRACKET_CLOSE) {
            throw this.error(this.peek(), 'Expected "," or "]" in array literal.');
        }
    }
    
    const closeBracketToken = this.consume(TokenType.BRACKET_CLOSE, 'Expected "]" to close the array.');
    
    return {
      kind: 'ArrayLiteral',
      elements,
      position: { start: openBracketToken.position, end: this.getEnd(closeBracketToken) }
    };
  }
  
  private parseObjectLiteral(openBraceToken: Token): AST.ObjectLiteralNode {
    const properties: Record<string, AST.ValueNode> = {};

    while (this.peek().type !== TokenType.BRACE_CLOSE && !this.isAtEnd()) {
      const keyToken = this.peek();
      if (keyToken.type !== TokenType.IDENTIFIER && !keyToken.type.startsWith('KEYWORD_')) {
          throw this.error(keyToken, 'Expected a property name (identifier).');
      }
      this.advance();
      this.consume(TokenType.COLON, `Expected ":" after property name "${keyToken.value}".`);
      
      properties[keyToken.value] = this.parseValue(this.peek());

      if (this.peek().type === TokenType.COMMA) {
        this.advance();
      } else if (this.peek().type !== TokenType.BRACE_CLOSE) {
        throw this.error(this.peek(), 'Expected "," or "}" in object literal.');
      }
    }
    
    const closeBraceToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" to close the object literal.');
    
    return {
      kind: 'ObjectLiteral',
      properties,
      position: { start: openBraceToken.position, end: this.getEnd(closeBraceToken) }
    };
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  
  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), errorMessage);
  }
  
  private check(type: TokenType): boolean {
    return !this.isAtEnd() && this.peek().type === type;
  }
  
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
  
  private peek(): Token {
    return this.tokens[this.current];
  }
  
  private peekNext(): Token | undefined {
    return this.tokens[this.current + 1] ?? undefined;
  }
  
  private previous(): Token {
    return this.tokens[this.current - 1];
  }
  
  private error(token: Token, message: string): Error {
    const snippet = token.type === TokenType.EOF ? "end of file" : `"${token.value}"`;
    return new DSLParsingError(
      message,
      this.filePath,
      token.position.line,
      token.position.column,
      `near ${snippet}`
    );
  }
}

/**
 * Parse a DSL token stream into an AST
 */
export function parse(tokens: Token[], filePath?: string): AST.SourceFileNode {
  const parser = new Parser(tokens, filePath);
  return parser.parse();
}