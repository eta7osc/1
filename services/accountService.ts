import { getCurrentUid, app, ensureLogin, getStorage } from './cloudbaseClient'
import type { Sender } from './chatService'

const ACCOUNT_COLLECTION = 'couple_accounts'
const ACCOUNT_STORAGE_KEY = 'lovers_secret_account_profile'
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024
const MAX_COVER_FILE_SIZE = 8 * 1024 * 1024
const MAX_USERNAME_LENGTH = 20

export interface AccountProfile {
  uid: string
  role: Sender
  nickname: string
  username: string
  avatarFileId?: string
  avatarUrl?: string
  coverFileId?: string
  coverUrl?: string
}

export type CoupleAvatarMap = Partial<Record<Sender, string>>

function normalizeRole(value: unknown): Sender {
  return value === 'her' ? 'her' : 'me'
}

function roleToNickname(role: Sender) {
  return role === 'me' ? '我' : '她'
}

function normalizeUsername(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }

  return trimmed.slice(0, MAX_USERNAME_LENGTH)
}

function readCachedProfile(): AccountProfile | null {
  const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as any
    const uid = String(parsed?.uid || '').trim()
    if (!uid) {
      return null
    }

    const role = normalizeRole(parsed?.role)
    const fallbackName = roleToNickname(role)
    const username = normalizeUsername(parsed?.username ?? parsed?.nickname, fallbackName)

    return {
      uid,
      role,
      username,
      nickname: username,
      avatarFileId: typeof parsed?.avatarFileId === 'string' ? parsed.avatarFileId : undefined,
      avatarUrl: typeof parsed?.avatarUrl === 'string' ? parsed.avatarUrl : undefined,
      coverFileId: typeof parsed?.coverFileId === 'string' ? parsed.coverFileId : undefined,
      coverUrl: typeof parsed?.coverUrl === 'string' ? parsed.coverUrl : undefined
    }
  } catch {
    return null
  }
}

function saveCachedProfile(profile: AccountProfile) {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(profile))
}

