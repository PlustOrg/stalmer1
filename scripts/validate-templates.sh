#!/bin/bash

# Template validation script
# This script compiles all EJS templates to ensure they don't have syntax errors
# or reference undefined variables

set -e # Exit on error

echo "Validating EJS templates..."

# Check for required npm packages
if ! command -v npx &> /dev/null; then
    echo "Error: npx is required but not installed. Please install Node.js."
    exit 1
fi

# Find all template directories
TEMPLATE_DIRS=(
  "packages/frontend-generator/templates"
  "packages/backend-generator/templates"
)

# Create temp directory for test files
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Create a test file for template validation
cat > "$TEMP_DIR/template-validator.js" <<EOL
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

// Mock data for template variables
const mockData = {
  app: {
    name: 'Test App',
    config: {
      auth: {
        provider: 'jwt',
        props: {
          clerkPublishableKey: 'test-key',
          auth0Domain: 'test.auth0.com',
          auth0ClientId: 'test-client-id'
        }
      },
      integrations: {
        monitoring: {
          dsn: 'test-dsn'
        }
      }
    }
  },
  page: {
    name: 'TestPage',
    type: 'table',
    route: '/test-page',
    permissions: ['ADMIN', 'USER'],
    entity: {
      name: 'TestEntity',
      fields: [
        { name: 'id', type: 'UUID', isPrimaryKey: true },
        { name: 'name', type: 'String' },
        { name: 'email', type: 'String', isUnique: true },
        { name: 'password', type: 'Password', isPassword: true },
        { name: 'createdAt', type: 'DateTime' }
      ]
    }
  },
  pages: [
    {
      name: 'User',
      type: 'table',
      route: '/users',
      permissions: ['ADMIN'],
      entity: {
        name: 'User',
        fields: [
          { name: 'id', type: 'UUID', isPrimaryKey: true },
          { name: 'name', type: 'String' },
          { name: 'email', type: 'String', isUnique: true }
        ]
      }
    },
    {
      name: 'Post',
      type: 'form',
      route: '/posts',
      permissions: ['ADMIN', 'EDITOR'],
      entity: {
        name: 'Post',
        fields: [
          { name: 'id', type: 'UUID', isPrimaryKey: true },
          { name: 'title', type: 'String' },
          { name: 'content', type: 'Text' }
        ]
      }
    }
  ],
  authProvider: 'jwt',
  clerkPublishableKey: 'test-key',
  auth0Domain: 'test.auth0.com',
  auth0ClientId: 'test-client-id',
  sentryDsn: 'test-dsn',
  backendPort: 4000
};

// Get the directory to scan from command line args
const dir = process.argv[2];
if (!dir) {
  console.error('Please specify a directory to scan');
  process.exit(1);
}

// Helper function to get all EJS files in a directory and its subdirectories
function getAllEjsFiles(dir) {
  let results = [];
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

// Get all EJS template files
const templateFiles = getAllEjsFiles(dir);
console.log(\`Found \${templateFiles.length} EJS templates in \${dir}\`);

// Validate each template
let hasErrors = false;
templateFiles.forEach(templateFile => {
  const relativePath = path.relative(dir, templateFile);
  process.stdout.write(\`Validating \${relativePath}... \`);
  
  try {
    const template = fs.readFileSync(templateFile, 'utf-8');
    
    // Prepare custom data based on template file name
    let templateData = { ...mockData };
    
    if (templateFile.includes('Table.tsx.ejs') || templateFile.endsWith('/table.tsx.ejs')) {
      const tablePage = mockData.pages.find(p => p.type === 'table');
      if (tablePage) templateData = { page: tablePage };
    } else if (templateFile.includes('Form.tsx.ejs')) {
      const formPage = mockData.pages.find(p => p.type === 'form');
      if (formPage) templateData = { page: formPage };
    } else if (templateFile.includes('Details.tsx.ejs')) {
      const detailsPage = mockData.pages.find(p => p.type === 'form');
      if (detailsPage) templateData = { page: detailsPage };
    }
    
    // Test compile the template
    ejs.render(template, templateData);
    console.log('\x1b[32mOK\x1b[0m');
  } catch (error) {
    console.log('\x1b[31mFAILED\x1b[0m');
    console.error(\`  Error in \${relativePath}: \${error.message}\`);
    hasErrors = true;
  }
});

if (hasErrors) {
  console.error('\nTemplate validation failed!');
  process.exit(1);
} else {
  console.log('\nAll templates validated successfully!');
}
EOL

# Install ejs temporarily if needed
if ! npm list -g ejs &> /dev/null; then
  echo "Installing EJS temporarily..."
  npm install --no-save ejs
fi

# Validate templates in all directories
let HAS_ERRORS=0
for dir in "${TEMPLATE_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Checking templates in $dir..."
    node "$TEMP_DIR/template-validator.js" "$dir"
    if [ $? -ne 0 ]; then
      HAS_ERRORS=1
    fi
  else
    echo "Warning: Directory $dir not found, skipping."
  fi
done

if [ $HAS_ERRORS -eq 1 ]; then
  echo "Template validation failed!"
  exit 1
else
  echo "All templates passed validation!"
fi
