# Stalmer1 Implementation Plan

This document provides a detailed, step-by-step plan for building the Stalmer1 project. It is designed to be a living document, tracked by the development team from project inception to completion. All steps are grounded in the established specification documents.

## Phase 0: Project Setup & Foundation

**Goal:** Prepare the development environment for the Stalmer1 tool itself.

1. **Initialize Monorepo & Core Tooling:**
    * [x] Initialize a new Git repository.
    * [x] Set up a Node.js/TypeScript project (`npm init -y`, `tsc --init`).
    * [x] Install and configure Prettier, ESLint, and Jest for code quality and testing.
    * [x] Create a root `package.json` and set up workspaces (e.g., using npm, yarn, or pnpm) to manage future packages (e.g., `packages/cli`, `packages/core`).

2. **Establish CLI Entrypoint:**
    * [x] Create the initial CLI package (`packages/cli`).
    * [x] Choose and install a CLI framework (e.g., `oclif` or `commander.js`).
    * [x] Implement the main `stalmer1` command that can parse global options like `--help` and `--version` as defined in `CLI_REFERENCE.md`.

---

## Phase 1: MVP - The Core Generator (4-6 Weeks)

**Goal:** Implement the core functionality to generate a basic, working CRUD application from a DSL file.

1. **Parser & Intermediate Representation (IR):**
    * [x] **Technology Selection:** Choose a parsing library. Given the YAML-like syntax, a library like `chevrotain` or a custom recursive descent parser is suitable. Avoids the heavy setup of ANTLR for this syntax.
    * [x] **IR Definition:** In a `packages/core` module, define the TypeScript interfaces for the entire IR (`IApp`, `IREntity`, `IRPage`, etc.) as specified in `ARCHITECTURE.md#3.2`.
    * [x] **DSL Parsing:** Implement the parser to read a `.dsl` file and transform it into a validated IR object.
        * It must parse `entity` blocks with fields, types, and relations (`DSL_SPEC.md#3`).
        * It must parse `page` blocks (`table`, `form`, `details`) with their properties (`DSL_SPEC.md#4`).
    * [x] **Validation:** The parser must perform semantic validation (e.g., check that a page's entity exists, field types are valid, etc.).

2. **CLI Command Foundation:**
    * [x] **`stalmer1 init`:** Implement the `init` command as per `CLI_REFERENCE.md`. It should create a new directory with a default `schema.dsl` and `stalmer1.json`.
    * [x] **`stalmer1 generate` (stub):** Implement a basic `generate` command that runs the parser and prints the resulting IR to the console for verification.

3. **Backend Generator (NestJS + Prisma):**
    * [x] **Templating Engine:** Choose and configure a templating engine like EJS.
    * [x] **Prisma Schema Generation:** Create a generator function that takes `IREntity[]` and produces a valid `schema.prisma` file content.
    * [x] **NestJS Templates:** Create EJS templates for:
        * `*.module.ts`
        * `*.controller.ts` (with CRUD endpoints)
        * `*.service.ts` (with Prisma client calls)
    * [x] **Generator Logic:** Implement the main backend generator that iterates over `IR.entities` and uses the templates to generate the full directory structure for the NestJS server.

4. **Frontend Generator (React + Vite):**
    * [x] **React Templates:** Create EJS templates for:
        * A `Table.tsx` component.
        * A `Form.tsx` component.
        * A `Details.tsx` component.
        * A main `App.tsx` containing `react-router-dom` setup.
    * [x] **Generator Logic:** Implement the frontend generator that:
        * Iterates over `IR.pages` and generates the corresponding page components.
        * Generates the router configuration based on the `route` property of each page.
        * Generates basic data-fetching hooks.

5. **Infrastructure & Finalization:**
    * [x] **Docker Generator:** Create templates for `Dockerfile`s and a `docker-compose.yml` for local development (SQLite).
    * [x] **Update `stalmer1 generate`:** Enhance the command to execute all generators and write the complete file tree to the user's `src/` directory.
    * [x] **Implement `stalmer1 serve`:** Implement the `serve` command to run `docker-compose up` in the generated project.

---

## Phase 1.5: MVP Hardening & Feature Completion

**Goal:** Address all missing or incomplete features from Phase 1 to ensure a robust, working MVP.

1. **Parser Implementation:**
    * [x] Implement the actual DSL parser to transform a `.dsl` file into a valid IR object, supporting all syntax in the DSL spec.

2. **TypeScript Monorepo Configuration:**
    * [x] Configure TypeScript path aliases and build tooling so that all `@stalmer1/*` imports resolve correctly across packages.
    * [x] Add build scripts to build/link all packages for local development.

3. **Backend CRUD Logic:**
    * [x] Update NestJS controller and service EJS templates to generate real CRUD endpoints and Prisma client calls.

4. **Frontend Data Fetching & Routing:**
    * [x] Implement data fetching hooks in the frontend generator.
    * [x] Generate router configuration in `App.tsx` based on the `route` property of each page.

5. **Type Declarations & Linting:**
    * [x] Install and configure `@types/ejs` for proper TypeScript support.
    * [x] Add or update type declarations for any other missing types.

6. **Error Handling & Validation:**
    * [x] Add error handling and validation in CLI and generator logic for missing files, invalid IR, or template errors.

7. **Testing:**
    * [x] Add tests for the parser, generators, and CLI commands to ensure correctness.

---

## Phase 2: v1.0 - Production Readiness (+4 Weeks)

**Goal:** Add features that make the generated applications robust, secure, and deployable.

1. **Database Migrations & PostgreSQL:**
    * [x] **Update `init` command:** Add the `--db` flag logic as per `CLI_REFERENCE.md`.
    * [x] **Update Docker Generator:** Conditionally generate a `postgres` service in `docker-compose.yml` if selected.
    * [x] **Update `generate` command:** After generating the `schema.prisma` file, the command should automatically execute `npx prisma migrate dev` to create and apply a migration.

2. **Tier 1 Integrations:**
    * [x] **Parser:** Update the parser to handle the `config auth` and `config integrations` blocks (`DSL_SPEC.md#6`).
    * [x] **Auth (Clerk/Auth0):**
        * In the Frontend Generator, add conditional logic to generate Clerk/Auth0 components if the `provider` is set.
        * In the Backend Generator, add logic to use the appropriate JWT validation strategy based on the provider.
    * [x] **Monitoring (Sentry):**
        * In both Frontend and Backend generators, add logic to inject the Sentry SDK initialization code if `config.integrations.monitoring` is present.
    * [x] **Email (SendGrid) & Workflows:**
        * Implement the `workflow` parser.
        * In the Backend Generator, create a registry for "Built-in Actions".
        * Implement the `sendEmail` action handler, which uses the SendGrid SDK and credentials from the IR.

3. **Built-in JWT & RBAC:**
    * [x] **Generator Logic:** Implement the code generation for the `jwt` provider option, including login/signup services and controllers.
    * [x] **Guards:** The Backend Generator must parse the `permissions` array on pages and apply the generated RBAC guards to the NestJS controllers.

4. **CI/CD & Testing:**
    * [x] **GitHub Actions Generator:** Create a template for a basic CI workflow (`.github/workflows/ci.yml`) that runs `npm install`, `lint`, and `test`.
    * [x] **Implement `stalmer1 test`:** Implement the `test` command to run Jest/Vitest in the generated project.

---

## Phase 3: v2.0 & Beyond - Extensibility

**Goal:** Evolve the tool from a generator into a true platform.

1. **Plugin System:**
    * [ ] **API Design:** Design the plugin API, including the lifecycle hooks (`afterParse`, `beforeWrite`, etc.) as defined in `ARCHITECTURE.md#4`.
    * [ ] **Plugin Loader:** Implement the logic in the CLI to discover, load, and execute registered plugins.

2. **Template Overrides:**
    * [ ] Implement a mechanism that allows the generator to check for a user-provided template in a specific directory and use it in place of the default one.

3. **Advanced Features:**
    * [ ] Implement the remaining "Future Considerations" from `DSL_SPEC.md`, such as `wizard` pages, `Image` data types, and more built-in actions.
