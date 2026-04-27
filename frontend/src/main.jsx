import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font)',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: 'var(--green)', secondary: 'var(--bg)' } },
        error: { iconTheme: { primary: 'var(--red)', secondary: 'var(--bg)' } },
      }}
    />
  </React.StrictMode>
);
