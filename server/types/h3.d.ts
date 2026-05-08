// 让 IDE / tsc 认 event.context.adminUser
// 由 server/middleware/admin-auth.ts 在请求进入时挂载
import 'h3'
import type { AdminUserContext } from '../utils/adminAuth'

declare module 'h3' {
  interface H3EventContext {
    adminUser?: AdminUserContext
  }
}

export {}
