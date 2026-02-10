import { app, ensureLogin, getStorage } from './cloudbaseClient'
import type { Sender } from './chatService'

const ROOM_ID = 'couple-room'
const COLLECTION = 'home_posts'
const MAX_MEDIA_SIZE = 300 * 1024 * 1024
const MAX_IMAGE_COUNT = 9
const MAX_VIDEO_COUNT = 1

export interface HomeComment {
  id: string
  authorId: Sender
  content: string
  createdAt: string
}

export interface HomeMedia {
  fileId: string
  type: 'image' | 'video'
  url?: string
}

export interface HomePost {
  _id: string
  roomId: string
  authorId: Sender
  content: string
  media: HomeMedia[]
  likes: Sender[]
  comments: HomeComment[]
  createdAt: string
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

function normalizePost(raw: any): HomePost {
  const media: HomeMedia[] = Array.isArray(raw?.media)
    ? raw.media
        .map((item: any) => ({
          fileId: String(item?.fileId || ''),
          type: item?.type === 'video' ? 'video' : 'image'
        }))
        .filter((item: HomeMedia) => Boolean(item.fileId))
    : []

  const comments: HomeComment[] = Array.isArray(raw?.comments)
    ? raw.comments
        .map((comment: any) => ({
          id: String(comment?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
          authorId: comment?.authorId === 'her' ? 'her' : 'me',
          content: String(comment?.content || ''),
          createdAt: normalizeDate(comment?.createdAt)
        }))
        .filter((comment: HomeComment) => Boolean(comment.content))
    : []

  const likes: Sender[] = Array.isArray(raw?.likes)
    ? raw.likes.map((like: unknown) => (like === 'her' ? 'her' : 'me'))
    : []

  return {
    _id: String(raw?._id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    roomId: String(raw?.roomId || ROOM_ID),
    authorId: raw?.authorId === 'her' ? 'her' : 'me',
    content: String(raw?.content || ''),
    media,
    likes,
    comments,
    createdAt: normalizeDate(raw?.createdAt)
  }
}

function assertMediaFile(file: File) {
  const isAllowed = file.type.startsWith('image/') || file.type.startsWith('video/')
  if (!isAllowed) {
    throw new Error('家页面仅支持图片和视频')
  }

  if (file.size > MAX_MEDIA_SIZE) {
    throw new Error('文件过大，家页面单文件最大 300MB')
  }
}

async function uploadHomeMedia(file: File): Promise<HomeMedia> {
  assertMediaFile(file)
  const storage = getStorage()
  const ext = file.name.split('.').pop() || 'bin'
  const cloudPath = `home-media/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const uploadRes = await storage.uploadFile({ cloudPath, file })

  return {
    fileId: String(uploadRes.fileID),
    type: file.type.startsWith('video/') ? 'video' : 'image'
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

export async function fetchHomePosts(limit = 100): Promise<HomePost[]> {
  await ensureLogin()

  const db = app.database()
  const res = await db.collection(COLLECTION).where({ roomId: ROOM_ID }).orderBy('createdAt', 'desc').limit(limit).get()

  const posts = (res.data || []).map(normalizePost)
  const fileIds = Array.from(new Set(posts.flatMap(post => post.media.map(item => item.fileId))))
  const fileIdToUrl = await getTempUrlMap(fileIds)

  return posts.map(post => ({
    ...post,
    media: post.media.map(item => ({
      ...item,
      url: fileIdToUrl.get(item.fileId)
    }))
  }))
}

export async function createHomePost(authorId: Sender, content: string, files: File[]) {
  await ensureLogin()
  const text = content.trim()

  if (!text && files.length === 0) {
    throw new Error('请输入内容或上传图片/视频')
  }

  const imageCount = files.filter(file => file.type.startsWith('image/')).length
  const videoCount = files.filter(file => file.type.startsWith('video/')).length
  if (imageCount > MAX_IMAGE_COUNT) {
    throw new Error(`最多上传 ${MAX_IMAGE_COUNT} 张图片`)
  }
  if (videoCount > MAX_VIDEO_COUNT) {
    throw new Error('最多上传 1 个视频')
  }
  if (imageCount > 0 && videoCount > 0) {
    throw new Error('图片与视频请分开发布，更接近朋友圈体验')
  }

  const media: HomeMedia[] = []
  for (const file of files) {
    const uploaded = await uploadHomeMedia(file)
    media.push(uploaded)
  }

  const db = app.database()
  await db.collection(COLLECTION).add({
    roomId: ROOM_ID,
    authorId,
    content: text,
    media,
    likes: [],
    comments: [],
    createdAt: new Date()
  })
}

export async function toggleHomeLike(postId: string, actor: Sender) {
  await ensureLogin()
  const db = app.database()
  const res = await db.collection(COLLECTION).doc(postId).get()
  const row = res.data?.[0] as any
  if (!row) {
    throw new Error('动态不存在')
  }

  const currentLikes: Sender[] = Array.isArray(row.likes) ? row.likes.map((like: unknown) => (like === 'her' ? 'her' : 'me')) : []
  const nextLikes = currentLikes.includes(actor) ? currentLikes.filter(item => item !== actor) : [...currentLikes, actor]

  await db.collection(COLLECTION).doc(postId).update({ likes: nextLikes })
}

export async function addHomeComment(postId: string, actor: Sender, content: string) {
  await ensureLogin()
  const text = content.trim()
  if (!text) {
    return
  }

  const db = app.database()
  const res = await db.collection(COLLECTION).doc(postId).get()
  const row = res.data?.[0] as any
  if (!row) {
    throw new Error('动态不存在')
  }

  const comments = Array.isArray(row.comments) ? row.comments : []
  comments.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    authorId: actor,
    content: text,
    createdAt: new Date()
  })

  await db.collection(COLLECTION).doc(postId).update({ comments })
}

