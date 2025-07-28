/**
 * Unit tests for the new parser module.
 * These tests focus on the individual components of the parsing pipeline:
 * lexer, parser, validator, and IR builder.
 */

import { tokenize } from '../src/parser/new/lexer';
import { parse } from '../src/parser/new/parser';
import { validate } from '../src/parser/new/validator';
import { buildIR } from '../src/parser/new/ir-builder';
import { TokenType } from '../src/parser/new/token';
import * as AST from '../src/parser/new/ast';

describe('New Parser - Unit Tests', () => {
  describe('Lexer', () => {
    it('should tokenize basic syntax correctly', () => {
      const dsl = `entity User { id: UUID primaryKey }`;
      const tokens = tokenize(dsl);
      
      // Expected token sequence
      expect(tokens[0].type).toBe(TokenType.ENTITY);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].lexeme).toBe('User');
      expect(tokens[2].type).toBe(TokenType.LEFT_BRACE);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].lexeme).toBe('id');
      expect(tokens[4].type).toBe(TokenType.COLON);
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].lexeme).toBe('UUID');
      expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[6].lexeme).toBe('primaryKey');
      expect(tokens[7].type).toBe(TokenType.RIGHT_BRACE);
      expect(tokens[8].type).toBe(TokenType.EOF);
    });
    
    it('should handle string literals with escapes', () => {
      const dsl = `"Hello \\"World\\"\\n"`;
      const tokens = tokenize(dsl);
      
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].literal).toBe('Hello \\"World\\"\\n');
    });
    
    it('should handle number literals', () => {
      const dsl = `42 3.14`;
      const tokens = tokenize(dsl);
      
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].literal).toBe(42);
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].literal).toBe(3.14);
    });
    
    it('should handle boolean literals', () => {
      const dsl = `true false`;
      const tokens = tokenize(dsl);
      
      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
      expect(tokens[0].literal).toBe(true);
      expect(tokens[1].type).toBe(TokenType.BOOLEAN);
      expect(tokens[1].literal).toBe(false);
    });
    
    it('should track line and column positions', () => {
      const dsl = `entity\nUser {\n  id: UUID\n}`;
      const tokens = tokenize(dsl);
      
      expect(tokens[0].position).toEqual({ line: 1, column: 1 });
      expect(tokens[1].position).toEqual({ line: 2, column: 1 });
      expect(tokens[3].position).toEqual({ line: 3, column: 3 });
    });
    
    it('should handle comments', () => {
      const dsl = `
        // This is a comment
        entity User { // Another comment
          id: UUID // Field comment
        } // End comment
      `;
      const tokens = tokenize(dsl);
      
      // Comments should be ignored
      const entityIndex = tokens.findIndex(t => t.type === TokenType.ENTITY);
      expect(entityIndex).toBeGreaterThanOrEqual(0);
      expect(tokens[entityIndex + 1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[entityIndex + 1].lexeme).toBe('User');
    });
  });
  
  describe('Parser', () => {
    it('should parse entity declarations correctly', () => {
      const dsl = `entity User { id: UUID primaryKey }`;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      
      expect(ast.type).toBe('Program');
      expect(ast.declarations.length).toBe(1);
      
      const entityDecl = ast.declarations[0] as AST.EntityDeclaration;
      expect(entityDecl.type).toBe('EntityDeclaration');
      expect(entityDecl.name.name).toBe('User');
      
      const field = entityDecl.members[0] as AST.FieldDeclaration;
      expect(field.type).toBe('FieldDeclaration');
      expect(field.name.name).toBe('id');
      expect((field.fieldType as any).typeName).toBe('UUID');
      
      // Check for primaryKey attribute
      const attribute = field.attributes[0];
      expect(attribute.name).toBe('primaryKey');
    });
    
    it('should parse enum declarations correctly', () => {
      const dsl = `enum Role { ADMIN USER GUEST }`;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      
      const enumDecl = ast.declarations[0] as AST.EnumDeclaration;
      expect(enumDecl.type).toBe('EnumDeclaration');
      expect(enumDecl.name.name).toBe('Role');
      expect(enumDecl.values.length).toBe(3);
      expect(enumDecl.values[0].name.name).toBe('ADMIN');
      expect(enumDecl.values[1].name.name).toBe('USER');
      expect(enumDecl.values[2].name.name).toBe('GUEST');
    });
    
    it('should parse view declarations correctly', () => {
      const dsl = `
        view UserView {
          from: User
          fields: [
            { name: id, expression: "id" },
            { name: fullName, type: String, expression: "CONCAT(firstName, ' ', lastName)" }
          ]
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      
      const viewDecl = ast.declarations[0] as AST.ViewDeclaration;
      expect(viewDecl.type).toBe('ViewDeclaration');
      expect(viewDecl.name.name).toBe('UserView');
      
      // Check 'from' property
      const fromProp = viewDecl.properties.find(p => p.key.name === 'from');
      expect(fromProp).toBeDefined();
      expect((fromProp?.value as AST.Identifier).name).toBe('User');
      
      // Check 'fields' property
      const fieldsProp = viewDecl.properties.find(p => p.key.name === 'fields');
      expect(fieldsProp).toBeDefined();
      expect((fieldsProp?.value as AST.ArrayLiteral).elements.length).toBe(2);
    });
    
    it('should parse page declarations correctly', () => {
      const dsl = `
        page UserList {
          type: table
          entity: User
          route: "/users"
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      
      const pageDecl = ast.declarations[0] as AST.PageDeclaration;
      expect(pageDecl.type).toBe('PageDeclaration');
      expect(pageDecl.name.name).toBe('UserList');
      
      // Check properties
      const typeProp = pageDecl.properties.find(p => p.key.name === 'type');
      expect(typeProp).toBeDefined();
      expect((typeProp?.value as AST.Identifier).name).toBe('table');
      
      const entityProp = pageDecl.properties.find(p => p.key.name === 'entity');
      expect(entityProp).toBeDefined();
      expect((entityProp?.value as AST.Identifier).name).toBe('User');
      
      const routeProp = pageDecl.properties.find(p => p.key.name === 'route');
      expect(routeProp).toBeDefined();
      expect((routeProp?.value as AST.StringLiteral).value).toBe('/users');
    });
  });
  
  describe('Validator', () => {
    it('should validate a well-formed AST without errors', () => {
      const dsl = `
        entity User {
          id: UUID primaryKey
          email: String
        }
        
        page UserList {
          type: table
          entity: User
          route: "/users"
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      const diagnostics = validate(ast);
      
      expect(diagnostics.length).toBe(0);
    });
    
    it('should detect undefined entity references', () => {
      const dsl = `
        page UserList {
          type: table
          entity: User // User is not defined
          route: "/users"
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      const diagnostics = validate(ast);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('User');
      expect(diagnostics[0].message).toContain('not defined');
    });
    
    it('should detect duplicate declarations', () => {
      const dsl = `
        entity User {
          id: UUID primaryKey
        }
        
        entity User {
          id: UUID primaryKey
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      const diagnostics = validate(ast);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('User');
      expect(diagnostics[0].message).toContain('already defined');
    });
    
    it('should detect duplicate fields within an entity', () => {
      const dsl = `
        entity User {
          id: UUID primaryKey
          id: String
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      const diagnostics = validate(ast);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('id');
      expect(diagnostics[0].message).toContain('already defined');
    });
    
    it('should validate field types', () => {
      const dsl = `
        entity User {
          id: UUID primaryKey
          score: InvalidType
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      const diagnostics = validate(ast);
      
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain('InvalidType');
      expect(diagnostics[0].message).toContain('not a valid type');
    });
  });
  
  describe('IR Builder', () => {
    it('should build a valid IR from a validated AST', () => {
      const dsl = `
        entity User {
          id: UUID primaryKey
          email: String unique
        }
        
        entity Post {
          id: UUID primaryKey
          title: String
          author: User
        }
        
        page UserList {
          type: table
          entity: User
          route: "/users"
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      const diagnostics = validate(ast);
      expect(diagnostics.length).toBe(0);
      
      const ir = buildIR(ast);
      
      // Check entities
      expect(ir.entities.length).toBe(2);
      
      const userEntity = ir.entities.find(e => e.name === 'User');
      expect(userEntity).toBeDefined();
      expect(userEntity?.fields.length).toBe(2);
      expect(userEntity?.fields[0].name).toBe('id');
      expect(userEntity?.fields[0].primaryKey).toBe(true);
      expect(userEntity?.fields[1].name).toBe('email');
      expect(userEntity?.fields[1].unique).toBe(true);
      
      const postEntity = ir.entities.find(e => e.name === 'Post');
      expect(postEntity).toBeDefined();
      expect(postEntity?.fields.length).toBe(3);
      
      // Check relations
      expect(postEntity?.relations).toBeDefined();
      expect(postEntity?.relations?.length).toBe(1);
      expect(postEntity?.relations?.[0].target).toBe('User');
      expect(postEntity?.relations?.[0].field).toBe('author');
      expect(postEntity?.relations?.[0].type).toBe('many-to-one');
      
      // Check pages
      expect(ir.pages.length).toBe(1);
      expect(ir.pages[0].name).toBe('UserList');
      expect(ir.pages[0].type).toBe('table');
      expect(ir.pages[0].entity).toBe('User');
      expect(ir.pages[0].route).toBe('/users');
    });
    
    it('should auto-add ID fields to entities without primary keys', () => {
      const dsl = `
        entity User {
          email: String
        }
      `;
      const tokens = tokenize(dsl);
      const ast = parse(tokens);
      const diagnostics = validate(ast);
      expect(diagnostics.length).toBe(0);
      
      const ir = buildIR(ast);
      
      const userEntity = ir.entities[0];
      expect(userEntity.fields.length).toBe(2); // email + auto-added id
      expect(userEntity.fields[0].name).toBe('id');
      expect(userEntity.fields[0].primaryKey).toBe(true);
      expect(userEntity.fields[0].type).toBe('UUID');
    });
  });
});
