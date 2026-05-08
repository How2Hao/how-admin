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

/** 单档位 schema：一个 task_template.tiers JSON 数组里的元素 */
export function getBankTaskTierSchema() {
  return z.object({
    minAmount: z.number().nullable().describe('该档达标金额门槛。例如"满 200 减 20"填 200，"立减 5 元"无门槛填 null。'),
    benefitAmountFixed: z.number().nullable().describe('该档固定优惠金额。如"立减 50 元"填 50。与 Min/Max 互斥；区间金额时填 null。'),
    benefitAmountMin: z.number().nullable().describe('该档区间优惠下限。如"随机立减 5-50 元"填 5。与 Fixed 互斥；固定金额时填 null。'),
    benefitAmountMax: z.number().nullable().describe('该档区间优惠上限。如"随机立减 5-50 元"填 50。与 Fixed 互斥；固定金额时填 null。'),
    benefitDescription: z.string().nullable().describe('该档优惠描述。例如"满 200 减 20"、"5 笔减 30"。自然、可读、不超过 50 个字；无可写时填 null。'),
    quotaPerCycleText: z.string().nullable().describe('该档每日/每周名额文案。例如"每日 100 名"、"每周 500 名"；不细分到底是每日还是每周，按原文表述填即可；没有则 null。'),
    quotaTotalText: z.string().nullable().describe('该档总名额文案。例如"总共 1000 名"、"前 500 名"、"限量 200 份"；与 quotaPerCycleText 不冲突，可同时存在；没有则 null。'),
  })
}

/** 单 task_template schema：共享字段 + tiers 数组 */
export function getBankTemplateSchema() {
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
    frequencyControl: z.string().nullable().describe('频控说明。例如"每日1次"、"每月1次"、"活动期每用户限1次"、"每档各1次"；无法归纳时填 null。'),
    reminderTime: z.string().nullable().describe('提醒时间，格式为 `HH:mm`。优先使用文章明确的开抢、开奖、领取或报名时间；如果活动是周期内任意时间可参与（无明确时点），填 null（注：reminderTime 为 null 的模板会被自动隐藏不在 plaza 展示）。'),
    startDate: z.string().describe('活动开始时间。填写活动有效期起始时间；如果只有日期没有具体时分秒，使用当日 00:00:00。'),
    endDate: z.string().describe('活动结束时间。填写活动有效期截止时间；如果只有日期没有具体时分秒，使用当日 23:59:59。'),
    tiers: z.array(getBankTaskTierSchema()).min(1).describe('档位数组，**至少 1 个元素**。单档活动只填 1 个；同一活动内"互斥取一/二选一"按门槛由低到高列出多个 tier 元素。'),
    extraConditionsText: z.string().nullable().describe('附加条件文本，仅填写门槛、报名要求、客群限制、达标条件、排除交易或商户等；名额信息请填到 tier 的 quotaPerCycleText / quotaTotalText 字段；没有则填 null。'),
    ruleSourceLinkUrl: z.string().nullable().describe('规则原文链接，例如银行公众号文章 / 官网公告 / 活动详情页 URL。如果用户提供的输入是 URL 文本，请直接填入该 URL；如果只是图文未提供 URL 则填 null。'),
    // 以下两个字段不参与 AI 解析，是 admin 表单 → 创建/编辑接口透传用：
    // - ruleSourceImageUrls：保留的已上传 URL（编辑回显时使用）
    // - ruleSourceImageBase64s：用户新加的 data URL（创建/编辑时由 server 上传到 task_template/{id}/{idx}.png）
    // AI 不需要也不应该填这两个字段（AI 输出时填 null 即可）
    ruleSourceImageUrls: z.array(z.string()).nullable().describe('（admin 表单字段，AI 输出请填 null）'),
    ruleSourceImageBase64s: z.array(z.string()).nullable().describe('（admin 表单字段，AI 输出请填 null）'),
    benefitCategoryId: z.number().nullable().describe('优惠分类ID。当文章能明确归类为返现、支付立减、电子卡券等时，使用 `get_benefit_category_id` 工具查询；否则填 null。'),
    benefitPayPlatformId: z.number().nullable().describe('支付平台ID。当文章明确支付渠道为微信支付、支付宝、云闪付等时，使用 `get_benefit_platform_id` 工具查询；否则填 null。'),
    benefitUsagePlatformId: z.number().nullable().describe('使用平台ID。当文章明确优惠发生在美团、京东、携程等消费平台时，使用 `get_benefit_usage_platform_id` 工具查询；否则填 null。'),
    activityCategoryId: z.number().nullable().describe('活动分类ID。当文章可明确归入某个活动分类时，使用 `get_activity_category_id` 工具查询；否则填 null。'),
    participationDifficulty: z.string().nullable().describe('参与难度。根据文章活动描述推测参与复杂度，例如"简单"、"中等"、"复杂"等。'),
    guideText: z.string().nullable().describe('操作指引。用简短步骤总结"如何参加"活动；没有清晰步骤时填 null。'),
    // 仅 admin 表单使用；AI 解析时不要填（填 null 即可）
    linkedCoupons: z.array(z.object({
      couponId: z.number().int().positive(),
      purchasePrice: z.number().nullable(),
      sku: z.string().nullable(),
      actualValue: z.number().nullable(),
    })).nullable().optional().describe('（admin 表单字段，AI 输出请填 null）关联卡券明细：仅 benefitCategoryId in (1, 2) 时填值；同 couponId 多 SKU = 数组多行。'),
  })
}

/** 顶层 schema：解析出 1+ 个 task_template，外加多档互斥判断标识 */
export function getBankTaskGroupSchema() {
  return z.object({
    templates: z.array(getBankTemplateSchema()).min(1).describe('task_template 数组，至少 1 条。单一活动只输出 1 条（其内部 tiers 数组承载档位）；如果文章描述的是多个独立可叠加的活动（"非互斥多档"），输出多条 templates，每条 tiers 长度为 1。'),
    tierExclusive: z.boolean().nullable().describe('多档是否互斥取一。单档（templates.length==1 且 templates[0].tiers.length==1）填 null；多档"二选一/取最高/享受其中一项/最多享一档"填 true（输出 1 条 template + 多个 tier）；多档"分别享受/独立计算/可叠加/各档独立"填 false（输出多条 templates，每条 1 个 tier）。'),
  })
}
