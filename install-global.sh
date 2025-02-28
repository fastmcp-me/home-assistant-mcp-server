#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Installing Logz.io MCP Server globally...${NC}"

# Get the current directory
CURRENT_DIR="$(pwd)"

# Build the package
echo -e "${YELLOW}Building the package...${NC}"
npm run build

# Pack the package to create a tarball
echo -e "${YELLOW}Creating package tarball...${NC}"
npm pack

# Get the package name from package.json
PACKAGE_NAME=$(node -e "console.log(require('./package.json').name + '-' + require('./package.json').version + '.tgz')")

# Install the package globally
echo -e "${YELLOW}Installing package globally...${NC}"
npm install -g "${CURRENT_DIR}/${PACKAGE_NAME}"

# Check if installation was successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Success! Logz.io MCP Server has been installed globally.${NC}"
  echo -e "${GREEN}You can now run it from anywhere using the command:${NC} logzio-mcp"
  echo ""
  echo -e "${YELLOW}Important:${NC} Make sure your environment has the LOGZIO_API_KEY set."
  echo -e "You can set it by running: ${GREEN}export LOGZIO_API_KEY=your-api-key${NC}"
else
  echo -e "${RED}Installation failed. Please check the error messages above.${NC}"
fi
