import { defineHandler } from 'nitro'
import { runAgent } from '~~/agent'
import { requestMDByURL } from '~~/utils/requestMD'

export default defineHandler(async (event) => {
  // const body = await event.req.json() as { url: string }
  // const url = body.url

  // if (!url) {
  //   throw new Error('Invalid url: missing url')
  // }

  // const markdown = await requestMDByURL(url)
  const bankTask = await runAgent(`
****工行万象星卡（180元支付红包）**

每月，消费满1666元，次月可领：10000万象星（可兑30元支付宝、或40元华润万家券），月限1次、共限6次（消费5笔免年费）

活动入口：工银e生活APP-搜索“万象星”

[🔍查看活动细则（12月31日截止）](https://mp.weixin.qq.com/s?%5F%5Fbiz=MzI5Njk5OTgzNA==&mid=2247495545&idx=1&sn=f8b06f67cf0a5ec15ff025abd84942bf&scene=21#wechat%5Fredirect)`)

  return {
    bankTask,
  }
})
