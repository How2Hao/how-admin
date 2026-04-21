export type IsLoggedInApiResponse = ReturnType<typeof import('./../../server/api/wechat/officialAccounts/isLoggedIn').default>
export type AccountApiResponse = ReturnType<typeof import('./../../server/api/wechat/officialAccounts/account/[name]').default> extends Promise<infer T>
  ? T
  : never
