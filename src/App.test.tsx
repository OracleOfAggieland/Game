import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders score label', () => {
  render(<App />);
  expect(screen.getByText(/score/i)).toBeInTheDocument();
});
