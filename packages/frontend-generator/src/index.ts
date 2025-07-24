import { IApp } from '@stalmer1/core';
import ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import { generateUiComponents } from './components';

export async function generateFrontend(app: IApp, outDir: string, verbose: boolean = false) {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const pages = app.pages || [];
  const authProvider = app.config?.auth?.provider;
  const sentryDsn = app.config?.integrations?.monitoring?.dsn;
  // Authentication config properties
  const clerkPublishableKey = app.config?.auth?.props?.clerkPublishableKey;
  const auth0Domain = app.config?.auth?.props?.auth0Domain;
  const auth0ClientId = app.config?.auth?.props?.auth0ClientId;
  const backendPort = 4000; // Default port for backend
  
  const hydratedPages = pages.map(page => ({
    ...page,
    entity: app.entities.find(e => e.name === page.entity)
  }));
  
  // Create directory structure
  fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/components'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/components/tables'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/components/forms'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/components/details'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/hooks'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'src/styles'), { recursive: true });

  // Generate UI components
  if (verbose) console.log('Generating UI components...');
  generateUiComponents(outDir);

  // Generate the base HTML file
  const htmlTemplate = fs.readFileSync(path.join(templatesDir, 'index.html.ejs'), 'utf-8');
  const htmlContent = ejs.render(htmlTemplate, { app });
  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    htmlContent
  );
  if (verbose) console.log('Generated index.html');
  
  // Generate Vite config
  const viteConfigTemplate = fs.readFileSync(path.join(templatesDir, 'vite.config.ts.ejs'), 'utf-8');
  const viteConfigContent = ejs.render(viteConfigTemplate, { backendPort });
  fs.writeFileSync(
    path.join(outDir, 'vite.config.ts'),
    viteConfigContent
  );
  if (verbose) console.log('Generated vite.config.ts');
  
  // Generate package.json
  const packageJsonTemplate = fs.readFileSync(path.join(templatesDir, 'package.json.ejs'), 'utf-8');
  const packageJsonContent = ejs.render(packageJsonTemplate, { app, authProvider, sentryDsn });
  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    packageJsonContent
  );
  if (verbose) console.log('Generated package.json');
  
  // Generate main.tsx
  const mainTemplate = fs.readFileSync(path.join(templatesDir, 'main.tsx.ejs'), 'utf-8');
  const mainContent = ejs.render(mainTemplate, { authProvider, sentryDsn, clerkPublishableKey, auth0Domain, auth0ClientId });
  fs.writeFileSync(
    path.join(outDir, 'src/main.tsx'),
    mainContent
  );
  if (verbose) console.log('Generated src/main.tsx');
  
  // Copy the CSS
  const cssTemplate = fs.readFileSync(path.join(templatesDir, 'styles/index.css.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/styles/index.css'),
    cssTemplate
  );
  if (verbose) console.log('Generated src/styles/index.css');
  
  // Generate API service
  const apiTemplate = fs.readFileSync(path.join(templatesDir, 'api.ts.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/api.ts'),
    apiTemplate
  );
  if (verbose) console.log('Generated src/api.ts');
  
  // Generate Layout component
  const layoutTemplate = fs.readFileSync(path.join(templatesDir, 'components/Layout.tsx.ejs'), 'utf-8');
  const layoutContent = ejs.render(layoutTemplate, { app, pages: hydratedPages, authProvider });
  fs.writeFileSync(
    path.join(outDir, 'src/components/Layout.tsx'),
    layoutContent
  );
  if (verbose) console.log('Generated src/components/Layout.tsx');

  // Generate App.tsx
  const appTemplate = fs.readFileSync(path.join(templatesDir, 'App.tsx.ejs'), 'utf-8');
  const appContent = ejs.render(appTemplate, { pages: hydratedPages, authProvider });
  fs.writeFileSync(
    path.join(outDir, 'src/App.tsx'),
    appContent
  );
  if (verbose) console.log('Generated src/App.tsx');

  // Generate Table components
  const tableTemplate = fs.readFileSync(path.join(templatesDir, 'Table.tsx.ejs'), 'utf-8');
  const tablePages = hydratedPages.filter(p => p.type === 'table');
  
  if (tablePages.length > 0) {
    tablePages.forEach(page => {
      const tableContent = ejs.render(tableTemplate, { page: page });
      fs.writeFileSync(
        path.join(outDir, `src/components/tables/${page.name}Table.tsx`),
        tableContent
      );
      if (verbose) console.log(`Generated src/components/tables/${page.name}Table.tsx`);
    });
  }

  // Generate Form components
  const formTemplate = fs.readFileSync(path.join(templatesDir, 'Form.tsx.ejs'), 'utf-8');
  const formPages = hydratedPages.filter(p => p.type === 'form');
  
  if (formPages.length > 0) {
    formPages.forEach(page => {
      const formContent = ejs.render(formTemplate, { page: page });
      fs.writeFileSync(
        path.join(outDir, `src/components/forms/${page.name}Form.tsx`),
        formContent
      );
      if (verbose) console.log(`Generated src/components/forms/${page.name}Form.tsx`);
    });
  }

  // Generate Details components
  const detailsTemplate = fs.readFileSync(path.join(templatesDir, 'Details.tsx.ejs'), 'utf-8');
  const detailsPages = hydratedPages.filter(p => p.type === 'details');
  
  if (detailsPages.length > 0) {
    detailsPages.forEach(page => {
      const detailsContent = ejs.render(detailsTemplate, { page: page });
      fs.writeFileSync(
        path.join(outDir, `src/components/details/${page.name}Details.tsx`),
        detailsContent
      );
      if (verbose) console.log(`Generated src/components/details/${page.name}Details.tsx`);
    });
  }

  // Generate auth hooks
  if (authProvider === 'jwt') {
    const useAuthTemplate = fs.readFileSync(path.join(templatesDir, 'hooks/useAuth.ejs'), 'utf-8');
    fs.writeFileSync(
      path.join(outDir, 'src/hooks/useAuth.ts'),
      ejs.render(useAuthTemplate)
    );
    if (verbose) console.log('Generated src/hooks/useAuth.ts');
  }

  // Generate lib/utils.ts
  const utilsTemplate = fs.readFileSync(path.join(templatesDir, 'lib/utils.ts.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'src/lib/utils.ts'),
    ejs.render(utilsTemplate)
  );
  if (verbose) console.log('Generated src/lib/utils.ts');

  // Generate Dockerfile
  const dockerfileTemplate = fs.readFileSync(path.join(templatesDir, 'Dockerfile.ejs'), 'utf-8');
  fs.writeFileSync(
    path.join(outDir, 'Dockerfile'),
    ejs.render(dockerfileTemplate)
  );
  if (verbose) console.log('Generated Dockerfile');
}
