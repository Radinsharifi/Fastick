import React from 'react';import ReactDOM from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import App from './App';import './style.css';import {ToastProvider} from './components/ui';import './lib/installPrompt';
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(error=>console.error('Fastick service worker registration failed:',error)));
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ToastProvider><BrowserRouter><App/></BrowserRouter></ToastProvider></React.StrictMode>)
