import React from 'react'
import ReactDOM from 'react-dom/client'
import { installWorkHistoryUiStyles } from '../../src/__shared/work-history-ui/index'
import { SidePanelApp } from '../../src/app/SidePanelApp'
import { createChromeControlPlaneClient } from '../../src/client/factories'
import '../../src/app/styles.css'

installWorkHistoryUiStyles()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanelApp client={createChromeControlPlaneClient()} />
  </React.StrictMode>,
)
