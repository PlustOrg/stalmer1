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

export async function generateBackend(app: IApp, outDir: string, verbose: boolean = false) {
  // Get database type from app config or default to sqlite
  const dbType = app.config?.db === 'postgresql' ? 'postgresql' : 'sqlite';
  
  // Generate Prisma schema
  const prismaSchema = generatePrismaSchema(app.entities, dbType as 'sqlite' | 'postgresql');
  fs.mkdirSync(path.join(outDir, 'prisma'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'prisma/schema.prisma'), prismaSchema);

  // Generate NestJS modules, controllers, services
  const templatesDir = path.join(__dirname, '..', 'templates');
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

  for (const entity of entities) {
    const entityDir = path.join(outDir, 'src', entity.name.toLowerCase());
    fs.mkdirSync(entityDir, { recursive: true });

    const moduleContent = ejs.render(moduleTemplate, { entity });
    fs.writeFileSync(
      path.join(entityDir, `${entity.name.toLowerCase()}.module.ts`),
      moduleContent
    );
    if (verbose) console.log(`Generated ${entity.name.toLowerCase()}.module.ts`);

    const controllerContent = ejs.render(controllerTemplate, { entity, rbac, permissions, authProvider });
    fs.writeFileSync(
      path.join(entityDir, `${entity.name.toLowerCase()}.controller.ts`),
      controllerContent
    );
    if (verbose) console.log(`Generated ${entity.name.toLowerCase()}.controller.ts`);

    const serviceContent = ejs.render(serviceTemplate, { entity });
    fs.writeFileSync(
      path.join(entityDir, `${entity.name.toLowerCase()}.service.ts`),
      serviceContent
    );
    if (verbose) console.log(`Generated ${entity.name.toLowerCase()}.service.ts`);
  }
  
  // Generate auth services
  if (rbac) {
    fs.writeFileSync(
      path.join(outDir, 'src/rbac.guard.ts'), 
      ejs.render(rbacGuardTemplate, { authProvider })
    );
    if (verbose) console.log('Generated rbac.guard.ts');

    const authModuleDir = path.join(outDir, 'src/auth');
    fs.mkdirSync(authModuleDir, { recursive: true });

    const authModuleTemplate = fs.readFileSync(path.join(templatesDir, 'auth/auth.module.ejs'), 'utf-8');
    fs.writeFileSync(
      path.join(authModuleDir, 'auth.module.ts'),
      ejs.render(authModuleTemplate, { authProvider })
    );
    if (verbose) console.log('Generated auth.module.ts');

    if (authProvider === 'jwt') {
      const jwtAuthTemplate = fs.readFileSync(path.join(templatesDir, 'auth-jwt.ts.ejs'), 'utf-8');
      fs.writeFileSync(
        path.join(authModuleDir, 'jwt.strategy.ts'),
        ejs.render(jwtAuthTemplate)
      );
      if (verbose) console.log('Generated jwt.strategy.ts');
    } else if (authProvider === 'clerk') {
      const clerkAuthTemplate = fs.readFileSync(path.join(templatesDir, 'auth-clerk.ts.ejs'), 'utf-8');
      fs.writeFileSync(
        path.join(authModuleDir, 'clerk.strategy.ts'),
        ejs.render(clerkAuthTemplate)
      );
      if (verbose) console.log('Generated clerk.strategy.ts');
    } else if (authProvider === 'auth0') {
      const auth0AuthTemplate = fs.readFileSync(path.join(templatesDir, 'auth-auth0.ts.ejs'), 'utf-8');
      fs.writeFileSync(
        path.join(authModuleDir, 'auth0.strategy.ts'),
        ejs.render(auth0AuthTemplate)
      );
      if (verbose) console.log('Generated auth0.strategy.ts');
    }
  }

  // Generate main app module, controller, service
  const appModuleTemplate = fs.readFileSync(path.join(templatesDir, 'app.module.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/app.module.ts'),
    ejs.render(appModuleTemplate, { entities, authProvider, rbac, sentryDsn })
  );
  if (verbose) console.log('Generated app.module.ts');

  const appControllerTemplate = fs.readFileSync(path.join(templatesDir, 'app.controller.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/app.controller.ts'),
    ejs.render(appControllerTemplate)
  );
  if (verbose) console.log('Generated app.controller.ts');

  const appServiceTemplate = fs.readFileSync(path.join(templatesDir, 'app.service.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/app.service.ts'),
    ejs.render(appServiceTemplate)
  );
  if (verbose) console.log('Generated app.service.ts');

  // Generate main.ts
  const mainTemplate = fs.readFileSync(path.join(templatesDir, 'main.ts.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/main.ts'),
    ejs.render(mainTemplate, { sentryDsn })
  );
  if (verbose) console.log('Generated main.ts');

  // Generate Prisma module and service
  const prismaModuleTemplate = fs.readFileSync(path.join(templatesDir, 'prisma.module.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/prisma.module.ts'),
    ejs.render(prismaModuleTemplate)
  );
  if (verbose) console.log('Generated prisma.module.ts');

  const prismaServiceTemplate = fs.readFileSync(path.join(templatesDir, 'prisma.service.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/prisma.service.ts'),
    ejs.render(prismaServiceTemplate)
  );
  if (verbose) console.log('Generated prisma.service.ts');

  // Generate package.json
  const packageJsonTemplate = {
    "name": path.basename(outDir),
    "version": "0.1.0",
    "scripts": {
      "start": "node dist/main.js",
      "build": "tsc",
      "watch": "tsc -w",
      "test": "jest",
      "test:watch": "jest --watch",
      "test:cov": "jest --coverage",
      "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
      "test:e2e": "jest --config ./test/jest-e2e.json"
    },
    "dependencies": {
      "@nestjs/common": "^9.0.0",
      "@nestjs/core": "^9.0.0",
      "@nestjs/platform-express": "^9.0.0",
      "reflect-metadata": "^0.1.13",
      "rxjs": "^7.2.0",
      "@prisma/client": "4.15.0"
    },
    "devDependencies": {
      "@nestjs/testing": "^9.0.0",
      "jest": "^27.0.0",
      "ts-jest": "^27.0.0",
      "supertest": "^6.0.0",
      "prisma": "4.15.0",
      "@types/jest": "^27.0.0",
      "@types/supertest": "^2.0.0",
      "typescript": "^4.7.4",
      "ts-loader": "^9.2.3",
      "ts-node": "^10.0.0",
      "tsconfig-paths": "4.2.0"
    },
    "jest": {
      "moduleFileExtensions": [
        "js",
        "json",
        "ts"
      ],
      "rootDir": "src",
      "testRegex": ".*\\.spec\\.ts$",
      "transform": {
        "^.+\\.(t|j)s$": "ts-jest"
      },
      "collectCoverageFrom": [
        "**/*.(t|j)s"
      ],
      "coverageDirectory": "../coverage",
      "testEnvironment": "node"
    }
  };
  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(packageJsonTemplate, null, 2));
  if (verbose) console.log('Generated package.json');

  // Add auth dependencies
  if (authProvider === 'jwt') {
    addDependencyToPackageJson(outDir, '@nestjs/jwt', '^9.0.0');
    addDependencyToPackageJson(outDir, '@nestjs/passport', '^9.0.0');
    addDependencyToPackageJson(outDir, 'passport', '^0.6.0');
    addDependencyToPackageJson(outDir, 'passport-jwt', '^4.0.0');
    addDependencyToPackageJson(outDir, '@types/passport-jwt', '^3.0.6', true);
  } else if (authProvider === 'clerk') {
    addDependencyToPackageJson(outDir, '@clerk/clerk-sdk-node', '^4.0.0');
  } else if (authProvider === 'auth0') {
    addDependencyToPackageJson(outDir, 'passport-auth0', '^1.4.2');
    addDependencyToPackageJson(outDir, '@types/passport-auth0', '^1.0.5', true);
  }

  // Add Sentry dependency
  if (sentryDsn) {
    addDependencyToPackageJson(outDir, '@sentry/node', '^7.0.0');
    addDependencyToPackageJson(outDir, '@sentry/tracing', '^7.0.0');
  }

  // Add Prisma dev dependency
  addDependencyToPackageJson(outDir, 'prisma', '4.15.0', true);

  // Generate tsconfig.json
  const tsconfigTemplate = {
    "compilerOptions": {
      "module": "commonjs",
      "target": "es2017",
      "lib": [
        "es2017",
        "dom"
      ],
      "sourceMap": true,
      "outDir": "./dist",
      "baseUrl": "./",
      "incremental": true,
      "skipLibCheck": true,
      "strictNullChecks": false,
      "noImplicitAny": false,
      "strictBindCallApply": false,
      "forceConsistentCasingInFileNames": false,
      "noFallthroughCasesInSwitch": false,
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true,
      "useDefineForClassFields": false
    }
  };
  fs.writeFileSync(path.join(outDir, 'tsconfig.json'), JSON.stringify(tsconfigTemplate, null, 2));
  if (verbose) console.log('Generated tsconfig.json');
}
