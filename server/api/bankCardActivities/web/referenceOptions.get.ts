import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'
import { getReferenceOptions } from '~~/utils/bankCardActivityForm'

export default defineHandler(async () => {
  await referenceData.ensureInitialized()
  return getReferenceOptions()
})
