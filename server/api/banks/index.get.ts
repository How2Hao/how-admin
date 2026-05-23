import { asc } from 'drizzle-orm'
import { defineHandler } from 'nitro'
import { db } from '~~/db'
import { bank } from '../../../drizzle/schema'

// 后台银行列表：返回所有银行（含 is_visible=0），不做用户端过滤
export default defineHandler(async () => {
  const list = await db
    .select({
      id: bank.id,
      name: bank.name,
      code: bank.code,
      logo: bank.logo,
      pinyinIndex: bank.pinyinIndex,
      isVisible: bank.isVisible,
      bankType: bank.bankType,
      isHot: bank.isHot,
    })
    .from(bank)
    .orderBy(asc(bank.pinyinIndex), asc(bank.id))
  return { list }
})
