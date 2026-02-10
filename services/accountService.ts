import { getCurrentUid, app, ensureLogin } from './cloudbaseClient'
import type { Sender } from './chatService'

const ACCOUNT_COLLECTION = 'couple_accounts'
const ACCOUNT_STORAGE_KEY = 'lovers_secret_account_profile'

export interface AccountProfile {
  uid: string
  role: Sender
  nickname: string
}

function getExpectedInviteCode(role: Sender) {
  return role === 'me' ? import.meta.env.VITE_ME_INVITE_CODE : import.meta.env.VITE_HER_INVITE_CODE
}

function roleToNickname(role: Sender) {
  return role === 'me' ? '我' : '她'
}

function readCachedProfile(): AccountProfile | null {
  const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as AccountProfile
    if (!parsed.uid || (parsed.role !== 'me' && parsed.role !== 'her')) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveCachedProfile(profile: AccountProfile) {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(profile))
}

export function clearCachedProfile() {
  localStorage.removeItem(ACCOUNT_STORAGE_KEY)
}

export async function getBoundAccount(): Promise<AccountProfile | null> {
  await ensureLogin()
  const uid = await getCurrentUid()
  if (!uid) {
    return null
  }

  const cached = readCachedProfile()
  if (cached && cached.uid === uid) {
    return cached
  }

  const db = app.database()
  const res = await db.collection(ACCOUNT_COLLECTION).where({ uid }).limit(1).get()
  const row = res.data?.[0] as any
  if (!row) {
    clearCachedProfile()
    return null
  }

  const profile: AccountProfile = {
    uid,
    role: row.role === 'her' ? 'her' : 'me',
    nickname: roleToNickname(row.role === 'her' ? 'her' : 'me')
  }
  saveCachedProfile(profile)
  return profile
}

export async function bindAccount(role: Sender, inviteCode: string): Promise<AccountProfile> {
  await ensureLogin()
  const uid = await getCurrentUid()
  if (!uid) {
    throw new Error('账号初始化失败，请刷新页面重试')
  }

  const expectedInviteCode = getExpectedInviteCode(role)
  if (!expectedInviteCode) {
    throw new Error(`缺少 ${role === 'me' ? 'VITE_ME_INVITE_CODE' : 'VITE_HER_INVITE_CODE'} 配置`)
  }

  if (inviteCode.trim() !== expectedInviteCode) {
    throw new Error('邀请码不正确')
  }

  const db = app.database()

  const roleQuery = await db.collection(ACCOUNT_COLLECTION).where({ role }).limit(1).get()
  const roleRow = roleQuery.data?.[0] as any
  if (roleRow && roleRow.uid && roleRow.uid !== uid) {
    throw new Error(`角色“${roleToNickname(role)}”已被绑定`)
  }

  const currentQuery = await db.collection(ACCOUNT_COLLECTION).where({ uid }).limit(1).get()
  const currentRow = currentQuery.data?.[0] as any

  const payload = {
    uid,
    role,
    nickname: roleToNickname(role),
    updatedAt: new Date()
  }

  if (currentRow?._id) {
    await db.collection(ACCOUNT_COLLECTION).doc(currentRow._id).update(payload)
  } else {
    await db.collection(ACCOUNT_COLLECTION).add(payload)
  }

  const profile: AccountProfile = {
    uid,
    role,
    nickname: roleToNickname(role)
  }
  saveCachedProfile(profile)
  return profile
}
