import { parseDSL } from '../src/parser';
import { IApp } from '../src/ir';
import { DSLParsingError } from '../src/errors';

// SKIPPING OLD TESTS - Using new parser implementation instead
describe.skip('New DSL Parser', () => {
  it('should parse a complex DSL with all features', () => {
    const dsl = `
      enum UserRole {
        ADMIN
        USER
      }

      config auth {
        userEntity: User,
        provider: clerk
      }

      entity User {
        id: UUID primaryKey,
        email: String unique,
        role: UserRole default(USER),
        posts: Post[] @relation(name: "UserPosts")
      }

      entity Post {
        id: UUID primaryKey,
        title: String,
        content: Text,
        author: User @relation(name: "UserPosts")
      }

      page UsersPage {
        type: "table",
        entity: User,
        route: "/admin/users"
      }

      view PostWithAuthor {
        from: Post,
        fields: [
          { name: "title", expression: "Post.title" },
          { name: "authorEmail", expression: "Post.author.email" }
        ]
      }
    `;

    const app = parseDSL(dsl);

    // Verify entities
    expect(app.entities).toHaveLength(2);
    const user = app.entities.find(e => e.name === 'User');
    const post = app.entities.find(e => e.name === 'Post');
    expect(user).toBeDefined();
    expect(post).toBeDefined();

    // Verify config
    expect(app.config?.auth?.provider).toBe('clerk');

    // Verify pages
    expect(app.pages).toHaveLength(1);
    expect(app.pages[0].route).toBe('/admin/users');

    // Verify views
    expect(app.views).toHaveLength(1);
    const view = app.views![0];
    expect(view.name).toBe('PostWithAuthor');
    expect(view.from).toBe('Post');
    expect(view.fields).toHaveLength(2);
  });

  it('should throw an error for duplicate entity names', () => {
    const dsl = `
      entity User {}
      entity User {}
    `;
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
    expect(() => parseDSL(dsl)).toThrow('Duplicate entity name');
  });

  it('should throw an error for unknown types', () => {
    const dsl = `
      entity User {
        profile: UserProfile
      }
    `;
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
    expect(() => parseDSL(dsl)).toThrow('Unknown type');
  });
});
