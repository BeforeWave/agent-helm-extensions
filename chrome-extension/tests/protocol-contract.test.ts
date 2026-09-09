import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

it('keeps the Agent Helm Native Messaging host path stable', () => {
  expect(read('../src/client/factories.ts')).toContain("'com.beforewave.agent_helm'")
})

it('keeps Chrome Native Messaging method paths on the frozen entry contract', () => {
  const source = read('../src/adapters/chrome/NativeAgentHelmService.ts')
  const actual = [...new Set([...source.matchAll(/(?:this\.)?(?:transport\.)?request(?:<[^\n]*?>)?\(\s*['\"]([^'\"]+)['\"]/g)].map((match) => match[1]))].sort()
  expect(actual).toEqual([
    'bindChatUrl', 'chooseAndRegisterWorkspace', 'configureTunnel', 'findChatSessionSummaryByUrl',
    'getChatSessionSummary', 'getChatSessionTimeline', 'getExternalUserAccess', 'installDependency',
    'listChatSessionSummaryPage', 'listWorkspaces', 'setAgentDelegationEnabled', 'setDaemonEnabled',
    'setExternalAgentLspEnabled', 'setExternalUserAccess', 'setLocalMcpEnabled', 'supervisorHealth',
  ])
})


it('keeps the additive External Code Sense control backward-compatible with older Core health', () => {
  const source = read('../src/adapters/chrome/NativeAgentHelmService.ts')
  expect(source).toContain("const externalAgentLspStateKnown = typeof health.externalAgentLspEnabled === 'boolean'")
  expect(source).toContain('const externalAgentLspConfigurable = externalAgentLspStateKnown && booleanValue(policy.semantic)')
})
