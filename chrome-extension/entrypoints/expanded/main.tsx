import React from 'react'
import ReactDOM from 'react-dom/client'
import { ExpandedDetailApp } from '../../src/app/ExpandedDetailApp'
import { createChromeControlPlaneClient } from '../../src/client/factories'
import { t } from '../../src/locale'
import '../../src/app/styles.css'

const workId = new URLSearchParams(window.location.search).get('workId')
document.title = `Agent Helm · ${t('extensionWorkDetail')}`

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExpandedDetailApp client={createChromeControlPlaneClient()} workId={workId} />
  </React.StrictMode>,
)
