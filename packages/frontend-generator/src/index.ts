import { IApp } from '@stalmer1/core';
import ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import { generateUiComponents } from './components';

export async function generateFrontend(app: IApp, outDir: string) {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const pages = app.pages || [];
  const authProvider = app.config?.auth?.provider;
  const sentryDsn = app.config?.integrations?.monitoring?.dsn;
  // Authentication config properties
  const clerkPublishableKey = app.config?.auth?.props?.clerkPublishableKey;
  const auth0Domain = app.config?.auth?.props?.auth0Domain;
  const auth0ClientId = app.config?.auth?.props?.auth0ClientId;
  const backendPort = 4000; // Default port for backend
  
  // Create directory structure
  fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/components'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/components/tables'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/components/forms'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/components/details'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/hooks'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/styles'), { recursive: true });

  // Generate UI components
  generateUiComponents(outDir);

  // Generate the base HTML file
  const htmlTemplate = fs.readFileSync(path.join(templatesDir, 'index.html.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    ejs.render(htmlTemplate, { app })
  );
  
  // Generate Vite config
  const viteConfigTemplate = fs.readFileSync(path.join(templatesDir, 'vite.config.ts.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'vite.config.ts'),
    ejs.render(viteConfigTemplate, { backendPort })
  );
  
  // Generate package.json
  const packageJsonTemplate = fs.readFileSync(path.join(templatesDir, 'package.json.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    ejs.render(packageJsonTemplate, { app, authProvider, sentryDsn })
  );
  
  // Generate main.tsx
  const mainTemplate = fs.readFileSync(path.join(templatesDir, 'main.tsx.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/main.tsx'),
    ejs.render(mainTemplate, { authProvider, sentryDsn, clerkPublishableKey, auth0Domain, auth0ClientId })
  );
  
  // Copy the CSS
  const cssTemplate = fs.readFileSync(path.join(templatesDir, 'styles/index.css.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/styles/index.css'),
    cssTemplate
  );
  
  // Generate API service
  const apiTemplate = fs.readFileSync(path.join(templatesDir, 'api.ts.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/api.ts'),
    apiTemplate
  );
  
  // Generate Layout component
  const layoutTemplate = fs.readFileSync(path.join(templatesDir, 'components/Layout.tsx.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/components/Layout.tsx'),
    ejs.render(layoutTemplate, { app, pages, authProvider })
  );

  // Generate App.tsx
  const appTemplate = fs.readFileSync(path.join(templatesDir, 'App.tsx.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/App.tsx'),
    ejs.render(appTemplate, { pages, authProvider })
  );

  // Generate Table components
  const tableTemplate = fs.readFileSync(path.join(templatesDir, 'Table.tsx.ejs'), 'utf-8');
  const tablePages = pages.filter(p => p.type === 'table');
  
  if (tablePages.length > 0) {
    tablePages.forEach(page => {
      fs.writeFileSync(
        path.join(outDir, `src/components/tables/${page.name}Table.tsx`),
        ejs.render(tableTemplate, { pages: [page] })
      );
    });
  }

  // Generate Form components
  const formTemplate = fs.readFileSync(path.join(templatesDir, 'Form.tsx.ejs'), 'utf-8');
  const formPages = pages.filter(p => p.type === 'form');
  
  if (formPages.length > 0) {
    formPages.forEach(page => {
      fs.writeFileSync(
        path.join(outDir, `src/components/forms/${page.name}Form.tsx`),
        ejs.render(formTemplate, { pages: [page] })
      );
    });
  }

  // Generate Details components
  const detailsTemplate = fs.readFileSync(path.join(templatesDir, 'Details.tsx.ejs'), 'utf-8');
  const detailsPages = pages.filter(p => p.type === 'details');
  
  if (detailsPages.length > 0) {
    detailsPages.forEach(page => {
      fs.writeFileSync(
        path.join(outDir, `src/components/details/${page.name}Details.tsx`),
        ejs.render(detailsTemplate, { pages: [page] })
      );
    });
  }
  
  // Generate auth and monitoring setup files
  if (authProvider === 'clerk') {
    fs.writeFileSync(
      path.join(outDir, 'src/clerkConfig.ts'),
      `// Clerk configuration
export const clerkPubKey = '${clerkPublishableKey || 'pk_test_your-clerk-publishable-key'}';
      
// User roles and permissions
export const getUserRoles = (user) => {
  return user?.publicMetadata?.roles || [];
};

export const checkPermission = (user, requiredPermissions) => {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  const userRoles = getUserRoles(user);
  return requiredPermissions.some(perm => userRoles.includes(perm));
};`
    );
  } else if (authProvider === 'auth0') {
    fs.writeFileSync(
      path.join(outDir, 'src/auth0Config.ts'),
      `// Auth0 configuration
export const auth0Config = {
  domain: '${auth0Domain || 'your-domain.auth0.com'}',
  clientId: '${auth0ClientId || 'your-client-id'}',
  audience: 'https://api.example.com',
  redirectUri: window.location.origin,
};
      
// User roles and permissions
export const getUserRoles = (user) => {
  return user?.['https://example.com/roles'] || [];
};

export const checkPermission = (user, requiredPermissions) => {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  const userRoles = getUserRoles(user);
  return requiredPermissions.some(perm => userRoles.includes(perm));
};`
    );
  }
  
  // Sentry integration
  if (sentryDsn) {
    fs.writeFileSync(
      path.join(outDir, 'src/sentryConfig.ts'),
      `// Sentry integration
import * as Sentry from '@sentry/react';

export const initSentry = () => {
  Sentry.init({
    dsn: '${sentryDsn}',
    integrations: [
      new Sentry.BrowserTracing({
        tracePropagationTargets: ['localhost', /^https://yourserver.io/api/],
      }),
      new Sentry.Replay(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
};`
    );
  }
  
  // Generate TypeScript types for entities
  if (app.entities && app.entities.length > 0) {
    let typesContent = `// Generated TypeScript types for entities\n\n`;
    
    app.entities.forEach(entity => {
      typesContent += `export interface ${entity.name} {\n`;
      entity.fields.forEach(field => {
        const isOptional = field.optional ? '?' : '';
        let tsType = 'string';
        
        // Convert field types to TypeScript types
        switch(field.type.toLowerCase()) {
          case 'string':
          case 'text':
            tsType = 'string';
            break;
          case 'int':
          case 'integer':
          case 'number':
          case 'float':
          case 'decimal':
            tsType = 'number';
            break;
          case 'boolean':
            tsType = 'boolean';
            break;
          case 'date':
          case 'datetime':
            tsType = 'Date | string';
            break;
          case 'uuid':
            tsType = 'string';
            break;
          case 'json':
            tsType = 'Record<string, any>';
            break;
          default:
            // Probably a relation
            if (app.entities.some(e => e.name === field.type)) {
              tsType = field.type;
            }
        }
        
        typesContent += `  ${field.name}${isOptional}: ${tsType};\n`;
      });
      typesContent += `}\n\n`;
    });
    
    fs.writeFileSync(path.join(outDir, 'src/types.ts'), typesContent);
  }
}
