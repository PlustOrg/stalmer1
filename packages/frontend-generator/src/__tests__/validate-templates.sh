#!/bin/bash
# Template validation test runner
# Usage: ./validate-templates.sh

# Change to the directory of this script
cd "$(dirname "$0")"

# Run the template validation tests
npx jest --config ../../jest.config.js template-validation.test.ts
