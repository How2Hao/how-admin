<script setup lang="ts">
import { useRouter } from 'vue-router'

export interface GapItem {
  bucketCode: string
  bucketName: string
  bucketType: 'NORMAL' | 'DIRECT' | 'SAR' | 'UNKNOWN'
  cityCode: string | null
  cityName: string | null
  cityTag: 'PLAN_SINGLE' | null
  bankId: string
  bankName: string
  cardType: 'CREDIT' | 'DEBIT'
  userCount: number
  templateCount: number
  gapScore: number
}

defineProps<{
  items: GapItem[]
  severeBlind: number
  /** 用 bankId 反查 logo */
  bankLogos: Record<string, string | null>
}>()
const emit = defineEmits<{
  (e: 'pick', item: GapItem): void
}>()

const router = useRouter()

function bucketIcon(t: GapItem['bucketType']): string {
  if (t === 'DIRECT') return '🏛️'
  if (t === 'SAR') return '🏝️'
  if (t === 'UNKNOWN') return '❓'
  return '🏙️'
}

function badgeClass(item: GapItem) {
  if (item.templateCount === 0) return 'red'
  if (item.gapScore >= 5) return 'orange'
  if (item.gapScore >= 1) return 'yellow'
  return 'green'
}

function gotoCreate(item: GapItem) {
  // 跳转活动模板创建页（路径基于现有 bank-card-activities/edit）
  const regionCode = item.cityCode ?? item.bucketCode
  router.push({
    path: '/bank-card-activities/edit',
    query: { bankId: item.bankId, regionCode, cardType: item.cardType },
  })
}
</script>

<template>
  <div class="list-wrap">
    <div class="hdr">
      <div>
        <div class="title">运营盲区 TOP 50</div>
        <div class="subtitle">
          按 gap score 降序 ·
          <span class="severe">严重盲区 {{ severeBlind }} 组</span>
        </div>
      </div>
    </div>
    <div class="body">
      <t-empty v-if="!items.length" description="暂无盲区，所有 cell 都已覆盖" />
      <div
        v-for="(item, i) in items"
        :key="`${item.bucketCode}-${item.cityCode ?? ''}-${item.bankId}-${item.cardType}`"
        class="item"
        @click="emit('pick', item)"
      >
        <div class="item-rank">{{ i + 1 }}</div>
        <div class="item-main">
          <div class="row1">
            <span class="icon">{{ bucketIcon(item.bucketType) }}</span>
            <span class="region">
              {{ item.cityName || item.bucketName }}
              <span v-if="item.cityName && item.cityName !== '全省' && item.bucketName !== item.cityName" class="prov">· {{ item.bucketName }}</span>
              <span v-if="item.cityTag === 'PLAN_SINGLE'" class="single-tag">📍单列</span>
            </span>
          </div>
          <div class="row2">
            <span class="bank">
              <img
                v-if="bankLogos[item.bankId]"
                :src="bankLogos[item.bankId]!"
                :alt="item.bankName"
                class="bank-logo"
              >
              <span v-else class="bank-logo placeholder">{{ item.bankName.slice(0, 1) }}</span>
              <span class="bank-name">{{ item.bankName }}</span>
            </span>
            <span class="card-type" :class="item.cardType.toLowerCase()">
              {{ item.cardType === 'CREDIT' ? '信用卡' : '借记卡' }}
            </span>
          </div>
          <div class="row3">
            <span class="metric">{{ item.userCount }} 张卡</span>
            <span class="metric muted">{{ item.templateCount }} 个模板</span>
          </div>
        </div>
        <div class="item-score" :class="badgeClass(item)">
          <div class="score">{{ item.gapScore }}</div>
          <div class="label">gap</div>
        </div>
        <button class="goto-btn" title="去创建活动" @click.stop="gotoCreate(item)">
          <div i-carbon:add />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: calc(100vh - 220px);
}
.hdr {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
}
.title { font-size: 14px; font-weight: 700; color: #0f172a; }
.subtitle { font-size: 11px; color: #94a3b8; margin-top: 2px; }
.severe { color: #dc2626; font-weight: 600; }

.body {
  flex: 1;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #f8fafc;
  cursor: pointer;
  transition: background 0.15s;
  gap: 10px;
}
.item:hover { background: #f8fafc; }

.item-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-main { flex: 1; min-width: 0; }
.row1 { font-size: 13px; color: #0f172a; font-weight: 500; }
.icon { margin-right: 4px; }
.prov { color: #94a3b8; font-weight: 400; font-size: 11px; margin-left: 4px; }
.single-tag {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  margin-left: 4px;
}
.row2 { font-size: 11px; color: #475569; margin-top: 2px; display: flex; align-items: center; gap: 6px; min-width: 0; }
.bank { font-weight: 500; display: inline-flex; align-items: center; gap: 4px; min-width: 0; flex: 1; }
.bank-logo {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 2px;
  background: white;
}
.bank-logo.placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  color: #64748b;
  font-size: 9px;
  font-weight: 700;
}
.bank-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.card-type {
  display: inline-block;
  padding: 0 5px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 600;
}
.card-type.credit { color: #1e40af; background: #dbeafe; }
.card-type.debit { color: #166534; background: #dcfce7; }
.row3 { font-size: 11px; color: #475569; margin-top: 2px; display: flex; gap: 10px; }
.metric.muted { color: #94a3b8; }

.item-score {
  text-align: center;
  padding: 4px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.item-score.red { background: #fee2e2; color: #7f1d1d; }
.item-score.orange { background: #fed7aa; color: #7c2d12; }
.item-score.yellow { background: #fef3c7; color: #78350f; }
.item-score.green { background: #dcfce7; color: #14532d; }
.score { font-size: 16px; font-weight: 700; line-height: 1.1; }
.label { font-size: 9px; opacity: 0.7; }

.goto-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 4px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.goto-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
}
</style>
