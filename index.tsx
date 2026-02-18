import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';

// --- SYSTEM INTEGRITY CHECK: REACT 19 ---
console.group('%c HunterMatch PRO | React 19 System Check', 'background: #0f172a; color: #10b981; font-weight: bold; padding: 6px; border-radius: 4px;');
console.log(`%c React Core:    v${React.version}`, 'color: #38bdf8; font-family: monospace');

// ESM.sh pode resolver RC.1 para 19.0.0 estável, ambos são aceitáveis.
if (!React.version.startsWith('19.0.0')) {
  console.error(`%c 🛑 CRITICAL: React version mismatch! Expected 19.x, found ${React.version}`, 'color: #f43f5e; font-weight: bold;');
} else {
   console.log('%c ✅ Integrity Verified: Running on React 19', 'color: #10b981; font-weight: bold;');
}
console.groupEnd();
// ---------------------------------------------

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("FATAL: Root element not found.");
}

const root = createRoot(rootElement);

// StrictMode is essential for identifying concurrency issues in React 19
root.render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
);