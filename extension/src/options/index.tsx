import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import OptionsPage from './options-page'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>,
)
