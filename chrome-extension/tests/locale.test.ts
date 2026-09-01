import { describe, expect, it } from 'vitest'
import { createHelmTranslate, resolveHelmLocale } from '../src/locale'

describe('Chrome locale', () => {
  it('resolves all Chinese browser locales to the Chrome zh dictionary', () => {
    expect(resolveHelmLocale('zh-CN')).toBe('zh')
    expect(resolveHelmLocale('zh-TW')).toBe('zh')
    expect(resolveHelmLocale('en-US')).toBe('en')
    expect(resolveHelmLocale(undefined)).toBe('en')
  })

  it('uses the typed Chrome translations', () => {
    const zh = createHelmTranslate('zh')
    const en = createHelmTranslate('en')
    expect(zh('capabilityGroup')).toBe('能力')
    expect(zh('extensionOpenAgentHelm')).toBe('打开 Agent Helm')
    expect(zh('extensionActivitiesCount', { count: 3 })).toBe('3 条活动')
    expect(en('extensionOpenAgentHelm')).toBe('Open Agent Helm')
    expect(en('extensionActivitiesCount', { count: 3 })).toBe('3 activities')
  })
})
