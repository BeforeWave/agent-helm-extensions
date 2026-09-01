#!/bin/sh
set -eu

agent_helm_installer_integrity_fail() {
  printf '%s\n' "Agent Helm Installer: $1" >&2
  return 1
}

agent_helm_installer_manifest_mode() {
  manifest_url=$1
  version=$2
  production="https://github.com/BeforeWave/agent-helm/releases/download/v${version}/release-manifest.json"
  if [ "$manifest_url" = "$production" ]; then
    printf '%s\n' production
    return 0
  fi
  case "$manifest_url" in
    http://127.0.0.1:*/*|http://localhost:*/*) printf '%s\n' uat ;;
    *) agent_helm_installer_integrity_fail "release manifest URL must use the official Agent Helm release or an explicit loopback UAT endpoint." ;;
  esac
}

agent_helm_installer_manifest_value() {
  file=$1
  key=$2
  /usr/bin/plutil -extract "$key" raw -o - "$file" 2>/dev/null
}

agent_helm_verify_installer_manifest_file() {
  manifest_file=$1
  manifest_url=$2
  version=$3
  package_path=$4
  mode=$(agent_helm_installer_manifest_mode "$manifest_url" "$version")
  [ -f "$manifest_file" ] || agent_helm_installer_integrity_fail "release manifest is unavailable."
  [ -f "$package_path" ] || agent_helm_installer_integrity_fail "installer package is unavailable for integrity verification."
  [ "$(/usr/bin/wc -c < "$manifest_file" | /usr/bin/tr -d ' ')" -le 2097152 ] || agent_helm_installer_integrity_fail "release manifest is too large."
  [ "$(agent_helm_installer_manifest_value "$manifest_file" schemaVersion)" = 1 ] || agent_helm_installer_integrity_fail "release manifest schema is invalid."
  [ "$(agent_helm_installer_manifest_value "$manifest_file" releaseVersion)" = "$version" ] || agent_helm_installer_integrity_fail "release manifest version does not match Agent Helm Installer."

  match_index=''
  match_count=0
  index=0
  while id=$(agent_helm_installer_manifest_value "$manifest_file" "artifacts.$index.id"); do
    if [ "$id" = agent-helm-installer ]; then
      match_index=$index
      match_count=$((match_count + 1))
    fi
    index=$((index + 1))
  done
  [ "$match_count" -eq 1 ] || agent_helm_installer_integrity_fail "release manifest must contain exactly one Agent Helm Installer artifact."

  prefix="artifacts.$match_index"
  asset="Agent-Helm-Installer-${version}.pkg"
  [ "$(agent_helm_installer_manifest_value "$manifest_file" "$prefix.kind")" = native-installer ] || agent_helm_installer_integrity_fail "installer artifact kind is invalid."
  [ "$(agent_helm_installer_manifest_value "$manifest_file" "$prefix.platform")" = macos ] || agent_helm_installer_integrity_fail "installer artifact platform is invalid."
  [ "$(agent_helm_installer_manifest_value "$manifest_file" "$prefix.version")" = "$version" ] || agent_helm_installer_integrity_fail "installer artifact version is invalid."
  [ "$(agent_helm_installer_manifest_value "$manifest_file" "$prefix.assetName")" = "$asset" ] || agent_helm_installer_integrity_fail "installer artifact name is invalid."
  download_url=$(agent_helm_installer_manifest_value "$manifest_file" "$prefix.downloadUrl")
  if [ "$mode" = production ]; then
    expected="https://github.com/BeforeWave/agent-helm/releases/download/v${version}/${asset}"
    [ "$download_url" = "$expected" ] || agent_helm_installer_integrity_fail "installer artifact URL is outside the official Agent Helm release."
  else
    manifest_origin=$(printf '%s\n' "$manifest_url" | /usr/bin/sed -E 's#^(http://[^/]+).*$#\1#')
    case "$download_url" in
      "$manifest_origin"/*) ;;
      *) agent_helm_installer_integrity_fail "UAT installer artifact URL must remain on the loopback release origin." ;;
    esac
  fi

  expected_sha=$(agent_helm_installer_manifest_value "$manifest_file" "$prefix.sha256" | /usr/bin/tr 'A-F' 'a-f')
  printf '%s\n' "$expected_sha" | /usr/bin/grep -Eq '^[0-9a-f]{64}$' || agent_helm_installer_integrity_fail "installer artifact SHA-256 is invalid."
  actual_sha=$(/usr/bin/shasum -a 256 "$package_path" | /usr/bin/awk '{print $1}')
  [ "$actual_sha" = "$expected_sha" ] || agent_helm_installer_integrity_fail "installer artifact SHA-256 mismatch."
}

agent_helm_verify_installer_artifact() {
  manifest_url=$1
  version=$2
  package_path=$3
  command -v /usr/bin/curl >/dev/null 2>&1 || agent_helm_installer_integrity_fail "curl is required for installer integrity verification."
  [ -x /usr/bin/plutil ] || agent_helm_installer_integrity_fail "plutil is required for installer integrity verification."
  [ -x /usr/bin/shasum ] || agent_helm_installer_integrity_fail "shasum is required for installer integrity verification."

  temp_root=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/agent-helm-installer-integrity.XXXXXX")
  manifest_file="$temp_root/release-manifest.json"
  trap '/bin/rm -rf "$temp_root"' EXIT HUP INT TERM
  mode=$(agent_helm_installer_manifest_mode "$manifest_url" "$version")
  if [ "$mode" = production ]; then
    /usr/bin/curl -fsSL --proto '=https' --tlsv1.2 "$manifest_url" -o "$manifest_file" \
      || agent_helm_installer_integrity_fail "could not download the official release manifest."
  else
    /usr/bin/curl -fsSL "$manifest_url" -o "$manifest_file" \
      || agent_helm_installer_integrity_fail "could not download the UAT release manifest."
  fi
  agent_helm_verify_installer_manifest_file "$manifest_file" "$manifest_url" "$version" "$package_path"
  trap - EXIT HUP INT TERM
  /bin/rm -rf "$temp_root"
}
