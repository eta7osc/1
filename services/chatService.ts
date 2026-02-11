import { app, ensureLogin, getStorage } from './cloudbaseClient'

export type MsgType = 'text' | 'image' | 'video' | 'emoji' | 'audio'
export type Sender = 'me' | 'her'

export interface Message {
  _id: string
  roomId: string
  senderId: Sender
  type: MsgType
  content?: string
  fileId?: string
  createdAt: string
  url?: string
  privateMedia?: boolean
  selfDestructSeconds?: number
  readByMeAt?: string
  readByHerAt?: string
  viewedAt?: string
  destructAt?: string
}

export interface EmojiPackItem {
  _id: string
  roomId: string
  senderId: Sender
  fileId: string
  createdAt: string
  url?: string
}

export interface SendMediaOptions {
  privateMedia?: boolean
  selfDestructSeconds?: number
}

const ROOM_ID = 'couple-room'
const MESSAGE_COLLECTION = 'messages'
const EMOJI_COLLECTION = 'emoji_packs'

const DEFAULT_MAX_CHAT_FILE_MB = Number(import.meta.env.VITE_MAX_CHAT_FILE_MB || '300')
const MAX_CHAT_FILE_SIZE = Math.max(20, DEFAULT_MAX_CHAT_FILE_MB) * 1024 * 1024
const MAX_EMOJI_FILE_SIZE = 10 * 1024 * 1024

function normalizeDate(value: unknown): string {
  if (!value) {
    return new Date().toISOString()
  }

  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString()
  }

  const date = new Date(value as any)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString()
  }

  return new Date().toISOString()
}

