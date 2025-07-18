
import { parseDSL } from '../src/parser';
import { IApp } from '../src/ir';

const dsl = `
enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

config auth {
  provider: jwt
  userEntity: User
}

entity User {
  id: UUID primaryKey
  email: String unique
  password: Password
  role: UserRole default(VIEWER)
  posts: Post[] @relation(name: "UserPosts")
}

entity Post {
  id: UUID primaryKey
  title: String
  author: User @relation(name: "UserPosts")
}

page UserList {
  type: table
  entity: User
  route: "/users"
  permissions: [ADMIN, EDITOR]
  columns: [
    { field: email, label: "Email Address" },
    { field: role, label: "Role" }
  ]
}

workflow UserOnboarding {
  trigger: {
    event: "user.created",
    entity: User
  }
  steps: [
    {
      action: sendEmail,
      inputs: {
        template: "welcome",
        recipient: trigger.entity.email
      }
    }
  ]
}
`;

describe('DSL Parser', () => {
  let app: IApp;

  beforeAll(() => {
    app = parseDSL(dsl);
  });

  it('should parse entities correctly', () => {
    expect(app.entities).toHaveLength(2);
    const user = app.entities.find(e => e.name === 'User');
    expect(user).toBeDefined();
    if (!user) return;

    expect(user.fields).toHaveLength(4);
    expect(user.relations).toHaveLength(1);
    const emailField = user.fields.find(f => f.name === 'email');
    expect(emailField).toBeDefined();
    if (!emailField) return;
    expect(emailField.unique).toBe(true);

    const passwordField = user.fields.find(f => f.name === 'password');
    expect(passwordField).toBeDefined();
    if (!passwordField) return;
    expect(passwordField.isPassword).toBe(true);
  });

  it('should parse pages correctly', () => {
    expect(app.pages).toHaveLength(1);
    const userList = app.pages[0];
    expect(userList.name).toBe('UserList');
    expect(userList.type).toBe('table');
    expect(userList.entity).toBe('User');
    expect(userList.route).toBe('/users');
    expect(userList.permissions).toEqual(['ADMIN', 'EDITOR']);
  });

  it('should parse workflows correctly', () => {
    expect(app.workflows).toBeDefined();
    if (!app.workflows) return;
    expect(app.workflows).toHaveLength(1);
    const onboarding = app.workflows[0];
    expect(onboarding.name).toBe('UserOnboarding');
    expect(onboarding.trigger.event).toBe('user.created');
  });

  it('should parse config correctly', () => {
    expect(app.config).toBeDefined();
    if (!app.config) return;
    expect(app.config.auth).toBeDefined();
    if (!app.config.auth) return;
    expect(app.config.auth.provider).toBe('jwt');
    expect(app.config.auth.userEntity).toBe('User');
  });

  it('should parse enums correctly', () => {
    expect(app.config).toBeDefined();
    if (!app.config) return;
    expect(app.config.enums).toBeDefined();
    if (!app.config.enums) return;
    expect(app.config.enums.UserRole).toEqual(['ADMIN', 'EDITOR', 'VIEWER']);
  });
});
