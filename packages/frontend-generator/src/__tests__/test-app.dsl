// Test App DSL - Used for validating EJS templates

config app {
  name: "Test App"
}

config auth {
  provider: jwt,
  userEntity: User,
  props: {
    clerkPublishableKey: "test-key",
    auth0Domain: "test.auth0.com",
    auth0ClientId: "test-client-id"
  }
}

config integrations {
  monitoring: {
    dsn: "test-dsn"
  }
}

enum Role {
  ADMIN
  EDITOR
  USER
}

entity TestEntity {
  id: UUID primaryKey,
  name: String,
  email: String unique,
  password: Password,
  createdAt: DateTime
}

entity User {
  id: UUID primaryKey,
  name: String,
  email: String unique
}

entity Post {
  id: UUID primaryKey,
  title: String,
  content: Text
}

entity Product {
  id: UUID primaryKey,
  name: String,
  price: Decimal
}

page TestPage {
  type: table,
  route: "/test-page",
  entity: TestEntity,
  permissions: [ADMIN, USER]
}

page UserPage {
  type: table,
  route: "/users",
  entity: User,
  permissions: [ADMIN]
}

page PostPage {
  type: form,
  route: "/posts",
  entity: Post,
  permissions: [ADMIN, EDITOR]
}

page ProductPage {
  type: details,
  route: "/products",
  entity: Product,
  permissions: [ADMIN, USER]
}
