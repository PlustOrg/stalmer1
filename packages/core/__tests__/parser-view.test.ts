import { parseDSL } from '../src/parser';
import { IApp } from '../src/ir';

describe('DSL Parser - View Block', () => {
  it('should parse a simple view block', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        firstName: String
        lastName: String
      }

      view UserView {
        from: User
        fields: [
          { name: "fullName", type: String, expression: "firstName || ' ' || lastName" }
        ]
      }
    `;

    const app = parseDSL(dsl);
    expect(app.views).toBeDefined();
    expect(app.views).toHaveLength(1);
    const view = app.views![0];
    expect(view.name).toBe('UserView');
    expect(view.from).toBe('User');
    expect(view.fields).toHaveLength(1);
    expect(view.fields[0].name).toBe('fullName');
    expect(view.fields[0].type).toBe('String');
    expect(view.fields[0].expression).toBe("firstName || ' ' || lastName");
  });

  it('should throw an error if the from entity does not exist', () => {
    const dsl = `
      view UserView {
        from: NonExistentEntity
        fields: [
          { name: "fullName", type: String, expression: "firstName || ' ' || lastName" }
        ]
      }
    `;

    expect(() => parseDSL(dsl)).toThrow("Entity 'NonExistentEntity' not found for view 'UserView'");
  });

  it('should throw an error if the view is missing the from property', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
      }

      view UserView {
        fields: [
          { name: "fullName", type: String, expression: "firstName || ' ' || lastName" }
        ]
      }
    `;

    expect(() => parseDSL(dsl)).toThrow("View 'UserView' must have a 'from' property.");
  });

  it('should throw an error if the view is missing the fields property', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
      }

      view UserView {
        from: User
      }
    `;

    expect(() => parseDSL(dsl)).toThrow("View 'UserView' must have a 'fields' property that is an array.");
  });

  it('should correctly parse a page that uses a view', () => {
    const dsl = `
        entity User {
            id: UUID primaryKey
            firstName: String
            lastName: String
        }

        view UserView {
            from: User
            fields: [
                { name: "fullName", type: String, expression: "firstName || ' ' || lastName" }
            ]
        }

        page UserList {
            type: table
            entity: UserView
        }
    `;

    const app = parseDSL(dsl);
    expect(app.pages).toHaveLength(1);
    const page = app.pages[0];
    expect(page.entity).toBe('UserView');
  });
});
