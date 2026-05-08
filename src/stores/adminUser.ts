import { ref } from 'vue'
import { requestJson } from '@/composables/useJsonRequest'

export interface AdminUserDto {
  id: number
  username: string
  displayName: string | null
  avatar: string | null
  role: string
  status: string
}

// 全局单例 ref（不引 pinia，本项目目前也没用 pinia）
const adminUser = ref<AdminUserDto | null>(null)
let mePromise: Promise<AdminUserDto | null> | null = null

/**
 * 拉当前登录用户。失败（401）→ 设为 null。
 * 多次同时调用会去重，避免重复打 /api/admin/auth/me。
 */
async function refresh(): Promise<AdminUserDto | null> {
  if (mePromise) return mePromise
  mePromise = (async () => {
    try {
      const data = await requestJson<AdminUserDto>('/api/admin/auth/me')
      adminUser.value = data
      return data
    }
    catch {
      adminUser.value = null
      return null
    }
    finally {
      mePromise = null
    }
  })()
  return mePromise
}

async function logout() {
  try {
    await requestJson('/api/admin/auth/logout', { method: 'POST' })
  }
  catch {
    // 即便后端报错也清前端态，避免卡住
  }
  adminUser.value = null
}

function setAdminUser(value: AdminUserDto | null) {
  adminUser.value = value
}

export function useAdminUser() {
  return { adminUser, refresh, logout, setAdminUser }
}
