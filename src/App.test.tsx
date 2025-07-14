import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders snake game', () => {
  render(<App />);
  const gameElement = screen.getByText(/Snake Game/i);
  expect(gameElement).toBeInTheDocument();
});