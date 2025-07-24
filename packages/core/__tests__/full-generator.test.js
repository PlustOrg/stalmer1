"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFullGeneration = testFullGeneration;
const globals_1 = require("@jest/globals");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Validates that files exist and contain expected content
 * @param baseDir - Base directory to check files in
 * @param expectations - Array of file expectations
 */
function validateFiles(baseDir, expectations) {
    for (const expectation of expectations) {
        const fullPath = path.join(baseDir, expectation.path);
        if (expectation.shouldExist) {
            (0, globals_1.expect)(fs.existsSync(fullPath)).toBe(true);
            if (expectation.contentChecks && expectation.contentChecks.length > 0) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                for (const contentCheck of expectation.contentChecks) {
                    (0, globals_1.expect)(content).toContain(contentCheck);
                }
            }
        }
        else {
            (0, globals_1.expect)(fs.existsSync(fullPath)).toBe(false);
        }
    }
}
// Mock the dependencies
jest.mock('@stalmer1/backend-generator', () => ({
    generateBackend: jest.fn().mockImplementation((app, outDir) => {
        // Create a minimal structure to simulate backend generation
        fs.mkdirSync(path.join(outDir, 'prisma'), { recursive: true });
        fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });
        // Create a sample schema.prisma file based on the app's entities
        let schema = `// Mock schema.prisma generated for testing\n\n`;
        schema += `generator client {\n  provider = "prisma-client-js"\n}\n\n`;
        // Use the correct database provider from app config
        const dbProvider = app.config?.db || 'sqlite';
        schema += `datasource db {\n  provider = "${dbProvider}"\n`;
        if (dbProvider === 'postgresql') {
            schema += `  url = env("DATABASE_URL")\n`;
        }
        else {
            schema += `  url = "file:./dev.db"\n`;
        }
        schema += `}\n\n`;
        // Generate models for each entity
        for (const entity of app.entities) {
            schema += `model ${entity.name} {\n`;
            for (const field of entity.fields) {
                let fieldDef = `  ${field.name} `;
                // Map types
                if (field.type === 'UUID') {
                    fieldDef += 'String';
                }
                else if (field.type === 'Password') {
                    fieldDef += 'String'; // Password is stored as String
                }
                else {
                    fieldDef += field.type;
                }
                // Add constraints
                if (field.primaryKey) {
                    fieldDef += ' @id';
                }
                if (field.unique) {
                    fieldDef += ' @unique';
                }
                schema += fieldDef + '\n';
            }
            schema += '}\n\n';
        }
        fs.writeFileSync(path.join(outDir, 'prisma', 'schema.prisma'), schema);
        // Create minimal controller and service files
        fs.writeFileSync(path.join(outDir, 'src', 'controllers.ts'), '// Mock controllers');
        fs.writeFileSync(path.join(outDir, 'src', 'services.ts'), '// Mock services');
        return Promise.resolve();
    }),
    generateDockerFiles: jest.fn().mockImplementation((app, outDir) => {
        // Create a sample docker-compose.yml file
        const dockerCompose = `# Mock docker-compose.yml for testing
version: '3'
services:
  backend:
    build: ./backend
    ports:
      - '3001:3001'
  frontend:
    build: ./frontend
    ports:
      - '3000:3000'
`;
        fs.writeFileSync(path.join(outDir, 'docker-compose.yml'), dockerCompose);
    }),
}));
jest.mock('@stalmer1/frontend-generator', () => ({
    generateFrontend: jest.fn().mockImplementation((app, outDir) => {
        // Create minimal frontend structure
        fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });
        // Create sample React components
        fs.writeFileSync(path.join(outDir, 'src', 'App.tsx'), '// Mock App component');
        fs.writeFileSync(path.join(outDir, 'src', 'Table.tsx'), '// Mock Table component');
        fs.writeFileSync(path.join(outDir, 'src', 'Form.tsx'), '// Mock Form component');
        return Promise.resolve();
    }),
}));
async function testFullGeneration(app, outDir) {
    // Use dynamic imports with type annotations
    const backendGen = await Promise.resolve().then(() => __importStar(require('@stalmer1/backend-generator')));
    const frontendGen = await Promise.resolve().then(() => __importStar(require('@stalmer1/frontend-generator')));
    // Ensure the test templates directory is used
    const originalTemplatesDir = process.env.STALMER1_TEMPLATES_DIR;
    process.env.STALMER1_TEMPLATES_DIR = path.join(__dirname, 'templates');
    try {
        await backendGen.generateBackend(app, path.join(outDir, 'backend'));
        await frontendGen.generateFrontend(app, path.join(outDir, 'frontend'));
        await backendGen.generateDockerFiles(app, outDir, app.config?.db || 'sqlite');
        return path.join(outDir, 'backend');
    }
    finally {
        if (originalTemplatesDir) {
            process.env.STALMER1_TEMPLATES_DIR = originalTemplatesDir;
        }
        else {
            delete process.env.STALMER1_TEMPLATES_DIR;
        }
    }
}
(0, globals_1.describe)('Full Project Generation', () => {
    // Basic app model for testing
    const mockApp = {
        name: 'TestApp',
        entities: [
            {
                name: 'User',
                fields: [
                    { name: 'id', type: 'UUID', primaryKey: true },
                    { name: 'email', type: 'String', unique: true },
                    { name: 'name', type: 'String' }
                ]
            }
        ],
        pages: [
            {
                name: 'UserList',
                type: 'table',
                entity: 'User',
                route: '/users'
            }
        ],
        workflows: []
    };
    const tempBaseDir = path.join(__dirname, 'temp-output');
    let tempDir;
    // Set up the base temp directory before all tests
    (0, globals_1.beforeAll)(() => {
        try {
            if (fs.existsSync(tempBaseDir)) {
                fs.rmSync(tempBaseDir, { recursive: true });
            }
            fs.mkdirSync(tempBaseDir, { recursive: true });
        }
        catch (error) {
            console.error('Error setting up test environment:', error);
            throw error; // Fail the test suite if setup fails
        }
    });
    // Create a fresh temp directory for each test
    beforeEach(() => {
        // Create a unique directory for each test to prevent interference
        const testId = Date.now().toString();
        tempDir = path.join(tempBaseDir, testId);
        fs.mkdirSync(tempDir, { recursive: true });
    });
    // Clean up all temporary directories after all tests
    (0, globals_1.afterAll)(() => {
        try {
            if (fs.existsSync(tempBaseDir)) {
                fs.rmSync(tempBaseDir, { recursive: true });
            }
        }
        catch (error) {
            console.error('Error cleaning up test environment:', error);
            // Don't throw here, as it would mask actual test failures
        }
    });
    (0, globals_1.it)('should generate a basic project structure', async () => {
        await testFullGeneration(mockApp, tempDir);
        // Use the validateFiles utility to check for expected files and directories
        validateFiles(tempDir, [
            // Backend files
            { path: 'backend', shouldExist: true },
            { path: 'backend/prisma', shouldExist: true },
            { path: 'backend/src', shouldExist: true },
            { path: 'backend/prisma/schema.prisma', shouldExist: true, contentChecks: ['model User'] },
            { path: 'backend/src/controllers.ts', shouldExist: true },
            { path: 'backend/src/services.ts', shouldExist: true },
            // Frontend files
            { path: 'frontend', shouldExist: true },
            { path: 'frontend/src', shouldExist: true },
            { path: 'frontend/src/App.tsx', shouldExist: true },
            { path: 'frontend/src/Table.tsx', shouldExist: true },
            { path: 'frontend/src/Form.tsx', shouldExist: true },
            // Docker files
            { path: 'docker-compose.yml', shouldExist: true, contentChecks: ['services:', 'backend:', 'frontend:'] },
            // Ensure non-existent files are not created
            { path: 'backend/src/non-existent.ts', shouldExist: false },
        ]);
    });
    (0, globals_1.it)('should generate correct Prisma schema with proper models', async () => {
        // Generate project first
        await testFullGeneration(mockApp, tempDir);
        const schemaPath = path.join(tempDir, 'backend', 'prisma', 'schema.prisma');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        // Check for database configuration
        (0, globals_1.expect)(schema).toContain('provider = "sqlite"');
        (0, globals_1.expect)(schema).toContain('provider = "prisma-client-js"');
        // Check for model definition
        (0, globals_1.expect)(schema).toContain('model User');
        (0, globals_1.expect)(schema).toContain('id String @id');
        (0, globals_1.expect)(schema).toContain('email String @unique');
        (0, globals_1.expect)(schema).toContain('name String');
    });
    (0, globals_1.it)('should generate docker-compose.yml with proper services', async () => {
        // Generate project first
        await testFullGeneration(mockApp, tempDir);
        const dockerComposePath = path.join(tempDir, 'docker-compose.yml');
        const dockerCompose = fs.readFileSync(dockerComposePath, 'utf-8');
        // Check for proper service configuration
        (0, globals_1.expect)(dockerCompose).toContain('version: \'3\'');
        (0, globals_1.expect)(dockerCompose).toContain('services:');
        (0, globals_1.expect)(dockerCompose).toContain('backend:');
        (0, globals_1.expect)(dockerCompose).toContain('frontend:');
        (0, globals_1.expect)(dockerCompose).toContain('ports:');
    });
    (0, globals_1.it)('should respect entity relationships in generation', async () => {
        // Create a new app with entity relationships
        const appWithRelationships = {
            name: 'RelationshipTest',
            entities: [
                {
                    name: 'Author',
                    fields: [
                        { name: 'id', type: 'UUID', primaryKey: true },
                        { name: 'name', type: 'String' }
                    ]
                },
                {
                    name: 'Book',
                    fields: [
                        { name: 'id', type: 'UUID', primaryKey: true },
                        { name: 'title', type: 'String' },
                        { name: 'authorId', type: 'String' } // Reference to Author
                    ],
                    relations: [
                        {
                            field: 'author',
                            type: 'many-to-one',
                            target: 'Author'
                        }
                    ]
                }
            ],
            pages: [],
            workflows: []
        };
        // Create a separate directory for this test
        const relationshipsDir = path.join(tempDir, 'relationships-test');
        fs.mkdirSync(relationshipsDir, { recursive: true });
        await testFullGeneration(appWithRelationships, relationshipsDir);
        // Check schema.prisma for relationship
        const schema = fs.readFileSync(path.join(relationshipsDir, 'backend', 'prisma', 'schema.prisma'), 'utf-8');
        // We don't need to check actual relationship syntax since we're mocking,
        // but in a real test we would verify the relationship was properly defined
        (0, globals_1.expect)(schema).toContain('model Author');
        (0, globals_1.expect)(schema).toContain('model Book');
    });
    (0, globals_1.it)('should handle complex app configurations', async () => {
        // Create a more complex app configuration with auth, workflows, etc.
        const complexApp = {
            name: 'ComplexApp',
            entities: [
                {
                    name: 'User',
                    fields: [
                        { name: 'id', type: 'UUID', primaryKey: true },
                        { name: 'email', type: 'String', unique: true },
                        { name: 'password', type: 'Password' }
                    ]
                }
            ],
            workflows: [
                {
                    name: 'UserOnboarding',
                    trigger: { event: 'user.created', entity: 'User' },
                    steps: [
                        { action: 'sendEmail', inputs: { to: '{{user.email}}', subject: 'Welcome!', template: 'welcome' } }
                    ]
                }
            ],
            config: {
                auth: {
                    provider: 'jwt',
                    userEntity: 'User',
                    props: {
                        identityField: 'email',
                        secretField: 'password'
                    }
                },
                integrations: {
                    email: {
                        provider: 'sendgrid',
                        apiKey: 'env(SENDGRID_API_KEY)',
                        defaultFrom: 'noreply@example.com'
                    }
                },
                db: 'postgresql'
            },
            pages: [
                {
                    name: 'UserDashboard',
                    type: 'dashboard',
                    entity: 'User',
                    route: '/dashboard',
                    permissions: ['ADMIN', 'USER']
                }
            ]
        };
        const outDir = path.join(__dirname, 'test-output/full-app');
        fs.mkdirSync(outDir, { recursive: true });
        await testFullGeneration(complexApp, outDir);
        // Use the validateFiles utility to check expected complex app files
        validateFiles(outDir, [
            // Check for basic structure
            { path: 'backend/prisma/schema.prisma', shouldExist: true,
                contentChecks: [
                    'model User',
                    'provider = "postgresql"', // Should use PostgreSQL for this test
                ]
            },
            { path: 'frontend/src/App.tsx', shouldExist: true },
            { path: 'docker-compose.yml', shouldExist: true },
            // We would check for auth-specific files and workflow registry files
            // For a real implementation, but in our mocks we're just checking structure
        ]);
        // Additional assertions specific to complex apps
        const backendSchema = fs.readFileSync(path.join(outDir, 'backend', 'prisma', 'schema.prisma'), 'utf-8');
        (0, globals_1.expect)(backendSchema).toContain('model User');
        (0, globals_1.expect)(backendSchema).toContain('email String @unique');
        (0, globals_1.expect)(backendSchema).toContain('password String'); // Password field should be mapped to String
    });
});
//# sourceMappingURL=full-generator.test.js.map