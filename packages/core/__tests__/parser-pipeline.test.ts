import { tokenize } from '../src/parser/lexer';
import { parse } from '../src/parser/parser';
import { validate } from '../src/parser/validator';
import { buildIR } from '../src/parser/ir-builder';
import { parseDSL } from '../src/parser';
import { DSLParsingError } from '../src/errors';

describe('Parser Pipeline', () => {
  // Simplified DSL for testing
  const validDSL = `
    entity User {
      name: String
      email: String
    }
    
    entity Post {
      title: String
    }
    
    page UserPage {
      type: table
      entity: User
      route: "/users"
    }
  `;

  describe('Lexer', () => {
    it('should tokenize a valid DSL string', () => {
      const tokens = tokenize(validDSL);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].value).toBe('entity');
      
      // Find User entity tokens
      const userEntityTokens = tokens.filter(t => t.value === 'User' || t.value === 'entity');
      expect(userEntityTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Parser', () => {
    it('should parse tokens into an AST', () => {
      try {
        const tokens = tokenize(validDSL);
        console.log('Tokens:', tokens.map(t => ({ type: t.type, value: t.value })));
        
        const ast = parse(tokens);
        
        expect(ast.kind).toBe('SourceFile');
        expect(ast.statements.length).toBeGreaterThan(0);
        
        // Find User entity in AST
        const userEntity = ast.statements.find(
          s => s.kind === 'EntityDeclaration' && s.name.name === 'User'
        );
        expect(userEntity).toBeDefined();
        
        if (userEntity && userEntity.kind === 'EntityDeclaration') {
          expect(userEntity.members.length).toBe(2); // name, email
        }
      } catch (error) {
        console.error('Parse error:', error);
        throw error;
      }
    });
  });

  describe('Validator', () => {
    it('should validate a valid AST without errors', () => {
      try {
        const tokens = tokenize(validDSL);
        const ast = parse(tokens);
        const diagnostics = validate(ast);
        
        expect(diagnostics.length).toBe(0);
      } catch (error) {
        console.error('Validation error:', error);
        throw error;
      }
    });

    it('should detect errors in an invalid AST', () => {
      const invalidDSL = `
        entity User {
          name: String
        }
        
        page UserPage {
          entity: NonExistentEntity
        }
      `;
      
      try {
        const tokens = tokenize(invalidDSL);
        const ast = parse(tokens);
        const diagnostics = validate(ast);
        
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('NonExistentEntity');
      } catch (error) {
        console.error('Validation error (invalid AST):', error);
        throw error;
      }
    });
  });

  describe('IR Builder', () => {
    it('should build IR from a validated AST', () => {
      try {
        const tokens = tokenize(validDSL);
        const ast = parse(tokens);
        const diagnostics = validate(ast);
        expect(diagnostics.length).toBe(0);
        
        const ir = buildIR(ast);
        
        expect(ir.entities.length).toBe(2);
        expect(ir.pages.length).toBe(1);
        
        // Check User entity
        const userEntity = ir.entities.find(e => e.name === 'User');
        expect(userEntity).toBeDefined();
        if (userEntity) {
          // In the actual implementation, there may be more fields than just name and email
          const fieldNames = userEntity.fields.map(f => f.name);
          expect(fieldNames).toContain('name');
          expect(fieldNames).toContain('email');
        }
      } catch (error) {
        console.error('IR Builder error:', error);
        throw error;
      }
    });
  });

  describe('Full Pipeline', () => {
    it('should process a valid DSL string through the full pipeline', () => {
      const ir = parseDSL(validDSL);
      
      expect(ir.entities.length).toBe(2);
      expect(ir.pages.length).toBe(1);
      
      // Check User entity
      const userEntity = ir.entities.find(e => e.name === 'User');
      expect(userEntity).toBeDefined();
      
      // Check Post entity
      const postEntity = ir.entities.find(e => e.name === 'Post');
      expect(postEntity).toBeDefined();
    });

    it('should throw an error for invalid DSL', () => {
      const invalidDSL = `
        entity User {
          name: String
          invalid-field
        }
      `;
      
      expect(() => parseDSL(invalidDSL)).toThrow(DSLParsingError);
    });
  });
});