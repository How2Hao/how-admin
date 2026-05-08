import { getCookie, setCookie } from 'h3'
import { defineHandler } from 'nitro'
import { ADMIN_SESSION_COOKIE, adminCookieOptions, revokeSession } from '~~/utils/adminAuth'

export default defineHandler(async (event) => {
  const token = getCookie(event, ADMIN_SESSION_COOKIE)
  if (token) {
    await revokeSession(token)
  }
  // 清 cookie：maxAge=0 让浏览器立即删除
  setCookie(event, ADMIN_SESSION_COOKIE, '', { ...adminCookieOptions(), maxAge: 0 })
  return { ok: true }
})
