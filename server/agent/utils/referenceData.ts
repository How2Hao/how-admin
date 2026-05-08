import Fuse from 'fuse.js'
import { activityCategory, bank, bankCardTemplate, benefitCategory, benefitPayPlatform, benefitUsagePlatform, cardOrganization, region } from '../../../drizzle/schema'
import { db } from '../../db'

export interface BankRef {
  id: number
  name: string
  logo: string | null
}

export interface RegionRef {
  regionCode: string
  regionName: string | null
  level: number | null
}

export interface BenefitCategoryRef {
  id: number
  name: string
  icon: string | null
}

export interface BankCardTemplateRef {
  id: number
  cardName: string
}

export interface BenefitPlatformRef {
  id: number
  code: string
  name: string
  icon: string | null
}

export interface BenefitUsagePlatformRef {
  id: number
  code: string
  name: string
  icon: string | null
}

export interface ActivityCategoryRef {
  id: number
  code: string
  name: string
  parentId: number | null
  icon: string | null
}

export interface CardOrganizationRef {
  id: number
  name: string
  memberOrgIds: string | null
  supportedCardTypes: string | null
  status: string
}

class ReferenceDataCache {
  private threshold = 0.3
  private limit = 3

  private _banks: BankRef[] | null = null
  private _regions: RegionRef[] | null = null
  private _benefitCategories: BenefitCategoryRef[] | null = null
  private _bankCardTemplates: BankCardTemplateRef[] | null = null
  private _benefitPlatforms: BenefitPlatformRef[] | null = null
  private _benefitUsagePlatforms: BenefitUsagePlatformRef[] | null = null
  private _activityCategories: ActivityCategoryRef[] | null = null
  private _cardOrganizations: CardOrganizationRef[] | null = null

  private _bankFuse: Fuse<BankRef> | null = null
  private _regionFuse: Fuse<RegionRef> | null = null
  private _templateFuse: Fuse<BankCardTemplateRef> | null = null
  private _platformFuse: Fuse<BenefitPlatformRef> | null = null
  private _usagePlatformFuse: Fuse<BenefitUsagePlatformRef> | null = null
  private _activityCategoryFuse: Fuse<ActivityCategoryRef> | null = null

  private _initPromise: Promise<void> | null = null

  async ensureInitialized() {
    if (this._cardOrganizations) return
    if (!this._initPromise) {
      this._initPromise = this.initialize()
    }
    await this._initPromise
  }

  invalidate() {
    this._banks = null
    this._regions = null
    this._benefitCategories = null
    this._bankCardTemplates = null
    this._benefitPlatforms = null
    this._benefitUsagePlatforms = null
    this._activityCategories = null
    this._cardOrganizations = null
    this._bankFuse = null
    this._regionFuse = null
    this._templateFuse = null
    this._platformFuse = null
    this._usagePlatformFuse = null
    this._activityCategoryFuse = null
    this._initPromise = null
  }

