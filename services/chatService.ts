import { app, ensureLogin } from './cloudbaseClient'

export type MsgType = 'text' | 'image' | 'video'
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
}

const ROOM_ID = 'couple-room'
const ALLOWED_FILE_TYPES = ['image/', 'video/']
const MAX_FILE_SIZE = 20 * 1024 * 1024

function normalizeDate(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date().toISOString()
}

function normalizeMessage(raw: any): Message {
  return {
    _id: String(raw?._id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    roomId: String(raw?.roomId ?? ROOM_ID),
    senderId: raw?.senderId === 'her' ? 'her' : 'me',
    type: raw?.type === 'image' || raw?.type === 'video' ? raw.type : 'text',
    content: typeof raw?.content === 'string' ? raw.content : '',
    fileId: typeof raw?.fileId === 'string' ? raw.fileId : undefined,
    createdAt: normalizeDate(raw?.createdAt)
  }
}

function assertValidFile(file: File) {
  const isAllowed = ALLOWED_FILE_TYPES.some(prefix => file.type.startsWith(prefix))
  if (!isAllowed) {
    throw new Error('仅支持图片或视频文件')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('文件过大，最大支持 20MB')
  }
}

export async function fetchMessages(limit = 500): Promise<Message[]> {
  await ensureLogin()

  const db = app.database()
  const res = await db
    .collection('messages')
    .where({ roomId: ROOM_ID })
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get()

  const data = (res.data || []).map(normalizeMessage)

  const fileIds = Array.from(
    new Set(
      data
        .filter(message => !!message.fileId)
        .map(message => message.fileId as string)
    )
  )

  const fileIdToUrl = new Map<string, string>()
  if (fileIds.length > 0) {
    const storage = app.storage()
    const tempRes = await storage.getTempFileURL({ fileList: fileIds })

    for (const item of tempRes.fileList || []) {
      if (item.code === 'SUCCESS' && item.fileID && item.tempFileURL) {
        fileIdToUrl.set(item.fileID, item.tempFileURL)
      }
    }
  }

  return data.map(message => ({
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

  await db.collection('messages').add({
    roomId: ROOM_ID,
    senderId,
    type: 'text',
    content: text,
    createdAt: new Date()
  })
}

export async function sendFileMessage(senderId: Sender, file: File) {
  assertValidFile(file)
  await ensureLogin()

  const storage = app.storage()
  const ext = file.name.split('.').pop() || 'bin'
  const cloudPath = `chat-media/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const uploadRes = await storage.uploadFile({
    cloudPath,
    file
  })

  const fileId = uploadRes.fileID as string
  const type: MsgType = file.type.startsWith('image/') ? 'image' : 'video'

  const db = app.database()
  await db.collection('messages').add({
    roomId: ROOM_ID,
    senderId,
    type,
    fileId,
    createdAt: new Date()
  })
}
