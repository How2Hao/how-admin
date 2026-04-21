import { ChatOpenAI } from '@langchain/openai'

export const DeepSeekModel = new ChatOpenAI({
  model: 'Pro/deepseek-ai/DeepSeek-V3.2',
  apiKey: 'sk-ytxtsnfaqzbdocykbvcbttuehzzscytubvczewvwnezueodx',
  temperature: 0,
  configuration: {
    baseURL: 'https://api.siliconflow.cn/v1',
  },
})
