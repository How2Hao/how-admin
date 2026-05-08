<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { requestJson } from '@/composables/useJsonRequest'
import { type AdminUserDto, useAdminUser } from '@/stores/adminUser'

const router = useRouter()
const route = useRoute()
const { setAdminUser } = useAdminUser()

const form = ref({ username: '', password: '' })
const loading = ref(false)

async function submit() {
  if (!form.value.username.trim()) {
    MessagePlugin.error('请输入用户名')
    return
  }
  if (form.value.password.length < 8) {
    MessagePlugin.error('密码至少 8 位')
    return
  }
  loading.value = true
  try {
    const user = await requestJson<AdminUserDto>('/api/admin/auth/login', {
      method: 'POST',
      body: { username: form.value.username.trim(), password: form.value.password },
    })
    setAdminUser(user)
    MessagePlugin.success('登录成功')
    // 优先跳回原本想访问的页面（/login?redirect=...）
    const redirect = (route.query.redirect as string | undefined) || '/'
    router.replace(redirect)
  }
  catch (e: any) {
    MessagePlugin.error(e?.message ?? '登录失败')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-title">How2hao 管理后台</div>
      <div class="login-subtitle">请登录</div>

      <t-form label-width="0" class="mt-6" @submit.prevent="submit">
        <t-form-item>
          <t-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            :maxlength="64"
            clearable
            autofocus
          />
        </t-form-item>
        <t-form-item>
          <t-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            :maxlength="128"
            @keydown.enter="submit"
          />
        </t-form-item>
        <t-form-item>
          <t-button
            theme="primary"
            size="large"
            block
            :loading="loading"
            @click="submit"
          >
            登录
          </t-button>
        </t-form-item>
      </t-form>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
}
.login-card {
  width: 360px;
  padding: 32px 28px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}
.login-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
}
.login-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
  text-align: center;
}
</style>
