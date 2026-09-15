#!/bin/sh
set -eu

# Stable raw bootstrap. Version selection is an argument; versioned artifacts live in GitHub Releases.
# curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh
# curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | sh -s -- 0.1.0

VERSION=${AGENT_HELM_EXTENSION_VERSION:-${1:-latest}}
VERSION=${VERSION#v}
RELEASE_URL=${AGENT_HELM_EXTENSION_RELEASE_URL:-https://github.com/BeforeWave/agent-helm-extensions/releases}
RELEASE_TOOL_URL=${BEFOREWAVE_RELEASE_TOOL_URL:-https://raw.githubusercontent.com/BeforeWave/agent-helm/main/install-release.sh}
AGENT_HELM_INSTALL_URL=${AGENT_HELM_INSTALL_URL:-https://raw.githubusercontent.com/BeforeWave/agent-helm/main/install.sh}
EXTENSION_ID=${AGENT_HELM_CHROME_EXTENSION_ID:-eigfmmjccbiinngdfifjkpmofandcgif}
TARGET=${AGENT_HELM_EXTENSION_DIR:-$HOME/Downloads/Agent-Helm-Chrome-Extension}
TUNNEL_RELEASE_URL=https://github.com/openai/tunnel-client/releases
CLI_LAUNCHER=$HOME/.agent-helm/bin/agent-helm

fail() {
  printf '%s\n' "Agent Helm Chrome installer: $1" >&2
  exit 1
}

stage() {
  printf '%s\n' "Agent Helm Chrome [$1/7] $2"
}

release_tool() {
  curl -fsSL "$RELEASE_TOOL_URL" | /bin/sh -s -- "$@"
}

confirm_optional_install() {
  override=$1
  title=$2
  source=$3
  note=${4:-}
  case "$override" in
    1) return 0 ;;
    0) return 1 ;;
  esac
  if [ ! -r /dev/tty ] || [ ! -w /dev/tty ]; then return 1; fi
  {
    printf '%s\n' "$title"
    printf '%s\n' "Source: $source"
    if [ -n "$note" ]; then printf '%s\n' "$note"; fi
    printf '%s' 'Install it now? [y/N] '
  } > /dev/tty

  answer=''
  prompt_interrupted=0
  trap 'prompt_interrupted=1' INT
  if IFS= read -r answer < /dev/tty; then :; fi
  trap - INT
  if [ "$prompt_interrupted" = 1 ]; then
    printf '\n' > /dev/tty
    return 1
  fi
  case "$answer" in
    y|Y|yes|YES|Yes) return 0 ;;
    *) return 1 ;;
  esac
}

confirm_tunnel_install() {
  note=''
  if [ "$(uname -s 2>/dev/null || true)" = Darwin ]; then
    note='macOS will also grant the downloaded component the required permission to run.'
  fi
  confirm_optional_install "${AGENT_HELM_INSTALL_TUNNEL_CLIENT:-}" \
    'OpenAI tunnel-client is required for ChatGPT Tunnel.' \
    "$TUNNEL_RELEASE_URL" \
    "$note"
}

confirm_serena_install() {
  confirm_optional_install "${AGENT_HELM_INSTALL_SERENA:-}" \
    'Serena enables semantic code tools. Agent Helm works without it, but semantic tools stay unavailable.' \
    'https://github.com/oraios/serena' \
    'Agent Helm prefers an existing uv installation and uses compatible Python/pip only as a fallback.'
}

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v unzip >/dev/null 2>&1 || fail "unzip is required."

VERSION=$(release_tool resolve --release-url "$RELEASE_URL" --version "$VERSION") \
  || fail "Could not resolve Chrome Extension GitHub Release version."
AGENT_HELM_PRODUCT_VERSION=$(release_tool field --release-url "$RELEASE_URL" --version "$VERSION" --field agentHelmVersion) \
  || fail "Could not resolve the Agent Helm product version pinned by Chrome Extension Release v$VERSION."
AGENT_HELM_RELEASE_VERSION=$(release_tool field --release-url "$RELEASE_URL" --version "$VERSION" --field agentHelmReleaseVersion) \
  || fail "Could not resolve the Agent Helm release pinned by Chrome Extension Release v$VERSION."
