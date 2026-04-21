<script setup lang="ts">
const visible = ref(false)
const officialAccountName = ref('')

function handleClose() {
  visible.value = false
}
const url = computed(() => `/api/wechat/officialAccounts/account/${officialAccountName.value}`)
const {
  isFetching,
  execute: fetchOfficialAccount,
  data: officialAccountData,
} = useFetch<AccountApiResponse>(url, { immediate: false }).json()

const accountList = computed(() => officialAccountData.value?.accounts?.list ?? [])

async function searchOfficialAccount() {
  await fetchOfficialAccount()
}

function handleSelectAccount(account: AccountApiResponse['accounts']['list'][number]) {
  officialAccountName.value = account.nickname
}
</script>

<template>
  <div flex-center rounded-md bg-white h-20 w-20 cursor-pointer transition-all duration-300 hover:shadow-sm @click="visible = true">
    <div i-carbon:add size="14" class="text-blue-500" />
  </div>

  <t-drawer v-model:visible="visible" header="添加公众号" :on-confirm="handleClose" @close="handleClose">
    <t-space direction="vertical" size="large" style="width: 100%">
      <t-space direction="vertical" :size="0" style="width: 100%">
        <t-input
          v-model="officialAccountName"
          placeholder="搜索公众号名称"
          @enter="searchOfficialAccount"
        />
      </t-space>
    </t-space>
    <t-loading :loading="isFetching" size="small" show-overlay class="min-h-10">
      <div v-if="accountList.length > 0" class="mt-2 space-y-2">
        <div
          v-for="account in accountList"
          :key="account.fakeid"
          class="group p-3 rounded-md bg-gray-100/90 flex gap-3 cursor-pointer transition-all duration-200 items-center dark:bg-dark-100/50"
          @click="handleSelectAccount(account)"
        >
          <img :src="account.round_head_img" :alt="account.nickname" class="rounded-full size-14">
          <div class="text-left flex-1 min-w-0">
            <div class="text-sm text-gray-700 font-medium transition-colors dark:text-gray-200">
              {{ account.nickname }}
            </div>
            <div class="text-xs text-gray-400 mt-0.5 line-clamp-2 dark:text-gray-500">
              {{ account.signature }}
            </div>
          </div>
          <div class="opacity-0 transition-opacity group-hover:opacity-100">
            <div i-carbon-chevron-right class="text-gray-500/80" />
          </div>
        </div>
      </div>
    </t-loading>
  </t-drawer>
</template>
