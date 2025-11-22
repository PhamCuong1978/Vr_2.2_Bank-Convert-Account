
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

console.log("Mounting Application Version 2.2.1...");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <div id="app-v2-2-1">
      <App />
    </div>
  </React.StrictMode>
);
