import React, { useState } from 'react';
import './App.css';
import Level2 from './Level2';
import Level3 from './Level3';

function App() {
  const [level, setLevel] = useState(3);

  return (
    <div className="App">
      <nav className="level-selector">
        <label>
          Select Level:
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
          </select>
        </label>
      </nav>
      {level === 2 ? <Level2 /> : <Level3 />}
    </div>
  );
}

export default App;
