# Stalmer1 CLI Reference

This document provides a comprehensive reference for the Stalmer1 Command-Line Interface (CLI). All commands are run via the main `stalmer1` executable.

## Global Options

These flags can be used with any command.

- `--help`: Show help for a command.
- `--verbose`: Enable verbose logging for debugging.
- `--version`: Show the current Stalmer1 version.

---

## `stalmer1 init`

Initializes a new Stalmer1 project in a new directory.

### Usage

```bash
stalmer1 init <project-name> [options]
```

### Arguments

- `<project-name>` (required): The name of the project. A directory with this name will be created.

### Options

- `--template <url>`: Use a custom project template from a Git repository URL.
- `--db <database>`: Specify the database to use. Defaults to `sqlite`.
  - Allowed values: `sqlite`, `postgresql`.
- `--frontend <framework>`: Specify the frontend framework to use. Defaults to `react`.
  - Allowed values: `react`, `nextjs`.

### Example

```bash
# Create a new project with PostgreSQL and Next.js
stalmer1 init my-crm --db postgresql --frontend nextjs
```

---

## `stalmer1 generate`

Generates or updates the application source code from the `.dsl` files.

### Usage

```bash
stalmer1 generate [options]
```

### Options

- `--watch`: Watch the DSL files for changes and regenerate automatically.
- `--clean`: Perform a clean build, removing all existing generated files in the `src` directory before generation. Useful for resolving conflicts or applying major updates.
- `--dry-run`: Run the generator without writing any files to disk. Outputs a list of files that would be created or modified.

### Details

This is the core command of Stalmer1. It reads `schema.dsl`, parses it, builds the IR, and then invokes the registered code generators. It is designed to be idempotent and safe to run multiple times.

---

## `stalmer1 serve`

Starts the full local development environment.

### Usage

```bash
stalmer1 serve [options]
```

### Options

- `--port <port>`: The port to expose the frontend on. Defaults to `3000`.
- `--no-watch`: Disable hot-reloading for both frontend and backend.

### Details

This command is a wrapper around `docker-compose up`. It reads the `docker-compose.yml` file in the `src` directory and starts all services, including the database, backend API, and frontend development server.

---

## `stalmer1 test`

Runs the entire test suite for the generated application.

### Usage

```bash
stalmer1 test [options]
```

### Options

- `--watch`: Run tests in watch mode, re-running them when files change.
- `--coverage`: Generate a code coverage report.
- `--backend-only`: Only run the backend (NestJS/Jest) tests.
- `--frontend-only`: Only run the frontend (React/Vitest) tests.

### Details

Stalmer1 generates a complete test suite, including:

- **Backend:** Unit tests for services and e2e tests for controllers (using Jest and Supertest).
- **Frontend:** Unit tests for components and hooks (using Vitest and React Testing Library).

---

## `stalmer1 deploy`

Deploys the application to a specified target.

### Usage

```bash
stalmer1 deploy [options]
```

### Options

- `--target <target>` (required): The deployment environment.
  - `docker`: Deploys the application using `docker-compose` in production mode.
  - `kubernetes`: Deploys the application to a Kubernetes cluster using the generated Helm chart.
- `--kubeconfig <path>`: Path to the kubeconfig file to use (for `kubernetes` target).
- `--namespace <ns>`: The Kubernetes namespace to deploy to (for `kubernetes` target).

### Details

This command orchestrates the deployment process based on the generated infrastructure-as-code files. It handles building production Docker images, pushing them to a registry (if configured), and applying the necessary configurations.
