import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { parseDSL, IApp } from '@stalmer1/core';

/**
 * This test suite validates that all EJS templates can be compiled without errors
 * by parsing a DSL file to provide realistic test data.
 */

const templatesDir = path.join(__dirname, '../../templates');
const dslFilePath = path.join(__dirname, 'test-app.dsl');

// Read DSL content from file
const dslContent = fs.readFileSync(dslFilePath, 'utf-8');

// Parse DSL to generate app data for template testing
let parsedApp: IApp;
try {
  parsedApp = parseDSL(dslContent);
} catch (error) {
  console.error('Error parsing DSL file:', error);
  throw error;
}

// Add additional template variables that may not be in the DSL
// but are needed for template rendering
const mockData = {
  // App data from DSL
  app: parsedApp,
  
  // Page data - use the first page with a table type
  page: parsedApp.pages.find(p => p.type === 'table') || {
    name: 'TestPage',
    type: 'table',
    route: '/test-page',
    permissions: ['ADMIN', 'USER'],
    entity: parsedApp.entities.find(e => e.name === 'TestEntity')
  },
  
  // Collection of pages from DSL
  pages: parsedApp.pages,
  
  // Authentication related
  authProvider: parsedApp.config?.auth?.provider || 'jwt',
  clerkPublishableKey: parsedApp.config?.auth?.props?.clerkPublishableKey || 'test-key',
  auth0Domain: parsedApp.config?.auth?.props?.auth0Domain || 'test.auth0.com',
  auth0ClientId: parsedApp.config?.auth?.props?.auth0ClientId || 'test-client-id',
  sentryDsn: parsedApp.config?.integrations?.monitoring?.dsn || 'test-dsn',
  backendPort: 4000
};

/**
 * Helper function to get all EJS files in a directory and its subdirectories
 */
function getAllEjsFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recurse into subdirectory
      results = results.concat(getAllEjsFiles(filePath));
    } else if (path.extname(file) === '.ejs') {
      results.push(filePath);
    }
  });
  
  return results;
}

describe('EJS Template Validation', () => {
  // Get all EJS template files
  const templateFiles = getAllEjsFiles(templatesDir);
  
  // Create a test for each template file
  templateFiles.forEach(templateFile => {
    const relativePath = path.relative(templatesDir, templateFile);
    
    it(`should compile ${relativePath} without errors`, () => {
      const template = fs.readFileSync(templateFile, 'utf-8');
      
      // Prepare data for template rendering
      let templateData: any = { ...mockData };
      
      // Add specific mock data based on the template file
      if (templateFile.includes('Table.tsx.ejs')) {
        const tablePage = mockData.pages.find(p => p.type === 'table');
        if (tablePage) {
          const entity = parsedApp.entities.find(e => e.name === tablePage.entity);
          templateData = { ...mockData, page: { ...tablePage, entity } };
        }
      } else if (templateFile.includes('Form.tsx.ejs')) {
        const formPage = mockData.pages.find(p => p.type === 'form');
        if (formPage) {
          const entity = parsedApp.entities.find(e => e.name === formPage.entity);
          templateData = { ...mockData, page: { ...formPage, entity } };
        }
      } else if (templateFile.includes('Details.tsx.ejs')) {
        const detailsPage = mockData.pages.find(p => p.type === 'details');
        if (detailsPage) {
          const entity = parsedApp.entities.find(e => e.name === detailsPage.entity);
          templateData = { ...mockData, page: { ...detailsPage, entity } };
        }
      }
      
      // Test that the template can be compiled
      expect(() => {
        ejs.render(template, templateData);
      }).not.toThrow();
    });
  });
});

/**
 * Test that template combinations work together
 */
describe('Template Integration Tests', () => {
  // Add this utility function to help debug specific template issues
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function testSpecificTemplate(templatePath: string, data: any = mockData) {
    const fullPath = path.join(templatesDir, templatePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Template file not found: ${fullPath}`);
    }
    
    const template = fs.readFileSync(fullPath, 'utf-8');
    try {
      const result = ejs.render(template, data);
      return result; // Return the rendered template for inspection
    } catch (error) {
      console.error(`Error rendering template ${templatePath}:`, error);
      throw error;
    }
  }
  
  it('should generate Table components correctly', () => {
    const tableTemplate = fs.readFileSync(path.join(templatesDir, 'Table.tsx.ejs'), 'utf-8');
    const tablePages = mockData.pages.filter(p => p.type === 'table');
    
    tablePages.forEach(page => {
      const entity = parsedApp.entities.find(e => e.name === page.entity);
      expect(() => {
        ejs.render(tableTemplate, { ...mockData, page: { ...page, entity } });
      }).not.toThrow();
    });
  });
  
  it('should generate Form components correctly', () => {
    const formTemplate = fs.readFileSync(path.join(templatesDir, 'Form.tsx.ejs'), 'utf-8');
    const formPages = mockData.pages.filter(p => p.type === 'form');
    
    formPages.forEach(page => {
      const entity = parsedApp.entities.find(e => e.name === page.entity);
      expect(() => {
        ejs.render(formTemplate, { ...mockData, page: { ...page, entity } });
      }).not.toThrow();
    });
  });
  
  it('should generate Details components correctly', () => {
    const detailsTemplate = fs.readFileSync(path.join(templatesDir, 'Details.tsx.ejs'), 'utf-8');
    const detailsPages = mockData.pages.filter(p => p.type === 'details');
    
    detailsPages.forEach(page => {
      const entity = parsedApp.entities.find(e => e.name === page.entity);
      expect(() => {
        ejs.render(detailsTemplate, { ...mockData, page: { ...page, entity } });
      }).not.toThrow();
    });
  });

  it('should generate App.tsx correctly', () => {
    const appTemplate = fs.readFileSync(path.join(templatesDir, 'App.tsx.ejs'), 'utf-8');
    expect(() => {
      ejs.render(appTemplate, { pages: mockData.pages, authProvider: mockData.authProvider });
    }).not.toThrow();
  });

  it('should generate API service correctly', () => {
    const apiTemplate = fs.readFileSync(path.join(templatesDir, 'api.ts.ejs'), 'utf-8');
    expect(() => {
      ejs.render(apiTemplate);
    }).not.toThrow();
  });

  it('should generate component templates correctly', () => {
    const componentsDirPath = path.join(templatesDir, 'components');
    if (fs.existsSync(componentsDirPath)) {
      const componentFiles = getAllEjsFiles(componentsDirPath);
      componentFiles.forEach(file => {
        const template = fs.readFileSync(file, 'utf-8');
        expect(() => {
          ejs.render(template, mockData);
        }).not.toThrow(`Component template ${path.basename(file)} should compile without errors`);
      });
    }
  });

  it('should generate UI component templates correctly', () => {
    const uiDirPath = path.join(templatesDir, 'components/ui');
    if (fs.existsSync(uiDirPath)) {
      const uiFiles = getAllEjsFiles(uiDirPath);
      uiFiles.forEach(file => {
        const template = fs.readFileSync(file, 'utf-8');
        expect(() => {
          ejs.render(template, mockData);
        }).not.toThrow(`UI component template ${path.basename(file)} should compile without errors`);
      });
    }
  });
});
