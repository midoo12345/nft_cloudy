import React from 'react';
import ReactDOM from 'react-dom/client';

// Import styles
import './App.css';  // This will import all other style files in the correct order

import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: bit.ly/CRA-vitals
reportWebVitals();
