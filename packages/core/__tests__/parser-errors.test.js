"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../src/index");
describe('DSL Parser Error Handling', () => {
    const filePath = 'test.dsl';
    it('should throw an error for an empty DSL file', () => {
        const dsl = `// Just comments`;
        expect(() => (0, index_1.parseDSL)(dsl, filePath)).toThrow(new index_1.DSLParsingError('DSL file is empty or contains only comments. At least one entity block is required.', filePath));
    });
    it('should throw an error for a field with no type', () => {
        const dsl = `
      entity User {
        email:
      }
    `;
        expect(() => (0, index_1.parseDSL)(dsl, filePath)).toThrow(new index_1.DSLParsingError("Field type is required for field 'email' in entity 'User'", filePath, 3, 9, '        email:'));
    });
    it('should throw an error for an invalid field name', () => {
        const dsl = `
      entity User {
        1stName: String
      }
    `;
        expect(() => (0, index_1.parseDSL)(dsl, filePath)).toThrow(new index_1.DSLParsingError('Invalid field name: "1stName". Field names must start with a letter or underscore and contain only letters, numbers, and underscores.', filePath, 3, 9, '        1stName: String'));
    });
    it('should throw an error for a duplicate field name', () => {
        const dsl = `
      entity User {
        name: String
        name: String
      }
    `;
        expect(() => (0, index_1.parseDSL)(dsl, filePath)).toThrow(new index_1.DSLParsingError("Duplicate field name 'name' in entity 'User'", filePath, 4, 9, '        name: String'));
    });
    it('should throw an error for an invalid field type', () => {
        const dsl = `
      entity User {
        name: InvalidType
      }
    `;
        expect(() => (0, index_1.parseDSL)(dsl, filePath)).toThrow(new index_1.DSLParsingError("Type 'InvalidType' for field 'name' is not a defined entity or enum.", filePath, 1, 9, '        name: InvalidType'));
    });
    it('should throw an error for a page with a non-existent entity', () => {
        const dsl = `
      page UserList {
        type: table
        entity: NonExistentEntity
      }
    `;
        expect(() => (0, index_1.parseDSL)(dsl, filePath)).toThrow(new index_1.DSLParsingError("Entity 'NonExistentEntity' not found for page 'UserList'", filePath, 2, 7, '      page UserList {'));
    });
    it('should throw an error for a relation to a non-existent entity', () => {
        const dsl = `
      entity User {
        posts: Post[] @relation(name: "UserPosts")
      }
    `;
        expect(() => (0, index_1.parseDSL)(dsl, filePath)).toThrow(new index_1.DSLParsingError("Entity 'Post' not found for relation 'posts' in entity 'User'", filePath, 1, 9, '        posts: Post[] @relation(name: "UserPosts")'));
    });
});
//# sourceMappingURL=parser-errors.test.js.map