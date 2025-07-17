# Project Structure

## Root Level
- `src/` - Main application source code
- `functions/` - Firebase Cloud Functions (Node.js/TypeScript)
- `public/` - Static assets and HTML template
- `build/` - Production build output
- `.kiro/` - Kiro AI assistant configuration and specs

## Source Code Organization (`src/`)

### Core Application
- `App.tsx` - Main application component
- `index.tsx` - React application entry point
- `*.css` - Global and component-specific styles

### Components (`src/components/`)
- `Game/` - Game-related React components
- `UI/` - User interface components
- `ErrorBoundaries/` - Error handling components

### Business Logic
- `hooks/` - Custom React hooks for game logic
- `services/` - External service integrations and utilities
- `managers/` - Game state and feature managers
- `utils/` - Pure utility functions and algorithms

### Type Definitions (`src/types/`)
- Game-specific TypeScript interfaces and types
- Enhancement-related type definitions

### Testing (`src/tests/`)
- `integration/` - Integration test suites
- Component and utility unit tests

## Key Architectural Patterns

### Separation of Concerns
- **Components**: Pure UI rendering with minimal logic
- **Hooks**: Reusable stateful logic (useGameState, useInputHandling, etc.)
- **Services**: External integrations (Firebase, AI, error handling)
- **Managers**: Complex feature coordination (PowerUpManager, WaveManager)
- **Utils**: Pure functions for calculations and algorithms

### File Naming Conventions
- Components: PascalCase (e.g., `SnakeGame.tsx`)
- Hooks: camelCase with "use" prefix (e.g., `useGameLoop.ts`)
- Services: PascalCase (e.g., `SnakeAI.ts`)
- Utils: PascalCase (e.g., `GameBalance.ts`)
- Types: PascalCase (e.g., `GameEnhancements.ts`)

### Import Organization
- External libraries first
- Internal imports grouped by: types, hooks, services, components
- Relative imports last