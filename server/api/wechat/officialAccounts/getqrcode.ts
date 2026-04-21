import { defineHandler } from 'nitro'
import { wechatArticleSDK } from '../../../lib/wechatArticle/WechatArticle'

export default defineHandler(async () => {
  const controller = await wechatArticleSDK.startLogin()
  const qrcodeBase64 = await wechatArticleSDK.getQrcode(controller)

  return {
    src: `data:image/png;base64,${qrcodeBase64}`,
    controller,
  }
})
