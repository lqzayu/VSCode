self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 💡 GASへの通信はService Workerで干渉させずスルーさせる
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('script.google.com')) {
    return; // スルーして直接通信
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// 🔔 バックグラウンド通知の受信処理
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "新着メッセージ";
  const options = {
    body: data.body || "新しいメッセージが届きました",
    icon: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
    badge: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
    data: { url: data.url || "messages.html" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 🔔 通知タップ時にチャット画面を開く処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});