self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "新着メッセージ";
  const options = {
    body: data.body || "新しいメッセージが届きました",
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: data.url || "messages.html" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : "messages.html";
  event.waitUntil(
    clients.openWindow(targetUrl)
  );
});
