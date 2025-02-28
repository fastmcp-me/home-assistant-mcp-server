# MCP Logz.io Server Refactoring

This project has been refactored to improve code organization and make it easier for LLMs to work with the codebase.

## Key Changes

### Directory Structure

- Organized tools by functionality in separate directories
- Each tool action is in its own file
- Extracted utility functions to dedicated modules
- Moved types to their own files

### Type Organization

- Created dedicated type files for each domain area
- Centralized error types in `src/types/errors.types.ts`
- Tool-specific types in `src/types/tools/` directory
- Improved type imports and exports

### Code Organization

- Each tool implementation follows a consistent pattern
- Utility functions are grouped by domain (search, analysis, etc.)
- Better separation of concerns between API, tools, and utilities
- More descriptive naming for functions and modules

## Benefits for LLMs

1. **Context Locality**: Related code is now grouped together, making it easier to understand.
2. **File Size Reduction**: Smaller files with focused purposes reduce context window usage.
3. **Explicit Typing**: Improved type documentation helps understand code relationships.
4. **Naming Consistency**: File and directory names reflect their purpose.
5. **Modular Design**: Each component has a clear responsibility.

## Project Structure

The new structure follows this pattern:

- `src/`
  - `api/` - API clients and communication
  - `tools/` - MCP tools organized by functionality
    - `search/` - Search-related tools
    - `fields/` - Field-related tools
    - `analysis/` - Analysis tools
    - etc.
  - `types/` - TypeScript type definitions
    - `tools/` - Tool-specific type definitions
    - `*.types.ts` - Domain-specific type files
  - `utils/` - Utility functions organized by domain
    - `search/` - Search-specific utilities
    - `analysis/` - Analysis-specific utilities
    - etc.
  - `schemas/` - Zod validation schemas
  - `templates/` - Template definitions
  - `prompts/` - Prompt definitions

Each tool file focuses on a single tool action, making it easy to understand the implementation at a glance.