function normalizeMessage(raw: any): Message {
  const type = raw?.type
  const normalizedType: MsgType =
    type === 'image' || type === 'video' || type === 'emoji' || type === 'audio' ? type : 'text'

  return {
    _id: String(raw?._id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    roomId: String(raw?.roomId ?? ROOM_ID),
    senderId: raw?.senderId === 'her' ? 'her' : 'me',
    type: normalizedType,
    content: typeof raw?.content === 'string' ? raw.content : '',
    fileId: typeof raw?.fileId === 'string' ? raw.fileId : undefined,
    createdAt: normalizeDate(raw?.createdAt),
    privateMedia: Boolean(raw?.privateMedia),
    selfDestructSeconds: Number.isFinite(raw?.selfDestructSeconds) ? Number(raw.selfDestructSeconds) : undefined,
    readByMeAt: raw?.readByMeAt ? normalizeDate(raw.readByMeAt) : undefined,
    readByHerAt: raw?.readByHerAt ? normalizeDate(raw.readByHerAt) : undefined,
    viewedAt: raw?.viewedAt ? normalizeDate(raw.viewedAt) : undefined,
    destructAt: raw?.destructAt ? normalizeDate(raw.destructAt) : undefined
  }
}

function normalizeEmojiPack(raw: any): EmojiPackItem {
  return {
    _id: String(raw?._id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    roomId: String(raw?.roomId ?? ROOM_ID),
    senderId: raw?.senderId === 'her' ? 'her' : 'me',
    fileId: String(raw?.fileId || ''),
    createdAt: normalizeDate(raw?.createdAt)
  }
}

function assertValidChatFile(file: File) {
  const isAllowed = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')
  if (!isAllowed) {
    throw new Error('仅支持图片、视频或语音文件')
  }

  if (file.size > MAX_CHAT_FILE_SIZE) {
    throw new Error(`文件过大，最大支持 ${Math.round(MAX_CHAT_FILE_SIZE / 1024 / 1024)}MB`)
  }
}

function assertValidEmojiFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('表情包仅支持图片')
  }

  if (file.size > MAX_EMOJI_FILE_SIZE) {
    throw new Error('表情包图片不能超过 10MB')
  }
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

function isMessageExpired(message: Message) {
  if (!message.destructAt) {
    return false
  }

  return new Date(message.destructAt).getTime() <= Date.now()
}

function createSelfReadPayload(senderId: Sender) {
  const now = new Date()
  return senderId === 'me'
    ? { readByMeAt: now, readByHerAt: null as Date | null }
    : { readByMeAt: null as Date | null, readByHerAt: now }
}

async function uploadMediaFile(file: File, folder: string) {
  const storage = getStorage()
  const ext = file.name.split('.').pop() || 'bin'
  const cloudPath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const uploadRes = await storage.uploadFile({ cloudPath, filePath: file as any })
  return String(uploadRes.fileID)
}

export async function fetchMessages(limit = 500): Promise<Message[]> {
  await ensureLogin()

  const db = app.database()
  const res = await db
    .collection(MESSAGE_COLLECTION)
    .where({ roomId: ROOM_ID })
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get()

  const normalized = (res.data || []).map(normalizeMessage)

  const expiredMessageIds = normalized.filter(isMessageExpired).map(message => message._id)
  if (expiredMessageIds.length > 0) {
    for (const id of expiredMessageIds) {
      db.collection(MESSAGE_COLLECTION)
        .doc(id)
        .remove()
        .catch(() => {
          // ignore cleanup errors
        })
    }
  }

  const activeMessages = normalized.filter(message => !isMessageExpired(message))

  const fileIds = Array.from(new Set(activeMessages.filter(message => !!message.fileId).map(message => message.fileId as string)))
  const fileIdToUrl = await getTempUrlMap(fileIds)

  return activeMessages.map(message => ({
    ...message,
    url: message.fileId ? fileIdToUrl.get(message.fileId) : undefined
  }))
}

export async function sendTextMessage(senderId: Sender, content: string) {
  const text = content.trim()
  if (!text) {
    return
  }

  await ensureLogin()
  const db = app.database()

  await db.collection(MESSAGE_COLLECTION).add({
    roomId: ROOM_ID,
    senderId,
    type: 'text',
    content: text,
    ...createSelfReadPayload(senderId),
    createdAt: new Date()
  })
}

export async function sendFileMessage(senderId: Sender, file: File, options: SendMediaOptions = {}) {
  assertValidChatFile(file)
  await ensureLogin()

  const fileId = await uploadMediaFile(file, 'chat-media')
  const type: MsgType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio'

  const privateMedia = Boolean(options.privateMedia)
  const selfDestructSeconds = privateMedia ? Math.max(10, Number(options.selfDestructSeconds || 60)) : undefined

  const db = app.database()
  await db.collection(MESSAGE_COLLECTION).add({
    roomId: ROOM_ID,
    senderId,
    type,
    fileId,
    privateMedia,
    selfDestructSeconds,
    ...createSelfReadPayload(senderId),
    viewedAt: null,
    destructAt: null,
    createdAt: new Date()
  })
}

export async function markPrivateMessageViewed(message: Message): Promise<void> {
  if (!message.privateMedia || !message.selfDestructSeconds || message.destructAt) {
    return
  }

  await ensureLogin()
  const db = app.database()
  const now = Date.now()

  await db.collection(MESSAGE_COLLECTION).doc(message._id).update({
    viewedAt: new Date(now),
    destructAt: new Date(now + message.selfDestructSeconds * 1000)
  })
}

function getReaderField(readerId: Sender) {
  return readerId === 'me' ? 'readByMeAt' : 'readByHerAt'
}

export async function markMessagesRead(readerId: Sender, messageIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(messageIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return
  }

  await ensureLogin()
  const db = app.database()
  const readField = getReaderField(readerId)
  const now = new Date()

  for (const id of uniqueIds) {
    try {
      await db.collection(MESSAGE_COLLECTION).doc(id).update({ [readField]: now })
    } catch {
      // Ignore single-message failures, next poll will retry.
    }
  }
}

export async function fetchEmojiPacks(limit = 80): Promise<EmojiPackItem[]> {
  await ensureLogin()

  const db = app.database()
  const res = await db
    .collection(EMOJI_COLLECTION)
    .where({ roomId: ROOM_ID })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  const data = (res.data || []).map(normalizeEmojiPack).filter(item => Boolean(item.fileId))
  const fileIdToUrl = await getTempUrlMap(Array.from(new Set(data.map(item => item.fileId))))

  return data.map(item => ({
    ...item,
    url: fileIdToUrl.get(item.fileId)
  }))
}

export async function saveEmojiPackFromMessage(senderId: Sender, fileId: string) {
  await ensureLogin()
  if (!fileId) {
    throw new Error('图片文件不存在，无法保存为表情包')
  }

  const db = app.database()
  await db.collection(EMOJI_COLLECTION).add({
    roomId: ROOM_ID,
    senderId,
    fileId,
    createdAt: new Date()
  })
}

export async function uploadEmojiPack(senderId: Sender, file: File) {
  assertValidEmojiFile(file)
  await ensureLogin()

  const fileId = await uploadMediaFile(file, 'emoji-packs')
  const db = app.database()
  await db.collection(EMOJI_COLLECTION).add({
    roomId: ROOM_ID,
    senderId,
    fileId,
    createdAt: new Date()
  })
}

export async function sendEmojiMessage(senderId: Sender, fileId: string) {
  await ensureLogin()
  if (!fileId) {
    throw new Error('表情包文件不存在')
  }

  const db = app.database()
  await db.collection(MESSAGE_COLLECTION).add({
    roomId: ROOM_ID,
    senderId,
    type: 'emoji',
    fileId,
    ...createSelfReadPayload(senderId),
    createdAt: new Date()
  })
}
