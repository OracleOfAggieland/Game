# Technology Stack

## Frontend
- **React 19.1.0** with TypeScript (strict mode)
- **Create React App** build system
- **CSS** for styling (no CSS framework dependencies)
- **Web Vitals** for performance monitoring

## Backend & Services
- **Firebase 11.10.0** for real-time multiplayer sync
- **Firestore** database with custom rules
- **Firebase Hosting** for deployment
- **Firebase Functions** (Node.js 22) for server-side logic
- **Firebase Storage** with custom rules

## Development Tools
- **TypeScript 4.9.5** with strict configuration
- **ESLint** with React app configuration
- **Jest** and React Testing Library for testing
- **Firebase Emulators** for local development

## Common Commands

### Development
```bash
npm start          # Start development server (localhost:3000)
npm test           # Run tests in watch mode
npm run build      # Build for production
```

### Firebase Functions
```bash
cd functions
npm run build      # Compile TypeScript
npm run serve      # Start local emulators
npm run deploy     # Deploy functions to Firebase
npm run logs       # View function logs
```

### Firebase Deployment
```bash
firebase serve     # Test hosting locally
firebase deploy    # Deploy entire project
firebase deploy --only hosting  # Deploy only frontend
firebase deploy --only functions # Deploy only functions
```

## Architecture Notes
- Uses Firebase for real-time state synchronization
- Implements object pooling and spatial partitioning for performance
- Features WebGL renderer option for enhanced graphics
- Maintains 60 FPS target with batched Firebase updates (500ms intervals)