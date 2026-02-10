const CACHE_NAME = 'lovers-secret-v1'
const ASSETS_TO_CACHE = ['./']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return
  }

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
