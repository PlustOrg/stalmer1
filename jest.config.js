module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$', '/dist/'],
  roots: ['<rootDir>/packages'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        "allowJs": true,
        "esModuleInterop": true,
      }
    }]
  },
  moduleNameMapper: {
    '^@stalmer1/core$': '<rootDir>/packages/core/src',
    '^@stalmer1/core/(.*)$': '<rootDir>/packages/core/src/$1',
    '^@stalmer1/backend-generator$': '<rootDir>/packages/backend-generator/src',
    '^@stalmer1/backend-generator/(.*)$': '<rootDir>/packages/backend-generator/src/$1',
    '^@stalmer1/frontend-generator$': '<rootDir>/packages/frontend-generator/src',
    '^@stalmer1/frontend-generator/(.*)$': '<rootDir>/packages/frontend-generator/src/$1',
    '^@stalmer1/cli$': '<rootDir>/packages/cli/src'
  }
};
