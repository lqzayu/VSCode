self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 💡 GAS（script.google.com）への通信は Service Worker で一切横取りせず直接実行させる
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('script.google.com')) {
    return; // respondWith を呼ばずにリターンすることで標準の直接通信になる
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      // キャッシュもない通信エラー時は代替レスポンスを返してクラッシュを防ぐ
      return new Response("Network error", { status: 404, statusText: "Network error" });
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