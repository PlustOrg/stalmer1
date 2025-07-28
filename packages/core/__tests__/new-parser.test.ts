import { parseDSL } from '../src/parser/new-index';
import { DSLParsingError } from '../src/errors';

describe('New DSL Parser - Basic Functionality', () => {
  it('should parse a minimal entity declaration', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir).toBeDefined();
    expect(ir.entities).toHaveLength(1);
    expect(ir.entities[0].name).toBe('User');
    expect(ir.entities[0].fields).toHaveLength(1);
    expect(ir.entities[0].fields[0]).toMatchObject({
      name: 'id',
      type: 'UUID',
      primaryKey: true
    });
  });

  it('should auto-add an id field if not present', () => {
    const dsl = `
      entity User {
        name: String
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.entities[0].fields).toHaveLength(2);
    expect(ir.entities[0].fields[0]).toMatchObject({
      name: 'id',
      type: 'UUID',
      primaryKey: true
    });
  });

  it('should parse field attributes correctly', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        email: String unique
        name: String optional
        createdAt: DateTime readonly
        retries: Int default(3)
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.entities[0].fields).toHaveLength(5);
    expect(ir.entities[0].fields[1]).toMatchObject({
      name: 'email',
      type: 'String',
      unique: true
    });
    expect(ir.entities[0].fields[2]).toMatchObject({
      name: 'name',
      type: 'String',
      optional: true
    });
    expect(ir.entities[0].fields[3]).toMatchObject({
      name: 'createdAt',
      type: 'DateTime',
      readonly: true
    });
    expect(ir.entities[0].fields[4]).toMatchObject({
      name: 'retries',
      type: 'Int',
      default: 3
    });
  });

  it('should handle special field types correctly', () => {
    const dsl = `
      entity Content {
        id: UUID primaryKey
        description: Text
        price: Decimal
        publishDate: Date
        password: Password
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.entities[0].fields[1]).toMatchObject({
      name: 'description',
      type: 'String',
      isLongText: true
    });
    expect(ir.entities[0].fields[2]).toMatchObject({
      name: 'price',
      type: 'Decimal',
      isDecimal: true
    });
    expect(ir.entities[0].fields[3]).toMatchObject({
      name: 'publishDate',
      type: 'DateTime',
      isDateOnly: true
    });
    expect(ir.entities[0].fields[4]).toMatchObject({
      name: 'password',
      type: 'String',
      isPassword: true
    });
  });

  it('should parse multiple entity declarations', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        name: String
      }

      entity Post {
        id: UUID primaryKey
        title: String
        content: Text
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.entities).toHaveLength(2);
    expect(ir.entities[0].name).toBe('User');
    expect(ir.entities[1].name).toBe('Post');
  });
});

describe('New DSL Parser - Relations', () => {
  it('should parse one-to-many relations', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        posts: Post[] relation(author)
      }

      entity Post {
        id: UUID primaryKey
        title: String
        author: User relation
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.entities[0].fields[1]).toMatchObject({
      name: 'posts',
      type: 'Post',
      isArray: true,
      relation: {
        type: 'hasMany',
        foreignField: 'author'
      }
    });
    
    expect(ir.entities[1].fields[2]).toMatchObject({
      name: 'author',
      type: 'User',
      relation: {
        type: 'belongsTo'
      }
    });
  });

  it('should parse many-to-many relations', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        name: String
        roles: Role[] relation(users)
      }

      entity Role {
        id: UUID primaryKey
        name: String
        users: User[] relation(roles)
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.entities[0].fields[2]).toMatchObject({
      name: 'roles',
      type: 'Role',
      isArray: true,
      relation: {
        type: 'manyToMany',
        foreignField: 'users'
      }
    });
    
    expect(ir.entities[1].fields[2]).toMatchObject({
      name: 'users',
      type: 'User',
      isArray: true,
      relation: {
        type: 'manyToMany',
        foreignField: 'roles'
      }
    });
  });
});

