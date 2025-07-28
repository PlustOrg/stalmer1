/**
 * Tests for edge cases and complex scenarios for the new parser.
 * This ensures the parser can handle unusual but valid DSL inputs
 * and provides clear error messages for invalid inputs.
 */

import { parseDSL } from '../src/parser/new-index';
import { DSLParsingError } from '../src/errors';

describe('New DSL Parser - Edge Cases', () => {
  it('should handle complex nested expressions in views', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        firstName: String
        lastName: String
        email: String
      }

      view ComplexUserView {
        from: User
        fields: [
          { 
            name: complexExpression, 
            type: String, 
            expression: "CASE WHEN POSITION('@' IN email) > 0 THEN CONCAT(UPPER(firstName), ' ', SUBSTRING(lastName, 1, 1), '.') ELSE 'Unknown' END" 
          }
        ]
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.views?.[0].fields[0].expression).toBe(
      "CASE WHEN POSITION('@' IN email) > 0 THEN CONCAT(UPPER(firstName), ' ', SUBSTRING(lastName, 1, 1), '.') ELSE 'Unknown' END"
    );
  });

  it('should handle array syntax in field types', () => {
    const dsl = `
      entity Category {
        id: UUID primaryKey
        name: String
      }
      
      entity Product {
        id: UUID primaryKey
        name: String
        categories: Category[]
      }
    `;
    
    const ir = parseDSL(dsl);
    const productEntity = ir.entities.find(e => e.name === 'Product');
    const categoryField = productEntity?.fields.find(f => f.name === 'categories');
    
    expect(categoryField).toBeDefined();
    expect(categoryField?.type).toBe('Category');
    
    // The relation should be detected
    const relation = productEntity?.relations?.find(r => r.field === 'categories');
    expect(relation).toBeDefined();
    expect(relation?.type).toBe('many-to-many');
    expect(relation?.target).toBe('Category');
  });

  it('should handle all field attributes in various combinations', () => {
    const dsl = `
      entity ComplexEntity {
        id: UUID primaryKey
        name: String unique
        description: Text optional
        score: Int default(10) min(0) max(100)
        email: String pattern("^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$")
        tags: String[] optional
        createdAt: DateTime readonly
      }
    `;
    
    const ir = parseDSL(dsl);
    const entity = ir.entities[0];
    
    expect(entity.fields[1]).toMatchObject({
      name: 'name',
      type: 'String',
      unique: true
    });
    
    expect(entity.fields[2]).toMatchObject({
      name: 'description',
      type: 'String',
      isLongText: true,
      optional: true
    });
    
    expect(entity.fields[3]).toMatchObject({
      name: 'score',
      type: 'Int',
      default: 10,
      min: 0,
      max: 100
    });
    
    expect(entity.fields[4]).toMatchObject({
      name: 'email',
      type: 'String',
      pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$'
    });
  });

  it('should handle empty arrays and objects', () => {
    const dsl = `
      entity WithEmptyValues {
        id: UUID primaryKey
      }
      
      page EmptyPage {
        type: table
        entity: WithEmptyValues
        route: "/empty"
        columns: []
        filters: {}
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.pages[0].columns).toEqual([]);
    expect(ir.pages[0].props?.filters).toEqual({});
  });

  it('should handle escaped characters in strings', () => {
    const dsl = `
      entity WithEscapes {
        id: UUID primaryKey
        text: String default("Line 1\\nLine \\"2\\"\\nLine \\\\3")
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.entities[0].fields[1].default).toBe('Line 1\\nLine \\"2\\"\\nLine \\\\3');
  });

  it('should handle Unicode characters in identifiers and strings', () => {
    const dsl = `
      entity 用户 {
        id: UUID primaryKey
        名称: String
        描述: Text default("这是一个测试")
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.entities[0].name).toBe('用户');
    expect(ir.entities[0].fields[1].name).toBe('名称');
    expect(ir.entities[0].fields[2].default).toBe('这是一个测试');
  });

  it('should detect circular references between entities', () => {
    const dsl = `
      entity Parent {
        id: UUID primaryKey
        name: String
        child: Child
      }
      
      entity Child {
        id: UUID primaryKey
        name: String
        parent: Parent
      }
    `;
    
    // This should be valid - circular references are allowed with proper relation annotations
    const ir = parseDSL(dsl);
    expect(ir.entities).toHaveLength(2);
    expect(ir.entities[0].relations).toBeDefined();
    expect(ir.entities[1].relations).toBeDefined();
  });

  it('should handle deeply nested config objects', () => {
    const dsl = `
      config customIntegrations {
        email: {
          provider: sendgrid
          apiKey: "api-key-123"
          templates: {
            welcome: {
              id: "welcome-123"
              subject: "Welcome to our app"
              body: {
                html: "<h1>Welcome!</h1>"
                text: "Welcome!"
              }
            }
          }
        }
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.config?.customIntegrations?.email?.provider).toBe('sendgrid');
    expect(ir.config?.customIntegrations?.email?.apiKey).toBe('api-key-123');
    expect(ir.config?.customIntegrations?.email?.templates?.welcome?.id).toBe('welcome-123');
    expect(ir.config?.customIntegrations?.email?.templates?.welcome?.body?.html).toBe('<h1>Welcome!</h1>');
  });
});

describe('New DSL Parser - Error Reporting', () => {
  it('should report proper line and column for syntax errors', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        name String  // Missing colon
      }
    `;
    
    try {
      parseDSL(dsl);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(DSLParsingError);
      expect(error.line).toBe(4); // Line with the error
      expect(error.message).toContain('Expected ":"');
    }
  });

  it('should detect duplicate entity names', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
      }
      
      entity User {  // Duplicate name
        id: UUID primaryKey
      }
    `;
    
    try {
      parseDSL(dsl);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(DSLParsingError);
      expect(error.message).toContain('already defined');
    }
  });

  it('should detect duplicate field names within an entity', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        name: String
        name: String  // Duplicate field
      }
    `;
    
    try {
      parseDSL(dsl);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(DSLParsingError);
      expect(error.message).toContain('already defined');
    }
  });

  it('should detect references to undefined entities', () => {
    const dsl = `
      entity Post {
        id: UUID primaryKey
        author: NonExistentUser
      }
    `;
    
    try {
      parseDSL(dsl);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(DSLParsingError);
      expect(error.message).toContain('NonExistentUser');
    }
  });

  it('should detect invalid field types', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        age: integer  // Should be Int, not integer
      }
    `;
    
    try {
      parseDSL(dsl);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(DSLParsingError);
      expect(error.message).toContain('integer');
    }
  });

  it('should detect invalid attribute combinations', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey optional  // Primary key can't be optional
      }
    `;
    
    try {
      parseDSL(dsl);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(DSLParsingError);
      expect(error.message).toContain('primary key');
      expect(error.message).toContain('optional');
    }
  });

  it('should detect missing required fields in declarations', () => {
    const dsl = `
      page InvalidPage {
        // Missing required 'type' field
        entity: User
        route: "/users"
      }
      
      entity User {
        id: UUID primaryKey
      }
    `;
    
    try {
      parseDSL(dsl);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(DSLParsingError);
      expect(error.message).toContain('type');
    }
  });
});
