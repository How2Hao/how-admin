import * as cheerio from 'cheerio'
import { createAgent, providerStrategy } from 'langchain'
import { NodeHtmlMarkdown } from 'node-html-markdown'
import z from 'zod'
import { DeepSeekModel } from '../models/deepseek'
import ocrPrompt from '../prompts/ocr.md?raw'

const API_URL = 'https://l2kc8fs9bdvaxape.aistudio-app.com/layout-parsing'
const TOKEN = '0b90f6202ae679799413654e301dac6ea9975074'

interface OCRResponse {
  layoutParsingResults: LayoutParsingResult[]
}

interface LayoutParsingResult {
  markdown: {
    text: string
  }
}

export async function performOCR(url: string): Promise<OCRResponse> {
  const headers = {
    'Authorization': `token ${TOKEN}`,
    'Content-Type': 'application/json',
  }

  const payload = {
    file: url,
    fileType: 1,
    useDocOrientationClassify: false,
    useDocUnwarping: false,
    useChartRecognition: false,
    prettifyMarkdown: true,
    visualize: false,
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const result = await response.json()
  return result.result
}

export async function ocrAgent(url: string) {
  const ocrResult = await performOCR(url)

  const ocrText = ocrResult.layoutParsingResults[0].markdown.text
  const $ = cheerio.load(ocrText)
  $('img').remove()
  const nhm = new NodeHtmlMarkdown({})
  const markdown = nhm.translate($.html())

  if (!markdown) {
    return null
  }

  const agent = createAgent({
    model: DeepSeekModel,
    systemPrompt: ocrPrompt,
    tools: [],
    responseFormat: providerStrategy(
      z.object({
        isSummary: z.boolean(),
      }),
    ),
  })

  const messages = [{
    role: 'user',
    content: markdown.slice(0, 500),
  }]

  const result = await agent.invoke({ messages })

  if (result.structuredResponse?.isSummary) {
    return markdown
  }
  return null
}
