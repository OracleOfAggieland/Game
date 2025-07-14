// src/App.tsx
import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import SnakeGame from './components/Game/SnakeGame';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <SnakeGame />
      </div>
    </AuthProvider>
  );
}

export default App;