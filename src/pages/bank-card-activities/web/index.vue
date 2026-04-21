<script setup lang="ts">
const target = ref('')
const { execute: parseUrl, data } = useFetch('/api/bankCardActivities/web/parseUrl', { immediate: false })
  .post(() => ({ url: target.value }))
  .json()
async function handleParse() {
  await parseUrl()
  console.log(data.value)
}
</script>

<template>
  <div>
    <div flex gap-2 w-full>
      <t-input v-model="target" size="large" placeholder="请输入网页地址获取银行卡活动信息" />
      <t-button line-height="32px" size="large" @click="handleParse">
        解析
      </t-button>
    </div>
  </div>
</template>
