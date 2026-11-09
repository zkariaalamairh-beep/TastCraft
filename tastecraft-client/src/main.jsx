import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App.jsx';
import { initializeAuth } from './services/auth.js';

// Start once, outside React effects.
// This avoids duplicate startup refreshes from StrictMode.
void initializeAuth();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);