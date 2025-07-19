import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders level 3 heading', () => {
  render(<App />);
  const heading = screen.getByText(/Level 3 - Advanced Snake/i);
  expect(heading).toBeInTheDocument();
});
