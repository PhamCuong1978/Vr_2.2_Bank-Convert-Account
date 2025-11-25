
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Thêm timestamp vào log để xác nhận code mới đã được nạp
console.log("Mounting App v2.5 at " + new Date().toLocaleTimeString());

const root = ReactDOM.createRoot(rootElement);

// Thay đổi key/id của wrapper div để ép React mount lại từ đầu
root.render(
  <React.StrictMode>
    <div id="app-root-v2-5" className="app-container-refresh">
      <App />
    </div>
  </React.StrictMode>
);
