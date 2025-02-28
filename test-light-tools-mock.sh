#!/bin/bash

# Make sure TypeScript is compiled
echo "Building the project..."
npm run build

# Run the mock light tools test
echo "Running mock light tools test..."
node test/test-light-tools-mock.js
