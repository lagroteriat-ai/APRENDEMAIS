import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles/index.css';
import './playground.css';
import { App } from './App';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root não encontrado.');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
