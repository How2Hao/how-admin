import { tool } from 'langchain'
import * as z from 'zod'
import { referenceData } from '../utils/referenceData'

export const getBenefitPlatformIdTool = tool(
  async ({ platformName }) => {
    const results = referenceData.findBenefitPlatformByName(platformName)

    if (!results) {
      return JSON.stringify({
        success: false,
        message: `未找到优惠平台 "${platformName}"，请检查名称后重试`,
      })
    }

    return JSON.stringify({
      success: true,
      matches: {
        platformId: results.id,
        platformName: results.name,
      },
      message: `找到优惠平台 "${results.name}"，ID 为 ${results.id}`,
    })
  },
  {
    name: 'get_benefit_platform_id',
    description: '根据优惠平台名称模糊搜索获取平台ID。',
    schema: z.object({
      platformName: z.enum(referenceData.benefitPlatformNames).describe('优惠平台名称'),
    }),
  },
)
