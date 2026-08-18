import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const renderApp = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

// Initialize Office.js
if (window.Office) {
  window.Office.onReady(() => {
    renderApp();
  });
} else {
  // Fallback if running outside of Excel
  renderApp();
}
