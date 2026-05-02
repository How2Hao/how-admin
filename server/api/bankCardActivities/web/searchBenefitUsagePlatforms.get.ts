import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'

export default defineHandler((event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const q = url.searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return { options: [] }
  }

  return {
    options: referenceData.searchUsagePlatforms(q, 10).map(match => ({
      label: match.item.name,
      value: match.item.id,
      code: match.item.code,
      icon: match.item.icon,
    })),
  }
})
