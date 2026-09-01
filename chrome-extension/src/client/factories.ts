import { ChromeBrowserCapabilities } from '../adapters/chrome/ChromeBrowserCapabilities'
import { NativeAgentHelmService } from '../adapters/chrome/NativeAgentHelmService'
import { NativeMessagingTransport } from '../adapters/chrome/NativeMessagingTransport'
import { MockAgentHelmService } from '../adapters/mock/MockAgentHelmService'
import { MockBrowserCapabilities } from '../adapters/mock/MockBrowserCapabilities'
import { BrowserControlPlaneClient } from './BrowserControlPlaneClient'

export function createChromeControlPlaneClient(): BrowserControlPlaneClient {
  const hostName = import.meta.env.WXT_AGENT_HELM_NATIVE_HOST_NAME ?? 'com.beforewave.agent_helm'
  return new BrowserControlPlaneClient(
    new NativeAgentHelmService(new NativeMessagingTransport(hostName)),
    new ChromeBrowserCapabilities(),
  )
}

export function createMockControlPlaneClient(): { client: BrowserControlPlaneClient; browser: MockBrowserCapabilities; service: MockAgentHelmService } {
  const browser = new MockBrowserCapabilities()
  const service = new MockAgentHelmService()
  return { client: new BrowserControlPlaneClient(service, browser), browser, service }
}
