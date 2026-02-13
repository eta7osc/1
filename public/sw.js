const CACHE_NAME = 'lovers-secret-v2'
const ASSETS_TO_CACHE = ['./']
const DEFAULT_NOTIFICATION_TITLE = "Lover's Secret"
const DEFAULT_NOTIFICATION_BODY = '你有一条新消息'
const DEFAULT_NOTIFICATION_TAG = 'lovers-secret-message'
const DEFAULT_NOTIFICATION_URL = './#/'
const DEFAULT_NOTIFICATION_ICON = './icons/icon-192.svg'

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')
}

function toAbsoluteUrl(url) {
  try {
    return new URL(url || DEFAULT_NOTIFICATION_URL, self.location.origin).toString()
  } catch {
    return new URL(DEFAULT_NOTIFICATION_URL, self.location.origin).toString()
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return
  }

  // HTML navigation should go network-first so new UI deploys are visible immediately.
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clonedResponse = response.clone()
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clonedResponse)
            })
          }
          return response
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./')))
    )
    return
  }

  // Static assets can remain cache-first for speed/offline.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached
      }

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          const clonedResponse = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse)
          })
          return response
        })
        .catch(() => caches.match('./'))
    })
  )
})

self.addEventListener('push', event => {
  let payload = {}

  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = { body: event.data.text() }
    }
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : DEFAULT_NOTIFICATION_TITLE
  const body = typeof payload.body === 'string' && payload.body.trim() ? payload.body.trim() : DEFAULT_NOTIFICATION_BODY
  const tag = typeof payload.tag === 'string' && payload.tag.trim() ? payload.tag.trim() : DEFAULT_NOTIFICATION_TAG
  const icon =
    typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : DEFAULT_NOTIFICATION_ICON
  const badge =
    typeof payload.badge === 'string' && payload.badge.trim() ? payload.badge.trim() : DEFAULT_NOTIFICATION_ICON
  const targetUrl = toAbsoluteUrl(typeof payload.url === 'string' ? payload.url : DEFAULT_NOTIFICATION_URL)

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon,
      badge,
      renotify: true,
      data: {
        url: targetUrl
      }
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const targetUrl = toAbsoluteUrl(event.notification?.data?.url)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }

      const activeClient = clientList.find(client => client.url.startsWith(self.location.origin))
      if (activeClient && 'focus' in activeClient) {
        return activeClient.focus().then(() => {
          if ('navigate' in activeClient) {
            return activeClient.navigate(targetUrl)
          }
          return undefined
        })
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
