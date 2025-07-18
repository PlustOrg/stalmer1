# Stalmer1

[![Tests](https://github.com/yourusername/stalmer1/actions/workflows/test.yml/badge.svg)](https://github.com/yourusername/stalmer1/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/stalmer1.svg)](https://www.npmjs.com/package/stalmer1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Stalmer1: DSL-driven full-stack web-app generator.

Stalmer1 is a powerful tool that lets you describe your application in a simple domain-specific language (DSL) and automatically generates a complete full-stack application with frontend, backend, database, authentication, and more.

## Features

- **Simple DSL**: Define your entities, pages, and workflows in a simple, expressive language
- **Full-Stack Generation**: Generates both frontend (React) and backend (NestJS) code
- **Database Integration**: Automatic schema generation and migrations with Prisma
- **Authentication**: Built-in support for JWT, Clerk, and Auth0
- **Role-Based Access Control**: Define permissions for different user roles
- **Workflows**: Define event-driven workflows for business processes
- **Docker Integration**: Ready-to-use Docker and docker-compose files
- **CI/CD**: GitHub Actions workflow generation

## Installation

```bash
# Install globally
npm install -g stalmer1

# Or use with npx
npx stalmer1 --help
```

## Quick Start

```bash
# Create a new project
stalmer1 init my-app

# Generate code from DSL
cd my-app
stalmer1 generate

# Start the application
stalmer1 serve
```

## DSL Example

```
entity User {
  id: UUID primaryKey
  email: String unique
  password: Password
  role: UserRole default(VIEWER)
}

enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

page UserList {
  type: table
  entity: User
  route: "/users"
  permissions: [ADMIN, EDITOR]
}

config auth {
  provider: jwt
  userEntity: User
}
```

## CLI Reference

### `stalmer1 init [name]`

Creates a new Stalmer1 project in a new directory.

### `stalmer1 generate`

Generates code from DSL files in the current project.

### `stalmer1 serve`

Starts both the frontend and backend servers.

### `stalmer1 test`

Runs tests for the generated application.

## Documentation

For more detailed documentation, please visit the [official documentation](https://github.com/yourusername/stalmer1/tree/main/docs).

## License

MIT © [Stalmer1 Contributors]
