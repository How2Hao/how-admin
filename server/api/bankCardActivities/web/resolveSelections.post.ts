import { defineHandler } from 'nitro'
import { referenceData } from '~~/agent/utils/referenceData'

interface ResolveSelectionsBody {
  bankId?: number | null
  bankCardTemplateId?: number | null
  regionCode?: string | null
  benefitUsagePlatformId?: number | null
  activityCategoryId?: number | null
}

export default defineHandler(async (event) => {
  const body = await event.req.json() as ResolveSelectionsBody

  const bank = body.bankId ? referenceData.banks.find(item => item.id === body.bankId) : null
  const bankCardTemplate = body.bankCardTemplateId
    ? referenceData.bankCardTemplates.find(item => item.id === body.bankCardTemplateId)
    : null
  const region = body.regionCode
    ? referenceData.regions.find(item => item.regionCode === body.regionCode)
    : null
  const benefitUsagePlatform = body.benefitUsagePlatformId
    ? referenceData.benefitUsagePlatforms.find(item => item.id === body.benefitUsagePlatformId)
    : null
  const activityCategory = body.activityCategoryId
    ? referenceData.activityCategories.find(item => item.id === body.activityCategoryId)
    : null

  return {
    bank: bank
      ? {
          label: bank.name,
          value: bank.id,
          icon: bank.logo,
        }
      : null,
    bankCardTemplate: bankCardTemplate
      ? {
          label: bankCardTemplate.cardName,
          value: bankCardTemplate.id,
        }
      : null,
    region: region
      ? {
          label: region.regionName ?? region.regionCode,
          value: region.regionCode,
        }
      : null,
    benefitUsagePlatform: benefitUsagePlatform
      ? {
          label: benefitUsagePlatform.name,
          value: benefitUsagePlatform.id,
          icon: benefitUsagePlatform.icon,
        }
      : null,
    activityCategory: activityCategory
      ? {
          label: activityCategory.name,
          value: activityCategory.id,
        }
      : null,
  }
})
