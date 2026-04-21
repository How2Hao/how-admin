import { tool } from 'langchain'
import * as z from 'zod'
import { referenceData } from '../utils/referenceData'

export const getBenefitCategoryIdTool = tool(
  async ({ categoryName }) => {
    const category = referenceData.findBenefitCategoryByName(categoryName)

    if (!category) {
      return JSON.stringify({
        success: false,
        message: `未找到优惠分类 "${categoryName}"，可选值: ${referenceData.benefitCategoryNames.join(', ')}`,
      })
    }

    return JSON.stringify({
      success: true,
      matches: [{
        categoryId: category.id,
        categoryName: category.name,
        icon: category.icon,
      }],
      message: `找到优惠分类 "${category.name}"，ID 为 ${category.id}`,
    })
  },
  {
    name: 'get_benefit_category_id',
    description: '根据优惠分类名称获取分类ID。可选值: 会员充值、电子卡券、支付立减、返现、积分、立减金、还款优惠',
    schema: z.object({
      categoryName: z.enum(referenceData.benefitCategoryNames).describe('优惠分类名称'),
    }),
  },
)
