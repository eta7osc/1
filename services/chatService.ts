// services/chatService.ts
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
  createdAt: string | Date
  url?: string   // 前端本地使用的临时访问地址
}

const ROOM_ID = 'couple-room'

// 拉取消息 + 拼装图片/视频临时 URL
export async function fetchMessages(limit = 500): Promise<Message[]> {
  await ensureLogin()
  const db = app.database()

  const res = await db
    .collection('messages')
    .where({ roomId: ROOM_ID })
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get()

  const data = res.data as any as Message[]

  const fileIds = Array.from(
    new Set(
      data
        .filter(m => !!m.fileId)
        .map(m => m.fileId as string)
    )
  )

  const fileIdToUrl = new Map<string, string>()

  if (fileIds.length > 0) {
    const storage = app.storage()
    const tempRes = await storage.getTempFileURL({
      fileList: fileIds
    })
    tempRes.fileList.forEach(item => {
      if (item.code === 'SUCCESS') {
        fileIdToUrl.set(item.fileID, item.tempFileURL)
      }
    })
  }

  const withUrl = data.map(m => ({
    ...m,
    url: m.fileId ? fileIdToUrl.get(m.fileId) : undefined
  }))

  return withUrl
}

// 发送文本消息
export async function sendTextMessage(senderId: Sender, content: string) {
  const text = content.trim()
  if (!text) return

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

// 上传文件并发送图片/视频消息
export async function sendFileMessage(senderId: Sender, file: File) {
  await ensureLogin()
  const storage = app.storage()

  const ext = file.name.split('.').pop() || ''
  const cloudPath = `chat-media/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.${ext}`

  const uploadRes = await storage.uploadFile({
    cloudPath,
    file
  })

  const fileId = uploadRes.fileID as string
  const isImage = file.type.startsWith('image/')
  const type: MsgType = isImage ? 'image' : 'video'

  const db = app.database()
  await db.collection('messages').add({
    roomId: ROOM_ID,
    senderId,
    type,
    fileId,
    createdAt: new Date()
  })
}
