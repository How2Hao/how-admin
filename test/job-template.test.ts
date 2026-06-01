import { describe, expect, it } from 'vitest'
import { getJobTemplateSchema, parseJobTemplateId, toJobTemplateMutation } from '../server/utils/jobTemplate'

describe('getJobTemplateSchema', () => {
  const base = {
    title: '本月刷满5笔',
    repeatType: 'MONTHLY',
    tiers: [{ minAmount: null, minCount: 5, logic: 'OR', description: '达标即可' }],
  }

  it('accepts a minimal valid payload and defaults optional fields', () => {
    const r = getJobTemplateSchema().safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.startDate).toBeNull()
      expect(r.data.endDate).toBeNull()
      expect(r.data.taskTemplateId).toBeNull()
      expect(r.data.tiers[0].logic).toBe('OR')
    }
  })

  it('defaults tier.logic to AND when omitted', () => {
    const r = getJobTemplateSchema().safeParse({ ...base, tiers: [{ minAmount: 100, minCount: null, description: null }] })
    expect(r.success).toBe(true)
    if (r.success)
      expect(r.data.tiers[0].logic).toBe('AND')
  })

  it('rejects empty title', () => {
    expect(getJobTemplateSchema().safeParse({ ...base, title: '' }).success).toBe(false)
  })

  it('rejects empty tiers array', () => {
    expect(getJobTemplateSchema().safeParse({ ...base, tiers: [] }).success).toBe(false)
  })

  it('rejects unknown repeatType', () => {
    expect(getJobTemplateSchema().safeParse({ ...base, repeatType: 'HOURLY' }).success).toBe(false)
  })
})

describe('toJobTemplateMutation', () => {
  const parsed = getJobTemplateSchema().parse({
    title: '本月刷满5笔',
    repeatType: 'MONTHLY',
    startDate: 1000,
    endDate: 2000,
    tiers: [{ minAmount: 100, minCount: 5, logic: 'AND', description: 'x' }],
    bankId: 7,
  })

  it('maps validated input to db column values', () => {
    const v = toJobTemplateMutation(parsed)
    expect(v.title).toBe('本月刷满5笔')
    expect(v.repeatType).toBe('MONTHLY')
    expect(v.startDate).toBe(1000)
    expect(v.bankId).toBe(7)
    expect(v.taskTemplateId).toBeNull()
    expect(v.bankCardTemplateId).toBeNull()
    expect(v.isVisible).toBe(0)
    expect(v.tiers).toHaveLength(1)
  })

  it('coerces isVisible truthy to 1', () => {
    const v = toJobTemplateMutation(getJobTemplateSchema().parse({ ...parsed, isVisible: true }))
    expect(v.isVisible).toBe(1)
  })
})

describe('parseJobTemplateId', () => {
  it('parses a positive integer string', () => {
    expect(parseJobTemplateId('42')).toBe(42)
  })

  it('throws on non-positive / non-integer', () => {
    expect(() => parseJobTemplateId('0')).toThrow()
    expect(() => parseJobTemplateId('abc')).toThrow()
  })
})

describe('getJobTemplateSchema - region fields', () => {
  const base = {
    title: '测试',
    repeatType: 'MONTHLY' as const,
    tiers: [{ minCount: 1, logic: 'OR' as const, minAmount: null, description: null }],
  }

  it('defaults regionCode and regionMatchStrategy to null when omitted', () => {
    const r = getJobTemplateSchema().safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.regionCode).toBeNull()
      expect(r.data.regionMatchStrategy).toBeNull()
    }
  })

  it('accepts valid regionCode and regionMatchStrategy', () => {
    const r = getJobTemplateSchema().safeParse({ ...base, regionCode: '330000', regionMatchStrategy: 'EXCLUDE_PLAN_SINGLE_CITY' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.regionCode).toBe('330000')
      expect(r.data.regionMatchStrategy).toBe('EXCLUDE_PLAN_SINGLE_CITY')
    }
  })

  it('rejects regionMatchStrategy longer than 255 chars', () => {
    const r = getJobTemplateSchema().safeParse({ ...base, regionCode: '100000', regionMatchStrategy: 'x'.repeat(256) })
    expect(r.success).toBe(false)
  })
})

describe('toJobTemplateMutation - region fields', () => {
  it('includes regionCode and regionMatchStrategy in mutation output', () => {
    const parsed = getJobTemplateSchema().parse({
      title: 'x',
      repeatType: 'MONTHLY',
      tiers: [{ minCount: 1, logic: 'OR', minAmount: null, description: null }],
      regionCode: '110000',
      regionMatchStrategy: 'INCLUDE_ALL',
    })
    const v = toJobTemplateMutation(parsed)
    expect(v.regionCode).toBe('110000')
    expect(v.regionMatchStrategy).toBe('INCLUDE_ALL')
  })

  it('passes null through when region fields are absent', () => {
    const parsed = getJobTemplateSchema().parse({
      title: 'x',
      repeatType: 'MONTHLY',
      tiers: [{ minCount: 1, logic: 'OR', minAmount: null, description: null }],
    })
    const v = toJobTemplateMutation(parsed)
    expect(v.regionCode).toBeNull()
    expect(v.regionMatchStrategy).toBeNull()
  })
})
