import { auth } from './cloudbaseClient'

const AUTH_STATUS_STORAGE_KEY = 'lovers_secret_phone_auth'

export interface AuthIdentity {
  uid: string
  phoneNumber?: string
  isAnonymous: boolean
}

export interface SmsLoginInput {
  phoneNumber: string
  phoneCode?: string
  password?: string
}

function assertAuthReady() {
  if (!auth) {
    throw new Error('CloudBase 鉴权未就绪，请检查 VITE_CLOUDBASE_ENV_ID 配置。')
  }
}

function normalizePhoneNumber(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('请输入手机号')
  }

  const compact = trimmed.replace(/\s+/g, '')
  if (compact.startsWith('+')) {
    if (!/^\+\d{6,20}$/.test(compact)) {
      throw new Error('手机号格式不正确，请使用 +86 开头的完整号码')
    }
    return compact
  }

  if (!/^1\d{10}$/.test(compact)) {
    throw new Error('请输入正确的中国大陆手机号')
  }
  return `+86${compact}`
}

function parseIdentityFromState(loginState: any): AuthIdentity | null {
  if (!loginState) {
    return null
  }

  const user = loginState.user || loginState.credential || loginState
  const uid = String(user?.uid || user?.uuid || user?.userId || loginState.uid || '')
  if (!uid) {
    return null
  }

  const isAnonymous = Boolean(
    user?.isAnonymous ||
      user?.anonymous ||
      user?.loginType === 'ANONYMOUS' ||
      user?.provider === 'anonymous' ||
      user?.authType === 'ANONYMOUS'
  )

  const phoneNumber = typeof user?.phone_number === 'string' ? user.phone_number : typeof user?.phoneNumber === 'string' ? user.phoneNumber : undefined

  return { uid, phoneNumber, isAnonymous }
}

function rememberPhoneAuth(identity: AuthIdentity | null) {
  if (identity && !identity.isAnonymous) {
    localStorage.setItem(AUTH_STATUS_STORAGE_KEY, '1')
    return
  }
  localStorage.removeItem(AUTH_STATUS_STORAGE_KEY)
}

function readPhoneAuthFallback() {
  return localStorage.getItem(AUTH_STATUS_STORAGE_KEY) === '1'
}

function throwFriendlyError(error: unknown): never {
  if (error instanceof Error && error.message) {
    throw error
  }
  throw new Error('认证失败，请稍后重试')
}

export async function getPhoneAuthIdentity(): Promise<AuthIdentity | null> {
  assertAuthReady()
  try {
    const loginState = await auth!.getLoginState()
    const identity = parseIdentityFromState(loginState)
    rememberPhoneAuth(identity)
    return identity
  } catch {
    return null
  }
}

export async function isPhoneAuthenticated(): Promise<boolean> {
  const identity = await getPhoneAuthIdentity()
  if (identity) {
    return !identity.isAnonymous
  }
  return readPhoneAuthFallback()
}

export async function sendPhoneSmsCode(rawPhoneNumber: string): Promise<string> {
  assertAuthReady()
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber)

  try {
    await (auth as any).sendPhoneCode(phoneNumber)
    return phoneNumber
  } catch (error) {
    throwFriendlyError(error)
  }
}

export async function registerBySms(rawPhoneNumber: string, phoneCode: string, password: string): Promise<AuthIdentity> {
  assertAuthReady()
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber)
  const code = phoneCode.trim()
  const safePassword = password.trim()

  if (!/^\d{4,8}$/.test(code)) {
    throw new Error('请输入正确的短信验证码')
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,32}$/.test(safePassword)) {
    throw new Error('密码需为 8-32 位，且包含字母和数字')
  }

  try {
    await (auth as any).signUpWithPhoneCode(phoneNumber, code, safePassword)
    const loginState = await auth!.getLoginState()
    const identity = parseIdentityFromState(loginState)
    if (!identity) {
      throw new Error('注册成功，但登录态获取失败，请重新登录')
    }
    rememberPhoneAuth(identity)
    return identity
  } catch (error) {
    throwFriendlyError(error)
  }
}

export async function loginBySmsOrPassword(input: SmsLoginInput): Promise<AuthIdentity> {
  assertAuthReady()

  const phoneNumber = normalizePhoneNumber(input.phoneNumber)
  const phoneCode = input.phoneCode?.trim()
  const password = input.password?.trim()

  if (!phoneCode && !password) {
    throw new Error('请填写短信验证码或密码')
  }

  try {
    const loginState = await (auth as any).signInWithPhoneCodeOrPassword({
      phoneNumber,
      phoneCode: phoneCode || undefined,
      password: password || undefined
    })
    const identity = parseIdentityFromState(loginState)
    if (!identity) {
      throw new Error('登录成功，但用户信息解析失败')
    }
    rememberPhoneAuth(identity)
    return identity
  } catch (error) {
    throwFriendlyError(error)
  }
}

export async function signOutPhoneAuth(): Promise<void> {
  assertAuthReady()
  try {
    await (auth as any).signOut()
  } finally {
    rememberPhoneAuth(null)
  }
}
