import Fuse from 'fuse.js'
import { bank, bankCardTemplate, benefitCategory, benefitPlatform, region } from '../../../drizzle/schema'
import { db } from '../../db'

export interface BankRef {
  id: number
  name: string
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

class ReferenceDataCache {
  private _banks: BankRef[] | null = null
  private _regions: RegionRef[] | null = null
  private _benefitCategories: BenefitCategoryRef[] | null = null
  private _bankCardTemplates: BankCardTemplateRef[] | null = null
  private _benefitPlatforms: BenefitPlatformRef[] | null = null

  private _bankFuse: Fuse<BankRef> | null = null
  private _regionFuse: Fuse<RegionRef> | null = null
  private _templateFuse: Fuse<BankCardTemplateRef> | null = null
  private _platformFuse: Fuse<BenefitPlatformRef> | null = null

  async initialize() {
    const [banks, regions, categories, templates, platforms] = await Promise.all([
      db.select({ id: bank.id, name: bank.name }).from(bank),
      db.select({ regionCode: region.regionCode, regionName: region.regionName, level: region.level }).from(region),
      db.select({ id: benefitCategory.id, name: benefitCategory.name, icon: benefitCategory.icon }).from(benefitCategory),
      db.select({ id: bankCardTemplate.id, cardName: bankCardTemplate.cardName }).from(bankCardTemplate),
      db.select({ id: benefitPlatform.id, code: benefitPlatform.code, name: benefitPlatform.name, icon: benefitPlatform.icon }).from(benefitPlatform),
    ])

    this._banks = banks
    this._regions = regions
    this._benefitCategories = categories
    this._bankCardTemplates = templates
    this._benefitPlatforms = platforms

    this._bankFuse = new Fuse(banks, { keys: ['name'], threshold: 0.5 })
    this._regionFuse = new Fuse(regions, { keys: ['regionName'], threshold: 0.5 })
    this._templateFuse = new Fuse(templates, { keys: ['cardName'], threshold: 0.5 })
    this._platformFuse = new Fuse(platforms, { keys: ['name'], threshold: 0.5 })
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

  get benefitCategoryNames() {
    return this._benefitCategories!.map(c => c.name)
  }

  get benefitPlatformNames() {
    return this._benefitPlatforms!.map(p => p.name)
  }

  searchBanks(query: string, limit = 3) {
    return this._bankFuse!.search(query).slice(0, limit)
  }

  searchRegions(query: string, limit = 3) {
    return this._regionFuse!.search(query).slice(0, limit)
  }

  searchTemplates(query: string, limit = 3) {
    return this._templateFuse!.search(query).slice(0, limit)
  }

  searchPlatforms(query: string, limit = 3) {
    return this._platformFuse!.search(query).slice(0, limit)
  }

  findBenefitCategoryByName(name: string) {
    return this._benefitCategories!.find(c => c.name === name)
  }

  findBenefitPlatformByName(name: string) {
    return this._benefitPlatforms!.find(p => p.name === name)
  }
}

export const referenceData = new ReferenceDataCache()
