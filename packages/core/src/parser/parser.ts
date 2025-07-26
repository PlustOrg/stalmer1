/**
 * Parser for the DSL
 * 
 * The parser consumes tokens from the lexer and produces an AST.
 * It should not perform any semantic validation, focusing only on syntax.
 */
import { DSLParsingError } from '../errors';
import * as AST from './ast';
import { Token, TokenType } from './lexer';

export class Parser {
  private tokens: Token[];
  private current = 0;
  private filePath?: string;
  private source: string = "";

  constructor(tokens: Token[], filePath?: string, source: string = "") {
    this.tokens = tokens;
    this.filePath = filePath;
    this.source = source;
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

  private parseStatement(): AST.StatementNode {
    const token = this.peek();
    
    if (token.type === TokenType.KEYWORD_ENTITY) {
      return this.parseEntityDeclaration();
    } else if (token.type === TokenType.KEYWORD_VIEW) {
      return this.parseViewDeclaration();
    } else if (token.type === TokenType.KEYWORD_PAGE) {
      return this.parsePageDeclaration();
    } else if (token.type === TokenType.KEYWORD_WORKFLOW) {
      return this.parseWorkflowDeclaration();
    } else if (token.type === TokenType.KEYWORD_CONFIG) {
      return this.parseConfigDeclaration();
    } else if (token.type === TokenType.KEYWORD_ENUM) {
      return this.parseEnumDeclaration();
    } else {
      throw this.error(token, `Unexpected token "${token.value}", expected a declaration keyword`);
    }
  }

  private parseEntityDeclaration(): AST.EntityDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_ENTITY, 'Expected "entity"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected entity name');
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after entity name');
    
    const members: AST.EntityMemberNode[] = [];
    
    // Parse entity members (fields and relations)
    while (this.peek().type !== TokenType.BRACE_CLOSE && !this.isAtEnd()) {
      if (this.peek().type !== TokenType.IDENTIFIER) {
        this.advance(); // Skip any unexpected tokens
        continue;
      }

      // All field declarations are handled the same way now
      // Relations are parsed as field declarations with relation attributes
      members.push(this.parseFieldDeclaration());
    }

    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after entity body');

