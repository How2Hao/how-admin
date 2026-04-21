import Fuse from 'fuse.js'
import { tool } from 'langchain'
import * as z from 'zod'
import { bank } from '../../../drizzle/schema'
import { db } from '../../db'

export const getBankIdTool = tool(
  async ({ bankName }) => {
    try {
      const banks = await db.select({
        id: bank.id,
        name: bank.name,
      }).from(bank)

      const fuse = new Fuse(banks, {
        keys: ['name'],
        threshold: 0.3,
      })

      const results = fuse.search(bankName)

      if (results.length === 0) {
        return JSON.stringify({
          success: false,
          message: `未找到银行 "${bankName}"，请检查名称后重试`,
        })
      }

      const topMatches = results.slice(0, 3)
      const matches = topMatches.map(match => ({
        bankId: match.item.id,
        bankName: match.item.name,
      }))

      const response = JSON.stringify({
        success: true,
        matches,
        message: `找到 ${matches.length} 个匹配的银行，请根据实际情况选择正确的银行ID`,
      })

      return response
    }
    catch (error) {
      console.error('getBankIdTool error:', error)
      return JSON.stringify({
        success: false,
        message: `搜索银行时发生错误: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  },
  {
    name: 'get_bank_id',
    description: '根据银行名称模糊搜索获取银行ID。支持银行全称、简称等模糊匹配。',
    schema: z.object({
      bankName: z.string().describe('银行名称，例如: 华夏银行、建行、工商银行等'),
    }),
  },
)
