import { describe, expect, it } from 'vitest'
import { runAgent } from '~~/agent'
import { parserWebByURL } from '~~/utils/paserweb'

describe('runAgent', () => {
  it('should run agent successfully', async () => {
    const webResult = await parserWebByURL('https://mp.weixin.qq.com/s/0RmSpCdlUi3PsYRQyUqlLg')
    const result = await runAgent(webResult)
    expect(result).toMatchFileSnapshot('./snapshots/agent.test.json')
  })
})
