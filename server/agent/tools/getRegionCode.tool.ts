import { tool } from 'langchain'
import * as z from 'zod'
import { referenceData } from '../utils/referenceData'

export const getRegionCodeTool = tool(
  async ({ regionName }) => {
    const results = referenceData.searchRegions(regionName)

    if (results.length === 0) {
      return JSON.stringify({
        success: false,
        message: `未找到区域 "${regionName}"，请检查名称后重试`,
      })
    }

    const matches = results.map(match => ({
      regionCode: match.item.regionCode,
      regionName: match.item.regionName,
    }))

    return JSON.stringify({
      success: true,
      matches,
      message: `找到 ${matches.length} 个匹配的区域，请根据实际情况选择正确的区域代码`,
    })
  },
  {
    name: 'get_region_code',
    description: '根据区域名称模糊搜索获取区域代码。支持省市区名称模糊匹配。',
    schema: z.object({
      regionName: z.string().describe('区域名称，例如: 广东省、深圳市、北京市等'),
    }),
  },
)