printf '%s\n' "Agent Helm Chrome: Release v$VERSION -> Extension/Installer artifact ${VERSION%-dev}; Agent Helm v$AGENT_HELM_RELEASE_VERSION -> $AGENT_HELM_PRODUCT_VERSION"

if command -v node >/dev/null 2>&1 && [ "$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf 0)" -ge 22 ]; then
  stage 1 "Runtime / Node: using existing $(node --version 2>/dev/null || printf 'Node.js')"
else
  stage 1 "Runtime / Node: Agent Helm will install its managed Node runtime"
fi

stage 2 "Agent Helm $AGENT_HELM_PRODUCT_VERSION from Release v$AGENT_HELM_RELEASE_VERSION"
curl -fsSL "$AGENT_HELM_INSTALL_URL" | AGENT_HELM_CHROME_EXTENSION_ID="$EXTENSION_ID" /bin/sh -s -- "$AGENT_HELM_RELEASE_VERSION" \
  || fail "Agent Helm installation from Release v$AGENT_HELM_RELEASE_VERSION failed."

stage 3 "OpenAI tunnel-client"
if EXISTING_TUNNEL_CLIENT=$(command -v tunnel-client 2>/dev/null) && "$EXISTING_TUNNEL_CLIENT" --version >/dev/null 2>&1; then
  printf '%s\n' "Agent Helm Chrome: using existing tunnel-client from $EXISTING_TUNNEL_CLIENT."
elif confirm_tunnel_install; then
  [ -x "$CLI_LAUNCHER" ] || fail "Agent Helm CLI launcher is missing at $CLI_LAUNCHER."
  "$CLI_LAUNCHER" setup tunnel-client --channel chrome --yes \
    || fail "OpenAI tunnel-client installation failed."
else
  printf '%s\n' 'Agent Helm Chrome: tunnel-client installation skipped. You can install it later from the Tunnel configuration screen.'
fi

stage 4 "Serena semantic tools"
if confirm_serena_install; then
  [ -x "$CLI_LAUNCHER" ] || fail "Agent Helm CLI launcher is missing at $CLI_LAUNCHER."
  if "$CLI_LAUNCHER" setup serena --yes; then
    printf '%s\n' 'Agent Helm Chrome: Serena installed and verified.'
  else
    printf '%s\n' 'Agent Helm Chrome: Serena installation did not complete. Semantic tools can be set up later.'
  fi
else
  printf '%s\n' 'Agent Helm Chrome: Serena installation skipped. You can install it later from Agent Helm.'
fi

stage 5 "Native Messaging bridge: registered for $EXTENSION_ID"

ROOT=$(mktemp -d "${TMPDIR:-/tmp}/agent-helm-chrome.XXXXXX")
trap 'rm -rf "$ROOT"' EXIT HUP INT TERM
ZIP=$ROOT/extension.zip
STAGE=$ROOT/extension
stage 6 "Chrome Extension $VERSION: download and verify"
release_tool download \
  --release-url "$RELEASE_URL" \
  --version "$VERSION" \
  --artifact-id agent-helm-chrome-extension \
  --output "$ZIP" >/dev/null \
  || fail "Could not download Chrome Extension GitHub Release v$VERSION."
mkdir -p "$STAGE" "$HOME/Downloads"
unzip -q "$ZIP" -d "$STAGE"
[ -f "$STAGE/manifest.json" ] || fail "Chrome Extension archive does not contain manifest.json."
rm -rf "$TARGET.previous"
if [ -e "$TARGET" ]; then mv "$TARGET" "$TARGET.previous"; fi
if mv "$STAGE" "$TARGET"; then
  rm -rf "$TARGET.previous"
else
  rm -rf "$TARGET"
  if [ -e "$TARGET.previous" ]; then mv "$TARGET.previous" "$TARGET"; fi
  fail "Could not place the Chrome Extension in Downloads."
fi
trap - EXIT HUP INT TERM
rm -rf "$ROOT"

stage 7 "Chrome handoff: Extension files are ready at $TARGET"
printf '%s\n' "Open chrome://extensions, enable Developer mode, choose Load unpacked, and select:"
printf '%s\n' "$TARGET"
if [ "$(uname -s 2>/dev/null || true)" = Darwin ]; then
  /usr/bin/open "$TARGET" >/dev/null 2>&1 || true
  /usr/bin/open -a 'Google Chrome' 'chrome://extensions/' >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$TARGET" >/dev/null 2>&1 || true
fi
