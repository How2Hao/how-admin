import { defineHandler } from 'nitro'
import { runAgent } from '~~/agent'
import { parserWebByURL } from '~~/utils/paserweb'

export default defineHandler(async (event) => {
  const body = await event.req.json() as { url: string }
  const url = body.url

  if (!url) {
    throw new Error('Invalid url: missing url')
  }

  const markdown = await parserWebByURL(url)
  const bankTask = await runAgent(markdown)

  return bankTask
})
