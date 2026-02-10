import cloudbase from '@cloudbase/js-sdk'

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID
const hasEnvId = typeof envId === 'string' && envId.trim().length > 0

if (!hasEnvId) {
  console.warn('[CloudBase] Missing VITE_CLOUDBASE_ENV_ID, CloudBase calls will fail until it is configured.')
}

export const app = cloudbase.init(hasEnvId ? { env: envId } : {})

const authInstance = hasEnvId ? app.auth({ persistence: 'local' }) : null
export const auth = authInstance

function assertCloudBaseReady() {
  if (!hasEnvId || !authInstance) {
    throw new Error('CloudBase 未配置：请在 .env.local 中设置 VITE_CLOUDBASE_ENV_ID 并重启开发服务器。')
  }
}

export async function ensureLogin() {
  assertCloudBaseReady()

  const loginState = await authInstance.getLoginState()
  if (loginState) {
    return loginState
  }

  const res = await authInstance.signInAnonymously()
  return res.loginState
}

export async function getCurrentUid(): Promise<string> {
  const state: any = await ensureLogin()
  const user = state?.user || state?.credential || state

  return String(user?.uid || user?.uuid || user?.userId || user?.openid || state?.uid || '')
}
