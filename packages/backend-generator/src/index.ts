import * as ejs from 'ejs';
import { IApp, IRPage } from '@stalmer1/core';
import { generatePrismaSchema } from './prisma';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Adds a dependency to package.json
 * @param outDir - The output directory
 * @param packageName - The name of the package to add
 * @param version - The version of the package
 * @param isDev - Whether the package is a dev dependency
 */
function addDependencyToPackageJson(outDir: string, packageName: string, version: string, isDev: boolean = false): void {
  const packageJsonPath = path.join(outDir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    // Create a basic package.json if it doesn't exist
    const basicPackage = {
      name: path.basename(outDir),
      version: '0.1.0',
      dependencies: {},
      devDependencies: {}
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(basicPackage, null, 2));
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  if (isDev) {
    packageJson.devDependencies = packageJson.devDependencies || {};
    packageJson.devDependencies[packageName] = version;
  } else {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies[packageName] = version;
  }
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

// Re-export generateDockerFiles function
export { generateDockerFiles } from './docker';

export async function generateBackend(app: IApp, outDir: string) {
  // Get database type from app config or default to sqlite
  const dbType = app.config?.db === 'postgresql' ? 'postgresql' : 'sqlite';
  
  // Generate Prisma schema
  const prismaSchema = generatePrismaSchema(app.entities, dbType as 'sqlite' | 'postgresql');
  fs.mkdirSync(path.join(outDir, 'prisma'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'prisma/schema.prisma'), prismaSchema);

  // Generate NestJS modules, controllers, services
  const templatesDir = path.join(__dirname, 'templates');
  const entities = app.entities;
  const authProvider = app.config?.auth?.provider;
  const sentryDsn = app.config?.integrations?.monitoring?.dsn;
  const rbac = !!(app.pages && app.pages.some((p: IRPage) => p.permissions));
  // Build permissions map for controllers
  const permissions: Record<string, Record<string, string[]>> = {};
  if (app.pages) {
    for (const page of app.pages) {
      if (page.permissions && page.entity) {
        permissions[page.entity] = permissions[page.entity] || {};
        // Map page type to CRUD
        if (page.type === 'table' || page.type === 'details') permissions[page.entity].find = page.permissions;
        if (page.type === 'form') permissions[page.entity].create = page.permissions;
      }
    }
  }
  const moduleTemplate = fs.readFileSync(path.join(templatesDir, 'module.ejs'), 'utf-8');
  const controllerTemplate = fs.readFileSync(path.join(templatesDir, 'controller.ejs'), 'utf-8');
  const serviceTemplate = fs.readFileSync(path.join(templatesDir, 'service.ejs'), 'utf-8');
  const rbacGuardTemplate = fs.readFileSync(path.join(templatesDir, 'rbac.guard.ejs'), 'utf-8');

  fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'src/modules.ts'),
    ejs.render(moduleTemplate, { entities })
  );
  fs.writeFileSync(
    path.join(outDir, 'src/controllers.ts'),
    ejs.render(controllerTemplate, { entities, rbac, permissions, authProvider })
  );
  fs.writeFileSync(
    path.join(outDir, 'src/services.ts'),
    ejs.render(serviceTemplate, { entities })
  );
  
  // Generate auth services
  if (rbac) {
    fs.writeFileSync(
      path.join(outDir, 'src/rbac.guard.ts'), 
      ejs.render(rbacGuardTemplate, { authProvider })
    );
  }
  
  // Auth strategy implementation
  if (authProvider === 'clerk') {
    const clerkAuthTemplate = fs.readFileSync(path.join(templatesDir, 'auth-clerk.ts.ejs'), 'utf-8');
    fs.writeFileSync(
      path.join(outDir, 'src/auth.clerk.ts'), 
      clerkAuthTemplate
    );
    
    // Add clerk SDK to package.json
    addDependencyToPackageJson(outDir, '@clerk/clerk-sdk-node', '^4.10.0');
  } else if (authProvider === 'auth0') {
    const auth0AuthTemplate = fs.readFileSync(path.join(templatesDir, 'auth-auth0.ts.ejs'), 'utf-8');
    fs.writeFileSync(
      path.join(outDir, 'src/auth.auth0.ts'), 
      auth0AuthTemplate
    );
    
    // Add auth0 dependencies to package.json
    addDependencyToPackageJson(outDir, 'jsonwebtoken', '^9.0.0');
    addDependencyToPackageJson(outDir, 'jwks-rsa', '^3.0.1');
  } else if (authProvider === 'jwt') {
    const jwtAuthTemplate = fs.readFileSync(path.join(templatesDir, 'auth-jwt.ts.ejs'), 'utf-8');
    fs.writeFileSync(
      path.join(outDir, 'src/auth.jwt.ts'),
      jwtAuthTemplate
    );
    
    // Add JWT dependencies to package.json
    addDependencyToPackageJson(outDir, '@nestjs/jwt', '^10.0.0');
    addDependencyToPackageJson(outDir, 'bcrypt', '^5.1.0');
    addDependencyToPackageJson(outDir, '@types/bcrypt', '^5.0.0', true);
  }
  // Sentry integration
  if (sentryDsn) {
    const sentryCode = `// Sentry integration\nimport * as Sentry from '@sentry/node';\nSentry.init({ dsn: '${sentryDsn}' });`;
    fs.writeFileSync(path.join(outDir, 'src/sentry.ts'), sentryCode);
  }
  // SendGrid integration and workflow registry
  if (app.config?.integrations?.email?.provider === 'sendgrid') {
    const sendgridCode = `// SendGrid integration\nimport sgMail from '@sendgrid/mail';\nsgMail.setApiKey(process.env.SENDGRID_API_KEY!);\nexport async function sendEmail({ to, subject, text, html }: any) {\n  await sgMail.send({ to, from: '${app.config.integrations.email.defaultFrom}', subject, text, html });\n}`;
    fs.writeFileSync(path.join(outDir, 'src/sendgrid.ts'), sendgridCode);
  }
  // Workflow registry
  if (app.workflows && app.workflows.length > 0) {
    let registry = `// Workflow Registry\n`;
    registry += `const builtInActions = {\n`;
    if (app.config?.integrations?.email?.provider === 'sendgrid') {
      registry += `  sendEmail: require('./sendgrid').sendEmail,\n`;
    }
    // Add more built-in actions as needed
    registry += `};\n`;
    registry += `\nexport async function executeWorkflow(name, context) {\n`;
    registry += `  // This is a simple dispatcher. In production, add error handling, async steps, etc.\n`;
    registry += `  const wf = workflows.find(w => w.name === name);\n`;
    registry += `  if (!wf) throw new Error('Workflow not found: ' + name);\n`;
    registry += `  for (const step of wf.steps || []) {\n`;
    registry += `    const action = builtInActions[step.action];\n`;
    registry += `    if (action) await action(step.inputs);\n`;
    registry += `    // TODO: Add support for custom/user actions\n`;
    registry += `  }\n`;
    registry += `}\n`;
    registry += `\nexport const workflows = ${JSON.stringify(app.workflows, null, 2)};\n`;
    fs.writeFileSync(path.join(outDir, 'src/workflow.registry.ts'), registry);
  }
}
