# Stalmer1 System Architecture

This document provides a detailed overview of the Stalmer1 system architecture, from DSL parsing to final code generation. It is intended for developers contributing to the Stalmer1 core or building plugins.

## 1. Core Philosophy

The architecture is designed around a unidirectional data flow:

```DSL → Parser → Intermediate Representation (IR) → Generators → Final Code```

This ensures a clear separation of concerns, making the system modular, testable, and extensible.

## 2. Architectural Diagram

```mermaid
graph TD
    A[DSL Files (*.dsl)] -->|1. Parses| B(Parser);
    B -->|2. Validates & Builds| C(Intermediate Representation);
    C -->|3. Feeds IR to| D{Code Generators};

    subgraph Generators
        D --> E[Frontend Generator];
        D --> F[Backend Generator];
        D --> G[Infrastructure Generator];
    end

    subgraph Generated Artifacts
        E --> H[React/Next.js Code];
        F --> I[NestJS Code];
        G --> J[Docker/Helm Files];
    end

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px
    style D fill:#9f9,stroke:#333,stroke-width:2px
```

## 3. Component Breakdown

### 3.1. The Parser

The Parser is responsible for transforming the raw DSL text into a structured, validated format.

- **Technology:** Built using a standard parser-generator tool like **ANTLR** or a custom recursive descent parser for simplicity.
- **Process:**
    1. **Lexing:** The input `.dsl` file is scanned and broken down into a sequence of tokens (e.g., `entity`, `String`, `{`, `}`).
    2. **Parsing:** The token stream is parsed to build an **Abstract Syntax Tree (AST)** that mirrors the nested structure of the DSL.
    3. **Validation:** The AST is traversed to perform semantic checks:
        - Type checking (e.g., ensuring a `page`'s `entity` exists).
        - Constraint validation (e.g., detecting duplicate `unique` fields).
        - Relationship integrity (e.g., ensuring both sides of a relation are defined).
- **Output:** A validated AST.

### 3.2. The Intermediate Representation (IR)

The IR is the single source of truth for the code generators. It's a normalized, in-memory representation of the entire application, decoupled from the DSL syntax.

- **Structure:** A collection of TypeScript interfaces or classes.

  ```typescript
  // Example IR interfaces
  interface IREntity {
    name: string;
    fields: IRField[];
    relations: IRRelation[];
  }

  interface IRPage {
    name: string;
    type: 'table' | 'form';
    entity: IREntity;
    // ... and so on
  }

  interface IApp {
    entities: IREntity[];
    pages: IRPage[];
    config: IConfig;
  }
  ```

- **Benefits:**
  - **Decoupling:** Generators don't need to know about the DSL's syntax. If the DSL syntax changes, only the parser needs to be updated.
  - **Consistency:** All generators work from the same verified and structured data.
  - **Extensibility:** Plugins can operate on the IR, adding or modifying nodes before code generation.

### 3.3. The Code Generators

Generators are responsible for transforming the IR into source code and configuration files. Each generator is a separate module that targets a specific part of the stack.

- **Technology:** Template-based generation using tools like **EJS** or **Handlebars**, or direct string manipulation for more complex logic.

#### 3.3.1. Frontend Generator

- **Input:** `IRPage[]`, `IREntity[]`, `IApp['config']`
- **Output:** React/Next.js project (`/src/client`)
- **Responsibilities:**
  - Generate React components for each `page` (e.g., `UserTable.tsx`, `UserForm.tsx`).
  - **Conditional Auth Components:** If `config.auth.provider` is `clerk`, generate Clerk's pre-built UI components for sign-in and user profiles. Otherwise, generate standard forms.
  - **Inject Monitoring SDK:** If `config.integrations.monitoring` is defined, inject the Sentry SDK into the application's entry point.
  - Set up routing (e.g., `react-router-dom`).
  - Generate data-fetching hooks that call the backend API.
  - Configure the build system (Vite/Next.js) and CSS framework (Tailwind).

#### 3.3.2. Backend Generator

- **Input:** `IREntity[]`, `IRWorkflow[]`, `IApp['config']`
- **Output:** NestJS project (`/src/server`)
- **Responsibilities:**
  - Generate the **Prisma Schema** (`schema.prisma`) from the `IREntity` definitions.
  - Generate **NestJS Modules, Controllers, and Services** for each entity.
  - **Conditional Auth Strategy:** If `config.auth.provider` is `jwt`, generate JWT-based guards and services. If `clerk` or `auth0`, generate webhook handlers and services to sync users with the third-party provider.
  - **Inject Monitoring SDK:** If `config.integrations.monitoring` is defined, initialize the Sentry SDK in the main NestJS module.
  - Implement CRUD endpoints with validation pipes.
  - Set up authentication and authorization guards based on the `auth` config.
  - Generate workflow handlers.
  - Inject a registry of **Built-in Action Handlers** (e.g., for `sendEmail`). When the generator encounters a built-in action in a workflow, it wires it up to the corresponding SDK, pulling credentials from the IR's `config.integrations` node.

#### 3.3.3. Infrastructure Generator

- **Input:** `IApp` (for service discovery)
- **Output:** `docker-compose.yml`, `Dockerfile`, Helm charts (`/helm`)
- **Responsibilities:**
  - Create a `docker-compose.yml` for local development, networking the frontend, backend, and database (PostgreSQL/SQLite).
  - Generate `Dockerfile`s for production-ready frontend and backend images.
  - Scaffold a Helm chart for one-click deployment to Kubernetes.

## 4. The Plugin System

The plugin system allows for extending Stalmer1's functionality without modifying the core.

- **Lifecycle Hooks:** Plugins can register functions to run at specific points in the process:
  - `beforeParse(dsl: string): string` - Modify the raw DSL before parsing.
  - `afterParse(ir: IApp): IApp` - Modify the IR before generation.
  - `beforeWrite(files: Map<string, string>): Map<string, string>` - Modify the generated files before they are written to disk.
- **Custom Generators:** Plugins can register new generators to support different languages or frameworks (e.g., a Vue.js frontend generator).
- **Template Overrides:** Plugins can provide their own templates to override the default ones, allowing for fine-grained customization of the generated code.
