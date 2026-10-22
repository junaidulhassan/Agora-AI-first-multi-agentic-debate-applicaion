import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App.jsx'

const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-deep').trim()
if (themeColor) {
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = themeColor
  document.head.appendChild(meta)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