  async initialize() {
    const [banks, regions, categories, templates, platforms, usagePlatforms, activityCategories, cardOrganizations] = await Promise.all([
      db.select({ id: bank.id, name: bank.name, logo: bank.logo }).from(bank),
      db.select({ regionCode: region.regionCode, regionName: region.regionName, level: region.level }).from(region),
      db.select({ id: benefitCategory.id, name: benefitCategory.name, icon: benefitCategory.icon }).from(benefitCategory),
      db.select({ id: bankCardTemplate.id, cardName: bankCardTemplate.cardName }).from(bankCardTemplate),
      db.select({ id: benefitPayPlatform.id, code: benefitPayPlatform.code, name: benefitPayPlatform.name, icon: benefitPayPlatform.icon }).from(benefitPayPlatform),
      db.select({ id: benefitUsagePlatform.id, code: benefitUsagePlatform.code, name: benefitUsagePlatform.name, icon: benefitUsagePlatform.icon }).from(benefitUsagePlatform),
      db.select({ id: activityCategory.id, code: activityCategory.code, name: activityCategory.name, parentId: activityCategory.parentId, icon: activityCategory.icon }).from(activityCategory),
      db.select({ id: cardOrganization.id, name: cardOrganization.name, memberOrgIds: cardOrganization.memberOrgIds, supportedCardTypes: cardOrganization.supportedCardTypes, status: cardOrganization.status }).from(cardOrganization),
    ])

    this._banks = banks
    this._regions = regions
    this._benefitCategories = categories
    this._bankCardTemplates = templates
    this._benefitPlatforms = platforms
    this._benefitUsagePlatforms = usagePlatforms
    this._activityCategories = activityCategories
    this._cardOrganizations = cardOrganizations

    this._bankFuse = new Fuse(banks, { keys: ['name'], threshold: this.threshold })
    this._regionFuse = new Fuse(regions, { keys: ['regionName'], threshold: this.threshold })
    this._templateFuse = new Fuse(templates, { keys: ['cardName'], threshold: this.threshold })
    this._platformFuse = new Fuse(platforms, { keys: ['name'], threshold: this.threshold })
    this._usagePlatformFuse = new Fuse(usagePlatforms, { keys: ['name'], threshold: this.threshold })
    this._activityCategoryFuse = new Fuse(activityCategories, { keys: ['name'], threshold: this.threshold })
  }

  get banks(): BankRef[] {
    return this._banks!
  }

  get regions(): RegionRef[] {
    return this._regions!
  }

  get benefitCategories(): BenefitCategoryRef[] {
    return this._benefitCategories!
  }

  get bankCardTemplates(): BankCardTemplateRef[] {
    return this._bankCardTemplates!
  }

  get benefitPlatforms(): BenefitPlatformRef[] {
    return this._benefitPlatforms!
  }

  get benefitUsagePlatforms(): BenefitUsagePlatformRef[] {
    return this._benefitUsagePlatforms!
  }

  get activityCategories(): ActivityCategoryRef[] {
    return this._activityCategories!
  }

  get cardOrganizations(): CardOrganizationRef[] {
    return this._cardOrganizations!
  }

  get benefitCategoryNames() {
    return this._benefitCategories!.map(c => c.name)
  }

  get benefitPlatformNames() {
    return this._benefitPlatforms!.map(p => p.name)
  }

  get benefitUsagePlatformNames() {
    return this._benefitUsagePlatforms!.map(p => p.name)
  }

  get activityCategoryNames() {
    return this._activityCategories!.map(c => c.name)
  }

  searchBanks(query: string, limit = this.limit) {
    return this._bankFuse!.search(query).slice(0, limit)
  }

  searchRegions(query: string, limit = this.limit) {
    return this._regionFuse!.search(query).slice(0, limit)
  }

  searchTemplates(query: string, limit = this.limit) {
    return this._templateFuse!.search(query).slice(0, limit)
  }

  searchPlatforms(query: string, limit = this.limit) {
    return this._platformFuse!.search(query).slice(0, limit)
  }

  searchUsagePlatforms(query: string, limit = this.limit) {
    return this._usagePlatformFuse!.search(query).slice(0, limit)
  }

  searchActivityCategories(query: string, limit = this.limit) {
    return this._activityCategoryFuse!.search(query).slice(0, limit)
  }

  findBenefitCategoryByName(name: string) {
    return this._benefitCategories!.find(c => c.name === name)
  }

  findBenefitPlatformByName(name: string) {
    return this._benefitPlatforms!.find(p => p.name === name)
  }

  findBenefitUsagePlatformByName(name: string) {
    return this._benefitUsagePlatforms!.find(p => p.name === name)
  }

  findActivityCategoryByName(name: string) {
    return this._activityCategories!.find(c => c.name === name)
  }
}

export const referenceData = new ReferenceDataCache()
