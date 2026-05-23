<script setup lang="ts">
import { useRouter } from 'vue-router'

interface Props {
  visible: boolean
  bucketName: string
  cityName?: string | null
  bankId: string
  bankName: string
  cardType: 'CREDIT' | 'DEBIT'
  userCount: number
  templateCount: number
  gapScore: number
  /** 用于跳转创建活动的 regionCode */
  regionCode: string
}
defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const router = useRouter()
function gotoCreate(p: Props) {
  router.push({
    path: '/bank-card-activities/edit',
    query: { bankId: p.bankId, regionCode: p.regionCode, cardType: p.cardType },
  })
  emit('update:visible', false)
}

function badgeClass(p: Props) {
  if (p.templateCount === 0) return 'red'
  if (p.gapScore >= 5) return 'orange'
  if (p.gapScore >= 1) return 'yellow'
  return 'green'
}
</script>

<template>
  <t-dialog
    :visible="visible"
    header="覆盖详情"
    width="520px"
    :footer="false"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="detail">
      <div class="badges">
        <div class="loc">
          <span class="label">地区</span>
          <span class="val">{{ bucketName }}{{ cityName && cityName !== '全省' ? ` · ${cityName}` : '' }}</span>
        </div>
        <div class="loc">
          <span class="label">银行 × 卡类型</span>
          <span class="val">{{ bankName }} · {{ cardType === 'CREDIT' ? '信用卡' : '借记卡' }}</span>
        </div>
      </div>

      <div class="metrics">
        <div class="metric">
          <div class="m-val">{{ userCount }}</div>
          <div class="m-label">已绑卡</div>
        </div>
        <div class="metric">
          <div class="m-val">{{ templateCount }}</div>
          <div class="m-label">活动模板</div>
        </div>
        <div class="metric badge" :class="badgeClass({ userCount, templateCount, gapScore } as any)">
          <div class="m-val">{{ gapScore }}</div>
          <div class="m-label">gap score</div>
        </div>
      </div>

      <div class="hint">
        <div v-if="userCount === 0" class="hint-text muted">该 cell 暂无绑卡用户</div>
        <div v-else-if="templateCount === 0" class="hint-text danger">
          <strong>严重盲区</strong>：{{ userCount }} 位用户在该地区办了 {{ bankName }} 的{{ cardType === 'CREDIT' ? '信用卡' : '借记卡' }}，但没有任何对应活动模板覆盖。
        </div>
        <div v-else-if="gapScore > 0" class="hint-text warn">
          覆盖不足：每条模板平均要服务 {{ Math.ceil(userCount / templateCount) }} 位用户，建议补充。
        </div>
        <div v-else class="hint-text ok">
          覆盖充足：当前模板供给已超过用户需求。
        </div>
      </div>

      <div class="actions">
        <t-button variant="outline" @click="emit('update:visible', false)">关闭</t-button>
        <t-button theme="primary" @click="gotoCreate({ bankId, bankName, cardType, regionCode } as any)">
          <template #icon>
            <div i-carbon:add />
          </template>
          创建该 cell 的活动模板
        </t-button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped>
.detail { padding: 4px 0; }
.badges { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.loc { display: flex; gap: 10px; align-items: baseline; }
.label { font-size: 12px; color: #94a3b8; min-width: 80px; }
.val { font-size: 14px; color: #0f172a; font-weight: 500; }

.metrics { display: flex; gap: 12px; margin-bottom: 16px; }
.metric {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
}
.metric.badge.red { background: #fee2e2; color: #7f1d1d; }
.metric.badge.orange { background: #fed7aa; color: #7c2d12; }
.metric.badge.yellow { background: #fef3c7; color: #78350f; }
.metric.badge.green { background: #dcfce7; color: #14532d; }
.m-val { font-size: 22px; font-weight: 700; }
.m-label { font-size: 11px; opacity: 0.7; margin-top: 2px; }

.hint { margin: 12px 0 16px; padding: 10px 12px; border-radius: 6px; font-size: 13px; }
.hint:has(.danger) { background: #fee2e2; }
.hint:has(.warn) { background: #fef3c7; }
.hint:has(.ok) { background: #dcfce7; }
.hint:has(.muted) { background: #f8fafc; }
.hint-text.danger { color: #7f1d1d; }
.hint-text.warn { color: #78350f; }
.hint-text.ok { color: #14532d; }
.hint-text.muted { color: #64748b; }

.actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
