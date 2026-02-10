import { app, ensureLogin, getStorage } from './cloudbaseClient'
import type { Sender } from './chatService'

const ROOM_ID = 'couple-room'
const COLLECTION = 'wall_items'
const MAX_MEDIA_SIZE = 500 * 1024 * 1024

export interface WallItem {
  _id: string
  roomId: string
  uploaderId: Sender
  isPrivate: boolean
  type: 'image' | 'video'
  fileId: string
  caption: string
  createdAt: string
  url?: string
}

function normalizeDate(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString()
  }
  const date = new Date(value as any)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function normalizeItem(raw: any): WallItem {
  return {
    _id: String(raw?._id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    roomId: String(raw?.roomId || ROOM_ID),
    uploaderId: raw?.uploaderId === 'her' ? 'her' : 'me',
    isPrivate: Boolean(raw?.isPrivate),
    type: raw?.type === 'video' ? 'video' : 'image',
    fileId: String(raw?.fileId || ''),
    caption: String(raw?.caption || ''),
    createdAt: normalizeDate(raw?.createdAt)
  }
}

function assertWallFile(file: File) {
  const isAllowed = file.type.startsWith('image/') || file.type.startsWith('video/')
  if (!isAllowed) {
    throw new Error('照片墙仅支持图片和视频')
  }

  if (file.size > MAX_MEDIA_SIZE) {
    throw new Error('文件过大，照片墙单文件最大 500MB')
  }
}

async function uploadWallFile(file: File) {
  const storage = getStorage()
  const ext = file.name.split('.').pop() || 'bin'
  const cloudPath = `wall-media/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const uploadRes = await storage.uploadFile({ cloudPath, file })
  return String(uploadRes.fileID)
}

async function getTempUrlMap(fileIds: string[]) {
  const map = new Map<string, string>()
  if (fileIds.length === 0) {
    return map
  }

  const storage = getStorage()
  const tempRes = await storage.getTempFileURL({ fileList: fileIds })

  for (const item of tempRes.fileList || []) {
    if (item.code === 'SUCCESS' && item.fileID && item.tempFileURL) {
      map.set(item.fileID, item.tempFileURL)
    }
  }

  return map
}

export async function fetchWallItems(isPrivate: boolean, limit = 200): Promise<WallItem[]> {
  await ensureLogin()

  const db = app.database()
  const res = await db
    .collection(COLLECTION)
    .where({ roomId: ROOM_ID, isPrivate })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  const items = (res.data || []).map(normalizeItem).filter(item => Boolean(item.fileId))
  const fileIdToUrl = await getTempUrlMap(Array.from(new Set(items.map(item => item.fileId))))

  return items.map(item => ({
    ...item,
    url: fileIdToUrl.get(item.fileId)
  }))
}

export async function createWallItem(uploaderId: Sender, file: File, isPrivate: boolean, caption = '') {
  await ensureLogin()
  assertWallFile(file)

  const fileId = await uploadWallFile(file)

  const db = app.database()
  await db.collection(COLLECTION).add({
    roomId: ROOM_ID,
    uploaderId,
    isPrivate,
    type: file.type.startsWith('video/') ? 'video' : 'image',
    fileId,
    caption: caption.trim(),
    createdAt: new Date()
  })
}
