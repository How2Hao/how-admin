<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAdminUser } from './stores/adminUser'

const route = useRoute()
const router = useRouter()
const activeMenu = computed(() => route.path)

const { adminUser, logout: doLogout } = useAdminUser()

// 登录页不渲染主框架（侧边栏 + 顶栏），由 login.vue 自己控制全屏布局
const isLoginPage = computed(() => route.path === '/login')

async function handleLogout() {
  await doLogout()
  router.replace('/login')
}
</script>

<template>
  <RouterView v-if="isLoginPage" />
  <t-layout v-else h-full class="app-shell">
    <t-header>
      <t-head-menu value="item1" height="120px">
        <template #logo>
          <div class="text-2xl font-bold">
            How2Hao Admin
          </div>
        </template>
        <template #operations>
          <div class="header-ops">
            <div v-if="adminUser" class="header-user" :title="`role: ${adminUser.role}`">
              <img
                v-if="adminUser.avatar"
                :src="adminUser.avatar"
                class="header-user-avatar"
                :alt="adminUser.displayName || adminUser.username"
              >
              <div v-else class="header-user-avatar header-user-avatar--fallback">
                {{ (adminUser.displayName || adminUser.username).slice(0, 1).toUpperCase() }}
              </div>
              <span class="header-user-name">{{ adminUser.displayName || adminUser.username }}</span>
              <span class="header-user-role">{{ adminUser.role }}</span>
              <t-button size="small" variant="text" theme="default" @click="handleLogout">
                <template #icon>
                  <div i-carbon:logout />
                </template>
                登出
              </t-button>
            </div>
            <div class="t-menu__operations-icon" @click="toggleDark()">
              <div i-carbon-sun dark:i-carbon-moon />
            </div>
          </div>
        </template>
      </t-head-menu>
    </t-header>
    <t-layout class="min-w-0 overflow-hidden">
      <t-aside style="border-top: 1px solid var(--component-border)">
        <t-menu :value="activeMenu" theme="light" style="margin-right: 50px" height="550px" :default-expanded="['bank-card-activities', '/card-templates']">
          <t-menu-item value="/" to="/">
            <template #icon>
              <t-icon name="dashboard" />
            </template>
            仪表盘
          </t-menu-item>
          <t-submenu value="bank-card-activities">
            <template #icon>
              <div i-carbon:app-connectivity mr-3 />
            </template>
            <template #title>
              <span>银行卡活动</span>
            </template>
            <t-menu-item value="/bank-card-activities/wechat" to="/bank-card-activities/wechat">
              公众号管理
            </t-menu-item>
            <t-menu-item value="/bank-card-activities/web" to="/bank-card-activities/web">
              模板解析
            </t-menu-item>
            <t-menu-item value="/bank-card-activities/edit" to="/bank-card-activities/edit">
              模板管理
            </t-menu-item>
          </t-submenu>
          <t-menu-item value="/coverage-gap" to="/coverage-gap">
            <template #icon>
              <div i-carbon:radar mr-3 />
            </template>
            活动覆盖率
          </t-menu-item>
          <t-menu-item value="/no-match-users" to="/no-match-users">
            <template #icon>
              <div i-carbon:user-activity mr-3 />
            </template>
            活动缺口用户
          </t-menu-item>
          <t-submenu value="/card-templates">
            <template #icon>
              <div i-carbon:purchase mr-3 />
            </template>
            <template #title>
              <span>卡片模板管理</span>
            </template>
            <t-menu-item value="/card-templates/credit" to="/card-templates/credit">
              信用卡管理
            </t-menu-item>
            <t-menu-item value="/card-templates/debit" to="/card-templates/debit">
              借记卡管理
            </t-menu-item>
          </t-submenu>
          <t-menu-item value="/usage-platforms" to="/usage-platforms">
            <template #icon>
              <div i-carbon:application mr-3 />
            </template>
            使用平台
          </t-menu-item>
          <t-menu-item value="/benefit-pay-platforms" to="/benefit-pay-platforms">
            <template #icon>
              <div i-carbon:wallet mr-3 />
            </template>
            支付平台
          </t-menu-item>
          <t-menu-item value="/banks" to="/banks">
            <template #icon>
              <div i-lucide:landmark mr-3 />
            </template>
            银行管理
          </t-menu-item>
          <t-menu-item value="/activity-categories" to="/activity-categories">
            <template #icon>
              <div i-carbon:category mr-3 />
            </template>
            活动分类
          </t-menu-item>
          <t-menu-item value="/plaza-custom-tabs" to="/plaza-custom-tabs">
            <template #icon>
              <div i-lucide:layout-grid mr-3 />
            </template>
            广场运营 Tab
          </t-menu-item>
          <t-menu-item value="/coupon-categories" to="/coupon-categories">
            <template #icon>
              <div i-carbon:ticket mr-3 />
            </template>
            卡券管理
          </t-menu-item>
          <t-menu-item value="/job-templates" to="/job-templates">
            <template #icon>
              <div i-carbon:task mr-3 />
            </template>
            Job 模板
          </t-menu-item>
          <t-menu-item value="/reminder-templates" to="/reminder-templates">
            <template #icon>
              <div i-carbon:alarm mr-3 />
            </template>
            提醒模板
          </t-menu-item>
          <t-submenu value="users">
            <template #icon>
              <div i-carbon:user-multiple mr-3 />
            </template>
            <template #title>
              <span>用户管理</span>
            </template>
            <t-menu-item value="/users/cards" to="/users/cards">
              卡片管理
            </t-menu-item>
          </t-submenu>
          <t-menu-item value="/user-feedbacks" to="/user-feedbacks">
            <template #icon>
              <div i-carbon:chat mr-3 />
            </template>
            用户反馈
          </t-menu-item>
          <t-submenu value="/push">
            <template #icon>
              <div i-carbon:notification mr-3 />
            </template>
            <template #title>
              <span>推送中心</span>
            </template>
            <t-menu-item value="/push/tasks" to="/push/tasks">
              推送任务
            </t-menu-item>
            <t-menu-item value="/push/tags" to="/push/tags">
              用户标签
            </t-menu-item>
          </t-submenu>
          <t-menu-item value="/app-versions" to="/app-versions">
            <template #icon>
              <div i-carbon:version mr-3 />
            </template>
            App 版本管理
          </t-menu-item>
        </t-menu>
      </t-aside>
      <t-layout class="min-w-0 overflow-hidden">
        <Suspense>
          <t-content class="app-content min-w-0 w-full overflow-x-hidden" font-sans p="x-4 y-4 md:y-5" text="left gray-700 dark:gray-200">
            <RouterView />
          </t-content>
        </Suspense>
      </t-layout>
    </t-layout>
  </t-layout>
</template>

<style scoped>
.app-shell {
  overflow-x: hidden;
}

.app-content {
  box-sizing: border-box;
  max-width: 100%;
}

/* Header 右侧操作区 */
.header-ops {
  display: flex;
  align-items: center;
  gap: 16px;
}
.header-user {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--component-border, #e5edf5);
  border-radius: 999px;
  font-size: 13px;
  color: #475569;
}
.header-user-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(148, 163, 184, 0.18);
}
.header-user-avatar--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #475569;
}
.header-user-name {
  font-weight: 600;
  color: #0f172a;
}
.header-user-role {
  font-size: 11px;
  color: #94a3b8;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.12);
}
</style>
