# Stalmer1 DSL Specification

This document provides the complete specification for the Stalmer1 Domain-Specific Language (DSL). The DSL is a high-level, declarative language designed to enable rapid development of full-stack web applications by abstracting away boilerplate code.

## 1. Core Principles

- **Declarative:** You define *what* your application should do, not *how* it should do it.
- **Human-Readable:** The syntax is clean, minimal, and maps directly to business concepts.
- **Opinionated:** The DSL makes choices for you (e.g., tech stack, architecture) to ensure consistency and quality, while providing escape hatches for customization.

## 2. Syntax and Structure

The DSL uses a YAML-like syntax with significant whitespace. The top-level file (e.g., `schema.dsl`) can contain `entity`, `page`, `workflow`, and `config` blocks.

---

## 3. `entity` Blocks: Defining Data Models

Entities are the core of the application's data model. They translate directly to database tables and ORM models (Prisma).

### 3.1. Basic Definition

```dsl
entity User {
  id: UUID primaryKey
  firstName: String
  lastName: String
  email: String unique
  password: Password
  createdAt: DateTime readonly
  updatedAt: DateTime readonly
}
```

### 3.2. Data Types

| Type       | Description                                       | Generated Type (Prisma/TS) | Notes                               |
|------------|---------------------------------------------------|----------------------------|-------------------------------------|
| `String`   | Variable-length text                              | `String`                   |                                     |
| `Text`     | Long-form text                                    | `String` (`@db.Text`)      |                                     |
| `Int`      | Integer numbers                                   | `Int`                      |                                     |
| `Float`    | Floating-point numbers                            | `Float`                    |                                     |
| `Decimal`  | Fixed-point numbers for financial calculations    | `Decimal`                  |                                     |
| `Boolean`  | True or false values                              | `Boolean`                  |                                     |
| `DateTime` | Timestamp with date and time                      | `DateTime`                 |                                     |
| `Date`     | Date only                                         | `DateTime` (`@db.Date`)    |                                     |
| `UUID`     | Universally unique identifier                     | `String` (`@db.Uuid`)      |                                     |
| `JSON`     | JSON object                                       | `Json`                     |                                     |
| `Enum`     | A list of predefined string values (see below)    | Custom `enum` type         |                                     |
| `Password` | A secure field for storing passwords.             | `String`                   | Automatically hashed on write.      |

### 3.3. Field Constraints & Attributes

Constraints are added after the data type.

| Attribute       | Description                                                              | Example                        |
|-----------------|--------------------------------------------------------------------------|--------------------------------|
| `primaryKey`    | Marks the field as the primary key. Defaults to `id: UUID`.              | `id: UUID primaryKey`          |
| `unique`        | Ensures the value is unique across all records.                          | `email: String unique`         |
| `optional`      | The field can be null. All fields are required by default.               | `middleName: String optional`  |
| `default(...)`  | Sets a default value.                                                    | `retries: Int default(0)`      |
| `readonly`      | The field cannot be updated via generated forms/APIs.                    | `createdAt: DateTime readonly` |
| `validate(...)` | Defines validation rules (see Validation section).                       | `age: Int validate(min: 18)`   |

### 3.4. Relationships

Relationships define how entities connect to each other.

#### One-to-Many (1:N)

```dsl
entity Post {
  id: UUID primaryKey
  title: String
  author: User @relation(name: "UserPosts")
}

entity User {
  id: UUID primaryKey
  name: String
  posts: Post[] @relation(name: "UserPosts")
}
```

#### Many-to-Many (N:M)

A join table is automatically inferred and managed by the ORM.

```dsl
entity Product {
  id: UUID primaryKey
  name: String
  categories: Category[]
}

entity Category {
  id: UUID primaryKey
  name: String
  products: Product[]
}
```

### 3.5. Enums

Enums are defined at the top level and can be referenced by entities.

```dsl
enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

entity User {
  role: UserRole default(VIEWER)
}
```

---

## 4. `page` Blocks: Defining UI

Pages describe the application's user interface screens.

### 4.1. Page Types

| Type        | Description                                                              |
|-------------|--------------------------------------------------------------------------|
| `table`     | A data grid for listing entity records. Supports sorting, filtering, pagination. |
| `form`      | A form for creating or updating an entity record.                        |
| `details`   | A read-only view of a single entity record.                              |
| `dashboard` | A container for multiple widgets (charts, stats, etc.).                  |
| `custom`    | A blank page for adding custom React components.                         |

