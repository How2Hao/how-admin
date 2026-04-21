import Fuse from 'fuse.js'
import { tool } from 'langchain'
import * as z from 'zod'
import { bankCardTemplate } from '../../../drizzle/schema'
import { db } from '../../db'

export const getBankCardTemplateIdTool = tool(
  async ({ cardName }) => {
    const templates = await db.select({
      id: bankCardTemplate.id,
      cardName: bankCardTemplate.cardName,
    }).from(bankCardTemplate)

    const fuse = new Fuse(templates, {
      keys: ['cardName'],
      threshold: 0.5,
    })

    const results = fuse.search(cardName)

    if (results.length === 0) {
      return JSON.stringify({
        success: false,
        message: `未找到银行卡模板 "${cardName}"，请检查名称后重试`,
      })
    }

    const topMatches = results.slice(0, 3)
    return JSON.stringify({
      success: true,
      matches: topMatches.map(match => ({
        templateId: match.item.id,
        cardName: match.item.cardName,
      })),
      message: `找到 ${topMatches.length} 个匹配的银行卡模板，请根据实际情况选择正确的银行卡模板ID`,
    })
  },
  {
    name: 'get_bank_card_template_id',
    description: '根据银行卡模板名称模糊搜索获取银行卡模板ID。支持模板名称模糊匹配。',
    schema: z.object({
      cardName: z.string().describe('银行卡模板名称，例如: 上海农商银行商务卡等'),
    }),
  },
)
