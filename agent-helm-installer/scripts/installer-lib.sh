#!/bin/sh
set -eu

agent_helm_fail() {
  printf '%s\n' "Agent Helm Installer: $1" >&2
  exit 1
}

agent_helm_extension_id_from_package() {
  package_path=${1:-${PACKAGE_PATH:-}}
  [ -n "$package_path" ] || agent_helm_fail "Package path is unavailable. Download the installer from the Agent Helm Chrome Extension."
  package_name=${package_path##*/}
  extension_id=$(printf '%s\n' "$package_name" | sed -n 's/^Agent-Helm-Installer-[0-9][A-Za-z0-9._+-]*--chrome-\([a-p][a-p]*\)\.pkg$/\1/p')
  case "$extension_id" in
    ????????????????????????????????) ;;
    *) agent_helm_fail "Chrome Extension ID is missing from the installer filename. Download the installer again from the Agent Helm Chrome Extension." ;;
  esac
  printf '%s\n' "$extension_id"
}

agent_helm_console_user() {
  user=$(/usr/bin/stat -f '%Su' /dev/console 2>/dev/null || true)
  case "$user" in
    ''|root|loginwindow) agent_helm_fail "No signed-in macOS user is available for the user-scoped Agent Helm installation." ;;
  esac
  printf '%s\n' "$user"
}

agent_helm_user_home() {
  user=$1
  home=$(/usr/bin/dscl . -read "/Users/$user" NFSHomeDirectory 2>/dev/null | sed 's/^NFSHomeDirectory:[[:space:]]*//' || true)
  [ -n "$home" ] || agent_helm_fail "Could not resolve the home directory for $user."
  printf '%s\n' "$home"
}

agent_helm_preflight() {
  [ "$(/usr/bin/uname -s)" = Darwin ] || agent_helm_fail "This installer supports macOS only."
  [ -x /usr/bin/sudo ] || agent_helm_fail "macOS sudo is required to enter the signed-in user's install context."
  [ -x /usr/bin/stat ] || agent_helm_fail "macOS stat is required."
  [ -x /usr/bin/dscl ] || agent_helm_fail "macOS directory services are required."
  agent_helm_extension_id_from_package "$1" >/dev/null
  user=$(agent_helm_console_user)
  agent_helm_user_home "$user" >/dev/null
}

agent_helm_postflight() {
  home=$1
  extension_id=$2
  cli="$home/.agent-helm/bin/agent-helm"
  manifest="$home/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.beforewave.agent_helm.json"
  [ -x "$cli" ] || agent_helm_fail "Agent Helm CLI postflight failed: $cli is missing."
  "$cli" --version >/dev/null 2>&1 || agent_helm_fail "Agent Helm CLI postflight failed: installed runtime cannot execute."
  [ -f "$manifest" ] || agent_helm_fail "Native Messaging postflight failed: host manifest is missing."
  /usr/bin/grep -F "chrome-extension://$extension_id/" "$manifest" >/dev/null 2>&1 \
    || agent_helm_fail "Native Messaging postflight failed: current Chrome Extension ID was not registered."
}
