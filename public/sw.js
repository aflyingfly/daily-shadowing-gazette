// 每日英语新闻跟读 PWA Service Worker
// 应用外壳缓存优先（离线可打开），新闻/语音等网络请求直连网络
const CACHE = 'gazette-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // 只接管本站静态资源；新闻、翻译、语音等外部请求直接放行
  if (url.origin !== location.origin || event.request.method !== 'GET') return

  // 页面导航：网络优先，断网时回退缓存
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone()
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          return resp
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  // 静态资源（JS/CSS/图标）：缓存优先，后台更新
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return resp
        }),
    ),
  )
})
