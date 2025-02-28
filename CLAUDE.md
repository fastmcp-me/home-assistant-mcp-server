# MCP-HASS-SERVER Development Guide

## Commands
- Build: `npm run build`
- Start: `npm run start`
- Dev mode: `npm run dev` (watches for changes)
- Lint: `npm run lint`
- Format: `npm run format`
- Test all: `npm run test`
- Test watch: `npm run test:watch`
- Single test: `node --experimental-vm-modules node_modules/jest/bin/jest.js path/to/test.ts`
- Build & start: `npm run mcp`

## Code Style
- TypeScript with ES modules (requires .js extension in imports)
- Use 2-space indentation with semicolons required
- camelCase for variables/functions, PascalCase for classes/interfaces
- Prefix unused variables with underscore
- Follow Model Context Protocol specifications

## Cursor Rules
- Run `npm test` before and after making changes
- Fix build problems before addressing linting issues
- Use `npm run build` to verify compilation
- Format markdown files with Prettier

## Environment
- Node.js >= 18.0.0 required
- ES2022 target with NodeNext module resolution