import React from 'react'
import ReactDOM from 'react-dom/client'
import { PopupApp } from '../../src/app/PopupApp'
import { createChromeControlPlaneClient } from '../../src/client/factories'
import '../../src/app/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp client={createChromeControlPlaneClient()} />
  </React.StrictMode>,
)
