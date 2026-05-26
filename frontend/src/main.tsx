import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSessionSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Ignore blocked sessionStorage contexts.
  }
}

function safeSessionRemove(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Ignore blocked sessionStorage contexts.
  }
}

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

async function cleanupServiceWorkers() {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (!registrations.length) {
    safeSessionRemove('sw-cleanup-reload');
    return false;
  }

  await Promise.all(
    registrations.map((registration) =>
      registration.unregister().catch((error) => {
        console.warn('Failed to unregister service worker:', error);
      })
    )
  );

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys.map((key) =>
        caches.delete(key).catch((error) => {
          console.warn('Failed to delete cache:', error);
          return false;
        })
      )
    );
  }

  if (!safeSessionGet('sw-cleanup-reload')) {
    safeSessionSet('sw-cleanup-reload', '1');
    window.location.reload();
    return true;
  }

  safeSessionRemove('sw-cleanup-reload');
  return false;
}

cleanupServiceWorkers()
  .then((reloaded) => {
    if (!reloaded) {
      renderApp();
    }
  })
  .catch((error) => {
    console.warn('Service worker cleanup failed:', error);
    renderApp();
  })
