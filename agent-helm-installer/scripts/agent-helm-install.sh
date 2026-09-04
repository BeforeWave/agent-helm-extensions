#!/bin/sh
set -eu

# Package-owned backend used by the macOS PKG. Public curl installation is provided by BeforeWave/agent-helm install.sh.

PACKAGE=${AGENT_HELM_PACKAGE:-@beforewave/agent-helm}
VERSION=${AGENT_HELM_VERSION:-latest}
RUNTIME_BUNDLE=${AGENT_HELM_RUNTIME_BUNDLE:-}
RUNTIME_BUNDLE_SHA256=${AGENT_HELM_RUNTIME_BUNDLE_SHA256:-}
PREFIX=${AGENT_HELM_INSTALL_PREFIX:-$HOME/.agent-helm/npm}
NODE_VERSION=22.23.2
NODE_RUNTIME_ROOT=$HOME/.agent-helm/runtime/node
NODE_RUNTIME_DIR=$NODE_RUNTIME_ROOT/v$NODE_VERSION
NODE_CURRENT=$NODE_RUNTIME_ROOT/current
MIN_NODE_MAJOR=22

fail() {
  printf "%s\n" "Agent Helm installer: $1" >&2
  exit 1
}

case "$(uname -s)" in
  Darwin) NODE_OS=darwin; NODE_EXT=tar.gz ;;
  Linux) NODE_OS=linux; NODE_EXT=tar.xz ;;
  *) fail "Agent Helm installer currently supports macOS and Linux." ;;
esac

case "$(uname -m)" in
  arm64|aarch64) NODE_ARCH=arm64 ;;
  x86_64|amd64) NODE_ARCH=x64 ;;
  *) fail "Managed Node.js is not available for $(uname -s)/$(uname -m)." ;;
esac

node_major() {
  "$1" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0\n'
}

usable_node() {
  [ -n "${1:-}" ] && [ -x "$1" ] && [ "$(node_major "$1")" -ge "$MIN_NODE_MAJOR" ]
}

system_node() {
  command -v node 2>/dev/null || true
}

checksum_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    fail "SHA-256 verification requires shasum or sha256sum."
  fi
}

install_managed_node() {
  command -v curl >/dev/null 2>&1 || fail "curl is required to download the managed Node.js runtime."
  command -v tar >/dev/null 2>&1 || fail "tar is required to install the managed Node.js runtime."

  ASSET=node-v${NODE_VERSION}-${NODE_OS}-${NODE_ARCH}.${NODE_EXT}
  BASE=https://nodejs.org/dist/v${NODE_VERSION}
  TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/agent-helm-node.XXXXXX")
  trap 'rm -rf "$TMP_ROOT"' EXIT HUP INT TERM
  ARCHIVE=$TMP_ROOT/$ASSET
  SHASUMS=$TMP_ROOT/SHASUMS256.txt

  printf "%s\n" "Agent Helm: Node.js ${NODE_VERSION} is required; downloading the managed runtime from nodejs.org..."
  curl -fL --retry 2 --connect-timeout 15 "$BASE/$ASSET" -o "$ARCHIVE"
  curl -fL --retry 2 --connect-timeout 15 "$BASE/SHASUMS256.txt" -o "$SHASUMS"

  EXPECTED=$(awk -v asset="$ASSET" '$2 == asset || $2 == "*" asset { print $1; exit }' "$SHASUMS")
  [ -n "$EXPECTED" ] || fail "Node.js SHASUMS256.txt does not contain $ASSET."
  ACTUAL=$(checksum_file "$ARCHIVE")
  [ "$ACTUAL" = "$EXPECTED" ] || fail "Node.js SHA-256 verification failed for $ASSET."

  EXTRACT=$TMP_ROOT/extract
  mkdir -p "$EXTRACT" "$NODE_RUNTIME_ROOT"
  tar -xf "$ARCHIVE" -C "$EXTRACT"
  SOURCE=$EXTRACT/node-v${NODE_VERSION}-${NODE_OS}-${NODE_ARCH}
  [ -x "$SOURCE/bin/node" ] || fail "Downloaded Node.js archive did not contain bin/node."

  rm -rf "$NODE_RUNTIME_DIR.tmp"
  mv "$SOURCE" "$NODE_RUNTIME_DIR.tmp"
  rm -rf "$NODE_RUNTIME_DIR"
  mv "$NODE_RUNTIME_DIR.tmp" "$NODE_RUNTIME_DIR"
  rm -f "$NODE_CURRENT"
  ln -s "$NODE_RUNTIME_DIR" "$NODE_CURRENT"

  trap - EXIT HUP INT TERM
  rm -rf "$TMP_ROOT"
}

MANAGED_NODE=$NODE_CURRENT/bin/node
FOUND_NODE=$(system_node)
if usable_node "$FOUND_NODE"; then
  NODE_BIN=$FOUND_NODE
  printf "%s\n" "Agent Helm: using existing $("$NODE_BIN" --version)."
elif usable_node "$MANAGED_NODE"; then
  NODE_BIN=$MANAGED_NODE
  printf "%s\n" "Agent Helm: using managed $("$NODE_BIN" --version)."
