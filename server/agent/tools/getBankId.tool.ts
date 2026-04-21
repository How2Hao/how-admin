import Fuse from 'fuse.js'
import { tool } from 'langchain'
import * as z from 'zod'
import { bank } from '../../../drizzle/schema'
import { db } from '../../db'

export const getBankIdTool = tool(
  async ({ bankName }) => {
    const banks = await db.select({
      id: bank.id,
      name: bank.name,
    }).from(bank)

    const fuse = new Fuse(banks, {
      keys: ['name'],
      threshold: 0.5,
    })

    const results = fuse.search(bankName)

    if (results.length === 0) {
      return JSON.stringify({
        success: false,
        message: `未找到银行 "${bankName}"，请检查名称后重试`,
      })
    }

    const topMatches = results.slice(0, 3)
    return JSON.stringify({
      success: true,
      matches: topMatches.map(match => ({
        bankId: match.item.id,
        bankName: match.item.name,
      })),
      message: `找到 ${topMatches.length} 个匹配的银行，请根据实际情况选择正确的银行ID`,
    })
  },
  {
    name: 'get_bank_id',
    description: '根据银行名称模糊搜索获取银行ID。支持银行全称、简称等模糊匹配。',
    schema: z.object({
      bankName: z.string().describe('银行名称，例如: 华夏银行、建行、工商银行等'),
    }),
  },
)
