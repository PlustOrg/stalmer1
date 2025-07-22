# Stalmer1 Development Roadmap

This document outlines the planned features and development timeline for Stalmer1. The roadmap is a living document and may be adjusted based on community feedback and technical discoveries.

## Guiding Principles

- **Phase 1 (MVP & v1.0):** Focus on core generation, stability, and a seamless local development experience.
- **Phase 2 (v2.0):** Prioritize extensibility, customization, and production-readiness for cloud deployments.
- **Phase 3 (Future):** Explore AI-driven development and features that lower the barrier to entry for non-developers.

---

## Phase 1: Core Functionality (Now - 2 Months)

### Milestone: MVP (Target: 4-6 Weeks)

**Goal:** Prove the core concept with a generator for basic CRUD applications.

| Deliverable                      | Description                                                                                             | Acceptance Criteria                                                                    |
|----------------------------------|---------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| **DSL Grammar v0.1**             | Define syntax for entities (with relationships) and simple `table`/`form` pages.                        | Parser can successfully validate a moderately complex DSL file with 10+ entities.      |
| **Core Parser & IR**             | Implement the parser and a stable Intermediate Representation (IR).                                     | `stalmer1 generate` runs without errors, producing a valid IR.                           |
| **Frontend Generator (React)**   | Generate a functional React + Vite application with basic components.                                   | Generated UI can list, create, edit, and delete records from the backend.              |
| **Backend Generator (NestJS)**   | Generate a NestJS backend with CRUD services and controllers.                                           | API endpoints are fully functional and documented with Swagger.                        |
| **Database (SQLite)**            | Use SQLite as the default, zero-configuration database for easy setup.                                  | Data persists correctly across application restarts.                                   |
| **Local Dev (`docker-compose`)** | Provide a `docker-compose.yml` for a one-command local development environment.                         | `stalmer1 serve` successfully starts the frontend, backend, and DB.                      |

### Milestone: v1.0 (Target: +4 Weeks)

**Goal:** Make the generated applications robust and production-ready for simple use cases.

| Deliverable                      | Description                                                                                             | Acceptance Criteria                                                                    |
|----------------------------------|---------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| **Database Migrations**          | Integrate `prisma migrate` for schema evolution.                                                        | `stalmer1 generate` creates a new migration when the DSL `entity` definition changes.    |
| **PostgreSQL Support**           | Add PostgreSQL as a first-class, production-ready database option.                                      | Users can select PostgreSQL during `stalmer1 init`.                                      |
| **Tier 1 Integrations**          | Implement core integrations for Auth (`clerk`), Email (`sendgrid`), and Monitoring (`sentry`).          | A generated app can be configured to use Clerk for login and Sentry for error tracking.|
| **Role-Based Auth (RBAC)**       | Implement JWT-based authentication and role-based access control via NestJS guards.                     | DSL `permissions` on pages correctly lock down UI and API access.                      |
| **CI/CD Pipeline (GitHub Actions)** | Generate a default GitHub Actions workflow for `test`, `lint`, and `build`.                               | Pushing to a repo with a generated app automatically runs the CI pipeline.             |
| **Helm Chart Skeleton**          | Generate a basic Helm chart for Kubernetes deployment.                                                  | `stalmer1 deploy --target kubernetes` can deploy a simple app to a Minikube cluster.     |

---

## Phase 2: Extensibility & Advanced Features (2-6 Months)

### Milestone: v2.0 (Target: +6-8 Weeks)

**Goal:** Empower developers to customize and extend the generated code for complex, real-world applications.

| Deliverable                      | Description                                                                                             | Acceptance Criteria                                                                    |
|----------------------------------|---------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| **Plugin System API**            | Define and implement the core plugin API (hooks, custom generators).                                    | A developer can create a simple plugin that modifies the IR before code generation.    |
| **Template Overrides**           | Allow users to provide their own template files to override the default generated components.           | A user can replace the default `table` component with a custom one.                    |
| **Advanced Workflows**           | Implement the `workflow` DSL block for defining multi-step business logic (e.g., approvals, notifications). | A generated workflow can be triggered and execute a series of actions.                 |
| **Next.js SSR Support**          | Add Next.js as an alternative frontend generator for SEO-friendly, server-side rendered applications.   | A user can choose `nextjs` during `stalmer1 init` and get a fully functional SSR app.    |

---

## Phase 3: The Future (6-18 Months)

**Goal:** Redefine the application development experience with AI and visual tools.

| Vision                           | Description                                                                                             | Potential Features                                                                     |
|----------------------------------|---------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| **AI-Powered DSL Generation**    | Use Large Language Models (LLMs) to translate natural language prompts into Stalmer1 DSL.                 | `stalmer1 generate --from-prompt "Create an app to track job applications"`              |
| **Visual DSL Editor**            | A web-based, drag-and-drop interface that generates the DSL, making it accessible to non-developers.    | A product manager can visually design a data model and UI, which writes to `schema.dsl`. |
| **One-Click Self-Hosting**       | Create a simple, downloadable installer that sets up a production-ready, self-hosted Stalmer1 instance.   | An `install.sh` script that provisions a VM with Docker, Caddy (for TLS), and the app. |
| **Expanded Generator Ecosystem** | Foster a community of developers building and sharing generators for different stacks (e.g., Vue, Svelte, Go, Python). | A public registry for Stalmer1 plugins and generators.                                   |