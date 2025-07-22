# Stalmer1 Development Roadmap

This document outlines the development roadmap for Stalmer1. It reflects the current state of the project and our plans for future releases.

## Completed Features (v1.0)

The following features have been implemented and are available in the current version of Stalmer1:

- **Core DSL**: A stable DSL for defining entities, pages, and relationships.
- **Code Generation**: Full-stack code generation for React (Vite) and NestJS (Prisma).
- **Database Support**: Support for both SQLite and PostgreSQL.
- **Authentication**: Built-in support for JWT, Clerk, and Auth0.
- **Database Migrations**: Automatic database migrations with Prisma.
- **Workflows**: Event-driven workflows for business logic.
- **Docker Integration**: Automatic generation of Dockerfiles and docker-compose files.
- **CI/CD**: Generation of GitHub Actions workflows for testing and deployment.

## Future Plans (v2.0 and Beyond)

Our future plans are focused on increasing the flexibility and power of Stalmer1, with a focus on extensibility and developer experience.

### Extensibility

- **Plugin System**: Introduce a plugin system that allows developers to extend Stalmer1 with custom functionality, such as new generators, custom DSL blocks, and more.
- **Template Overrides**: Allow users to provide their own templates to override the default generated code, enabling greater customization.

### Advanced Features

- **Additional Page Types**: Add support for more complex page types, such as wizards, dashboards, and charts.
- **Additional Data Types**: Introduce new data types for common use cases, such as `Image`, `File`, and `RichText`.
- **More Integrations**: Expand the library of built-in integrations for popular services like Stripe for payments and Twilio for SMS.

### Developer Experience

- **Visual DSL Editor**: Create a web-based visual editor for the Stalmer1 DSL, making it even easier to design and build applications.
- **AI-Powered Scaffolding**: Explore the use of AI to generate initial DSL schemas from natural language descriptions.