async function resolveFileUrl(fileId?: string): Promise<string | undefined> {
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

function assertValidImage(file: File, maxFileSize: number, label: string) {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${label}仅支持图片文件`)
  }

  if (file.size > maxFileSize) {
    throw new Error(`${label}大小不能超过 ${Math.round(maxFileSize / 1024 / 1024)}MB`)
  }
}

async function uploadImage(file: File, folder: string): Promise<string> {
  const storage = getStorage()
  const ext = file.name.split('.').pop() || 'png'
  const cloudPath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const uploadRes = await storage.uploadFile({ cloudPath, filePath: file as any })
  return String(uploadRes.fileID)
}

async function getRowByUid(db: any, uid: string) {
  const query = await db.collection(ACCOUNT_COLLECTION).where({ uid }).limit(1).get()
  return query.data?.[0] as any
}

async function profileFromRow(uid: string, row: any): Promise<AccountProfile> {
  const role = normalizeRole(row?.role)
  const fallbackName = roleToNickname(role)
  const username = normalizeUsername(row?.username ?? row?.nickname, fallbackName)
  const avatarFileId = typeof row?.avatarFileId === 'string' ? row.avatarFileId : undefined
  const coverFileId = typeof row?.coverFileId === 'string' ? row.coverFileId : undefined

  const [avatarUrl, coverUrl] = await Promise.all([resolveFileUrl(avatarFileId), resolveFileUrl(coverFileId)])

  return {
    uid,
    role,
    username,
    nickname: username,
    avatarFileId,
    avatarUrl,
    coverFileId,
    coverUrl
  }
}

async function updateCurrentProfileRow(updates: Record<string, unknown>): Promise<AccountProfile> {
  await ensureLogin()
  const uid = await getCurrentUid()
  if (!uid) {
    throw new Error('账号初始化失败，请刷新页面重试')
  }

  const db = app.database()
  const row = await getRowByUid(db, uid)
  if (!row?._id) {
    throw new Error('账号资料不存在，请重新登录后重试')
  }

  await db.collection(ACCOUNT_COLLECTION).doc(row._id).update({
    ...updates,
    updatedAt: new Date()
  })

  const profile = await profileFromRow(uid, { ...row, ...updates })
  saveCachedProfile(profile)
  return profile
}

function pickNextRole(rows: any[], currentUid: string): Sender | null {
  const holder = new Map<Sender, string>()

  rows.forEach(row => {
    const uid = typeof row?.uid === 'string' ? row.uid : ''
    if (!uid) {
      return
    }
    const role = normalizeRole(row?.role)
    if (!holder.has(role)) {
      holder.set(role, uid)
    }
  })

  const meUid = holder.get('me')
  if (!meUid || meUid === currentUid) {
    return 'me'
  }

  const herUid = holder.get('her')
  if (!herUid || herUid === currentUid) {
    return 'her'
  }

  return null
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
  const currentRow = await getRowByUid(db, uid)

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
    const refreshed: AccountProfile = {
      ...cached,
      avatarUrl: await resolveFileUrl(cached.avatarFileId),
      coverUrl: await resolveFileUrl(cached.coverFileId)
    }
    saveCachedProfile(refreshed)
    return refreshed
  }

  const db = app.database()
  const row = await getRowByUid(db, uid)
  if (!row) {
    clearCachedProfile()
    return null
  }

  const profile = await profileFromRow(uid, row)
  saveCachedProfile(profile)
  return profile
}

export async function ensureAccountProfile(): Promise<AccountProfile> {
  const existed = await getBoundAccount()
  if (existed) {
    return existed
  }

  await ensureLogin()
  const uid = await getCurrentUid()
  if (!uid) {
    throw new Error('账号初始化失败，请刷新页面重试')
  }

  const db = app.database()
  const allRes = await db.collection(ACCOUNT_COLLECTION).get()
  const rows = (allRes.data || []) as any[]

  const role = pickNextRole(rows, uid)
  if (!role) {
    throw new Error('当前情侣空间已满，暂无法加入新成员')
  }

  const username = roleToNickname(role)

  await db.collection(ACCOUNT_COLLECTION).add({
    uid,
    role,
    username,
    nickname: username,
    avatarFileId: null,
    coverFileId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  })

  const row = await getRowByUid(db, uid)
  if (!row) {
    throw new Error('创建账号资料失败，请稍后重试')
  }

  const profile = await profileFromRow(uid, row)
  saveCachedProfile(profile)
  return profile
}

export async function updateAccountAvatar(file: File): Promise<AccountProfile> {
  assertValidImage(file, MAX_AVATAR_FILE_SIZE, '头像')
  const avatarFileId = await uploadImage(file, 'avatars')
  return updateCurrentProfileRow({ avatarFileId })
}

export async function updateAccountCover(file: File): Promise<AccountProfile> {
  assertValidImage(file, MAX_COVER_FILE_SIZE, '背景图')
  const coverFileId = await uploadImage(file, 'profile-covers')
  return updateCurrentProfileRow({ coverFileId })
}

export async function updateAccountUsername(rawUsername: string): Promise<AccountProfile> {
  const username = rawUsername.trim()
  if (!username) {
    throw new Error('用户名不能为空')
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    throw new Error(`用户名不能超过 ${MAX_USERNAME_LENGTH} 个字符`)
  }

  return updateCurrentProfileRow({
    username,
    nickname: username
  })
}

export async function getCoupleAvatarMap(): Promise<CoupleAvatarMap> {
  await ensureLogin()

  const db = app.database()
  const res = await db.collection(ACCOUNT_COLLECTION).get()
  const rows = (res.data || []) as any[]

  const entries = await Promise.all(
    rows.map(async row => {
      const role: Sender = normalizeRole(row?.role)
      const avatarFileId = typeof row?.avatarFileId === 'string' ? row.avatarFileId : undefined
      const avatarUrl = await resolveFileUrl(avatarFileId)
      return { role, avatarUrl }
    })
  )

  const map: CoupleAvatarMap = {}
  entries.forEach(entry => {
    if (entry.avatarUrl) {
      map[entry.role] = entry.avatarUrl
    }
  })

  return map
}
