import { createError } from 'h3'
import { defineHandler } from 'nitro'

// 经过 admin-auth middleware 拦截后到达此处时，event.context.adminUser 必然有值。
// 若没有（理论上不会发生）则返回 401。前端在启动时调用，决定显示登录页还是主界面。
export default defineHandler(async (event) => {
  const user = event.context.adminUser
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }
  return user
})
