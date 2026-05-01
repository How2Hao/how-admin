import type { ParserWebByURLResult } from '~~/utils/paserweb'
import { createAgent, toolStrategy } from 'langchain'
import { buildContent } from './content/buildContent'
import { DeepSeekModel } from './models/deepseek'
import systemPrompt from './prompts/system.md?raw'
import { getBankTaskGroupSchema } from './schemas/bankTask'
import { ocrAgent } from './subagents/ocr'
import { getActivityCategoryIdTool } from './tools/getActivityCategoryId.tool'
import { getBankCardTemplateIdTool } from './tools/getBankCardTemplateId.tool'
import { getBankIdTool } from './tools/getBankId.tool'
import { getBenefitCategoryIdTool } from './tools/getBenefitCategoryId.tool'
import { getBenefitPlatformIdTool } from './tools/getBenefitPlatformId.tool'
import { getBenefitUsagePlatformIdTool } from './tools/getBenefitUsagePlatformId.tool'
import { getRegionCodeTool } from './tools/getRegionCode.tool'

export async function runAgent(result: ParserWebByURLResult) {
  const { markdown, imageUrls } = result
  const ocrResults: string[] = []
  if (imageUrls?.length) {
    await Promise.all(imageUrls.map(async (imageUrl) => {
      const ocrResult = await ocrAgent(imageUrl)
      if (ocrResult) {
        ocrResults.push(ocrResult)
      }
    }))
  }

  const content = buildContent(markdown, ocrResults)
  const bankTaskSchema = getBankTaskGroupSchema()

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`
  const dynamicSystemPrompt = `${systemPrompt}

## 时间上下文（用于缺信息时的默认值）

- 今天: ${today}
- 本月最后一天: ${monthEnd}
- 当文章未明确给出活动开始时间时，startDate 默认填 "${today} 00:00:00"
- 当文章未明确给出活动结束时间时，endDate 默认填 "${monthEnd} 23:59:59"
`

  // The main parser contract is one primary activity per article.
  const bankTaskAgent = createAgent({
    model: DeepSeekModel,
    systemPrompt: dynamicSystemPrompt,
    tools: [
      getBankCardTemplateIdTool,
      getBankIdTool,
      getBenefitCategoryIdTool,
      getBenefitPlatformIdTool,
      getBenefitUsagePlatformIdTool,
      getActivityCategoryIdTool,
      getRegionCodeTool,
    ],
    responseFormat: toolStrategy(bankTaskSchema),
  })

  const bankTaskResult = await bankTaskAgent.invoke({
    messages: [{ role: 'user', content }],
  })

  const bankTask = bankTaskResult.structuredResponse

  return bankTask
}
