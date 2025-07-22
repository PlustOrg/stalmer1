# Getting Started with Stalmer1

This guide will walk you through the process of creating, running, and deploying a complete full-stack application with Stalmer1.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or later)
- [Docker](https://www.docker.com/)

## Step 1: Install Stalmer1

Install the Stalmer1 CLI globally using npm:

```bash
npm install -g stalmer1
```

## Step 2: Initialize a New Project

Create a new project using the `stalmer1 init` command:

```bash
stalmer1 init my-app
cd my-app
```

This will create a new directory called `my-app` with the following files:

- `schema.dsl`: The main DSL file where you will define your application.
- `stalmer1.json`: Project configuration.

## Step 3: Define Your Application

Open the `schema.dsl` file and define your application's data models and pages. For this example, we'll create a simple blog:

```dsl
entity User {
  id: UUID primaryKey
  email: String unique
  password: Password
}

entity Post {
  id: UUID primaryKey
  title: String
  content: Text
  author: User @relation(name: "UserPosts")
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

## Step 4: Generate the Code

Now, generate the application code using the `stalmer1 generate` command:

```bash
stalmer1 generate
```

This will create a `src` directory containing the complete frontend and backend code for your application.

## Step 5: Run the Application

Start the application using the `stalmer1 serve` command:

```bash
stalmer1 serve
```

This will start the development server, and you can view your application at `http://localhost:3000`.

## Step 6: Deploy the Application

Stalmer1 makes deployment easy. To deploy your application using Docker, simply run:

```bash
stalmer1 deploy --target docker
```

This will create a production-ready Docker image and run it.
