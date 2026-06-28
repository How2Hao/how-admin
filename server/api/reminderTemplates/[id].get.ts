import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { parseReminderTemplateId } from '~~/utils/reminderTemplate'
import { reminderTemplate, taskTemplate } from '../../../drizzle/schema'

export default defineHandler(async (event) => {
  const id = parseReminderTemplateId(event.context.params?.id)
  const [row] = await db
    .select({
      id: reminderTemplate.id,
      taskTemplateId: reminderTemplate.taskTemplateId,
      taskTemplateTitle: taskTemplate.title,
      title: reminderTemplate.title,
      description: reminderTemplate.description,
      kind: reminderTemplate.kind,
      repeatType: reminderTemplate.repeatType,
      date: reminderTemplate.date,
      startDate: reminderTemplate.startDate,
      endDate: reminderTemplate.endDate,
      daysOfWeek: reminderTemplate.daysOfWeek,
      daysOfMonth: reminderTemplate.daysOfMonth,
      yearlyMonths: reminderTemplate.yearlyMonths,
      yearlyDaysOfMonth: reminderTemplate.yearlyDaysOfMonth,
      reminderTime: reminderTemplate.reminderTime,
      advanceReminderMinutes: reminderTemplate.advanceReminderMinutes,
      isVisible: reminderTemplate.isVisible,
      createdAt: reminderTemplate.createdAt,
      updatedAt: reminderTemplate.updatedAt,
    })
    .from(reminderTemplate)
    .leftJoin(taskTemplate, eq(reminderTemplate.taskTemplateId, taskTemplate.id))
    .where(eq(reminderTemplate.id, id))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '提醒模板不存在' })
  }

  return {
    ...row,
    taskTemplateTitle: row.taskTemplateTitle ?? null,
  }
})
