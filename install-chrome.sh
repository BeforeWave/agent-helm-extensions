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

fail() {
  printf '%s\n' "Agent Helm Chrome installer: $1" >&2
  exit 1
}

stage() {
  printf '%s\n' "Agent Helm Chrome [$1/5] $2"
}

release_tool() {
  curl -fsSL "$RELEASE_TOOL_URL" | /bin/sh -s -- "$@"
}

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v unzip >/dev/null 2>&1 || fail "unzip is required."

VERSION=$(release_tool resolve --release-url "$RELEASE_URL" --version "$VERSION") \
  || fail "Could not resolve Chrome Extension GitHub Release version."
AGENT_HELM_VERSION=$(release_tool field --release-url "$RELEASE_URL" --version "$VERSION" --field agentHelmVersion) \
  || fail "Could not resolve the Agent Helm version pinned by Chrome Extension $VERSION."
printf '%s\n' "Agent Helm Chrome: Extension $VERSION -> Agent Helm $AGENT_HELM_VERSION"

if command -v node >/dev/null 2>&1 && [ "$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf 0)" -ge 22 ]; then
  stage 1 "Runtime / Node: using existing $(node --version 2>/dev/null || printf 'Node.js')"
else
  stage 1 "Runtime / Node: Agent Helm will install its managed Node runtime"
fi

stage 2 "Agent Helm $AGENT_HELM_VERSION"
curl -fsSL "$AGENT_HELM_INSTALL_URL" | AGENT_HELM_CHROME_EXTENSION_ID="$EXTENSION_ID" /bin/sh -s -- "$AGENT_HELM_VERSION" \
  || fail "Agent Helm $AGENT_HELM_VERSION installation failed."
stage 3 "Native Messaging bridge: registered for $EXTENSION_ID"

ROOT=$(mktemp -d "${TMPDIR:-/tmp}/agent-helm-chrome.XXXXXX")
trap 'rm -rf "$ROOT"' EXIT HUP INT TERM
ZIP=$ROOT/extension.zip
STAGE=$ROOT/extension
stage 4 "Chrome Extension $VERSION: download and verify"
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

stage 5 "Chrome handoff: Extension files are ready at $TARGET"
printf '%s\n' "Open chrome://extensions, enable Developer mode, choose Load unpacked, and select:"
printf '%s\n' "$TARGET"
if [ "$(uname -s 2>/dev/null || true)" = Darwin ]; then
  /usr/bin/open "$TARGET" >/dev/null 2>&1 || true
  /usr/bin/open -a 'Google Chrome' 'chrome://extensions/' >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$TARGET" >/dev/null 2>&1 || true
fi
