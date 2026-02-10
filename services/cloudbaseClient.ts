import cloudbase from '@cloudbase/js-sdk'

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID

if (!envId) {
  console.warn('[CloudBase] Missing VITE_CLOUDBASE_ENV_ID, CloudBase calls will fail until it is configured.')
}

export const app = cloudbase.init({
  env: envId || ''
})

export const auth = app.auth({ persistence: 'local' })

export async function ensureLogin() {
  const loginState = await auth.getLoginState()
  if (loginState) {
    return loginState
  }

  const res = await auth.signInAnonymously()
  return res.loginState
}

export async function getCurrentUid(): Promise<string> {
  const state: any = await ensureLogin()
  const user = state?.user || state?.credential || state

  return String(user?.uid || user?.uuid || user?.userId || user?.openid || state?.uid || '')
}
