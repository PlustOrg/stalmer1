export class DSLParsingError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly lineNumber?: number,
    public readonly columnNumber?: number,
    public readonly context?: string,
  ) {
    const location =
      filePath && lineNumber
        ? ` at ${filePath}:${lineNumber}`
        : '';
    super(`${message}${location}`);
    this.name = 'DSLParsingError';
  }
}
