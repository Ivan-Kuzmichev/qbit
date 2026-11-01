import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import { t } from './i18n/ru'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div>
      {t.app.name} v{__APP_VERSION__}
    </div>
  </StrictMode>,
)
