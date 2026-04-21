import * as z from 'zod'

export const BankTask = z.object({
  title: z.string().max(200).describe('活动标题。使用简洁中文概括银行名和核心优惠或动作。'),
  description: z.string().describe('活动简要描述。简述活动机制即可，避免照抄大段细则。'),
  bankId: z.number().describe('银行ID。必须使用 `get_bank_id` 工具根据文章中明确的银行名称查询，并从候选结果中选择最匹配的一项。'),
  bankCardOrganization: z.array(z.string()).default(['1']).describe('银行卡组织ID数组。银联为 ["1"]、Visa 为 ["2"]、American Express/运通/AE 为 ["3"]、Mastercard/万事达 为 ["4"]、JCB 为 ["5"]。双标卡可填多个；未明确提及时保持默认 ["1"]。'),
  bankCardTemplateID: z.string().describe('银行卡模板ID。优先根据文章中明确的卡产品名、卡系列名或唯一可识别卡名称，使用 `get_bank_card_template_id` 工具查询，并选择与银行、卡种、卡组织一致的候选。'),
  bankCardType: z.enum(['CREDIT', 'DEBIT']).describe('银行卡类型。信用卡、贷记卡填 `CREDIT`；借记卡、储蓄卡填 `DEBIT`；仅在正文或卡名称有明确证据时判定。'),
  regionCode: z.string().default('100000').describe('活动区域代码。全国活动使用 `100000`；只有文章明确限定到省、市、区时才使用 `get_region_code` 工具查询。'),
  regionMatchStrategy: z.enum(['EXACT', 'EXCLUDE_PLAN_SINGLE_CITY']).default('EXACT').describe('区域匹配策略。默认 `EXACT`；只有文章明确表达全国可参加但排除计划单列市等单独城市时，才使用 `EXCLUDE_PLAN_SINGLE_CITY`。'),
  repeatType: z.enum(['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).describe('活动重复类型，按活动触发节奏判断而不是按总有效期判断。活动期内仅一次为 `ONE_TIME`，每天为 `DAILY`，每周几为 `WEEKLY`，每月为 `MONTHLY`，每年或生日月为 `YEARLY`。'),
  daysOfWeek: z.array(z.number()).nullable().describe('仅当 `repeatType` 为 `WEEKLY` 时填写。周一到周日依次为 [1, 2, 3, 4, 5, 6, 7]；其他情况填 null。'),
  dayOfMonth: z.array(z.number()).nullable().describe('仅当 `repeatType` 为 `MONTHLY` 时填写，例如 [1, 5] 表示每月 1 日和 5 日；其他情况填 null。'),
  yearlyMonth: z.array(z.number()).nullable().describe('仅当 `repeatType` 为 `YEARLY` 时填写，例如 [1, 5] 表示每年 1 月和 5 月；其他情况填 null。'),
  yearlyDaysOfMonth: z.array(z.number()).nullable().describe('仅当 `repeatType` 为 `YEARLY` 时填写，对应 yearlyMonth 中每个月的日期，例如 [1, 5]；其他情况填 null。'),
  reminderTime: z.string().describe('提醒时间，格式为 `HH:mm`。优先使用文章明确的开抢、开奖、领取或报名时间；如果只有日期没有具体时点，统一填写 `10:00`。'),
  startDate: z.string().describe('活动开始时间。填写活动有效期起始时间；如果只有日期没有具体时分秒，使用当日 00:00:00。'),
  endDate: z.string().describe('活动结束时间。填写活动有效期截止时间；如果只有日期没有具体时分秒，使用当日 23:59:59。'),
  benefitAmount: z.number().describe('用户单次最典型、可直接理解的预估净收益。返现填返现金额，满减填减免额，购券填面值减售价；复杂阶梯活动不要只填宣传最高档金额。'),
  offerSummaryText: z.string().describe('一句话总结核心优惠，要求自然、可读、不超过 50 个字，不复述细则。'),
  extraConditionsText: z.string().nullable().describe('附加条件文本，仅填写门槛、报名要求、名额限制、客群限制、达标条件、排除交易或商户等；没有则填 null。'),
})
