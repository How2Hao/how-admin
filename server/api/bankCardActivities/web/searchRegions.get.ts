import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'

export default defineHandler((event) => {
  const url = new URL(event.req.url ?? '', 'http://localhost')
  const q = url.searchParams.get('q')?.trim() ?? ''

  if (!q) {
    return { options: [] }
  }

  return {
    options: referenceData.searchRegions(q, 10).map(match => ({
      label: match.item.regionName ?? match.item.regionCode,
      value: match.item.regionCode,
      level: match.item.level,
    })),
  }
})
