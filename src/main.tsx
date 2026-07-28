import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register our ConnectBoat PWA Service Worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }

  // Programmatically unregister older/stale service workers from other domains or older applet versions
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      const scriptURL = registration.active?.scriptURL || registration.installing?.scriptURL || registration.waiting?.scriptURL || '';
      if (scriptURL && !scriptURL.endsWith('/sw.js')) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[CacheCleaner] Unregistered stale service worker successfully:', scriptURL);
          }
        });
      }
    }
  }).catch((err) => {
    console.error('[CacheCleaner] Error finding registrations:', err);
  });
}

// Programmatically clear stale browser caches while protecting active PWA cache
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    return Promise.all(keys.map((key) => {
      if (key !== 'mercado-luso-pwa-v1') {
        console.log(`[CacheCleaner] Removing stale cache: ${key}`);
        return caches.delete(key);
      }
    }));
  }).catch((err) => {
    console.error('[CacheCleaner] Error clearing caches:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
