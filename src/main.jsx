import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { initTheme } from '@/lib/theme'
import '@/index.css'

initTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)