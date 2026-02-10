const CACHE_NAME = 'lovers-secret-v2'
const ASSETS_TO_CACHE = ['./']

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')
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
