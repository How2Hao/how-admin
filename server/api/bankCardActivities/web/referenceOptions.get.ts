import { defineHandler } from 'nitro'
import { getReferenceOptions } from '~~/utils/bankCardActivityForm'

export default defineHandler(() => {
  return getReferenceOptions()
})
