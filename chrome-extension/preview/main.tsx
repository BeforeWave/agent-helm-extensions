import React from 'react'
import ReactDOM from 'react-dom/client'
import { PreviewApp } from './PreviewApp'
import '../src/app/styles.css'; import './preview.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>,
)
