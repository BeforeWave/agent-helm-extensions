#!/bin/sh
set -eu

agent_helm_fail() {
  printf '%s\n' "Agent Helm Installer: $1" >&2
  exit 1
}

agent_helm_stage() {
  printf '%s\n' "Agent Helm Installer [$1/4] $2"
}

agent_helm_extension_id_from_package() {
  package_path=${1:-${PACKAGE_PATH:-}}
  default_extension_id=${2:-}
  [ -n "$package_path" ] || agent_helm_fail "Package path is unavailable."
  package_name=${package_path##*/}
  case "$package_name" in
    Agent-Helm-Installer-[0-9]*.pkg)
      extension_id=$(printf '%s\n' "$package_name" | sed -n 's/^Agent-Helm-Installer-[0-9][A-Za-z0-9._+-]*--chrome-\([a-p][a-p]*\)\.pkg$/\1/p')
      if [ -n "$extension_id" ]; then
        case "$extension_id" in
          ????????????????????????????????) printf '%s\n' "$extension_id"; return 0 ;;
          *) agent_helm_fail "Chrome Extension ID in the installer filename is invalid." ;;
        esac
      fi
      printf '%s\n' "$package_name" | grep -Eq '^Agent-Helm-Installer-[0-9][A-Za-z0-9._+-]*\.pkg$' \
        || agent_helm_fail "Installer filename is invalid."
      if [ -n "$default_extension_id" ]; then
        case "$default_extension_id" in
          ????????????????????????????????) printf '%s\n' "$default_extension_id" ;;
          *) agent_helm_fail "Default Chrome Extension ID is invalid." ;;
        esac
      else
        printf '%s\n' ''
      fi
      ;;
    *) agent_helm_fail "Installer filename is invalid." ;;
  esac
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
  package_path=$1
  default_extension_id=${2:-}
  [ "$(/usr/bin/uname -s)" = Darwin ] || agent_helm_fail "This installer supports macOS only."
  [ -x /usr/bin/sudo ] || agent_helm_fail "macOS sudo is required to enter the signed-in user's install context."
  [ -x /usr/bin/stat ] || agent_helm_fail "macOS stat is required."
  [ -x /usr/bin/dscl ] || agent_helm_fail "macOS directory services are required."
  agent_helm_extension_id_from_package "$package_path" "$default_extension_id" >/dev/null
  user=$(agent_helm_console_user)
  agent_helm_user_home "$user" >/dev/null
}

agent_helm_postflight() {
  home=$1
  extension_id=${2:-}
  cli="$home/.agent-helm/bin/agent-helm"
  [ -x "$cli" ] || agent_helm_fail "Agent Helm CLI postflight failed: $cli is missing."
  "$cli" --version >/dev/null 2>&1 || agent_helm_fail "Agent Helm CLI postflight failed: installed runtime cannot execute."
  if [ -n "$extension_id" ]; then
    manifest="$home/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.beforewave.agent_helm.json"
    [ -f "$manifest" ] || agent_helm_fail "Native Messaging postflight failed: host manifest is missing."
    /usr/bin/grep -F "chrome-extension://$extension_id/" "$manifest" >/dev/null 2>&1 \
      || agent_helm_fail "Native Messaging postflight failed: current Chrome Extension ID was not registered."
  fi
}
