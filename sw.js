self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      return new Response("Network error", { status: 404, statusText: "Network error" });
    })
  );
});

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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
