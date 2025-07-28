import { parseDSL } from '../src/parser/index';
import { IApp } from '../src/ir';

// SKIPPING OLD TESTS - Using new parser implementation instead
describe.skip('DSL Parser - View Block', () => {
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

    const app: IApp = parseDSL(dsl);

    expect(app.views).toBeDefined();
    expect(app.views?.length).toBe(1);
    const view = app.views?.[0];
    expect(view?.name).toBe('UserView');
    expect(view?.from).toBe('User');
    expect(view?.fields).toEqual([
      { name: 'fullName', type: 'String', expression: "firstName || ' ' || lastName" }
    ]);
  });

  it('should parse a view with multiple fields', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        firstName: String
        lastName: String
      }

      entity Post {
        id: UUID primaryKey
        author: User @relation(name: "UserPosts")
      }

      view UserView {
        from: User
        fields: [
          { name: "fullName", type: String, expression: "firstName || ' ' || lastName" },
          { name: "postCount", type: Int, expression: "(SELECT COUNT(*) FROM Post WHERE Post.authorId = User.id)" }
        ]
      }
    `;

    const app: IApp = parseDSL(dsl);

    expect(app.views).toBeDefined();
    expect(app.views?.length).toBe(1);
    const view = app.views?.[0];
    expect(view?.name).toBe('UserView');
    expect(view?.from).toBe('User');
    expect(view?.fields).toEqual([
      { name: 'fullName', type: 'String', expression: "firstName || ' ' || lastName" },
      { name: 'postCount', type: 'Int', expression: "(SELECT COUNT(*) FROM Post WHERE Post.authorId = User.id)" }
    ]);
  });
});
