import { defineHandler } from 'nitro'
import { wechatArticleSDK } from '../../../lib/wechatArticle/WechatArticle'

export default defineHandler(() => {
  const isLoggedIn = wechatArticleSDK.isLoggedIn()

  return {
    isLoggedIn,
  }
})
