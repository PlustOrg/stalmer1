
import { parseDSL } from '../src/parser';
import { IApp } from '../src/ir';
import { DSLParsingError } from '../src/errors';

describe('DSL Parser', () => {
  it('should parse a valid DSL string without errors', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        email: String unique
      }
    `;
    expect(() => parseDSL(dsl)).not.toThrow();
  });

  it('should correctly parse entities and fields', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey,
        name: String,
        email: String unique optional
      }
    `;
    const app = parseDSL(dsl);
    expect(app.entities).toHaveLength(1);
    const userEntity = app.entities[0];
    expect(userEntity.name).toBe('User');
    expect(userEntity.fields).toHaveLength(3);
    expect(userEntity.fields[0]).toEqual({ name: 'id', type: 'UUID', primaryKey: true });
    expect(userEntity.fields[1]).toEqual({ name: 'name', type: 'String' });
    expect(userEntity.fields[2]).toEqual({ name: 'email', type: 'String', unique: true, optional: true });
  });

  it('should parse pages with properties', () => {
    const dsl = `
      entity User {}
      page UsersPage {
        type: "table",
        entity: User,
        route: "/users"
      }
    `;
    const app = parseDSL(dsl);
    expect(app.pages).toHaveLength(1);
    const page = app.pages[0];
    expect(page.name).toBe('UsersPage');
    expect(page.type).toBe('table');
    expect(page.entity).toBe('User');
    expect(page.route).toBe('/users');
  });

  it('should throw a DSLParsingError for syntax errors', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        email: String unique
      }
    `;
    expect(() => parseDSL(dsl.replace('{', ''))).toThrow(DSLParsingError);
  });

  it('should handle enums and references', () => {
    const dsl = `
      enum Role {
        ADMIN
        USER
      }

      entity User {
        role: Role
      }
    `;
    const app = parseDSL(dsl);
    expect(app.config?.enums).toBeDefined();
    expect(app.config?.enums?.Role).toEqual(['ADMIN', 'USER']);
    const userEntity = app.entities.find(e => e.name === 'User');
    expect(userEntity?.fields[0].type).toBe('Role');
  });
});