    return {
      kind: 'EntityDeclaration',
      name: {
        kind: 'Identifier',
        name: nameToken.value,
        position: {
          start: nameToken.position,
          end: { 
            line: nameToken.position.line, 
            column: nameToken.position.column + nameToken.value.length 
          }
        }
      },
      members,
      position: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  private parseFieldDeclaration(): AST.FieldDeclarationNode {
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected field name');
    
    if (!this.check(TokenType.COLON)) {
      throw this.error(this.peek(), 'Expected ":" after field name');
    }
    
    this.advance(); // Consume the colon
    
    // Parse the type
    const typeToken = this.consume(TokenType.IDENTIFIER, 'Expected field type');
    
    // Check if it's an array type
    const isArray = this.peek().value === '[]';
    if (isArray) {
      this.advance(); // Consume the [] token
    }
    
    const type: AST.TypeNode = {
      kind: 'Type',
      name: typeToken.value,
      isArray,
      position: {
        start: typeToken.position,
        end: { 
          line: typeToken.position.line, 
          column: typeToken.position.column + typeToken.value.length + (isArray ? 2 : 0)
        }
      }
    }
    
    // Parse attributes
    const attributes: AST.AttributeNode[] = [];
    // Check for attributes until we hit a closing brace or another field identifier followed by a colon
    while (!this.isAtEnd() && this.peek().type !== TokenType.BRACE_CLOSE &&
           !(this.peek().type === TokenType.IDENTIFIER && 
             this.peekNext() !== undefined && this.peekNext()!.type === TokenType.COLON)) {
      
      // Parse attribute
      if (this.peek().value === 'primaryKey' || 
          this.peek().value === 'unique' || 
          this.peek().value === 'optional' ||
          this.peek().value === 'readonly' || 
          this.peek().value === 'isPassword' ||
          this.peek().value === 'isLongText' ||
          this.peek().value === 'isDecimal' ||
          this.peek().value === 'isDateOnly') {
        
        const attrToken = this.advance();
        attributes.push({
          kind: 'Attribute',
          name: attrToken.value,
          position: {
            start: attrToken.position,
            end: { 
              line: attrToken.position.line, 
              column: attrToken.position.column + attrToken.value.length 
            }
          }
        });
      } 
      // Parse attribute with arguments (like default or validate)
      else if (this.peek().value === 'default' || this.peek().value === 'validate') {
        const attrToken = this.advance();
        this.consume(TokenType.PARENTHESIS_OPEN, `Expected "(" after ${attrToken.value}`);
        
        // For validate attribute with an object argument
        if (attrToken.value === 'validate' && this.peek().type === TokenType.IDENTIFIER) {
          const key = this.advance();
          this.consume(TokenType.COLON, `Expected ":" after ${key.value}`);
          // Parse the value - don't advance here, let parseValue handle it
          const argValue = this.parseValue(this.peek());
          this.consume(TokenType.PARENTHESIS_CLOSE, `Expected ")" after ${attrToken.value} argument`);
          
          attributes.push({
            kind: 'Attribute',
            name: attrToken.value,
            arguments: [{
              kind: 'ObjectLiteral',
              properties: { [key.value]: argValue },
              position: {
                start: key.position,
                end: this.previous().position
              }
            }],
            position: {
              start: attrToken.position,
              end: this.previous().position
            }
          });
          continue;
        }
        
        // Parse the argument value for other attributes
        const argValue = this.parseValue(this.peek());
        this.consume(TokenType.PARENTHESIS_CLOSE, `Expected ")" after ${attrToken.value} argument`);
        
        attributes.push({
          kind: 'Attribute',
          name: attrToken.value,
          arguments: [argValue],
          position: {
            start: attrToken.position,
            end: this.previous().position
          }
        });
      }
      // Parse directive (like @virtual or @relation)
      else if (this.peek().type === TokenType.AT_SIGN) {
        const atToken = this.advance(); // @
        const directiveToken = this.consume(TokenType.IDENTIFIER, 'Expected directive name after @');
        
        if (directiveToken.value === 'virtual') {
          this.consume(TokenType.PARENTHESIS_OPEN, 'Expected "(" after @virtual');
          const fromToken = this.consume(TokenType.IDENTIFIER, 'Expected "from" in @virtual directive');
          
          if (fromToken.value !== 'from') {
            throw this.error(fromToken, 'Expected "from" in @virtual directive');
          }
          
          this.consume(TokenType.COLON, 'Expected ":" after "from"');
          const fromValue = this.consume(TokenType.STRING_LITERAL, 'Expected string for virtual field source');
          this.consume(TokenType.PARENTHESIS_CLOSE, 'Expected ")" after @virtual directive');
          
          attributes.push({
            kind: 'Attribute',
            name: 'virtual',
            arguments: [{
              kind: 'StringLiteral',
              value: fromValue.value,
              position: {
                start: fromValue.position,
                end: { 
                  line: fromValue.position.line, 
                  column: fromValue.position.column + fromValue.value.length + 2 // +2 for quotes
                }
              }
            }],
            position: {
              start: atToken.position,
              end: this.previous().position
            }
          });
        } else if (directiveToken.value === 'relation') {
          // Handle @relation directive
          let relationName: string | undefined;
          
          // Check for relation name in parentheses
          if (this.peek().type === TokenType.PARENTHESIS_OPEN) {
            this.advance(); // Consume (
            this.consume(TokenType.IDENTIFIER, 'Expected "name" in relation directive');
            this.consume(TokenType.COLON, 'Expected ":" after "name"');
            const nameValueToken = this.consume(TokenType.STRING_LITERAL, 'Expected string for relation name');
            relationName = nameValueToken.value;
            this.consume(TokenType.PARENTHESIS_CLOSE, 'Expected ")" after relation name');
          }
          
          attributes.push({
            kind: 'Attribute',
            name: 'relation',
            arguments: [{
              kind: 'StringLiteral',
              value: relationName || '',
              position: {
                start: directiveToken.position,
                end: this.previous().position
              }
            }],
            position: {
              start: atToken.position,
              end: this.previous().position
            }
          });
        } else {
          // Skip unknown directive
          while (!this.isAtEnd() && 
                 this.peek().type !== TokenType.PARENTHESIS_CLOSE &&
                 this.peek().type !== TokenType.BRACE_CLOSE) {
            this.advance();
          }
          if (this.peek().type === TokenType.PARENTHESIS_CLOSE) {
            this.advance();
          }
        }
      } else {
        // Skip any other unexpected tokens
        this.advance();
      }
    }
    
    return {
      kind: 'FieldDeclaration',
      name: {
        kind: 'Identifier',
        name: nameToken.value,
        position: {
          start: nameToken.position,
          end: { 
            line: nameToken.position.line, 
            column: nameToken.position.column + nameToken.value.length 
          }
        }
      },
      type,
      attributes,
      position: {
        start: nameToken.position,
        end: attributes.length > 0 
          ? attributes[attributes.length - 1].position.end 
          : type.position.end
      }
    };
  }

  private parseViewDeclaration(): AST.ViewDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_VIEW, 'Expected "view"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected view name');
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after view name');
    
