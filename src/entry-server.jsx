import React from 'react';
import {renderToString} from 'react-dom/server';
import {StaticRouter} from 'react-router-dom/server';
import {HelmetProvider} from 'react-helmet-async';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import {BootstrapProvider} from './context/BootstrapContext';
import {CartProvider} from './context/CartContext';
import {AuthProvider} from './context/AuthContext';
import './styles/global.css';

export function render(url,data={}){
 const helmetContext={};
 const html=renderToString(<HelmetProvider context={helmetContext}><BootstrapProvider value={data}><AuthProvider><CartProvider ssr><StaticRouter location={url}><ErrorBoundary><App/></ErrorBoundary></StaticRouter></CartProvider></AuthProvider></BootstrapProvider></HelmetProvider>);
 return {html,helmet:helmetContext.helmet,status:data?.notFound?404:200};
}
