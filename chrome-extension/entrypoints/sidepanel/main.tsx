import React from 'react'
import ReactDOM from 'react-dom/client'
import { SidePanelApp } from '../../src/app/SidePanelApp'
import { createChromeControlPlaneClient } from '../../src/client/factories'
import '../../src/app/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanelApp client={createChromeControlPlaneClient()} />
  </React.StrictMode>,
)
