import { app, ensureLogin } from './cloudbaseClient'
import type { Sender } from './chatService'

const ROOM_ID = 'couple-room'
const COLLECTION = 'anniversaries'

export interface AnniversaryItem {
  _id: string
  roomId: string
  title: string
  date: string
  reminderDays: number
  createdBy: Sender
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

function normalizeItem(raw: any): AnniversaryItem {
  return {
    _id: String(raw?._id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    roomId: String(raw?.roomId || ROOM_ID),
    title: String(raw?.title || ''),
    date: String(raw?.date || ''),
    reminderDays: Number.isFinite(raw?.reminderDays) ? Number(raw.reminderDays) : 1,
    createdBy: raw?.createdBy === 'her' ? 'her' : 'me',
    createdAt: normalizeDate(raw?.createdAt)
  }
}

export async function fetchAnniversaries(limit = 120): Promise<AnniversaryItem[]> {
  await ensureLogin()

  const db = app.database()
  const res = await db.collection(COLLECTION).where({ roomId: ROOM_ID }).orderBy('date', 'asc').limit(limit).get()

  return (res.data || []).map(normalizeItem)
}

export async function createAnniversary(createdBy: Sender, title: string, date: string, reminderDays: number) {
  await ensureLogin()

  const text = title.trim()
  if (!text || !date) {
    throw new Error('请填写完整信息')
  }

  const db = app.database()
  await db.collection(COLLECTION).add({
    roomId: ROOM_ID,
    title: text,
    date,
    reminderDays,
    createdBy,
    createdAt: new Date()
  })
}

export async function removeAnniversary(id: string) {
  await ensureLogin()

  const db = app.database()
  await db.collection(COLLECTION).doc(id).remove()
}
