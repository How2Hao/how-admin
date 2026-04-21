import { ChatOpenAI } from '@langchain/openai'

export const MiniMaxModel = new ChatOpenAI({
  model: 'MiniMax-M2.7',
  apiKey: 'sk-cp-BkhqMxeTpl2BvJ5uWWTpFtrF0dUxJIqK3HjRZgG1k3MjfXQ7ZBu6Z5LecwPuR8AicJkhESzoNVH7lmLMLCeONOciTPDvl0V6ZfvzCwE3QU6XvXeKU3Ydm8U',
  configuration: {
    baseURL: 'https://api.minimaxi.com/v1',
  },
})

// import { ChatAnthropic } from '@langchain/anthropic'

// export const MiniMaxModel = new ChatAnthropic({
//   model: 'MiniMax-M2.7',
// })
