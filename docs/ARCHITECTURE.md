# Stalmer1 System Architecture

This document provides a detailed overview of the Stalmer1 system architecture, from DSL parsing to final code generation.

## 1. Core Philosophy

The architecture is designed around a unidirectional data flow:

```
DSL -> Parser -> Intermediate Representation (IR) -> Generators -> Final Code
```

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
        E --> H[React/Vite Code];
        F --> I[NestJS/Prisma Code];
        G --> J[Docker/Helm Files];
    end
```

## 3. Component Breakdown

### 3.1. The Parser

The Parser is responsible for transforming the raw DSL text into a structured, validated format.

- **Technology**: Custom recursive descent parser.
- **Process**:
    1. **Lexing**: The input `.dsl` file is scanned and broken down into a sequence of tokens.
    2. **Parsing**: The token stream is parsed to build an Abstract Syntax Tree (AST).
    3. **Validation**: The AST is traversed to perform semantic checks (e.g., type checking, relationship integrity).
- **Output**: A validated Intermediate Representation (IR).

### 3.2. The Intermediate Representation (IR)

The IR is the single source of truth for the code generators. It's a normalized, in-memory representation of the entire application, decoupled from the DSL syntax.

### 3.3. The Code Generators

Generators are responsible for transforming the IR into source code and configuration files.

- **Technology**: EJS (Embedded JavaScript templates).

#### 3.3.1. Frontend Generator

- **Input**: `IRPage[]`, `IREntity[]`, `IApp['config']`
- **Output**: React/Vite project
- **Responsibilities**:
  - Generate React components for each `page`.
  - Set up routing with `react-router-dom`.
  - Generate data-fetching hooks.

#### 3.3.2. Backend Generator

- **Input**: `IREntity[]`, `IRWorkflow[]`, `IApp['config']`
- **Output**: NestJS project
- **Responsibilities**:
  - Generate the Prisma schema.
  - Generate NestJS modules, controllers, and services.
  - Implement authentication and authorization.
  - Generate workflow handlers.

#### 3.3.3. Infrastructure Generator

- **Input**: `IApp`
- **Output**: `docker-compose.yml`, `Dockerfile`, Helm charts
- **Responsibilities**:
  - Create a `docker-compose.yml` for local development.
  - Generate `Dockerfile`s for production-ready images.
  - Scaffold a Helm chart for Kubernetes deployment.
