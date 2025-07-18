import * as fs from 'fs';
import * as path from 'path';
import { IApp } from '@stalmer1/core';

/**
 * Generates GitHub Actions workflow files for CI/CD
 * @param app - The application IR
 * @param outDir - The output directory for the generated files
 */
export function generateGitHubActions(app: IApp, outDir: string): void {
  const actionsDir = path.join(outDir, '.github', 'workflows');
  fs.mkdirSync(actionsDir, { recursive: true });
  
  // Determine database type
  const dbType = app.config?.db === 'postgresql' ? 'postgresql' : 'sqlite';
  
  // Determine if auth is configured
  const hasAuth = !!app.config?.auth?.provider;
  const authProvider = app.config?.auth?.provider;
  
  // Generate CI workflow
  const ciWorkflow = generateCIWorkflow(dbType, hasAuth, authProvider);
  fs.writeFileSync(path.join(actionsDir, 'ci.yml'), ciWorkflow);
  
  // Generate CD workflow
  const cdWorkflow = generateCDWorkflow(dbType);
  fs.writeFileSync(path.join(actionsDir, 'deploy.yml'), cdWorkflow);
}

/**
 * Generates a GitHub Actions CI workflow configuration
 * @param dbType - The database type (sqlite or postgresql)
 * @param hasAuth - Whether authentication is configured
 * @param authProvider - The auth provider (jwt, clerk, auth0)
 * @returns The workflow configuration as a string
 */
function generateCIWorkflow(
  dbType: string,
  hasAuth: boolean,
  authProvider?: string
): string {
  let workflow = `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16.x, 18.x]

    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
`;
  
  if (dbType === 'postgresql') {
    workflow += `
      - name: Start PostgreSQL
        uses: ikalnytskyi/action-setup-postgres@v4
        with:
          username: postgres
          password: postgres
          database: test
          port: 5432
`;
  }
  
  // Add auth-specific setup steps
  if (hasAuth) {
    if (authProvider === 'clerk') {
      workflow += `
      - name: Set up Clerk environment
        run: |
          echo "CLERK_PUBLISHABLE_KEY=\${{ secrets.CLERK_PUBLISHABLE_KEY }}" >> $GITHUB_ENV
          echo "CLERK_SECRET_KEY=\${{ secrets.CLERK_SECRET_KEY }}" >> $GITHUB_ENV
`;
    } else if (authProvider === 'auth0') {
      workflow += `
      - name: Set up Auth0 environment
        run: |
          echo "AUTH0_DOMAIN=\${{ secrets.AUTH0_DOMAIN }}" >> $GITHUB_ENV
          echo "AUTH0_CLIENT_ID=\${{ secrets.AUTH0_CLIENT_ID }}" >> $GITHUB_ENV
          echo "AUTH0_CLIENT_SECRET=\${{ secrets.AUTH0_CLIENT_SECRET }}" >> $GITHUB_ENV
`;
    }
  }
  
  // Add backend test step
  workflow += `
      - name: Run backend tests
        run: npm run test:backend
        env:
          NODE_ENV: test
`;

  if (dbType === 'postgresql') {
    workflow += `          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
`;
  }

  // Add frontend test step
  workflow += `
      - name: Run frontend tests
        run: npm run test:frontend

      - name: Run e2e tests
        run: npm run test:e2e
`;

  // Add code coverage reporting
  workflow += `
      - name: Upload coverage reports
        uses: coverallsapp/github-action@v2
        if: \${{ matrix.node-version == '18.x' }}
`;

  return workflow;
}

/**
 * Generates a GitHub Actions CD workflow configuration for deployment
 * @param dbType - The database type (sqlite or postgresql)
 * @returns The workflow configuration as a string
 */
function generateCDWorkflow(dbType: string): string {
  let workflow = `name: Deploy

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Use Node.js 18.x
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: \${{ secrets.DOCKER_USERNAME }}/stalmer1-app
          tags: |
            type=ref,event=branch
            type=ref,event=tag
            type=semver,pattern={{version}}
            type=sha,format=long
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v3
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;

  // Add deployment steps based on database type
  if (dbType === 'postgresql') {
    workflow += `
      # Example deployment to Kubernetes
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        if: startsWith(github.ref, 'refs/tags/v')
      
      - name: Set Kubernetes context
        uses: azure/k8s-set-context@v3
        if: startsWith(github.ref, 'refs/tags/v')
        with:
          kubeconfig: \${{ secrets.KUBE_CONFIG }}
      
      - name: Deploy to Kubernetes
        if: startsWith(github.ref, 'refs/tags/v')
        run: |
          helm upgrade --install stalmer1-app ./helm/stalmer1-app \\
            --set image.repository=\${{ secrets.DOCKER_USERNAME }}/stalmer1-app \\
            --set image.tag=\${{ steps.meta.outputs.version }} \\
            --set postgresql.auth.password=\${{ secrets.DB_PASSWORD }} \\
            --namespace stalmer1
`;
  } else {
    workflow += `
      # Example deployment to simple VPS
      - name: Deploy to server
        if: startsWith(github.ref, 'refs/tags/v')
        uses: appleboy/ssh-action@master
        with:
          host: \${{ secrets.SSH_HOST }}
          username: \${{ secrets.SSH_USERNAME }}
          key: \${{ secrets.SSH_KEY }}
          script: |
            cd /app/stalmer1
            docker-compose pull
            docker-compose up -d
`;
  }

  return workflow;
}
