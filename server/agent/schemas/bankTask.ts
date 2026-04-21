import * as z from 'zod'

export const BankTask = z.object({
  title: z.string().max(200).describe('银行卡活动标题'),
  description: z.string().nullable().describe('银行卡活动简要'),
  bankId: z.number().describe('银行名称ID, 例如: 华夏银行 为 300 ；使用`get_bank_id`工具获取'),
  bankCardOrganization: z.array(z.string()).default(['1']).describe('银行卡组织ID数组，如银联为["1"]、Visa为["2"]、Ae为["3"]、Mastercard为["4"]、JCB为["5"]等。双联卡可填多个，如["1","2"]。未明确提及则默认为银联["1"]'),
  bankCardTemplateID: z.string().describe('银行卡模板ID，例如： 上海农商银行鑫风卡(银联，人民币，金卡) 为 468；使用`get_bank_card_template_id`工具获取'),
  bankCardType: z.enum(['CREDIT', 'DEBIT']).describe('银行卡类型，例如： CREDIT、DEBIT'),
  regionCode: z.string().default('100000').describe('银行卡区域代码，例如： 太原市 为 140100；全国活动默认为 100000； 其他区域请使用`get_region_code`工具获取'),
  regionMatchStrategy: z.enum(['EXACT', 'EXCLUDE_PLAN_SINGLE_CITY']).default('EXACT').describe('区域匹配策略，例如： EXACT 匹配区域代码，EXCLUDE_PLAN_SINGLE_CITY 排除单城市计划（包括 大连市，宁波市， 厦门市， 青岛市， 深圳市）'),
  repeatType: z.enum(['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).describe('重复活动类型，例如： ONE_TIME 一次性活动，DAILY 日重复活动，WEEKLY 周重复活动，MONTHLY 月重复活动，YEARLY 年重复活动'),
  daysOfWeek: z.array(z.number()).nullable().describe('当repeatType为WEEKLY时，例如：[1,2,3,4,5,6,7] 表示周一至周日'),
  dayOfMonth: z.array(z.number()).nullable().describe('当repeatType为MONTHLY时，例如：[1, 5]  表示每月的第一天和第五天'),
  yearlyMonth: z.array(z.number()).nullable().describe('当repeatType为YEARLY时，例如：[1, 5]  表示每年的第一月和第五月'),
  yearlyDaysOfMonth: z.array(z.number()).nullable().describe('当repeatType为YEARLY时，例如：[1, 5]  表示在yearlyMonth中的第一天和第五天'),
  reminderTime: z.string().describe('提醒时间，格式为 HH:mm，例如 21:00'),
  startDate: z.date().describe('活动开始日期, 格式为时间戳'),
  endDate: z.date().describe('活动结束日期, 格式为时间戳'),
  benefitAmount: z.number().describe('预估活动获利金额，例如： 10元买20元代金券，为10元'),
  offerSummaryText: z.string().describe('活动总结描述，用一句话总结活动内容，字数不超50个'),
  extraConditionsText: z.string().nullable().describe('额外条件文本，例如： 仅对新用户开放； 上周使用借记卡消费>=5000'),
})
