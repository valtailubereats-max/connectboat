/// <reference types="vite/client" />
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const CACHE_NAME = 'connectboat-pwa-v1';

if (typeof window !== 'undefined') {
  if (import.meta.env.PROD) {
    // ----------------------------------------------------
    // Production Mode: Register Service Worker & Manage Cache
    // ----------------------------------------------------
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered successfully:', reg.scope);
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New version available! Reloading...');
                    window.location.reload();
                  }
                };
              }
            };
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
    }

    // Clear stale caches in production while keeping CACHE_NAME
    if ('caches' in window) {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[CacheCleaner] Removing stale cache in production: ${key}`);
            return caches.delete(key);
          }
        }));
      }).catch((err) => {
        console.error('[CacheCleaner] Error clearing caches:', err);
      });
    }
  } else {
    // ----------------------------------------------------
    // Preview / Development Mode: Unregister SW & Purge Caches
    // ----------------------------------------------------
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().then((success) => {
            if (success) {
              console.log('[PWA] Unregistered Service Worker in Preview/Dev:', registration.scope);
            }
          });
        }
      }).catch((err) => {
        console.error('[PWA] Error unregistering service workers:', err);
      });
    }

    if ('caches' in window) {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => {
          console.log(`[CacheCleaner] Purging cache in Preview/Dev: ${key}`);
          return caches.delete(key);
        }));
      }).catch((err) => {
        console.error('[CacheCleaner] Error clearing caches:', err);
      });
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
