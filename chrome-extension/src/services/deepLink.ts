const SUPPORTED_LOCAL_PROTOCOLS = new Set(['vscode:', 'vscode-insiders:'])

export function isSupportedLocalDeepLink(value: string): boolean {
  try {
    return SUPPORTED_LOCAL_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}
