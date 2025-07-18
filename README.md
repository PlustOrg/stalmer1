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
cd my-app

# Edit the schema.dsl file to define your application

# Generate your application
stalmer1 generate

# Run your application locally
stalmer1 serve
```

## DSL Example

```
entity User {
  id: UUID primaryKey
  email: String unique
  password: Password
  role: String default("USER")
}

entity Post {
  id: UUID primaryKey
  title: String
  content: Text
  author: User @relation(name: "UserPosts")
  published: Boolean default(false)
  createdAt: DateTime default(now())
}

page UserList {
  type: table
  entity: User
  route: "/users"
  permissions: ["ADMIN"]
}

page PostList {
  type: table
  entity: Post
  route: "/posts"
}

page PostForm {
  type: form
  entity: Post
  route: "/posts/new"
}
```

## CLI Commands

- `stalmer1 init [name]` - Initialize a new project
- `stalmer1 generate` - Generate application code from DSL
- `stalmer1 serve` - Start the generated application locally
- `stalmer1 test` - Run tests for the generated application

For more information, see the [CLI Reference](docs/CLI_REFERENCE.md).

## Documentation

For more detailed documentation, please refer to:

- [DSL Specification](docs/DSL_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Workflow](docs/WORKFLOW.md)
- [CLI Reference](docs/CLI_REFERENCE.md)
- [Roadmap](docs/ROADMAP.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
