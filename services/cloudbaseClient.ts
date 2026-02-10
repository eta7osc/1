import cloudbase from '@cloudbase/js-sdk'

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID

if (!envId) {
  // Help fail fast when env is missing in deployment.
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
