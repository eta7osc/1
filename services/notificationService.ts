import { app, ensureLogin, getCurrentUid } from './cloudbaseClient'
import type { Sender } from './chatService'

const PUSH_SUBSCRIPTION_COLLECTION = 'push_subscriptions'
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || '').trim()

export type PushPermissionState = NotificationPermission | 'unsupported'

export interface PushSubscriptionStatus {
  supported: boolean
  permission: PushPermissionState
  subscribed: boolean
  reason?: string
}

interface CloudPushSubscriptionPayload {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

function getPublicBase() {
  const base = (import.meta.env.BASE_URL || '/').trim()
  return base.endsWith('/') ? base : `${base}/`
}

function getSupportReason(): string | null {
  if (typeof window === 'undefined') {
    return '当前环境不支持浏览器推送'
  }

  if (!window.isSecureContext) {
    return '推送仅支持 HTTPS 或 localhost'
  }

  if (!('serviceWorker' in navigator)) {
    return '浏览器不支持 Service Worker'
  }

  if (!('PushManager' in window)) {
    return '浏览器不支持 Push API'
  }

  if (!('Notification' in window)) {
    return '浏览器不支持通知 API'
  }

  return null
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const normalized = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(normalized)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

function normalizeSubscription(subscription: PushSubscription): CloudPushSubscriptionPayload {
  const serialized = subscription.toJSON() as any
  const endpoint = typeof serialized?.endpoint === 'string' ? serialized.endpoint : ''
  const p256dh = typeof serialized?.keys?.p256dh === 'string' ? serialized.keys.p256dh : ''
  const auth = typeof serialized?.keys?.auth === 'string' ? serialized.keys.auth : ''

  if (!endpoint || !p256dh || !auth) {
    throw new Error('推送订阅信息不完整，请重试')
  }

  return {
    endpoint,
    expirationTime: typeof serialized?.expirationTime === 'number' ? serialized.expirationTime : null,
    keys: {
      p256dh,
      auth
    }
  }
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const scope = getPublicBase()
  const scriptUrl = `${scope}sw.js`

  await navigator.serviceWorker.register(scriptUrl, { scope })
  return navigator.serviceWorker.ready
}

async function getSubscription(): Promise<PushSubscription | null> {
  const registration = await ensureServiceWorkerRegistration()
  return registration.pushManager.getSubscription()
}

async function upsertSubscriptionInCloud(role: Sender, subscription: PushSubscription): Promise<void> {
  await ensureLogin()
  const uid = await getCurrentUid()
  if (!uid) {
    throw new Error('账号未就绪，无法保存推送配置')
  }

  const db = app.database()
  const normalized = normalizeSubscription(subscription)
  const now = new Date()
  const queryRes = await db.collection(PUSH_SUBSCRIPTION_COLLECTION).where({ endpoint: normalized.endpoint }).limit(1).get()
  const existing = queryRes.data?.[0] as any

  const payload = {
    uid,
    role,
    endpoint: normalized.endpoint,
    expirationTime: normalized.expirationTime,
    keys: normalized.keys,
    userAgent: navigator.userAgent,
    enabled: true,
    updatedAt: now
  }

  if (existing?._id) {
    await db.collection(PUSH_SUBSCRIPTION_COLLECTION).doc(existing._id).update(payload)
  } else {
    await db.collection(PUSH_SUBSCRIPTION_COLLECTION).add({
      ...payload,
      createdAt: now
    })
  }
}

async function removeSubscriptionFromCloud(endpoint: string): Promise<void> {
  if (!endpoint) {
    return
  }

  await ensureLogin()
  const db = app.database()
  const queryRes = await db.collection(PUSH_SUBSCRIPTION_COLLECTION).where({ endpoint }).limit(20).get()
  const rows = (queryRes.data || []) as any[]

  for (const row of rows) {
    if (row?._id) {
      await db.collection(PUSH_SUBSCRIPTION_COLLECTION).doc(row._id).remove()
    }
  }
}

export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  const reason = getSupportReason()
  if (reason) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      reason
    }
  }

  try {
    const subscription = await getSubscription()
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: Boolean(subscription)
    }
  } catch (error) {
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: false,
      reason: error instanceof Error ? error.message : '推送状态检查失败'
    }
  }
}

export async function enablePushNotifications(role: Sender): Promise<PushSubscriptionStatus> {
  const reason = getSupportReason()
  if (reason) {
    throw new Error(reason)
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('缺少 VITE_WEB_PUSH_VAPID_PUBLIC_KEY 配置')
  }

  const registration = await ensureServiceWorkerRegistration()

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('通知权限未开启，请在系统设置中允许通知')
  }

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  }

  await upsertSubscriptionInCloud(role, subscription)

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: true
  }
}

export async function disablePushNotifications(): Promise<PushSubscriptionStatus> {
  const reason = getSupportReason()
  if (reason) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      reason
    }
  }

  const subscription = await getSubscription()
  if (!subscription) {
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: false
    }
  }

  const endpoint = subscription.endpoint

  try {
    await removeSubscriptionFromCloud(endpoint)
  } catch (error) {
    console.warn('[Push] failed to remove subscription from cloud', error)
  }

  try {
    await subscription.unsubscribe()
  } catch (error) {
    console.warn('[Push] failed to unsubscribe in browser', error)
  }

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: false
  }
}

export async function syncExistingPushSubscription(role: Sender): Promise<void> {
  const status = await getPushSubscriptionStatus()
  if (!status.supported || status.permission !== 'granted' || !status.subscribed) {
    return
  }

  const subscription = await getSubscription()
  if (!subscription) {
    return
  }

  await upsertSubscriptionInCloud(role, subscription)
}

export async function clearPushSubscriptionBinding(): Promise<void> {
  const reason = getSupportReason()
  if (reason) {
    return
  }

  const subscription = await getSubscription()
  if (!subscription) {
    return
  }

  try {
    await removeSubscriptionFromCloud(subscription.endpoint)
  } catch (error) {
    console.warn('[Push] failed to clear subscription binding', error)
  }
}
