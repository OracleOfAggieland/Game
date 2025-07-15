import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders game menu', () => {
  render(<App />);
  expect(screen.getByText(/snake game/i)).toBeInTheDocument();
});