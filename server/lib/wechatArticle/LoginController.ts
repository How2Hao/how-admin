import type { QrCodePayload } from './types'

interface LoginControllerState {
  canceled: boolean
  completed: boolean
  lastStatus: string | null
  qrCodePayload: QrCodePayload | null
}

const LOGIN_CONTROLLER_STATE = Symbol('wechat-article.login-controller-state')

export class LoginController {
  public readonly sid: string;

  [LOGIN_CONTROLLER_STATE]: LoginControllerState

  constructor(sid: string) {
    this.sid = sid
    this[LOGIN_CONTROLLER_STATE] = {
      canceled: false,
      completed: false,
      lastStatus: null,
      qrCodePayload: null,
    }
  }

  cancel() {
    this[LOGIN_CONTROLLER_STATE].canceled = true
    this[LOGIN_CONTROLLER_STATE].lastStatus = 'canceled'
  }
}

export function getLoginControllerState(controller: LoginController) {
  return controller[LOGIN_CONTROLLER_STATE]
}

export function isLoginController(value: unknown): value is LoginController {
  return value instanceof LoginController
}
