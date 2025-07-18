# Contributing to Stalmer1

Thank you for your interest in contributing to Stalmer1! We welcome contributions from everyone, and we're excited to have you join us. This document provides guidelines and instructions to help you get started.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct. Please be respectful and considerate of others.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with the following information:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Any relevant error messages or screenshots
- Environment details (OS, Node.js version, etc.)

### Suggesting Enhancements

We welcome suggestions for enhancements! When suggesting a feature:
- Use a clear, descriptive title
- Describe the current behavior and why it's limiting
- Describe the new behavior you'd like to see
- Explain why this enhancement would be useful

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure your changes don't break existing functionality (`npm test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Coding Guidelines

- Follow the existing code style
- Write tests for new functionality
- Update documentation when necessary
- Keep pull requests focused on a single topic

## Development Setup

```bash
# Clone the repo
git clone https://github.com/PlustOrg/stalmer1.git
cd stalmer1

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

## Project Structure

- `packages/core`: Core logic including parser, IR, and validation
- `packages/backend-generator`: Backend code generator for NestJS and Prisma
- `packages/frontend-generator`: Frontend code generator for React and Vite
- `packages/cli`: Command-line interface for Stalmer1
- `docs`: Documentation files

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
