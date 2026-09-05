param(
  [string]$Version = 'latest',
  [string]$ExtensionId = $env:AGENT_HELM_CHROME_EXTENSION_ID
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This installer supports Windows only.' }

$ReleaseUrl = 'https://github.com/BeforeWave/agent-helm-extensions/releases'
$TunnelReleaseUrl = 'https://github.com/openai/tunnel-client/releases'
$ReleaseToolUrl = if ($env:BEFOREWAVE_RELEASE_TOOL_URL) { $env:BEFOREWAVE_RELEASE_TOOL_URL } else { 'https://raw.githubusercontent.com/BeforeWave/agent-helm/main/install-release.ps1' }
$AgentHelmInstallUrl = if ($env:AGENT_HELM_INSTALL_URL) { $env:AGENT_HELM_INSTALL_URL } else { 'https://raw.githubusercontent.com/BeforeWave/agent-helm/main/install.ps1' }
$AgentHelmLauncher = Join-Path $HOME '.agent-helm\bin\agent-helm.cmd'
$CanonicalExtensionId = 'eigfmmjccbiinngdfifjkpmofandcgif'
if ([string]::IsNullOrWhiteSpace($ExtensionId)) { $ExtensionId = $CanonicalExtensionId }

function Fail([string]$Message) { throw "Agent Helm Chrome installer: $Message" }
function Stage([int]$Number, [string]$Message) { Write-Host "Agent Helm Chrome [$Number/6] $Message" }

function Confirm-TunnelInstall {
  if ($env:AGENT_HELM_INSTALL_TUNNEL_CLIENT -eq '1') { return $true }
  if ($env:AGENT_HELM_INSTALL_TUNNEL_CLIENT -eq '0') { return $false }
  Write-Host 'OpenAI tunnel-client is required for ChatGPT Tunnel.'
  Write-Host "Source: $TunnelReleaseUrl"
  Write-Host 'Windows will use the corresponding Windows installation and verification flow.'
  try { $answer = Read-Host 'Install it now? [y/N]' } catch { return $false }
  return $answer -match '^(?i:y|yes)$'
}

$arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if ($arch -notin @('AMD64', 'x64', 'X64')) { Fail "Windows installer currently supports win32-x64 only; detected $arch" }
if ($ExtensionId -notmatch '^[a-p]{32}$') { Fail 'Chrome extension id must be a 32-character extension id' }

$ExistingTunnelClient = Get-Command tunnel-client.exe -ErrorAction SilentlyContinue | Select-Object -First 1
$ExistingTunnelClientUsable = $false
if ($ExistingTunnelClient) {
  try {
    & $ExistingTunnelClient.Source --version *> $null
    $ExistingTunnelClientUsable = ($LASTEXITCODE -eq 0)
  } catch {
    $ExistingTunnelClientUsable = $false
  }
}

function Remote-Script([string]$Uri) {
  $source = (Invoke-WebRequest -UseBasicParsing -Uri $Uri).Content
  if ([string]::IsNullOrWhiteSpace($source)) { Fail "downloaded script is empty: $Uri" }
  return [scriptblock]::Create($source)
}

$ReleaseTool = Remote-Script $ReleaseToolUrl
$Version = (& $ReleaseTool resolve -ReleaseUrl $ReleaseUrl -Version $Version | Select-Object -Last 1).Trim()
$AgentHelmVersion = (& $ReleaseTool field -ReleaseUrl $ReleaseUrl -Version $Version -Field 'agentHelmVersion' | Select-Object -Last 1).Trim()
Write-Host "Agent Helm Chrome: Extension $Version -> Agent Helm $AgentHelmVersion"

Stage 1 'Runtime / Node'
Write-Host 'Agent Helm installer will reuse Node.js 22+ or install its managed win-x64 runtime.'

Stage 2 "Agent Helm $AgentHelmVersion"
$AgentHelmInstall = Remote-Script $AgentHelmInstallUrl
& $AgentHelmInstall -Version $AgentHelmVersion -ChromeExtensionId $ExtensionId
if ($LASTEXITCODE -ne 0) { Fail "Agent Helm $AgentHelmVersion installation failed" }

Stage 3 'OpenAI tunnel-client'
if ($ExistingTunnelClientUsable) {
  Write-Host "Agent Helm Chrome: using existing tunnel-client from $($ExistingTunnelClient.Source)."
} elseif (Confirm-TunnelInstall) {
  if (-not (Test-Path -LiteralPath $AgentHelmLauncher)) { Fail "Agent Helm CLI launcher is missing at $AgentHelmLauncher" }
  & $AgentHelmLauncher setup tunnel-client --channel chrome --yes
  if ($LASTEXITCODE -ne 0) { Fail 'OpenAI tunnel-client installation failed' }
} else {
  Write-Host 'Agent Helm Chrome: tunnel-client installation skipped. You can install it later from the Tunnel configuration screen.'
}

Stage 4 "Native Messaging bridge: $ExtensionId"
Write-Host 'Agent Helm bridge registered for the selected Chrome Extension ID.'

Stage 5 "Chrome Extension $Version"
$downloads = Join-Path $HOME 'Downloads'
$destination = Join-Path $downloads 'Agent-Helm-Chrome-Extension'
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("agent-helm-chrome-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $downloads, $temp -Force | Out-Null
try {
  $zip = Join-Path $temp 'extension.zip'
  & $ReleaseTool download -ReleaseUrl $ReleaseUrl -Version $Version -ArtifactId 'agent-helm-chrome-extension' -Output $zip
  Remove-Item -LiteralPath $destination -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force
} finally {
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}

Stage 6 'Chrome handoff'
Write-Host "Extension files: $destination"
Write-Host 'Chrome: Developer mode -> Load unpacked -> select that directory.'

$chromeCandidates = @(
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe')
)
if (${env:ProgramFiles(x86)}) { $chromeCandidates += (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe') }
$chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if ($chrome) {
  Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions' | Out-Null
}
Start-Process -FilePath 'explorer.exe' -ArgumentList @($destination) | Out-Null
