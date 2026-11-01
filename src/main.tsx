import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import { App } from './App'

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Only the public demo build sets VITE_DEMO; otherwise this branch and its chunk don't exist.
if (import.meta.env.VITE_DEMO) void import('./demo/install').then(({ installDemo }) => (installDemo(), render()))
else render()
