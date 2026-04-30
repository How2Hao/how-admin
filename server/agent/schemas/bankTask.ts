import * as z from 'zod'
import { referenceData } from '../utils/referenceData'

function getEnabledBankCardOrganizations() {
  return referenceData.cardOrganizations.filter(org => org.status === 'ENABLED')
}

function buildBankCardOrganizationDescription() {
  const organizations = getEnabledBankCardOrganizations()
  const optionsText = organizations
    .map(option => `${option.id}=${option.name}`)
    .join('、')
  const idsText = organizations.map(option => option.id).join(', ')

  return `银行卡组织ID，填写单个数字即可。当前可用ID为 [${idsText}]，对应关系：${optionsText}。如果文章未明确提及卡组织，默认填 1；如果明确提及双标卡，直接选择对应的组合组织ID，不要自行组合多个值。`
}

export function getBankTaskSchema() {
  return z.object({
    title: z.string().max(200).describe('活动标题。使用简洁中文概括银行名和核心优惠或动作。'),
    ruleBrief: z.string().nullable().describe('活动简要描述。简述活动机制即可，避免照抄大段细则；无法概括时填 null。'),
    ruleDetail: z.string().nullable().describe('活动详细规则。提炼核心参与步骤、门槛、限制和奖励，不要无脑粘贴整篇文章。'),
    bankId: z.number().describe('银行ID。必须使用 `get_bank_id` 工具根据文章中明确的银行名称查询，并从候选结果中选择最匹配的一项。'),
    bankCardOrganization: z.number().default(1).describe(buildBankCardOrganizationDescription()),
    bankCardTemplateId: z.number().nullable().describe('银行卡模板ID。优先根据文章中明确的卡产品名、卡系列名或唯一可识别卡名称，使用 `get_bank_card_template_id` 工具查询；无法确认时填 null。'),
    bankCardType: z.enum(['CREDIT', 'DEBIT']).describe('银行卡类型。信用卡、贷记卡填 `CREDIT`；借记卡、储蓄卡填 `DEBIT`。'),
    regionCode: z.string().default('100000').describe('活动区域代码。全国活动使用 `100000`；只有文章明确限定到省、市、区时才使用 `get_region_code` 工具查询。'),
    regionMatchStrategy: z.enum(['EXACT', 'EXCLUDE_PLAN_SINGLE_CITY']).default('EXACT').describe('区域匹配策略。默认 `EXACT`；只有文章明确表达全国可参加但排除计划单列市等单独城市时，才使用 `EXCLUDE_PLAN_SINGLE_CITY`。'),
    repeatType: z.enum(['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).describe('活动重复类型，按活动触发节奏判断而不是按总有效期判断。活动期内仅一次为 `ONE_TIME`，每天为 `DAILY`，每周几为 `WEEKLY`，每月为 `MONTHLY`，每年或生日月为 `YEARLY`。'),
    daysOfWeek: z.array(z.number()).nullable().describe('仅当 `repeatType` 为 `WEEKLY` 时填写。周一到周日依次为 [1, 2, 3, 4, 5, 6, 7]；其他情况填 null。'),
    yearlyMonths: z.array(z.number()).nullable().describe('仅当 `repeatType` 为 `YEARLY` 时填写，例如 [1, 5] 表示每年 1 月和 5 月；其他情况填 null。'),
    daysOfMonth: z.array(z.number()).nullable().describe('仅当 `repeatType` 为 `MONTHLY` 时填写，例如 [1, 5] 表示每月 1 日和 5 日；其他情况填 null。'),
    yearlyDaysOfMonth: z.array(z.number()).nullable().describe('仅当 `repeatType` 为 `YEARLY` 时填写，与 `yearlyMonths` 一一对应；其他情况填 null。'),
    frequencyControl: z.string().nullable().describe('频控说明。例如“每日1次”“每月1次”“活动期每用户限1次”“每档各1次”；无法归纳时填 null。'),
    reminderTime: z.string().describe('提醒时间，格式为 `HH:mm`。优先使用文章明确的开抢、开奖、领取或报名时间；如果只有日期没有具体时点，统一填写 `10:00`。'),
    startDate: z.string().describe('活动开始时间。填写活动有效期起始时间；如果只有日期没有具体时分秒，使用当日 00:00:00。'),
    endDate: z.string().describe('活动结束时间。填写活动有效期截止时间；如果只有日期没有具体时分秒，使用当日 23:59:59。'),
    benefitAmount: z.number().describe('用户单次最典型、可直接理解的预估净收益。返现填返现金额，满减填减免额，购券填面值减售价；复杂阶梯活动不要只填宣传最高档金额。'),
    benefitDescription: z.string().nullable().describe('优惠描述。一句话总结核心优惠，要求自然、可读、不超过 50 个字，不复述细则；无法准确概括时填 null。'),
    extraConditionsText: z.string().nullable().describe('附加条件文本，仅填写门槛、报名要求、名额限制、客群限制、达标条件、排除交易或商户等；没有则填 null。'),
    benefitCategoryId: z.number().nullable().describe('优惠分类ID。当文章能明确归类为返现、支付立减、电子卡券等时，使用 `get_benefit_category_id` 工具查询；否则填 null。'),
    benefitPayPlatformId: z.number().nullable().describe('支付平台ID。当文章明确支付渠道为微信支付、支付宝、云闪付等时，使用 `get_benefit_platform_id` 工具查询；否则填 null。'),
    benefitUsagePlatformId: z.number().nullable().describe('使用平台ID。当文章明确优惠发生在美团、京东、携程等消费平台时，使用 `get_benefit_usage_platform_id` 工具查询；否则填 null。'),
    activityCategoryId: z.number().nullable().describe('活动分类ID。当文章可明确归入某个活动分类时，使用 `get_activity_category_id` 工具查询；否则填 null。'),
    participationDifficulty: z.string().nullable().describe('参与难度。根据文章活动描述推测参与复杂度，例如“简单”“中等”“复杂”等。'),
    guideText: z.string().nullable().describe('操作指引。用简短步骤总结“如何参加”活动；没有清晰步骤时填 null。'),
    requiresQualify: z.boolean().default(false).describe('是否需要先达标才能享受。文章描述“先报名/先冲量/累计满 X 才能享受”填 true；“立享/直接减免/到店即享”填 false。'),
    qualifyCycle: z.enum(['SAME_MONTH', 'PREV_MONTH']).nullable().describe('仅 requiresQualify=true 时填。文章描述“当月消费当月享/当月报名当月用”填 SAME_MONTH；“上月消费本月享/月初报名次月生效”填 PREV_MONTH；requiresQualify=false 时填 null。'),
    tierMode: z.enum(['NONE', 'INDEPENDENT', 'EXCLUSIVE']).default('NONE').describe('档位模式。无分档或单档活动填 NONE；多档独立达成各拿各的（“分别享受/独立计算/可叠加”）填 INDEPENDENT；多档互斥取一档（“二选一/取最高一档/享受其中一项”）填 EXCLUSIVE。'),
    tiers: z.array(z.object({
      minAmount: z.number().nullable().describe('该档累计金额门槛，无金额要求时填 null。'),
      minCount: z.number().nullable().describe('该档累计笔数门槛，无笔数要求时填 null。'),
      benefitAmount: z.number().describe('达成该档可获得的优惠金额。'),
      benefitDescription: z.string().describe('该档优惠的中文一句话描述，例如“满 200 减 20”、“消费 5 笔减 30”。'),
    })).nullable().describe('分档优惠数组。requiresQualify=true 时必填且长度 ≥ 1，按门槛由低到高列出每档；requiresQualify=false 时填 null。'),
    qualifyDeadline: z.string().nullable().describe('达标截止日期。形如 “2026-05-22 23:59” 的本地时间字符串；文章无明确截止则填 null。后端会转成时间戳存储。'),
  })
}
