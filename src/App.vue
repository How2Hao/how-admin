<script setup lang="ts">
const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<template>
  <t-layout h-full class="app-shell">
    <t-header>
      <t-head-menu value="item1" height="120px">
        <template #logo>
          <div class="text-2xl font-bold">
            How2Hao Admin
          </div>
        </template>
        <!-- <t-menu-item value="item1">
          已选内容
        </t-menu-item> -->
        <template #operations>
          <div class="t-menu__operations-icon" @click="toggleDark()">
            <div i-carbon-sun dark:i-carbon-moon />
          </div>
        </template>
      </t-head-menu>
    </t-header>
    <t-layout class="min-w-0 overflow-hidden">
      <t-aside style="border-top: 1px solid var(--component-border)">
        <t-menu :value="activeMenu" theme="light" style="margin-right: 50px" height="550px" :default-expanded="['bank-card-activities']">
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
              <template #icon>
                <div i-carbon:logo-wechat mr-2 />
              </template>
              公众号管理
            </t-menu-item>
            <t-menu-item value="/bank-card-activities/web" to="/bank-card-activities/web">
              <template #icon>
                <div i-lucide:app-window mr-2 />
              </template>
              模板解析
            </t-menu-item>
            <t-menu-item value="/bank-card-activities/edit" to="/bank-card-activities/edit">
              <template #icon>
                <div i-carbon:edit mr-2 />
              </template>
              模板管理
            </t-menu-item>
          </t-submenu>
          <t-menu-item value="/card-templates" to="/card-templates">
            <template #icon>
              <div i-carbon:credit-card mr-3 />
            </template>
            卡片模板
          </t-menu-item>
          <t-menu-item value="/usage-platforms" to="/usage-platforms">
            <template #icon>
              <div i-carbon:application mr-3 />
            </template>
            使用平台
          </t-menu-item>
          <t-menu-item value="/activity-categories" to="/activity-categories">
            <template #icon>
              <div i-carbon:category mr-3 />
            </template>
            活动分类
          </t-menu-item>
          <t-submenu value="users">
            <template #icon>
              <div i-carbon:user-multiple mr-3 />
            </template>
            <template #title>
              <span>用户管理</span>
            </template>
            <t-menu-item value="/users/cards" to="/users/cards">
              <template #icon>
                <div i-carbon:credit-card mr-2 />
              </template>
              卡片管理
            </t-menu-item>
          </t-submenu>
          <t-menu-item value="/user-feedbacks" to="/user-feedbacks">
            <template #icon>
              <div i-carbon:chat mr-3 />
            </template>
            用户反馈
          </t-menu-item>
        </t-menu>
      </t-aside>
      <t-layout class="min-w-0 overflow-hidden">
        <Suspense>
          <t-content class="app-content min-w-0 w-full overflow-x-hidden" font-sans p="x-4 y-4 md:y-5" text="center gray-700 dark:gray-200">
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
</style>
