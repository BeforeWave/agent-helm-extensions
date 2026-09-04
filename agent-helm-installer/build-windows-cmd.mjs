#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
function option(name) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}
const version = option('--version')
const agentHelmVersion = option('--agent-helm-version')
const extensionId = option('--chrome-extension-id')
const output = option('--output') ?? resolve(root, `Agent-Helm-Installer-${version ?? 'dev'}-win32-x64.cmd`)
const semver = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
if (!version || !semver.test(version)) throw new Error('--version must be a semantic version')
if (!agentHelmVersion || !semver.test(agentHelmVersion)) throw new Error('--agent-helm-version must be a semantic version')
if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) throw new Error('--chrome-extension-id must be a 32-character Chrome Extension ID')

const installUrl = 'https://raw.githubusercontent.com/BeforeWave/agent-helm/main/install.ps1'
const source = `@echo off\r
setlocal EnableExtensions DisableDelayedExpansion\r
title Agent Helm Installer ${version}\r
echo Agent Helm Installer ${version} ^(win32-x64^)\r
echo Agent Helm ${agentHelmVersion} - Chrome Extension ${extensionId}\r
echo.\r
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $source=(Invoke-WebRequest -UseBasicParsing -Uri '${installUrl}').Content; if ([string]::IsNullOrWhiteSpace($source)) { throw 'Agent Helm install.ps1 is empty' }; & ([scriptblock]::Create($source)) -Version '${agentHelmVersion}' -ChromeExtensionId '${extensionId}'; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }"\r
set "RESULT=%ERRORLEVEL%"\r
if not "%RESULT%"=="0" (\r
  echo.\r
  echo Agent Helm installation failed with exit code %RESULT%.\r
  pause\r
  exit /b %RESULT%\r
)\r
echo.\r
echo Agent Helm and the Chrome Native Messaging bridge are installed.\r
echo You can close this window and return to Chrome.\r
pause\r
`
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, source, 'ascii')
console.log(output)
