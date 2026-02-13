const cloudbase = require('@cloudbase/node-sdk')
const webpush = require('web-push')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const auth = app.auth()
const db = app.database()

const ACCOUNT_COLLECTION = 'couple_accounts'
const PUSH_SUBSCRIPTION_COLLECTION = 'push_subscriptions'
const DEFAULT_URL = '/#/'
const DEFAULT_TAG = 'lovers-secret-chat'

function asTrimmedString(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function sanitizeSenderLabel(value, fallback) {
  const trimmed = asTrimmedString(value)
  if (!trimmed) {
    return fallback
  }

  return trimmed.length > 20 ? `${trimmed.slice(0, 20)}...` : trimmed
}

function buildMessageBody(event) {
  if (Boolean(event.privateMedia)) {
    return '发来一条私密消息'
  }

  const messageType = asTrimmedString(event.messageType).toLowerCase()
  const preview = asTrimmedString(event.preview)

  if (messageType === 'text' && preview) {
    return preview.length > 80 ? `${preview.slice(0, 80)}...` : preview
  }

  if (messageType === 'image') {
    return '发来一张图片'
  }

  if (messageType === 'video') {
    return '发来一段视频'
  }

  if (messageType === 'audio') {
    return '发来一条语音消息'
  }

  if (messageType === 'emoji') {
    return '发来一个表情包'
  }

  return preview || '发来一条新消息'
}

function isExpiredSubscriptionError(error) {
  const statusCode = Number(error && error.statusCode)
  return statusCode === 404 || statusCode === 410
}

async function removeInvalidSubscriptions(subscriptionIds) {
  if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
    return
  }

  await Promise.all(
    subscriptionIds.map(id =>
      db
        .collection(PUSH_SUBSCRIPTION_COLLECTION)
        .doc(id)
        .remove()
        .catch(() => null)
    )
  )
}

exports.main = async function main(event = {}) {
  const vapidPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  const vapidSubject = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@example.com'

  if (!vapidPublicKey || !vapidPrivateKey) {
    return {
      ok: false,
      delivered: 0,
      error: 'Missing WEB_PUSH_VAPID_PUBLIC_KEY or WEB_PUSH_VAPID_PRIVATE_KEY'
    }
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const userInfo = auth.getUserInfo() || {}
  const senderUid = asTrimmedString(userInfo.uid)
  if (!senderUid) {
    return {
      ok: false,
      delivered: 0,
      error: 'Unauthenticated request'
    }
  }

  const senderQuery = await db.collection(ACCOUNT_COLLECTION).where({ uid: senderUid }).limit(1).get()
  const senderAccount = senderQuery.data && senderQuery.data[0]
  if (!senderAccount) {
    return {
      ok: false,
      delivered: 0,
      error: 'Sender account profile not found'
    }
  }

  const senderRole = senderAccount.role === 'her' ? 'her' : 'me'
  const targetRole = senderRole === 'me' ? 'her' : 'me'

  const targetQuery = await db.collection(ACCOUNT_COLLECTION).where({ role: targetRole }).limit(1).get()
  const targetAccount = targetQuery.data && targetQuery.data[0]
  const targetUid = targetAccount && asTrimmedString(targetAccount.uid)

  if (!targetUid) {
    return {
      ok: true,
      delivered: 0,
      skipped: 'No target account'
    }
  }

  const subscriptionRes = await db.collection(PUSH_SUBSCRIPTION_COLLECTION).where({ uid: targetUid }).limit(200).get()
  const subscriptions = Array.isArray(subscriptionRes.data) ? subscriptionRes.data : []

  if (subscriptions.length === 0) {
    return {
      ok: true,
      delivered: 0,
      skipped: 'No push subscriptions'
    }
  }

  const senderFallbackLabel = senderRole === 'me' ? '我' : '她'
  const senderLabel = sanitizeSenderLabel(event.senderLabel, sanitizeSenderLabel(senderAccount.username, senderFallbackLabel))
  const payload = JSON.stringify({
    title: `${senderLabel}发来新消息`,
    body: buildMessageBody(event),
    url: DEFAULT_URL,
    tag: DEFAULT_TAG
  })

  let delivered = 0
  const invalidSubscriptionIds = []

  for (const row of subscriptions) {
    const endpoint = asTrimmedString(row.endpoint)
    const p256dh = asTrimmedString(row.keys && row.keys.p256dh)
    const authKey = asTrimmedString(row.keys && row.keys.auth)

    if (!endpoint || !p256dh || !authKey) {
      continue
    }

    const subscription = {
      endpoint,
      expirationTime: typeof row.expirationTime === 'number' ? row.expirationTime : null,
      keys: {
        p256dh,
        auth: authKey
      }
    }

    try {
      await webpush.sendNotification(subscription, payload)
      delivered += 1
    } catch (error) {
      if (isExpiredSubscriptionError(error) && row._id) {
        invalidSubscriptionIds.push(String(row._id))
      }
    }
  }

  await removeInvalidSubscriptions(invalidSubscriptionIds)

  return {
    ok: true,
    delivered,
    removed: invalidSubscriptionIds.length
  }
}
