import type { SessionInfo } from '../types'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { CookieJar } from 'tough-cookie'

interface PersistedSession {
  version: 1
  token: string | null
  expiresAt: string | null
  account: {
    nickname: string
    avatar: string
  } | null
  cookies: unknown
}

export class SessionStore {
  private _jar: CookieJar
  private _token: string | null = null
  private _expiresAt: Date | null = null
  private _nickname: string | null = null
  private _avatar: string | null = null

  constructor(private readonly persistPath?: string) {
    this._jar = new CookieJar()
    this.load()
  }

  get jar() {
    return this._jar
  }

  get token() {
    return this._token
  }

  get expiresAt() {
    return this._expiresAt
  }

  get session(): SessionInfo | null {
    if (!this._token || !this._expiresAt || !this._nickname || this._avatar === null) {
      return null
    }

    return {
      token: this._token,
      expiresAt: this._expiresAt,
      nickname: this._nickname,
      avatar: this._avatar,
    }
  }

  isLoggedIn() {
    return Boolean(this._token && this._expiresAt && this._expiresAt.getTime() > Date.now())
  }

  setAuthenticated(input: SessionInfo) {
    this._token = input.token
    this._expiresAt = input.expiresAt
    this._nickname = input.nickname
    this._avatar = input.avatar
    this.save()
  }

  clear() {
    this._jar = new CookieJar()
    this._token = null
    this._expiresAt = null
    this._nickname = null
    this._avatar = null

    if (this.persistPath && existsSync(this.persistPath)) {
      rmSync(this.persistPath)
    }
  }

  private load() {
    if (!this.persistPath || !existsSync(this.persistPath)) {
      return
    }

    try {
      const content = readFileSync(this.persistPath, 'utf8')
      const parsed = JSON.parse(content) as PersistedSession

      this._jar = parsed.cookies ? CookieJar.fromJSON(parsed.cookies as never) : new CookieJar()
      this._token = parsed.token
      this._expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null
      this._nickname = parsed.account?.nickname ?? null
      this._avatar = parsed.account?.avatar ?? null
    }
    catch {
      this.clear()
    }
  }

  private save() {
    if (!this.persistPath) {
      return
    }

    const payload: PersistedSession = {
      version: 1,
      token: this._token,
      expiresAt: this._expiresAt ? this._expiresAt.toISOString() : null,
      account:
        this._nickname === null || this._avatar === null
          ? null
          : {
              nickname: this._nickname,
              avatar: this._avatar,
            },
      cookies: this._jar.toJSON(),
    }

    mkdirSync(dirname(this.persistPath), { recursive: true })
    writeFileSync(this.persistPath, JSON.stringify(payload, null, 2))
  }
}
