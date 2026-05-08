import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'
import { useAdminUser } from './stores/adminUser'

import 'tdesign-vue-next/es/style/index.css'
import './styles/main.css'
import 'uno.css'

const app = createApp(App)
const router = createRouter({
  routes,
  history: createWebHistory(import.meta.env.BASE_URL),
})

// 全局登录守卫：未登录时跳 /login（带 redirect 参数），已登录访问 /login 跳 /
const { adminUser, refresh } = useAdminUser()

router.beforeEach(async (to) => {
  // 登录页：已登录就跳首页，否则放行
  if (to.path === '/login') {
    if (adminUser.value) return { path: '/' }
    return true
  }

  // 其它页面：必须有 user，没有就先尝试 refresh，仍空则跳 /login
  if (!adminUser.value) {
    await refresh()
  }
  if (!adminUser.value) {
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  return true
})

app.use(router)
app.mount('#app')
