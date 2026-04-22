import { tool } from 'langchain'
import * as z from 'zod'
import { referenceData } from '../utils/referenceData'

export const getBenefitUsagePlatformIdTool = tool(
  async ({ platformName }) => {
    const results = referenceData.searchUsagePlatforms(platformName)

    if (results.length === 0) {
      return JSON.stringify({
        success: false,
        message: `未找到使用平台 "${platformName}"，请检查名称后重试`,
      })
    }

    const matches = results.map(match => ({
      platformId: match.item.id,
      platformName: match.item.name,
    }))

    return JSON.stringify({
      success: true,
      matches,
      message: `找到 ${matches.length} 个匹配的使用平台，请根据实际情况选择正确的平台ID`,
    })
  },
  {
    name: 'get_benefit_usage_platform_id',
    description: '根据优惠使用平台名称模糊搜索获取平台ID。',
    schema: z.object({
      platformName: z.string().describe('优惠使用平台名称，例如: 微信支付、美团、云闪付等'),
    }),
  },
)
