import { IApp } from '@stalmer1/core';
import ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';

export async function generateFrontend(app: IApp, outDir: string) {
  const templatesDir = path.join(__dirname, 'templates');
  const pages = app.pages;
  const authProvider = app.config?.auth?.provider;
  const sentryDsn = app.config?.integrations?.monitoring?.dsn;

  // Table
  const tableTemplate = fs.readFileSync(path.join(templatesDir, 'Table.tsx.ejs'), 'utf-8');
  fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'src/Table.tsx'),
    ejs.render(tableTemplate, { pages })
  );

  // Form
  const formTemplate = fs.readFileSync(path.join(templatesDir, 'Form.tsx.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/Form.tsx'),
    ejs.render(formTemplate, { pages })
  );

  // Details
  const detailsTemplate = fs.readFileSync(path.join(templatesDir, 'Details.tsx.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/Details.tsx'),
    ejs.render(detailsTemplate, { pages })
  );

  // App
  const appTemplate = fs.readFileSync(path.join(templatesDir, 'App.tsx.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/App.tsx'),
    ejs.render(appTemplate, { pages, authProvider, sentryDsn })
  );

  // Auth integration (Clerk/Auth0)
  if (authProvider === 'clerk') {
    const clerkCode = `// Clerk integration\nimport { ClerkProvider } from '@clerk/clerk-react';\n// ...wrap your App in <ClerkProvider>...</ClerkProvider>`;
    fs.writeFileSync(path.join(outDir, 'src/ClerkIntegration.tsx'), clerkCode);
  } else if (authProvider === 'auth0') {
    const auth0Code = `// Auth0 integration\nimport { Auth0Provider } from '@auth0/auth0-react';\n// ...wrap your App in <Auth0Provider>...</Auth0Provider>`;
    fs.writeFileSync(path.join(outDir, 'src/Auth0Integration.tsx'), auth0Code);
  }
  // Sentry integration
  if (sentryDsn) {
    const sentryCode = `// Sentry integration\nimport * as Sentry from '@sentry/react';\nSentry.init({ dsn: '${sentryDsn}' });`;
    fs.writeFileSync(path.join(outDir, 'src/sentry.ts'), sentryCode);
  }
}
