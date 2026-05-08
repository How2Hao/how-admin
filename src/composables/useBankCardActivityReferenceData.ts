import type {
  ReferenceOptionsResponse,
  ResolveSelectionsResponse,
  SearchActivityCategoriesResponse,
  SearchBankCardTemplatesResponse,
  SearchBanksResponse,
  SearchBenefitUsagePlatformsResponse,
  SearchRegionsResponse,
  SelectOption,
} from '@/types/bankCardActivities'
import { mergeCurrentOption } from './useBankCardActivityForm'
import { requestJson } from './useJsonRequest'

export function useBankCardActivityReferenceData() {
  const referenceOptions = ref<ReferenceOptionsResponse | null>(null)
  const bankOptions = ref<SelectOption[]>([])
  const bankCardTemplateOptions = ref<SelectOption[]>([])
  const regionOptions = ref<SelectOption[]>([])
  const benefitUsagePlatformOptions = ref<SelectOption[]>([])
  const activityCategoryOptions = ref<SelectOption[]>([])

  const cardOrganizationOptions = computed(() => referenceOptions.value?.cardOrganizations ?? [])
  const benefitCategoryOptions = computed(() => referenceOptions.value?.benefitCategories ?? [])
  const benefitPayPlatformOptions = computed(() => referenceOptions.value?.benefitPayPlatforms ?? [])
  const bankCardTypeOptions = computed<SelectOption[]>(() => [...(referenceOptions.value?.enums.bankCardType ?? [])])
  const regionMatchStrategyOptions = computed<SelectOption[]>(() => [...(referenceOptions.value?.enums.regionMatchStrategy ?? [])])
  const repeatTypeOptions = computed<SelectOption[]>(() => [...(referenceOptions.value?.enums.repeatType ?? [])])

  async function fetchSearchOptions<T extends { options: SelectOption[] }>(url: string) {
    const response = await requestJson<T>(url)
    return response.options
  }

  async function loadReferenceOptions() {
    referenceOptions.value = await requestJson<ReferenceOptionsResponse>('/api/bankCardActivities/web/referenceOptions')
    benefitUsagePlatformOptions.value = referenceOptions.value?.benefitUsagePlatforms ?? []
    activityCategoryOptions.value = referenceOptions.value?.activityCategories ?? []
  }

  async function searchBanks(keyword: string) {
    bankOptions.value = await fetchSearchOptions<SearchBanksResponse>(`/api/bankCardActivities/web/searchBanks?q=${encodeURIComponent(keyword)}`)
  }

  async function searchBankCardTemplates(keyword: string) {
    bankCardTemplateOptions.value = await fetchSearchOptions<SearchBankCardTemplatesResponse>(`/api/bankCardActivities/web/searchBankCardTemplates?q=${encodeURIComponent(keyword)}`)
  }

  async function searchRegions(keyword: string) {
    regionOptions.value = await fetchSearchOptions<SearchRegionsResponse>(`/api/bankCardActivities/web/searchRegions?q=${encodeURIComponent(keyword)}`)
  }

  async function searchBenefitUsagePlatforms(keyword: string) {
    benefitUsagePlatformOptions.value = await fetchSearchOptions<SearchBenefitUsagePlatformsResponse>(`/api/bankCardActivities/web/searchBenefitUsagePlatforms?q=${encodeURIComponent(keyword)}`)
  }

  async function searchActivityCategories(keyword: string) {
    activityCategoryOptions.value = await fetchSearchOptions<SearchActivityCategoriesResponse>(`/api/bankCardActivities/web/searchActivityCategories?q=${encodeURIComponent(keyword)}`)
  }

  async function loadResolvedSelections(payload: {
    bankId: number | null
    bankCardTemplateId: number | null
    regionCode?: string
    benefitUsagePlatformId: number | null
    activityCategoryId: number | null
  }) {
    const resolved = await requestJson<ResolveSelectionsResponse>('/api/bankCardActivities/web/resolveSelections', {
      method: 'POST',
      body: {
        bankId: payload.bankId,
        bankCardTemplateId: payload.bankCardTemplateId,
        regionCode: payload.regionCode,
        benefitUsagePlatformId: payload.benefitUsagePlatformId,
        activityCategoryId: payload.activityCategoryId,
      },
    })

    mergeCurrentOption(bankOptions, resolved.bank)
    mergeCurrentOption(bankCardTemplateOptions, resolved.bankCardTemplate)
    mergeCurrentOption(regionOptions, resolved.region)
    mergeCurrentOption(benefitUsagePlatformOptions, resolved.benefitUsagePlatform)
    mergeCurrentOption(activityCategoryOptions, resolved.activityCategory)
  }

  return {
    referenceOptions,
    bankOptions,
    bankCardTemplateOptions,
    regionOptions,
    benefitUsagePlatformOptions,
    activityCategoryOptions,
    cardOrganizationOptions,
    benefitCategoryOptions,
    benefitPayPlatformOptions,
    bankCardTypeOptions,
    regionMatchStrategyOptions,
    repeatTypeOptions,
    loadReferenceOptions,
    searchBanks,
    searchBankCardTemplates,
    searchRegions,
    searchBenefitUsagePlatforms,
    searchActivityCategories,
    loadResolvedSelections,
  }
}
