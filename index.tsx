import React from 'react';
import ReactDOM from 'react-dom/client';
import CuteMIRC from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Example Consumer App usage
root.render(
  <React.StrictMode>
    {/* Consumer controls the container size */}
    <div style={{ width: '100vw', height: '100vh' }}>
        <CuteMIRC 
            pocketbaseUrl="https://api.workigomchat.online"
        />
    </div>
  </React.StrictMode>
);