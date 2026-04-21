<script setup lang="ts">
const { execute: isLoggedIn, data: isLoggedInData } = useFetch<IsLoggedInApiResponse>('/api/wechat/officialAccounts/isLoggedIn').json()
const { execute: getQrcode, data: qrcodeData } = useFetch<{ src: string }>('/api/wechat/officialAccounts/getqrcode', { immediate: false }).json()
const { execute: checkLogin }
  = useFetch<{ nickname: string }>
  (
    '/api/wechat/officialAccounts/check',
    { immediate: false },
  )
    .post(() => ({ controller: qrcodeData.value?.controller }))
    .json()

const qrcodeVisible = ref(false)

async function handleLogin() {
  await getQrcode()
  qrcodeVisible.value = true
  await checkLogin()
  await isLoggedIn()
}
</script>

<template>
  <div v-if="isLoggedInData?.isLoggedIn">
    已登录成功，欢迎
    <div>
      <AddOfficialAccount />
    </div>
  </div>

  <!-- 未登录时显示登录二维码 -->
  <div v-else>
    <t-button theme="primary" @click="handleLogin">
      登录微信公众号
    </t-button>
    <t-dialog
      v-model:visible="qrcodeVisible"
      :close-btn="false"
      :footer="false"
      :header="false"
      prevent-scroll-through
      placement="center"
    >
      <img :src="qrcodeData?.src" alt="qrcode">
    </t-dialog>
  </div>
</template>
