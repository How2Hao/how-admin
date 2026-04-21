import { defineHandler } from 'nitro'
import { wechatArticleSDK } from '../../../../lib/wechatArticle/WechatArticle'

export default defineHandler(async (event) => {
  const { name } = event.context.params as { name: string }
  const decodedName = decodeURIComponent(name)
  console.log(decodedName)
  const accounts = await wechatArticleSDK.account(decodedName)

  return {
    accounts,
  }
})
