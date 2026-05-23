import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { executePushTask } from '~~/utils/batchSender'

/**
 * 触发一条 push_task 真正发送：
 * 同步等结果（数据规模小，最多几十秒；规模大时未来加队列）
 */
export default defineHandler(async (event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isInteger(id) || id <= 0)
    throw createError({ statusCode: 400, statusMessage: 'task id 不合法' })

  try {
    const result = await executePushTask(id)
    return result
  } catch (e: any) {
    throw createError({ statusCode: 500, statusMessage: `发送失败：${e?.message ?? e}` })
  }
})
