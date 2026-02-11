import { auth } from './cloudbaseClient'

const AUTH_STATUS_STORAGE_KEY = 'lovers_secret_phone_auth'
const SMS_VERIFICATION_STORAGE_KEY = 'lovers_secret_sms_verification_v1'
const SMS_VERIFICATION_MAX_AGE_MS = 10 * 60 * 1000

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

interface NormalizedPhone {
  local: string
  e164: string
  cloudPhone: string
}

interface SmsVerificationCacheEntry {
  verificationId: string
  isUser: boolean
  createdAt: number
}

type SmsVerificationCacheMap = Record<string, SmsVerificationCacheEntry>

function assertAuthReady() {
  if (!auth) {
    throw new Error('CloudBase auth is not initialized. Check VITE_CLOUDBASE_ENV_ID.')
  }
}

function extractErrorMessage(error: unknown): string | null {
  if (!error) {
    return null
  }
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error && error.message) {
    return error.message
  }

  const maybeObj = error as any
  if (typeof maybeObj?.message === 'string' && maybeObj.message) {
    return maybeObj.message
  }
  if (typeof maybeObj?.error_description === 'string' && maybeObj.error_description) {
    return maybeObj.error_description
  }
  if (typeof maybeObj?.error_message === 'string' && maybeObj.error_message) {
    return maybeObj.error_message
  }
  if (typeof maybeObj?.msg === 'string' && maybeObj.msg) {
    return maybeObj.msg
  }
  if (typeof maybeObj?.error?.message === 'string' && maybeObj.error.message) {
    return maybeObj.error.message
  }

  return null
}

function throwFriendlyError(error: unknown, fallback = 'Authentication failed. Please try again.'): never {
  const message = extractErrorMessage(error)
  throw new Error(message || fallback)
}

function normalizePhoneNumber(raw: string): NormalizedPhone {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Please enter a phone number')
  }

  const compact = trimmed.replace(/\s+/g, '')
  let local = ''

  if (/^1\d{10}$/.test(compact)) {
    local = compact
  } else if (/^\+?86\d{11}$/.test(compact)) {
    local = compact.replace(/^\+?86/, '')
  } else {
    throw new Error('Please enter a valid Mainland China phone number')
  }

  return {
    local,
    e164: `+86${local}`,
    cloudPhone: `+86 ${local}`
  }
}

function parseIdentityFromState(loginState: any): AuthIdentity | null {
  if (!loginState) {
    return null
  }

  const user = loginState.user || loginState.credential || loginState
  const uid = String(user?.uid || user?.uuid || user?.userId || user?.id || user?.sub || loginState.uid || '')
  if (!uid) {
    return null
  }

  const isAnonymous = Boolean(
    user?.isAnonymous ||
      user?.anonymous ||
      user?.is_anonymous ||
      user?.loginType === 'ANONYMOUS' ||
      user?.provider === 'anonymous' ||
      user?.authType === 'ANONYMOUS'
  )

  const phoneNumber =
    typeof user?.phone_number === 'string' ? user.phone_number : typeof user?.phoneNumber === 'string' ? user.phoneNumber : typeof user?.phone === 'string' ? user.phone : undefined

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

function readSmsVerificationCache(): SmsVerificationCacheMap {
  const raw = localStorage.getItem(SMS_VERIFICATION_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as SmsVerificationCacheMap) : {}
  } catch {
    return {}
  }
}

function writeSmsVerificationCache(cache: SmsVerificationCacheMap) {
  localStorage.setItem(SMS_VERIFICATION_STORAGE_KEY, JSON.stringify(cache))
}

function setSmsVerification(phoneE164: string, entry: SmsVerificationCacheEntry) {
  const cache = readSmsVerificationCache()
  cache[phoneE164] = entry
  writeSmsVerificationCache(cache)
}

function clearSmsVerification(phoneE164: string) {
  const cache = readSmsVerificationCache()
  if (cache[phoneE164]) {
    delete cache[phoneE164]
    writeSmsVerificationCache(cache)
  }
}

function getSmsVerification(phoneE164: string): SmsVerificationCacheEntry | null {
  const cache = readSmsVerificationCache()
  const entry = cache[phoneE164]
  if (!entry?.verificationId) {
    return null
  }

  if (Date.now() - entry.createdAt > SMS_VERIFICATION_MAX_AGE_MS) {
    clearSmsVerification(phoneE164)
    return null
  }

  return entry
}

