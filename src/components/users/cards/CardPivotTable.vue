<script setup lang="ts">
interface Bank { id: string, name: string, total: number }
interface City { code: string, name: string, level: number, total: number }
type Cell = readonly [bankIdx: number, cityIdx: number, count: number]

const props = defineProps<{
  banks: Bank[]
  cities: City[]
  cells: Cell[]
}>()
const emit = defineEmits<{
  (e: 'cell-click', payload: { bankId: string, cityCode: string, count: number, bankName: string, cityName: string }): void
}>()

const cellMap = computed(() => {
  const m = new Map<string, number>()
  for (const [bi, ci, n] of props.cells)
    m.set(`${bi}:${ci}`, n)
  return m
})

const maxCell = computed(() => {
  let max = 0
  for (const [, , n] of props.cells) {
    if (n > max)
      max = n
  }
  return max || 1
})

function getCellCount(bi: number, ci: number): number {
  return cellMap.value.get(`${bi}:${ci}`) ?? 0
}

function handleClick(bi: number, ci: number) {
  const n = getCellCount(bi, ci)
  if (n <= 0)
    return
  emit('cell-click', {
    bankId: props.banks[bi].id,
    cityCode: props.cities[ci].code,
    count: n,
    bankName: props.banks[bi].name,
    cityName: props.cities[ci].name,
  })
}

function cellBg(n: number): string {
  if (n <= 0)
    return ''
  const ratio = Math.min(n / maxCell.value, 1)
  const alpha = 0.1 + ratio * 0.7
  return `background-color: rgba(0, 82, 217, ${alpha.toFixed(2)})`
}
</script>

<template>
  <div class="overflow-auto border rounded" style="max-height: calc(100vh - 260px)">
    <table class="border-collapse text-sm" style="min-width: max-content">
      <thead>
        <tr>
          <th class="sticky left-0 top-0 z-30 bg-gray-100 border px-3 py-2 text-left" style="min-width: 180px">
            银行 \ 城市
          </th>
          <th
            v-for="c in cities"
            :key="c.code"
            class="sticky top-0 z-20 bg-gray-100 border px-2 py-2 text-center"
            style="min-width: 90px"
          >
            <div class="font-medium whitespace-nowrap">{{ c.name }}</div>
            <div class="text-xs text-gray-500">{{ c.total }}</div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(b, bi) in banks" :key="b.id">
          <th class="sticky left-0 z-10 bg-white border px-3 py-2 text-left">
            <div class="font-medium whitespace-nowrap">{{ b.name }}</div>
            <div class="text-xs text-gray-500">合计 {{ b.total }}</div>
          </th>
          <td
            v-for="(c, ci) in cities"
            :key="c.code"
            class="border text-center"
            :class="getCellCount(bi, ci) > 0 ? 'cursor-pointer hover:outline hover:outline-2 hover:outline-blue-500' : ''"
            :style="cellBg(getCellCount(bi, ci))"
            @click="handleClick(bi, ci)"
          >
            <span v-if="getCellCount(bi, ci) > 0" class="px-2 py-1 inline-block">{{ getCellCount(bi, ci) }}</span>
            <span v-else class="text-gray-300">·</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
