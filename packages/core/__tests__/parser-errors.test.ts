import { parseDSL, DSLParsingError } from '../src/index';

describe('DSL Parser Error Handling', () => {
  it('should throw DSLParsingError for syntax errors', () => {
    const dsl = `
      entity User {
        name: String
        email:
      }
    `;
    const filePath = 'test.dsl';

    try {
      parseDSL(dsl, filePath);
      fail('Expected a DSLParsingError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DSLParsingError);
      const err = e as DSLParsingError;
      expect(err.message).toContain("Field type is required for field 'email' in entity 'User'");
      expect(err.filePath).toBe(filePath);
      expect(err.lineNumber).toBe(4);
    }
  });
});
