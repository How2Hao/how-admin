import { createError, defineEventHandler, getCookie, getRequestURL } from 'h3'
import { ADMIN_SESSION_COOKIE, findActiveSession } from '../utils/adminAuth'

// 不需要登录就能访问的 API 白名单（必须以 /api/ 开头匹配）
const PUBLIC_API = new Set<string>([
  '/api/admin/auth/login',
])

/**
 * 全局鉴权中间件：拦截所有 /api/* 请求；非白名单路径必须有有效 admin_session cookie。
 * 校验通过后把当前 admin 挂到 event.context.adminUser，下游 handler 可以读。
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname

  // 只关心 /api/*；前端静态资源 / 路由不拦
  if (!path.startsWith('/api/')) return

  // 白名单：登录接口
  if (PUBLIC_API.has(path)) return

  const token = getCookie(event, ADMIN_SESSION_COOKIE)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }

  const found = await findActiveSession(token)
  if (!found) {
    throw createError({ statusCode: 401, statusMessage: '会话已失效' })
  }

  event.context.adminUser = found.adminUser
})
