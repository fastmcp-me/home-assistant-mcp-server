# MCP Logz.io Server Guidelines

## Commands

- Build: `npm run build`
- Test all: `npm test`
- Test single: `npm test -- -t "test name pattern"`
- Lint: `npm run lint`
- Format: `npm run format`
- Dev mode: `npm run dev`
- Inspect MCP: `npm run inspect` or `./inspect.sh`

## Code Style

- TypeScript with strict typing and ES modules
- Use interfaces for public APIs, types for internal structures
- Follow naming: PascalCase for types/interfaces, camelCase for variables/functions
- Imports: group by external libraries → internal modules → types
- Error handling: use typed errors with meaningful messages
- Use async/await for promises, not callbacks
- Use Zod for runtime schema validation
- Add JSDoc comments for public functions and complex logic
- Follow MCP protocol conventions for tools integration

## Testing

- Write Jest tests for all new functionality
- Run `npm test` before and after making changes
- Use mocks for external dependencies
- Maintain test coverage above 80%
