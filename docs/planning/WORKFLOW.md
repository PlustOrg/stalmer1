# Stalmer1 Developer & User Workflow

This document provides a comprehensive guide to the end-to-end workflow for building, customizing, and deploying an application with Stalmer1. It covers both the initial generation and the iterative development cycle.

## The Core Philosophy: "DSL as Source of Truth"

The primary workflow revolves around modifying the `.dsl` files and regenerating the codebase. The generated code is considered an artifact, not the primary source. You should avoid directly modifying generated files whenever possible, instead using the provided extension points.

--- 

## Phase 1: Project Initialization

### 1.1. Bootstrap the Project

Start by using the `stalmer1 init` command. This creates a new directory with the essential scaffolding.

```bash
# Create a new project named "inventory-system"
stalmer1 init inventory-system
cd inventory-system
```

See the [CLI Reference](CLI_REFERENCE.md#stalmer1-init) for more details.

### 1.2. Initial Directory Structure

The `init` command generates the following structure:

```
inventory-system/
├── stalmer1.json       # Project configuration
├── schema.dsl        # Main DSL file for your application
├── .gitignore
└── src/              # Generated code will go here (initially empty)
```

--- 

## Phase 2: Application Definition & Generation

### 2.1. Define Your Application in DSL

Open `schema.dsl` and define your entities, pages, and workflows. This is where you model your business requirements. You can also configure integrations like SendGrid for email notifications.

**Example `schema.dsl`:**
```dsl
config integrations {
  email: { provider: sendgrid, apiKey: env(SENDGRID_API_KEY) }
}

entity Product {
  id: UUID primaryKey
  name: String
  stock: Int default(0)
}

page ProductList {
  type: table
  entity: Product
  // ... (as defined in DSL_SPEC.md)
}

workflow NotifyOnRestock {
  trigger: { event: "product.updated" }
  steps: [
    {
      action: sendEmail,
      inputs: {
        template: "restock_alert",
        recipient: "ops@example.com",
        context: { productName: trigger.entity.name }
      }
    }
  ]
}
```

Refer to the [DSL Specification](DSL_SPEC.md) for detailed syntax, including the list of [Built-in Actions](DSL_SPEC.md#7-built-in-actions--integrations).

### 2.2. Generate the Codebase

Run the `stalmer1 generate` command. This command parses your DSL, builds the IR, and runs the code generators.

```bash
# Generate the full stack
stalmer1 generate
```

After running, the `src/` directory will be populated:

```
src/
├── client/         # React + Vite frontend
├── server/         # NestJS + Prisma backend
└── docker-compose.yml
```

### 2.3. Preview Your Application

Use the `stalmer1 serve` command to start the entire stack locally using Docker Compose.

```bash
# This command runs `docker-compose up` with hot-reloading
stalmer1 serve
```

Your application will be available at `http://localhost:3000` (or as configured).

--- 

## Phase 3: Iteration and Customization

This is the most common phase of the development lifecycle.

### 3.1. The Iteration Loop

1.  **Modify DSL:** Update `schema.dsl` to add a new field, page, or workflow.
2.  **Regenerate:** Run `stalmer1 generate` again. The generator is smart enough to update existing files without overwriting your custom code in designated areas.
3.  **Preview:** Your running `stalmer1 serve` instance will hot-reload, showing the changes instantly.

### 3.2. Adding Custom Code (The Right Way)

Stalmer1 is not a black box. It provides "escape hatches" for custom logic.

#### Custom Backend Logic

The generated NestJS services include placeholder methods for you to implement custom business logic.

**Example: `src/server/product/product.service.ts`**
```typescript
// This file is generated, but the method body is safe to edit.

@Injectable()
export class ProductService {
  // ... CRUD methods

  async restockProduct(id: string, quantity: number): Promise<Product> {
    // --- CUSTOM LOGIC START ---
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive.');
    }
    return this.prisma.product.update({
      where: { id },
      data: { stock: { increment: quantity } },
    });
    // --- CUSTOM LOGIC END ---
  }
}
```

#### Custom Frontend Components

For a `custom` page type, you can link to your own React components.

**DSL:**
```dsl
page CustomDashboard {
  type: custom
  component: "./components/CustomDashboard.tsx"
}
```

**Action:** Create `src/client/components/CustomDashboard.tsx` and build your UI.

--- 

## Phase 4: Testing and Deployment

### 4.1. Running Tests

Stalmer1 generates a full test suite for you.

```bash
# Runs Jest unit tests for the backend and Vitest for the frontend
stalmer1 test
```

### 4.2. Deploying the Application

Deployment is handled by the `stalmer1 deploy` command, which uses the generated infrastructure files.

#### Local/Self-Hosted Production

```bash
# Runs `docker-compose -f docker-compose.prod.yml up -d`
stalmer1 deploy --target docker
```

#### Kubernetes

```bash
# Applies the generated Helm chart to your configured cluster
stalmer1 deploy --target kubernetes
```

For more details on commands and flags, see the [CLI Reference](CLI_REFERENCE.md).