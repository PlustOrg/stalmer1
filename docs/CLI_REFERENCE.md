# Stalmer1 CLI Reference

This document provides a comprehensive reference for the Stalmer1 Command-Line Interface (CLI).

## Global Options

- `--help`: Show help for a command.
- `--version`: Show the current Stalmer1 version.

---

## `stalmer1 init`

Initializes a new Stalmer1 project.

### Usage

```bash
stalmer1 init <project-name> [options]
```

### Arguments

- `<project-name>` (required): The name of the project.

### Options

- `--db <database>`: Specify the database to use (`sqlite` or `postgresql`). Defaults to `sqlite`.

---

## `stalmer1 generate`

Generates or updates the application source code from the `.dsl` files.

### Usage

```bash
stalmer1 generate [options]
```

### Options

- `--clean`: Perform a clean build, removing all existing generated files.
- `--skip-migrations`: Skip running database migrations after code generation.
- `--migrations-only`: Only run database migrations without generating code.

---

## `stalmer1 serve`

Starts the local development environment.

### Usage

```bash
stalmer1 serve [options]
```

### Options

- `--backend-only`: Start only the backend server.
- `--frontend-only`: Start only the frontend server.

---

## `stalmer1 test`

Runs the test suite for the generated application.

### Usage

```bash
stalmer1 test [options]
```

### Options

- `--watch`: Run tests in watch mode.
- `--coverage`: Generate a code coverage report.
- `--backend-only`: Only run the backend (NestJS/Jest) tests.
- `--frontend-only`: Only run the frontend (React/Vitest) tests.
- `--ci`: Run tests in CI mode (non-interactive).
- `--verbose`: Show verbose test output.

---

## `stalmer1 validate`

Validates EJS templates for compilation errors.

### Usage

```bash
stalmer1 validate
```