import { tool } from 'langchain'
import * as z from 'zod'
import { referenceData } from '../utils/referenceData'

export const getActivityCategoryIdTool = tool(
  async ({ categoryName }) => {
    const results = referenceData.searchActivityCategories(categoryName)

    if (results.length === 0) {
      return JSON.stringify({
        success: false,
        message: `未找到活动分类 "${categoryName}"，请检查名称后重试`,
      })
    }

    const matches = results.map(match => ({
      categoryId: match.item.id,
      categoryName: match.item.name,
      categoryCode: match.item.code,
    }))

    return JSON.stringify({
      success: true,
      matches,
      message: `找到 ${matches.length} 个匹配的活动分类，请根据实际情况选择正确的分类ID`,
    })
  },
  {
    name: 'get_activity_category_id',
    description: '根据活动分类名称模糊搜索获取活动分类ID。',
    schema: z.object({
      categoryName: z.string().describe('活动分类名称，例如: 支付优惠、餐饮优惠、商超便利等'),
    }),
  },
)
