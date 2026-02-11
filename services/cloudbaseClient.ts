import cloudbase from '@cloudbase/js-sdk'

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID
const hasEnvId = typeof envId === 'string' && envId.trim().length > 0
const MISSING_ENV_PLACEHOLDER = '__missing_cloudbase_env__'

if (!hasEnvId) {
  console.warn('[CloudBase] Missing VITE_CLOUDBASE_ENV_ID, CloudBase calls will fail until it is configured.')
}

const appConfig: Parameters<typeof cloudbase.init>[0] = {
  env: hasEnvId ? envId.trim() : MISSING_ENV_PLACEHOLDER
}

export const app = cloudbase.init(appConfig)

const authInstance = hasEnvId ? app.auth({ persistence: 'local' }) : null
export const auth = authInstance

export function getStorage() {
  const maybeStorage = (app as any).storage
  if (typeof maybeStorage === 'function') {
    return maybeStorage.call(app)
  }
  if (maybeStorage && typeof maybeStorage === 'object') {
    return maybeStorage
  }
  throw new Error('CloudBase storage 不可用，请检查 SDK 初始化')
}

function assertCloudBaseReady() {
  if (!hasEnvId || !authInstance) {
    throw new Error('CloudBase 未配置：请在 .env.local 中设置 VITE_CLOUDBASE_ENV_ID 并重启开发服务器。')
  }
}

function toErrorMessage(value: unknown) {
  if (!value) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Error) {
    return value.message
  }

  const maybeObj = value as any
  return maybeObj?.message || maybeObj?.error_description || maybeObj?.msg || maybeObj?.code || ''
}

function getReadyAuth() {
  assertCloudBaseReady()
  return authInstance as NonNullable<typeof authInstance>
}

export async function ensureLogin() {
  const readyAuth = getReadyAuth()

  const loginState = await readyAuth.getLoginState()
  if (loginState) {
    return loginState
  }

  const signInRes = await readyAuth.signInAnonymously()
  const signInError = (signInRes as any)?.error
  if (signInError) {
    throw new Error(toErrorMessage(signInError) || 'CloudBase 匿名登录失败，请稍后重试')
  }

  const refreshedState = await readyAuth.getLoginState()
  if (refreshedState) {
    return refreshedState
  }

  const signInUser = (signInRes as any)?.data?.user
  if (signInUser) {
    return { user: signInUser }
  }

  throw new Error('CloudBase 登录状态不可用，请稍后重试')
}

export async function getCurrentUid(): Promise<string> {
  const state: any = await ensureLogin()
  const user = state?.user || state?.credential || state

  return String(user?.uid || user?.uuid || user?.userId || user?.openid || state?.uid || '')
}
