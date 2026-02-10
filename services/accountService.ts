import { getCurrentUid, app, ensureLogin, getStorage } from './cloudbaseClient'
import type { Sender } from './chatService'

const ACCOUNT_COLLECTION = 'couple_accounts'
const ACCOUNT_STORAGE_KEY = 'lovers_secret_account_profile'
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024

export interface AccountProfile {
  uid: string
  role: Sender
  nickname: string
  avatarFileId?: string
  avatarUrl?: string
}

export type CoupleAvatarMap = Partial<Record<Sender, string>>

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

async function resolveAvatarUrl(fileId?: string): Promise<string | undefined> {
  if (!fileId) {
    return undefined
  }

  try {
    const storage = getStorage()
    const res = await storage.getTempFileURL({ fileList: [fileId] })
    const item = res.fileList?.[0]
    if (item?.code === 'SUCCESS' && item.tempFileURL) {
      return String(item.tempFileURL)
    }
  } catch {
    // ignore
  }

  return undefined
}

function assertValidAvatar(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('头像仅支持图片文件')
  }

  if (file.size > MAX_AVATAR_FILE_SIZE) {
    throw new Error('头像大小不能超过 5MB')
  }
}

async function uploadAvatar(file: File): Promise<string> {
  const storage = getStorage()
  const ext = file.name.split('.').pop() || 'png'
  const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const uploadRes = await storage.uploadFile({ cloudPath, filePath: file as any })
  return String(uploadRes.fileID)
}

export function clearCachedProfile() {
  localStorage.removeItem(ACCOUNT_STORAGE_KEY)
}

export async function unbindCurrentAccount(): Promise<void> {
  await ensureLogin()
  const uid = await getCurrentUid()
  if (!uid) {
    throw new Error('账号初始化失败，请刷新页面重试')
  }

  const db = app.database()
  const currentQuery = await db.collection(ACCOUNT_COLLECTION).where({ uid }).limit(1).get()
  const currentRow = currentQuery.data?.[0] as any

  if (currentRow?._id) {
    await db.collection(ACCOUNT_COLLECTION).doc(currentRow._id).remove()
  }

  clearCachedProfile()
}

export async function getBoundAccount(): Promise<AccountProfile | null> {
  await ensureLogin()
  const uid = await getCurrentUid()
  if (!uid) {
    return null
  }

  const cached = readCachedProfile()
  if (cached && cached.uid === uid) {
    const profile: AccountProfile = {
      ...cached,
      avatarUrl: await resolveAvatarUrl(cached.avatarFileId)
    }
    saveCachedProfile(profile)
    return profile
  }

  const db = app.database()
  const res = await db.collection(ACCOUNT_COLLECTION).where({ uid }).limit(1).get()
  const row = res.data?.[0] as any
  if (!row) {
    clearCachedProfile()
    return null
  }

  const role = row.role === 'her' ? 'her' : 'me'
  const avatarFileId = typeof row.avatarFileId === 'string' ? row.avatarFileId : undefined
  const profile: AccountProfile = {
    uid,
    role,
    nickname: roleToNickname(role),
    avatarFileId,
    avatarUrl: await resolveAvatarUrl(avatarFileId)
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
    avatarFileId: typeof currentRow?.avatarFileId === 'string' ? currentRow.avatarFileId : null,
    updatedAt: new Date()
  }

  if (currentRow?._id) {
    await db.collection(ACCOUNT_COLLECTION).doc(currentRow._id).update(payload)
  } else {
    await db.collection(ACCOUNT_COLLECTION).add(payload)
  }

  const avatarFileId = typeof currentRow?.avatarFileId === 'string' ? currentRow.avatarFileId : undefined
  const profile: AccountProfile = {
    uid,
    role,
    nickname: roleToNickname(role),
    avatarFileId,
    avatarUrl: await resolveAvatarUrl(avatarFileId)
  }
  saveCachedProfile(profile)
  return profile
}

export async function updateAccountAvatar(file: File): Promise<AccountProfile> {
  assertValidAvatar(file)
  await ensureLogin()

  const uid = await getCurrentUid()
  if (!uid) {
    throw new Error('账号初始化失败，请刷新页面重试')
  }

  const db = app.database()
  const query = await db.collection(ACCOUNT_COLLECTION).where({ uid }).limit(1).get()
  const row = query.data?.[0] as any
  if (!row?._id) {
    throw new Error('请先绑定账号，再设置头像')
  }

  const avatarFileId = await uploadAvatar(file)
  await db.collection(ACCOUNT_COLLECTION).doc(row._id).update({
    avatarFileId,
    updatedAt: new Date()
  })

  const role = row.role === 'her' ? 'her' : 'me'
  const profile: AccountProfile = {
    uid,
    role,
    nickname: roleToNickname(role),
    avatarFileId,
    avatarUrl: await resolveAvatarUrl(avatarFileId)
  }
  saveCachedProfile(profile)
  return profile
}

export async function getCoupleAvatarMap(): Promise<CoupleAvatarMap> {
  await ensureLogin()

  const db = app.database()
  const res = await db.collection(ACCOUNT_COLLECTION).get()
  const rows = (res.data || []) as any[]

  const map: CoupleAvatarMap = {}
  for (const row of rows) {
    const role: Sender = row?.role === 'her' ? 'her' : 'me'
    const avatarFileId = typeof row?.avatarFileId === 'string' ? row.avatarFileId : undefined
    const avatarUrl = await resolveAvatarUrl(avatarFileId)
    if (avatarUrl) {
      map[role] = avatarUrl
    }
  }

  return map
}
