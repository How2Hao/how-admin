import { defineHandler } from 'nitro'
import { LoginController } from '../../../lib/wechatArticle/LoginController'
import { wechatArticleSDK } from '../../../lib/wechatArticle/WechatArticle'

export default defineHandler(async (event) => {
  const body = await event.req.json() as { controller: { sid: string } }
  const sid = body.controller.sid

  if (!sid) {
    throw new Error('Invalid controller: missing sid')
  }

  const controller = new LoginController(sid)

  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const status = await wechatArticleSDK.checkLoginStatus(controller)

        if (status === 'confirmed') {
          clearInterval(timer)
          const account = await wechatArticleSDK.finishLogin(controller)
          resolve(account)
        }

        if (status === 'expired') {
          clearInterval(timer)
          reject(new Error('QR code expired'))
        }

        if (status === 'canceled') {
          clearInterval(timer)
          reject(new Error('Login canceled'))
        }
      }
      catch (error) {
        clearInterval(timer)
        reject(error)
      }
    }, 500)

    // 5 分钟超时
    setTimeout(() => {
      clearInterval(timer)
      reject(new Error('Login timeout'))
    }, 5 * 60 * 1000)
  })
})
