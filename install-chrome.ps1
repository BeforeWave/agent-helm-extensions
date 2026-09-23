param(
  [string]$Version = 'latest',
  [string]$ExtensionId = $env:AGENT_HELM_CHROME_EXTENSION_ID
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This installer supports Windows only.' }

$ReleaseUrl = 'https://github.com/BeforeWave/agent-helm-extensions/releases'
$CoreReleaseUrl = 'https://github.com/BeforeWave/agent-helm/releases'
$TunnelReleaseUrl = 'https://github.com/openai/tunnel-client/releases'
$ReleaseToolUrl = if ($env:BEFOREWAVE_RELEASE_TOOL_URL) { $env:BEFOREWAVE_RELEASE_TOOL_URL } else { 'https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-release.ps1' }
$AgentHelmInstallUrl = if ($env:AGENT_HELM_INSTALL_URL) { $env:AGENT_HELM_INSTALL_URL } else { 'https://raw.githubusercontent.com/BeforeWave/agent-helm/main/install.ps1' }
$AgentHelmLauncher = Join-Path $HOME '.agent-helm\bin\agent-helm.cmd'
$ManagedBin = Join-Path $HOME '.agent-helm\bin'
$CanonicalExtensionId = 'eigfmmjccbiinngdfifjkpmofandcgif'
if ([string]::IsNullOrWhiteSpace($ExtensionId)) { $ExtensionId = $CanonicalExtensionId }

function Fail([string]$Message) { throw "Agent Helm Chrome installer: $Message" }
function Stage([int]$Number, [string]$Message) { Write-Host "Agent Helm Chrome [$Number/7] $Message" }

function Confirm-OptionalInstall([string]$Override, [string]$Title, [string]$Source, [string]$Note = '') {
  if ($Override -eq '1') { return $true }
  if ($Override -eq '0') { return $false }
  Write-Host $Title
  Write-Host "Source: $Source"
  if (-not [string]::IsNullOrWhiteSpace($Note)) { Write-Host $Note }
  try { $answer = Read-Host 'Install it now? [y/N]' } catch { return $false }
  return $answer -match '^(?i:y|yes)$'
}

function Confirm-TunnelInstall {
  return Confirm-OptionalInstall $env:AGENT_HELM_INSTALL_TUNNEL_CLIENT 'OpenAI tunnel-client is required for ChatGPT Tunnel.' $TunnelReleaseUrl 'Windows will use the corresponding Windows installation and verification flow.'
}

function Confirm-SerenaInstall {
  return Confirm-OptionalInstall $env:AGENT_HELM_INSTALL_SERENA 'Serena enables semantic code tools. Agent Helm works without it, but semantic tools stay unavailable.' 'https://github.com/oraios/serena' 'Agent Helm prefers an existing uv installation and uses compatible Python/pip only as a fallback.'
}


$arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if ($arch -notin @('AMD64', 'x64', 'X64')) { Fail "Windows installer currently supports win32-x64 only; detected $arch" }
if ($ExtensionId -notmatch '^[a-p]{32}$') { Fail 'Chrome extension id must be a 32-character extension id' }

function Test-DependencyExecutable([string]$Path, [string]$Probe) {
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) { return $false }
  try {
    & $Path $Probe *> $null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Find-TunnelClient {
  $command = Get-Command tunnel-client.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command -and (Test-DependencyExecutable $command.Source '--version')) { return $command.Source }
  $managed = Join-Path $ManagedBin 'tunnel-client.exe'
  if (Test-DependencyExecutable $managed '--version') { return $managed }
  return $null
}

function Find-Serena {
  foreach ($name in @('serena.exe', 'serena.cmd')) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and (Test-DependencyExecutable $command.Source '--help')) { return $command.Source }
  }
  $candidates = @(
    (Join-Path $ManagedBin 'serena.cmd'),
    (Join-Path $HOME '.local\bin\serena.exe')
  )
  if ($env:UV_TOOL_BIN_DIR) { $candidates += (Join-Path $env:UV_TOOL_BIN_DIR 'serena.exe') }
  if ($env:XDG_BIN_HOME) { $candidates += (Join-Path $env:XDG_BIN_HOME 'serena.exe') }
  if ($env:APPDATA) {
    $pythonRoot = Join-Path $env:APPDATA 'Python'
    if (Test-Path -LiteralPath $pythonRoot) {
      Get-ChildItem -LiteralPath $pythonRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $candidates += (Join-Path $_.FullName 'Scripts\serena.exe')
      }
    }
  }
  foreach ($candidate in $candidates) {
    if (Test-DependencyExecutable $candidate '--help') { return $candidate }
  }
  return $null
}

