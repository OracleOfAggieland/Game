import React from 'react';

interface TutorialModeProps {
  onComplete: () => void;
  particlesEnabled: boolean;
  soundEnabled: boolean;
}

const TutorialMode: React.FC<TutorialModeProps> = ({ onComplete }) => {
  return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>
      <h2>Tutorial Mode</h2>
      <p>This is a placeholder for the interactive tutorial.</p>
      <button onClick={onComplete}>Return to Menu</button>
    </div>
  );
};

export default TutorialMode;