describe('New DSL Parser - Enums', () => {
  it('should parse enum declarations', () => {
    const dsl = `
      enum UserRole {
        ADMIN
        USER
        GUEST
      }

      entity User {
        id: UUID primaryKey
        name: String
        role: UserRole
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.config).toBeDefined();
    expect(ir.config?.enums).toBeDefined();
    expect(ir.config?.enums?.UserRole).toEqual(['ADMIN', 'USER', 'GUEST']);
    
    expect(ir.entities[0].fields[2]).toMatchObject({
      name: 'role',
      type: 'UserRole',
      isEnum: true
    });
  });

  it('should validate enum references', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        role: InvalidEnum
      }
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });
});

describe('New DSL Parser - Views', () => {
  it('should parse view declarations', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        name: String
        email: String
      }

      view UserSummary {
        source: User
        fields: [
          { name: "id" }
          { name: "name" }
        ]
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.views).toBeDefined();
    expect(ir.views).toHaveLength(1);
    expect(ir.views?.[0]).toMatchObject({
      name: 'UserSummary',
      source: 'User',
      fields: [
        { name: 'id' },
        { name: 'name' }
      ]
    });
  });

  it('should validate view source entity', () => {
    const dsl = `
      view UserSummary {
        source: NonExistentEntity
        fields: [
          { name: "id" }
        ]
      }
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });

  it('should validate view field references', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
      }

      view UserSummary {
        source: User
        fields: [
          { name: "nonExistentField" }
        ]
      }
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });
});

describe('New DSL Parser - Pages', () => {
  it('should parse page declarations', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        name: String
        email: String
      }

      page UserList {
        entity: User
        route: "/users"
        components: [
          { type: "table" }
        ]
      }

      page UserDetails {
        entity: User
        route: "/users/:id"
        components: [
          { type: "details" }
        ]
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.pages).toBeDefined();
    expect(ir.pages).toHaveLength(2);
    expect(ir.pages[0]).toMatchObject({
      name: 'UserList',
      entity: 'User',
      route: '/users',
      components: [
        { type: 'table' }
      ]
    });

    expect(ir.pages[1]).toMatchObject({
      name: 'UserDetails',
      entity: 'User',
      route: '/users/:id',
      components: [
        { type: 'details' }
      ]
    });
  });

  it('should validate page entity references', () => {
    const dsl = `
      page UserList {
        entity: NonExistentEntity
        route: "/users"
        components: [
          { type: "table" }
        ]
      }
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });
});

describe('New DSL Parser - Workflows', () => {
  it('should parse workflow declarations', () => {
    const dsl = `
      entity Order {
        id: UUID primaryKey
        status: String
      }

      workflow OrderProcessing {
        entity: Order
        states: [
          { name: "new", initial: true }
          { name: "processing" }
          { name: "shipped" }
          { name: "delivered" }
        ]
        transitions: [
          { from: "new", to: "processing", trigger: "startProcessing" }
          { from: "processing", to: "shipped", trigger: "ship" }
          { from: "shipped", to: "delivered", trigger: "deliver" }
        ]
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.workflows).toBeDefined();
    expect(ir.workflows).toHaveLength(1);
    expect(ir.workflows?.[0]).toMatchObject({
      name: 'OrderProcessing',
      entity: 'Order',
      states: [
        { name: 'new', initial: true },
        { name: 'processing' },
        { name: 'shipped' },
        { name: 'delivered' }
      ],
      transitions: [
        { from: 'new', to: 'processing', trigger: 'startProcessing' },
        { from: 'processing', to: 'shipped', trigger: 'ship' },
        { from: 'shipped', to: 'delivered', trigger: 'deliver' }
      ]
    });
  });
});

describe('New DSL Parser - Config', () => {
  it('should parse config declarations', () => {
    const dsl = `
      config {
        appName: "MyApp"
        auth: {
          type: "jwt"
          secretKey: "my-secret-key"
        }
        database: {
          provider: "postgresql"
        }
      }
    `;
    
    const ir = parseDSL(dsl);
    
    expect(ir.config).toBeDefined();
    expect(ir.config?.appName).toBe('MyApp');
    expect(ir.config?.auth).toMatchObject({
      type: 'jwt',
      secretKey: 'my-secret-key'
    });
    expect(ir.config?.database).toMatchObject({
      provider: 'postgresql'
    });
  });
});

describe('New DSL Parser - Error Handling', () => {
  it('should throw an error for empty DSL', () => {
    expect(() => parseDSL('')).toThrow(DSLParsingError);
    expect(() => parseDSL('// just a comment')).toThrow(DSLParsingError);
  });

  it('should throw an error for invalid syntax', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        name: String
        // Missing closing brace
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });

  it('should throw an error for duplicate entity names', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
      }

      entity User {
        id: UUID primaryKey
      }
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });

  it('should throw an error for duplicate field names', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        name: String
        name: String // Duplicate field
      }
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });

  it('should throw an error for unknown field types', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        status: UnknownType
      }
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });

  it('should throw an error for invalid relation references', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        posts: NonExistentEntity[] relation(author)
      }
    `;
    
    expect(() => parseDSL(dsl)).toThrow(DSLParsingError);
  });
});
