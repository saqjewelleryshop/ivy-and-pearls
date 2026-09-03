import React from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {HelmetProvider} from 'react-helmet-async';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import {BootstrapProvider} from './context/BootstrapContext';
import {CartProvider} from './context/CartContext';
import {AuthProvider} from './context/AuthContext';
import './styles/global.css';

// Runtime config injection — fetched from /api/config if not present
(async () => {
  if (!window.__IVY_CLIENT_CONFIG__) {
    try {
      const r = await fetch('/api/config');
      if (r.ok) window.__IVY_CLIENT_CONFIG__ = await r.json();
    } catch {}
  }
  // Bootstrap after config is ready (or timeout)
  setTimeout(() => mountApp(), 0);
})();

function mountApp() {
const rootElement=document.getElementById('root');
const bootstrap=window.__IVY_BOOTSTRAP__||{};
const app=(
  <HelmetProvider>
    <BootstrapProvider value={bootstrap}>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <ErrorBoundary><App/></ErrorBoundary>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </BootstrapProvider>
  </HelmetProvider>
);

/*
 * SSR pages contain React markup and are hydrated normally.
 * A static/edge fallback may legitimately contain an empty #root; mounting
 * instead of hydrating that shell prevents React errors #418/#423.
 */
if(rootElement.hasChildNodes()){
  hydrateRoot(rootElement,app);
}else{
  createRoot(rootElement).render(app);
}
}