    // Parse view properties
    const fields: AST.ViewFieldNode[] = [];
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after view body');
    
    // Extract specific properties
    let fromEntity = '';
    for (const prop of properties) {
      if (prop.name === 'from' && prop.value.kind === 'Identifier') {
        fromEntity = prop.value.name;
      } else if (prop.name === 'fields' && prop.value.kind === 'ArrayLiteral') {
        // Extract fields from the array
        const fieldArray = prop.value.elements;
        for (const field of fieldArray) {
          if (field.kind === 'ObjectLiteral') {
            const name = field.properties['name']?.kind === 'StringLiteral' ? field.properties['name'].value : '';
            const type = field.properties['type']?.kind === 'Identifier' ? field.properties['type'].name : '';
            const expression = field.properties['expression']?.kind === 'StringLiteral' ? field.properties['expression'].value : '';
            
            if (name && expression) {
              fields.push({
                kind: 'ViewField',
                name: {
                  kind: 'Identifier',
                  name,
                  position: field.position
                },
                type,
                expression,
                position: field.position
              });
            }
          }
        }
      }
    }
    
    return {
      kind: 'ViewDeclaration',
      name: {
        kind: 'Identifier',
        name: nameToken.value,
        position: {
          start: nameToken.position,
          end: { line: nameToken.position.line, column: nameToken.position.column + nameToken.value.length }
        }
      },
      fromEntity: {
        kind: 'Identifier',
        name: fromEntity,
        position: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } // Placeholder
      },
      fields,
      properties,
      position: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  private parsePageDeclaration(): AST.PageDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_PAGE, 'Expected "page"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected page name');
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after page name');
    
    // Parse page properties
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after page body');
    
    // Extract specific properties
    let entityName = '';
    for (const prop of properties) {
      // Handle property names
      if (prop.name === 'entity' && prop.value.kind === 'Identifier') {
        entityName = prop.value.name;
      }
    }
    
    return {
      kind: 'PageDeclaration',
      name: {
        kind: 'Identifier',
        name: nameToken.value,
        position: {
          start: nameToken.position,
          end: { line: nameToken.position.line, column: nameToken.position.column + nameToken.value.length }
        }
      },
      entity: {
        kind: 'Identifier',
        name: entityName,
        position: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } } // Placeholder
      },
      properties,
      position: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  private parseWorkflowDeclaration(): AST.WorkflowDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_WORKFLOW, 'Expected "workflow"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected workflow name');
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after workflow name');
    
    // Parse workflow properties
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after workflow body');
    
    return {
      kind: 'WorkflowDeclaration',
      name: {
        kind: 'Identifier',
        name: nameToken.value,
        position: {
          start: nameToken.position,
          end: { line: nameToken.position.line, column: nameToken.position.column + nameToken.value.length }
        }
      },
      properties,
      position: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  private parseConfigDeclaration(): AST.ConfigDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_CONFIG, 'Expected "config"');
    
    let nameToken;
    // Check if the next token is an identifier (config name) or a brace open (anonymous config)
    if (this.peek().type === TokenType.IDENTIFIER) {
      nameToken = this.advance();
      this.consume(TokenType.BRACE_OPEN, 'Expected "{" after config name');
    } else {
      // Anonymous config (no name)
      nameToken = { type: TokenType.IDENTIFIER, value: '', position: startToken.position };
      this.consume(TokenType.BRACE_OPEN, 'Expected "{" after config');
    }
    
    // Parse config properties
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after config body');
    
    return {
      kind: 'ConfigDeclaration',
      name: {
        kind: 'Identifier',
        name: nameToken.value,
        position: {
          start: nameToken.position,
          end: { line: nameToken.position.line, column: nameToken.position.column + nameToken.value.length }
        }
      },
      properties,
      position: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  private parseEnumDeclaration(): AST.EnumDeclarationNode {
    const startToken = this.consume(TokenType.KEYWORD_ENUM, 'Expected "enum"');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected enum name');
    this.consume(TokenType.BRACE_OPEN, 'Expected "{" after enum name');
    
    // Parse enum values
    const values: AST.EnumValueNode[] = [];
    
    while (this.peek().type !== TokenType.BRACE_CLOSE && !this.isAtEnd()) {
      if (this.peek().type === TokenType.IDENTIFIER) {
        const valueToken = this.advance();
        
        values.push({
          kind: 'EnumValue',
          name: {
            kind: 'Identifier',
            name: valueToken.value,
            position: {
              start: valueToken.position,
              end: { line: valueToken.position.line, column: valueToken.position.column + valueToken.value.length }
            }
          },
          position: {
            start: valueToken.position,
            end: { line: valueToken.position.line, column: valueToken.position.column + valueToken.value.length }
          }
        });
        
        // Skip optional comma or colon separators
        if (this.peek().type === TokenType.COLON || this.peek().type === TokenType.COMMA) {
          this.advance();
        }
      } else {
        this.advance(); // Skip unexpected tokens
      }
    }
    
    const endToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after enum body');
    
    return {
      kind: 'EnumDeclaration',
      name: {
        kind: 'Identifier',
        name: nameToken.value,
        position: {
          start: nameToken.position,
          end: { line: nameToken.position.line, column: nameToken.position.column + nameToken.value.length }
        }
      },
      values,
      position: {
        start: startToken.position,
        end: endToken.position
      }
    };
  }

  private parseProperties(): AST.PropertyNode[] {
    const properties: AST.PropertyNode[] = [];
    
    while (this.peek().type !== TokenType.BRACE_CLOSE && !this.isAtEnd()) {
      // Property name can be an identifier or a keyword 
      if (this.peek().type !== TokenType.IDENTIFIER && 
          !this.peek().type.startsWith('KEYWORD_')) {
        this.advance(); // Skip unexpected tokens
        continue;
      }
      
      // Get property name
      const nameToken = this.advance();
      const name = nameToken.value;
      
      // Handle object value without a colon (e.g., "auth { ... }")
      if (this.peek().type === TokenType.BRACE_OPEN) {
        // Parse as an object literal
        this.advance(); // Consume the {
        const openBraceToken = this.previous();
        const objectValue = this.parseObjectLiteral(openBraceToken);
        
        properties.push({
          kind: 'Property',
          name,
          value: objectValue,
          position: {
            start: nameToken.position,
            end: objectValue.position.end
          }
        });
        continue;
      }
      
      // Normal property with colon
      this.consume(TokenType.COLON, `Expected ":" after property name "${name}"`);
      
      // Handle different property value types
      const valueToken = this.peek();
      const value = this.parseValue(valueToken);
      
      properties.push({
        kind: 'Property',
        name,
        value,
        position: {
          start: nameToken.position,
          end: value.position.end
        }
      });
    }
    
    return properties;
  }

  private parseValue(token: Token): AST.ValueNode {
    // Use the provided token, which should be from this.peek()
    const currentToken = token;
    
    switch (currentToken.type) {
      // Handle env() function
      case TokenType.IDENTIFIER:
        if (currentToken.value === 'env') {
          this.advance(); // Consume 'env'
          
          // Check for opening parenthesis
          if (this.peek().type === TokenType.PARENTHESIS_OPEN) {
            this.advance(); // Consume (
            
            // Get the environment variable name
            const envVarToken = this.peek();
            let envVarName: string;
            
            if (envVarToken.type === TokenType.STRING_LITERAL) {
              envVarName = envVarToken.value;
              this.advance(); // Consume the variable name
            } else if (envVarToken.type === TokenType.IDENTIFIER) {
              envVarName = envVarToken.value;
              this.advance(); // Consume the variable name
            } else {
              throw this.error(envVarToken, 'Expected environment variable name');
            }
            
            // Check for closing parenthesis
            this.consume(TokenType.PARENTHESIS_CLOSE, 'Expected ")" after env variable');
            
            // Return as a function call
            return {
              kind: 'FunctionCall',
              name: 'env',
              arguments: [{
                kind: 'StringLiteral',
                value: envVarName,
                position: {
                  start: envVarToken.position,
                  end: { ...envVarToken.position, column: envVarToken.position.column + envVarName.length }
                }
              }],
              position: {
                start: currentToken.position,
                end: this.previous().position
              }
            };
          }
        }
        // Fall through to handle regular identifiers
        this.advance(); // Consume the token
        return {
          kind: 'Identifier',
          name: currentToken.value,
          position: {
            start: currentToken.position,
            end: { ...currentToken.position, column: currentToken.position.column + currentToken.value.length }
          }
        };
        
      case TokenType.STRING_LITERAL:
        this.advance(); // Consume the token
        return {
          kind: 'StringLiteral',
          value: currentToken.value,
          position: {
            start: currentToken.position,
            end: { ...currentToken.position, column: currentToken.position.column + currentToken.value.length + 2 } // +2 for quotes
          }
        };
        
      case TokenType.NUMBER_LITERAL:
        this.advance(); // Consume the token
        return {
          kind: 'NumberLiteral',
          value: parseFloat(currentToken.value),
          position: {
            start: currentToken.position,
            end: { ...currentToken.position, column: currentToken.position.column + currentToken.value.length }
          }
        };
        
      case TokenType.BOOLEAN_LITERAL:
        this.advance(); // Consume the token
        return {
          kind: 'BooleanLiteral',
          value: currentToken.value === 'true',
          position: {
            start: currentToken.position,
            end: { ...currentToken.position, column: currentToken.position.column + currentToken.value.length }
          }
        };
        
      case TokenType.BRACKET_OPEN:
        this.advance(); // Consume the token
        return this.parseArrayLiteral(currentToken);
        
      case TokenType.BRACE_OPEN:
        this.advance(); // Consume the token
        return this.parseObjectLiteral(currentToken);
        
      case TokenType.IDENTIFIER:
        this.advance(); // Consume the token
        return {
          kind: 'Identifier',
          name: currentToken.value,
          position: {
            start: currentToken.position,
            end: { ...currentToken.position, column: currentToken.position.column + currentToken.value.length }
          }
        };
        
      default:
        throw this.error(currentToken, `Unexpected token for value: ${currentToken.value}`);
    }
  }
  
  private parseArrayLiteral(openBracketToken: Token): AST.ArrayLiteralNode {
    const elements: AST.ValueNode[] = [];
    
    // Handle empty arrays
    if (this.peek().type === TokenType.BRACKET_CLOSE) {
      const closeBracketToken = this.advance();
      return {
        kind: 'ArrayLiteral',
        elements: [],
        position: {
          start: openBracketToken.position,
          end: closeBracketToken.position
        }
      };
    }
    
    // Parse array elements
    while (this.peek().type !== TokenType.BRACKET_CLOSE && !this.isAtEnd()) {
      // Parse the value - don't advance here, let parseValue handle it
      elements.push(this.parseValue(this.peek()));
      
      // Check for comma separator (optional)
      const hasComma = this.peek().type === TokenType.COMMA;
      if (hasComma) {
        this.advance(); // Consume the comma
      }
      
      // If we didn't see a comma but we're not at the end of the array, that's fine too
      // This is for the comma-less syntax that some tests use
    }
    
    const closeBracketToken = this.consume(TokenType.BRACKET_CLOSE, 'Expected "]" after array elements');
    
    return {
      kind: 'ArrayLiteral',
      elements,
      position: {
        start: openBracketToken.position,
        end: closeBracketToken.position
      }
    };
  }
  
  private parseObjectLiteral(openBraceToken: Token): AST.ObjectLiteralNode {
    const properties: Record<string, AST.ValueNode> = {};
    if (this.peek().type === TokenType.BRACE_CLOSE) {
      const closeBraceToken = this.advance();
      return {
        kind: 'ObjectLiteral',
        properties,
        position: {
          start: openBraceToken.position,
          end: closeBraceToken.position
        }
      };
    }
    while (this.peek().type !== TokenType.BRACE_CLOSE && !this.isAtEnd()) {
      let keyToken: Token;
      if (this.peek().type.startsWith('KEYWORD_') || this.peek().type === TokenType.IDENTIFIER) {
        keyToken = this.advance();
      } else {
        keyToken = this.consume(TokenType.IDENTIFIER, 'Expected property name');
      }
      const knownKeys = ['entity', 'action', 'field', 'recipient', 'template', 'event'];
      const nextToken = this.peek();
      if (knownKeys.includes(keyToken.value) && (nextToken.type === TokenType.IDENTIFIER || nextToken.type.startsWith('KEYWORD_')) && nextToken.type !== TokenType.COLON) {
        this.advance();
        properties[keyToken.value] = {
          kind: 'Identifier',
          name: nextToken.value,
          position: {
            start: nextToken.position,
            end: {
              line: nextToken.position.line,
              column: nextToken.position.column + nextToken.value.length
            }
          }
        };
        continue;
      }
      if (this.peek().type === TokenType.COLON) {
        this.advance();
        const value = this.parseValue(this.peek());
        properties[keyToken.value] = value;
      } else if (this.peek().type === TokenType.BRACE_OPEN) {
        // Nested object literal
        this.advance();
        const nestedObject = this.parseObjectLiteral(this.previous());
        properties[keyToken.value] = nestedObject;
      } else if (this.peek().type === TokenType.BRACKET_OPEN) {
        // Array literal
        this.advance();
        const arrayValue = this.parseArrayLiteral(this.previous());
        properties[keyToken.value] = arrayValue;
      } else {
        // Fallback: treat as identifier
        if (this.peek().type === TokenType.IDENTIFIER) {
          const idToken = this.advance();
          properties[keyToken.value] = {
            kind: 'Identifier',
            name: idToken.value,
            position: {
              start: idToken.position,
              end: {
                line: idToken.position.line,
                column: idToken.position.column + idToken.value.length
              }
            }
          };
        } else {
          // Skip unexpected token
          this.advance();
        }
      }
      if (this.peek().type === TokenType.COMMA) {
        this.advance();
      }
      // Defensive: skip any unexpected tokens to avoid infinite loop
      while (!this.isAtEnd() && this.peek().type !== TokenType.BRACE_CLOSE && this.peek().type !== TokenType.IDENTIFIER && !this.peek().type.startsWith('KEYWORD_')) {
        this.advance();
      }
    }
    const closeBraceToken = this.consume(TokenType.BRACE_CLOSE, 'Expected "}" after object properties');
    return {
      kind: 'ObjectLiteral',
      properties,
      position: {
        start: openBraceToken.position,
        end: closeBraceToken.position
      }
    };
  }

  // Helper method to check if we're currently parsing inside an object with a specific key
  private isInsideObjectWithKey(key: string): boolean {
    try {
      // Get the current source code
      const parentPropertyName = this.getCurrentParentPropertyName();
      return parentPropertyName === key;
    } catch (error) {
      return false;
    }
  }

  // Helper to get the parent property name in the parse context
  private getCurrentParentPropertyName(): string | null {
    // This is a simplified implementation that doesn't rely on source code
    // We can examine the tokens directly
    
    // Look back in the token stream for trigger: or inputs:
    let i = this.current - 1;
    while (i >= 0 && i >= this.current - 10) { // Look back up to 10 tokens
      const token = this.tokens[i];
      if ((token.value === 'trigger' || token.value === 'inputs') && 
          i + 1 < this.tokens.length && this.tokens[i + 1].type === TokenType.COLON) {
        return token.value;
      }
      i--;
    }
    
    return null;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }
  
  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    
    throw this.error(this.peek(), errorMessage);
  }
  
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) {
      return false;
    }
    return this.peek().type === type;
  }
  
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
  
  private peek(): Token {
    return this.tokens[this.current];
  }
  
  private peekNext(): Token | undefined {
    if (this.current + 1 >= this.tokens.length) {
      return undefined;
    }
    return this.tokens[this.current + 1];
  }
  
  private previous(): Token {
    return this.tokens[this.current - 1];
  }
  
  private error(token: Token, message: string): Error {
    return new DSLParsingError(
      message,
      this.filePath,
      token.position.line,
      token.position.column,
      `near "${token.value}"`
    );
  }
}

/**
 * Parse a DSL string into an AST
 */
export function parse(tokens: Token[], filePath?: string, source?: string): AST.SourceFileNode {
  const parser = new Parser(tokens, filePath, source);
  return parser.parse();
}
