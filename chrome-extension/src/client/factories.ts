import { BackgroundAgentHelmService } from '../adapters/chrome/BackgroundAgentHelmService'
import { ChromeBrowserCapabilities } from '../adapters/chrome/ChromeBrowserCapabilities'
import { NativeAgentHelmService } from '../adapters/chrome/NativeAgentHelmService'
import { NativeMessagingTransport } from '../adapters/chrome/NativeMessagingTransport'
import { MockAgentHelmService } from '../adapters/mock/MockAgentHelmService'
import { MockBrowserCapabilities, type MockBrowserCapabilitiesOptions } from '../adapters/mock/MockBrowserCapabilities'
import { BrowserControlPlaneClient } from './BrowserControlPlaneClient'

function nativeHostName(): string {
  return import.meta.env.WXT_AGENT_HELM_NATIVE_HOST_NAME ?? 'com.beforewave.agent_helm'
}

export function createChromeBackgroundService(): NativeAgentHelmService {
  return new NativeAgentHelmService(new NativeMessagingTransport(nativeHostName()))
}

export function createChromeControlPlaneClient(): BrowserControlPlaneClient {
  return new BrowserControlPlaneClient(
    new BackgroundAgentHelmService(),
    new ChromeBrowserCapabilities(),
  )
}

export function createMockControlPlaneClient(options: MockBrowserCapabilitiesOptions = {}): { client: BrowserControlPlaneClient; browser: MockBrowserCapabilities; service: MockAgentHelmService } {
  const browser = new MockBrowserCapabilities(options)
  const service = new MockAgentHelmService()
  return { client: new BrowserControlPlaneClient(service, browser), browser, service }
}