else
  install_managed_node
  NODE_BIN=$MANAGED_NODE
fi

NODE_BIN_DIR=${NODE_BIN%/*}
PATH="$NODE_BIN_DIR:${PATH:-/usr/bin:/bin}"
export PATH
if [ -z "$RUNTIME_BUNDLE" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    if [ "$NODE_BIN" != "$MANAGED_NODE" ]; then
      printf "%s\n" "Agent Helm: the existing Node.js runtime does not provide npm; switching to the managed runtime."
      if ! usable_node "$MANAGED_NODE"; then install_managed_node; fi
      NODE_BIN=$MANAGED_NODE
      NODE_BIN_DIR=${NODE_BIN%/*}
      PATH="$NODE_BIN_DIR:${PATH:-/usr/bin:/bin}"
      export PATH
    fi
  fi
  command -v npm >/dev/null 2>&1 || fail "npm was not found next to the selected Node.js runtime."
fi

mkdir -p "$HOME/.agent-helm" "$HOME/.agent-helm/bin"
if [ -n "$RUNTIME_BUNDLE" ]; then
  [ "$VERSION" != latest ] || fail "A bundled runtime requires an explicit Agent Helm version."
  [ -f "$RUNTIME_BUNDLE" ] || fail "Bundled Agent Helm runtime is missing."
  printf '%s\n' "$RUNTIME_BUNDLE_SHA256" | grep -Eq '^[0-9a-fA-F]{64}$' || fail "Bundled Agent Helm runtime SHA-256 is invalid."
  EXPECTED_RUNTIME_SHA=$(printf '%s' "$RUNTIME_BUNDLE_SHA256" | tr 'A-F' 'a-f')
  ACTUAL_RUNTIME_SHA=$(checksum_file "$RUNTIME_BUNDLE")
  [ "$ACTUAL_RUNTIME_SHA" = "$EXPECTED_RUNTIME_SHA" ] || fail "Bundled Agent Helm runtime SHA-256 verification failed."
  INSTALL_ROOT=$(mktemp -d "$HOME/.agent-helm/npm.install.XXXXXX")
  trap 'rm -rf "$INSTALL_ROOT"' EXIT HUP INT TERM
  printf "%s\n" "Installing bundled Agent Helm ${VERSION} runtime..."
  tar -xf "$RUNTIME_BUNDLE" -C "$INSTALL_ROOT"
  [ -f "$INSTALL_ROOT/node_modules/$PACKAGE/lib/cli.js" ] || fail "Bundled Agent Helm runtime does not contain the CLI."
  BACKUP_PREFIX="$PREFIX.previous"
  rm -rf "$BACKUP_PREFIX"
  if [ -e "$PREFIX" ]; then mv "$PREFIX" "$BACKUP_PREFIX"; fi
  if mv "$INSTALL_ROOT" "$PREFIX"; then
    rm -rf "$BACKUP_PREFIX"
  else
    rm -rf "$PREFIX"
    if [ -e "$BACKUP_PREFIX" ]; then mv "$BACKUP_PREFIX" "$PREFIX"; fi
    fail "Could not activate the bundled Agent Helm runtime."
  fi
  trap - EXIT HUP INT TERM
else
  printf "%s\n" "Installing ${PACKAGE}@${VERSION}..."
  npm install --prefix "$PREFIX" "${PACKAGE}@${VERSION}" --no-audit --no-fund
fi

CLI_JS=$PREFIX/node_modules/$PACKAGE/lib/cli.js
[ -f "$CLI_JS" ] || fail "Agent Helm CLI was not installed at $CLI_JS"

CLI_LAUNCHER=$HOME/.agent-helm/bin/agent-helm
cat > "$CLI_LAUNCHER" <<LAUNCHER
#!/bin/sh
set -eu
MANAGED_NODE="$NODE_CURRENT/bin/node"
FALLBACK_NODE="$NODE_BIN"
CLI_JS="$CLI_JS"
node_ok() {
  [ -x "\$1" ] && [ "\$("\$1" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf 0)" -ge 22 ]
}
if node_ok "\$MANAGED_NODE"; then NODE_BIN="\$MANAGED_NODE"
elif command -v node >/dev/null 2>&1 && node_ok "\$(command -v node)"; then NODE_BIN="\$(command -v node)"
elif node_ok "\$FALLBACK_NODE"; then NODE_BIN="\$FALLBACK_NODE"
else printf '%s\n' 'Agent Helm: Node.js 22+ runtime is unavailable; reinstall Agent Helm.' >&2; exit 127
fi
exec "\$NODE_BIN" "\$CLI_JS" "\$@"
LAUNCHER
chmod 755 "$CLI_LAUNCHER"

if [ -n "${AGENT_HELM_CHROME_EXTENSION_ID:-}" ]; then
  printf "%s\n" "Agent Helm installed. Registering the Chrome bridge for ${AGENT_HELM_CHROME_EXTENSION_ID}..."
  exec "$CLI_LAUNCHER" install-chrome-native-host --extension-id "$AGENT_HELM_CHROME_EXTENSION_ID"
fi

printf "%s\n" "Agent Helm runtime installed."
exit 0