function requireResultOk(result: any, fallback = 'Authentication failed. Please try again.') {
  if (result && typeof result === 'object' && 'error' in result && result.error) {
    throwFriendlyError(result.error, fallback)
  }
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
  const phone = normalizePhoneNumber(rawPhoneNumber)

  try {
    const verification = await auth!.getVerification({
      phone_number: phone.cloudPhone,
      target: 'ANY'
    })

    if (!verification?.verification_id) {
      throw new Error('Failed to send verification code. Please try again.')
    }

    setSmsVerification(phone.e164, {
      verificationId: verification.verification_id,
      isUser: Boolean(verification.is_user),
      createdAt: Date.now()
    })

    return phone.e164
  } catch (error) {
    throwFriendlyError(error, 'Failed to send verification code. Please try again.')
  }
}

export async function registerBySms(rawPhoneNumber: string, phoneCode: string, password: string): Promise<AuthIdentity> {
  assertAuthReady()
  const phone = normalizePhoneNumber(rawPhoneNumber)
  const code = phoneCode.trim()
  const safePassword = password.trim()

  if (!/^\d{4,8}$/.test(code)) {
    throw new Error('Please enter a valid SMS verification code')
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,32}$/.test(safePassword)) {
    throw new Error('Password must be 8-32 chars and include letters and numbers')
  }

  const verification = getSmsVerification(phone.e164)
  if (!verification) {
    throw new Error('Please request an SMS code first')
  }
  if (verification.isUser) {
    throw new Error('This phone number is already registered. Please sign in instead.')
  }

  try {
    const verifyRes = await auth!.verify({
      verification_id: verification.verificationId,
      verification_code: code
    })

    if (!verifyRes?.verification_token) {
      throw new Error('SMS code verification failed. Please request a new code.')
    }

    const signUpRes = await (auth as any).signUp({
      phone_number: phone.cloudPhone,
      password: safePassword,
      verification_token: verifyRes.verification_token,
      verification_code: code
    })

    requireResultOk(signUpRes, 'Registration failed. Please try again.')

    const identity = await getPhoneAuthIdentity()
    if (identity && !identity.isAnonymous) {
      clearSmsVerification(phone.e164)
      return identity
    }

    const passwordLoginRes = await auth!.signInWithPassword({
      phone: phone.cloudPhone,
      password: safePassword
    })
    requireResultOk(passwordLoginRes, 'Registered but auto sign-in failed. Please sign in with password.')

    const fallbackIdentity = await getPhoneAuthIdentity()
    if (!fallbackIdentity) {
      throw new Error('Registered but failed to load login state. Please sign in again.')
    }

    clearSmsVerification(phone.e164)
    return fallbackIdentity
  } catch (error) {
    throwFriendlyError(error, 'Registration failed. Please try again.')
  }
}

export async function loginBySmsOrPassword(input: SmsLoginInput): Promise<AuthIdentity> {
  assertAuthReady()

  const phone = normalizePhoneNumber(input.phoneNumber)
  const phoneCode = input.phoneCode?.trim()
  const password = input.password?.trim()

  if (!phoneCode && !password) {
    throw new Error('Please enter SMS code or password')
  }

  try {
    if (password) {
      const passwordLoginRes = await auth!.signInWithPassword({
        phone: phone.cloudPhone,
        password
      })
      requireResultOk(passwordLoginRes, 'Sign-in failed. Please try again.')
    } else {
      const verification = getSmsVerification(phone.e164)
      if (!verification) {
        throw new Error('Please request an SMS code first')
      }
      if (!verification.isUser) {
        throw new Error('This phone number is not registered yet. Please register first.')
      }

      const smsLoginRes = await auth!.verifyOtp({
        type: 'sms',
        phone: phone.cloudPhone,
        token: phoneCode,
        messageId: verification.verificationId
      })
      requireResultOk(smsLoginRes, 'Sign-in failed. Please try again.')
      clearSmsVerification(phone.e164)
    }

    const identity = await getPhoneAuthIdentity()
    if (!identity) {
      throw new Error('Signed in, but failed to load account identity.')
    }
    return identity
  } catch (error) {
    throwFriendlyError(error, 'Sign-in failed. Please try again.')
  }
}

export async function signOutPhoneAuth(): Promise<void> {
  assertAuthReady()
  try {
    await auth!.signOut()
  } finally {
    rememberPhoneAuth(null)
  }
}