function Remote-Script([string]$Uri) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri
  $source = if ($response.Content -is [byte[]]) {
    [System.Text.Encoding]::UTF8.GetString($response.Content)
  } else {
    [string]$response.Content
  }
  $source = $source.TrimStart([char]0xFEFF)
  if ([string]::IsNullOrWhiteSpace($source)) { Fail "downloaded script is empty: $Uri" }
  return [scriptblock]::Create($source)
}

function Install-ChromeExtensionArchive([string]$Zip, [string]$Destination) {
  # Keep staging and destination on the same volume so activation is a rename.
  $parent = [System.IO.Path]::GetDirectoryName($Destination)
  $id = [guid]::NewGuid().ToString('N')
  $stage = Join-Path $parent "Agent-Helm-Chrome-Extension.stage.$id"
  $backup = "$Destination.previous.$id"
  $movedExisting = $false
  try {
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    Expand-Archive -LiteralPath $Zip -DestinationPath $stage -Force
    if (-not (Test-Path -LiteralPath (Join-Path $stage 'manifest.json') -PathType Leaf)) {
      Fail 'Chrome Extension archive does not contain manifest.json'
    }
    if (Test-Path -LiteralPath $Destination) {
      Move-Item -LiteralPath $Destination -Destination $backup -ErrorAction Stop
      $movedExisting = $true
    }
    try {
      Move-Item -LiteralPath $stage -Destination $Destination -ErrorAction Stop
    } catch {
      $activationError = $_
      if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force -ErrorAction Stop
      }
      if ($movedExisting) {
        Move-Item -LiteralPath $backup -Destination $Destination -ErrorAction Stop
        $movedExisting = $false
      }
      throw $activationError
    }
    if ($movedExisting) {
      # A failed backup cleanup must not report an otherwise successful install
      # as failed; retain the old directory for manual removal in that case.
      try { Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction Stop }
      catch { Write-Warning "Chrome Extension updated; could not remove old directory: $backup" }
    }
  } finally {
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$ReleaseTool = Remote-Script $ReleaseToolUrl
$downloads = Join-Path $HOME 'Downloads'
$destination = Join-Path $downloads 'Agent-Helm-Chrome-Extension'
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("agent-helm-chrome-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $downloads, $temp -Force | Out-Null
$manifestPath = Join-Path $temp 'release-manifest.json'
try {
  $Version = (& $ReleaseTool resolve -ReleaseUrl $ReleaseUrl -Version $Version -ManifestPath $manifestPath | Select-Object -Last 1).Trim()
  $AgentHelmProductVersion = (& $ReleaseTool field -ReleaseUrl $ReleaseUrl -Version $Version -Field 'agentHelmVersion' -ManifestPath $manifestPath | Select-Object -Last 1).Trim()
  $AgentHelmReleaseVersion = (& $ReleaseTool field -ReleaseUrl $ReleaseUrl -Version $Version -Field 'agentHelmReleaseVersion' -ManifestPath $manifestPath | Select-Object -Last 1).Trim()
  Write-Host "Agent Helm Chrome: Release v$Version -> Agent Helm v$AgentHelmReleaseVersion -> $AgentHelmProductVersion"

  Stage 1 "Chrome Extension $($Version): download and verify"
  $zip = Join-Path $temp 'extension.zip'
  & $ReleaseTool download -ReleaseUrl $ReleaseUrl -Version $Version -ArtifactId 'agent-helm-chrome-extension' -Output $zip -ManifestPath $manifestPath
  Install-ChromeExtensionArchive -Zip $zip -Destination $destination
} finally {
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}

Stage 2 'Runtime / Node'
Write-Host 'Agent Helm installer will reuse Node.js 24.x or install its managed win-x64 runtime.'

Stage 3 "Agent Helm $AgentHelmProductVersion from Release v$AgentHelmReleaseVersion"
$coreManifestDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("agent-helm-core-manifest-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $coreManifestDirectory -Force | Out-Null
$coreManifestPath = Join-Path $coreManifestDirectory 'release-manifest.json'
try {
  $resolvedCore = (& $ReleaseTool resolve -ReleaseUrl $CoreReleaseUrl -Version $AgentHelmReleaseVersion -ManifestPath $coreManifestPath | Select-Object -Last 1).Trim()
  # The Core release manifest has no root agentHelmVersion field. The pinned
  # product identity/version is on the agent-helm-package artifact.
  $coreManifest = [System.IO.File]::ReadAllText($coreManifestPath) | ConvertFrom-Json -ErrorAction Stop
  $corePackages = @($coreManifest.artifacts | Where-Object { $_.id -ceq 'agent-helm-package' })
  if (
    $resolvedCore -cne $AgentHelmReleaseVersion -or
    $corePackages.Count -ne 1 -or
    $corePackages[0].name -cne '@beforewave/agent-helm' -or
    $corePackages[0].version -cne $AgentHelmProductVersion
  ) {
    Fail 'Core Release manifest does not match Chrome Extension Agent Helm pin'
  }
  $AgentHelmInstall = Remote-Script $AgentHelmInstallUrl
  & $AgentHelmInstall -Version $AgentHelmReleaseVersion -ChromeExtensionId $ExtensionId -ReleaseManifestPath $coreManifestPath
  if ($LASTEXITCODE -ne 0) { Fail "Agent Helm $AgentHelmProductVersion installation from Release v$AgentHelmReleaseVersion failed" }
} finally {
  Remove-Item -LiteralPath $coreManifestDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

Stage 4 'OpenAI tunnel-client'
$ExistingTunnelClient = Find-TunnelClient
if ($ExistingTunnelClient) {
  Write-Host "Agent Helm Chrome: using existing tunnel-client from $ExistingTunnelClient."
} elseif (Confirm-TunnelInstall) {
  if (-not (Test-Path -LiteralPath $AgentHelmLauncher)) { Fail "Agent Helm CLI launcher is missing at $AgentHelmLauncher" }
  & $AgentHelmLauncher setup tunnel-client --channel chrome --yes
  if ($LASTEXITCODE -ne 0) { Fail 'OpenAI tunnel-client installation failed' }
} else {
  Write-Host 'Agent Helm Chrome: tunnel-client installation skipped. You can install it later from the Tunnel configuration screen.'
}

Stage 5 'Serena semantic tools'
$ExistingSerena = Find-Serena
if ($ExistingSerena) {
  Write-Host "Agent Helm Chrome: using existing Serena from $ExistingSerena."
} elseif (Confirm-SerenaInstall) {
  if (-not (Test-Path -LiteralPath $AgentHelmLauncher)) { Fail "Agent Helm CLI launcher is missing at $AgentHelmLauncher" }
  & $AgentHelmLauncher setup serena --yes
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'Agent Helm Chrome: Serena installed and verified.'
  } else {
    Write-Host 'Agent Helm Chrome: Serena installation did not complete. Semantic tools can be set up later.'
  }
} else {
  Write-Host 'Agent Helm Chrome: Serena installation skipped. You can install it later from Agent Helm.'
}

Stage 6 "Native Messaging bridge: $ExtensionId"
Write-Host 'Agent Helm bridge registered for the selected Chrome Extension ID.'

Stage 7 'Chrome handoff'
Write-Host "Extension files: $destination"
Write-Host 'Chrome: Developer mode -> Load unpacked -> select that directory.'

$chromeCandidates = @(
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe')
)
if (${env:ProgramFiles(x86)}) { $chromeCandidates += (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe') }
$chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if ($chrome) {
  try { Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions' | Out-Null }
  catch { Write-Warning "Chrome Extension installed; could not open Chrome: $($_.Exception.Message)" }
}
try { Start-Process -FilePath 'explorer.exe' -ArgumentList @($destination) | Out-Null }
catch { Write-Warning "Chrome Extension installed; could not open its folder: $($_.Exception.Message)" }
