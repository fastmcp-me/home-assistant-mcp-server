#!/bin/bash

# Make sure TypeScript is compiled
echo "Building the project..."
npm run build

# Run the light tools test
echo "Running light tools test..."
node test/test-light-tools.js
