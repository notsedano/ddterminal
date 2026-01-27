import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PrivyAuthProvider } from './components/auth';
import './index.css';

// Suppress defaultProps warnings from third-party libraries (e.g., react-nba-logos)
// These libraries use deprecated defaultProps pattern but still work fine
// Remove this filter once libraries are updated for React 19
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    message.includes('Support for defaultProps will be removed')
  ) {
    return; // Suppress this specific warning
  }
  originalWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyAuthProvider>
      <App />
    </PrivyAuthProvider>
  </React.StrictMode>
);