### 4.2. `table` Page Example

```dsl
page UserList {
  type: table
  title: "Manage Users"
  entity: User
  route: "/users"
  permissions: [ADMIN, EDITOR]

  columns: [
    { field: firstName, label: "First Name" },
    { field: email, label: "Email Address" },
    { field: role, label: "Role" }
  ]

  actions: [
    { type: create, targetPage: UserForm },
    { type: edit, targetPage: UserForm },
    { type: view, targetPage: UserDetails },
    { type: delete }
  ]

  filters: [role, createdAt]
}
```

### 4.3. `form` Page Example

```dsl
page UserForm {
  type: form
  title: "User Profile"
  entity: User
  route: "/users/:id/edit"
  permissions: [ADMIN]

  fields: [
    { field: firstName, type: text },
    { field: lastName, type: text },
    { field: email, type: email },
    { field: role, type: select, options: UserRole }
  ]

  onSuccess: {
    action: navigate,
    target: "/users"
  }
}
```

### 4.4. `details` Page Example

```dsl
page UserDetails {
  type: details
  title: "View User"
  entity: User
  route: "/users/:id"
  permissions: [ADMIN, EDITOR, VIEWER]

  fields: [firstName, lastName, email, role, createdAt]
}
```

---

## 5. `workflow` Blocks: Defining Business Logic

Workflows chain together actions to perform complex business processes.

```dsl
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
    },
    {
      action: assignTrial,
      inputs: {
        userId: trigger.entity.id,
        plan: "premium"
      }
    }
  ]
}
```

---

## 6. `config` Blocks: System-Wide Configuration

Config blocks define global settings for the application.

### 6.1. `auth` Config

Defines the authentication strategy for the application.

```dsl
config auth {
  // provider: The auth method to use.
  // 'jwt' (default): Generates a built-in email/password system.
  // 'clerk' | 'auth0': Integrates with the specified third-party provider.
  provider: clerk

  // userEntity: The entity to use for user records.
  userEntity: User

  // The following are required only for the 'jwt' provider.
  roles: UserRole
  guards: {
    default: [ADMIN, EDITOR, VIEWER]
  }
}
```

### 6.2. `integrations` Config

Configures third-party services. The generator uses this information to wire up the corresponding SDKs and actions.

```dsl
config integrations {
  email: {
    provider: sendgrid
    apiKey: env(SENDGRID_API_KEY)
    defaultFrom: "noreply@myapp.com"
  }

  monitoring: {
    provider: sentry
    dsn: env(SENTRY_DSN)
  }

  // Payments are a planned feature.
  // payments: {
  //   provider: stripe
  //   apiKey: env(STRIPE_API_KEY)
  // }
}
```

---

## 7. Built-in Actions & Integrations

Stalmer1 provides a set of built-in actions that can be used within `workflow` blocks to perform common tasks. Many of these actions are powered by the services defined in the `config integrations` block.

### 7.1. `sendEmail`

- **Description:** Sends an email.
- **Requires:** `config integrations.email` to be defined (e.g., with `sendgrid`).
- **Inputs:**
    - `template` (String): The identifier of the email template to use.
    - `recipient` (String): The email address of the recipient.
    - `context` (Object): Key-value pairs to pass to the template.

### 7.2. `navigate`

- **Description:** A special action for use in `page` blocks (e.g., `onSuccess`) to redirect the user.
- **Inputs:**
    - `target` (String): The route to navigate to.

---

## 8. Future Considerations (Post-v1.0)

This section outlines features that are planned for future versions of the DSL but are not part of the initial specification.

### 8.1. Additional Data Types

| Type       | Description                                       |
|------------|---------------------------------------------------|
| `Image`    | For handling file uploads, storing a URL to the file. |
| `File`     | For handling generic file uploads.                |
| `RichText` | For a WYSIWYG editor, storing sanitized HTML.     |

### 8.2. Additional Page Types

| Type       | Description                                       |
|------------|---------------------------------------------------|
| `wizard`   | A multi-step form for complex data entry.         |
| `login`    | A dedicated, pre-built user authentication page.  |
| `chart`    | For data visualization within a dashboard.        |

### 8.3. Additional Actions

| Action                 | Description                                       |
|------------------------|---------------------------------------------------|
| `createCheckoutSession`| (Stripe) Initiates a payment flow.                |
| `sendSms`              | (Twilio) Sends an SMS message.                    |
| `postToSlack`          | Posts a message to a Slack channel.               |
