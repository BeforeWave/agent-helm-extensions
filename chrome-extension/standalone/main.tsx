import React from 'react'
import { installWorkHistoryUiStyles } from '../src/__shared/work-history-ui/index'
import ReactDOM from 'react-dom/client'
import '../src/app/styles.css'
import '../preview/preview.css'
import './standalone.css'
import { StandaloneApp } from './StandaloneApp'

installWorkHistoryUiStyles()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>,
)
