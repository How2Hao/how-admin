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

  // The main parser contract is one primary activity per article.
  const bankTaskAgent = createAgent({
    model: DeepSeekModel,
    systemPrompt,
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
