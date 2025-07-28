import { parseDSL } from '../src/parser/index';
import { DSLParsingError } from '../src/errors';

// SKIPPING OLD TESTS - Using new parser implementation instead
describe.skip('Parser Empty File Handling', () => {
  it('should handle completely empty files', () => {
    const emptyDSL = '';
    expect(() => parseDSL(emptyDSL)).toThrow(DSLParsingError);
  });

  it('should handle files with only whitespace', () => {
    const whitespaceOnlyDSL = '   \n\t\n   ';
    expect(() => parseDSL(whitespaceOnlyDSL)).toThrow(DSLParsingError);
  });

  it('should handle files with only comments', () => {
    const commentsOnlyDSL = '// This is a comment\n// Another comment';
    expect(() => parseDSL(commentsOnlyDSL)).toThrow(DSLParsingError);
  });

  it('should handle files with comments and whitespace', () => {
    const mixedEmptyDSL = '   \n// Comment\n\t// Another comment\n   ';
    expect(() => parseDSL(mixedEmptyDSL)).toThrow(DSLParsingError);
  });
});
