
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

function registerServiceWorker() {
  if (
    import.meta.env.PROD &&
    'serviceWorker' in navigator
  ) {
    window.addEventListener('load', () => {
      const baseUrl = import.meta.env.BASE_URL;

      navigator.serviceWorker
        .register(`${baseUrl}service-worker.js`, {
          scope: baseUrl
        })
        .catch((error) => {
          console.error('COL Service Worker registration failed:', error);
        });
    });
  }
}

registerServiceWorker();

ReactDOM.createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

