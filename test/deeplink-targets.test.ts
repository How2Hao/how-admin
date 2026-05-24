import { describe, expect, it } from 'vitest'
import { DEEPLINK_TARGETS, buildRoutePayload } from '../src/pages/push/deeplink-targets'

const plaza = DEEPLINK_TARGETS.find(t => t.key === 'plaza')!
const finance = DEEPLINK_TARGETS.find(t => t.key === 'finance')!

describe('buildRoutePayload', () => {
  it('plaza + code → params.code', () => {
    expect(buildRoutePayload(plaza, 'SUMMER')).toEqual({ type: 'route', route: '/plaza', params: { code: 'SUMMER' } })
  })
  it('plaza without code → no params', () => {
    expect(buildRoutePayload(plaza, '')).toEqual({ type: 'route', route: '/plaza' })
  })
  it('param-less target ignores value', () => {
    expect(buildRoutePayload(finance, 'X')).toEqual({ type: 'route', route: '/finance' })
  })
})

describe('DEEPLINK_TARGETS', () => {
  it('only plaza declares a plazaCustomTab param', () => {
    expect(DEEPLINK_TARGETS.filter(t => t.param?.source === 'plazaCustomTab').map(t => t.key)).toEqual(['plaza'])
  })
})
