import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'

export default defineHandler((event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const q = url.searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return { options: [] }
  }

  const categoryById = new Map(referenceData.activityCategories.map(c => [c.id, c]))
  return {
    options: referenceData.searchActivityCategories(q, 10).map(match => ({
      label: match.item.name,
      value: match.item.id,
      code: match.item.code,
      icon: match.item.icon,
      parentId: match.item.parentId ?? null,
      parentName: match.item.parentId ? (categoryById.get(match.item.parentId)?.name ?? null) : null,
      parentIcon: match.item.parentId ? (categoryById.get(match.item.parentId)?.icon ?? null) : null,
    })),
  }
})
