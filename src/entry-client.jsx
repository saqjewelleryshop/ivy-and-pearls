import React from 'react';
import {hydrateRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {HelmetProvider} from 'react-helmet-async';
import App from './App';
import {BootstrapProvider} from './context/BootstrapContext';
import {CartProvider} from './context/CartContext';
import {AuthProvider} from './context/AuthContext';
import './styles/global.css';

hydrateRoot(document.getElementById('root'),
 <HelmetProvider><BootstrapProvider value={window.__IVY_BOOTSTRAP__||{}}><AuthProvider><CartProvider><BrowserRouter><App/></BrowserRouter></CartProvider></AuthProvider></BootstrapProvider></HelmetProvider>
);
