import { definePlugin } from 'nitro'
import { referenceData } from '../agent/utils/referenceData'

export default definePlugin(async () => {
  console.log('[Nitro] Initializing reference data...')
  await referenceData.initialize()
  console.log('[Nitro] Reference data initialized')
})
