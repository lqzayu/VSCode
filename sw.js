self.addEventListener('install', (event) => {	// 操作イベントを登録
  self.skipWaiting();	// 処理を完了する
});	// 処理を完了する

self.addEventListener('activate', (event) => {	// 操作イベントを登録
  event.waitUntil(clients.claim());	// 処理を完了する
});	// 処理を完了する

self.addEventListener('fetch', (event) => {	// 操作イベントを登録
  if (event.request.url.includes('script.google.com')) {	// 条件に応じて処理を分ける
    return;	// 結果を返す
  }	// 処理のまとまりを閉じる

  event.respondWith(	// 処理を続ける
    fetch(event.request).catch(async () => {	// APIへリクエストを送る
      const cachedResponse = await caches.match(event.request);	// 定数を定義
      if (cachedResponse) {	// 条件に応じて処理を分ける
        return cachedResponse;	// 結果を返す
      }	// 処理のまとまりを閉じる
      return new Response("Network error", { status: 404, statusText: "Network error" });	// 結果を返す
    })	// 処理のまとまりを閉じる
  );	// 処理を完了する
});	// 処理を完了する

self.addEventListener('push', (event) => {	// 操作イベントを登録
  const data = event.data ? event.data.json() : {};	// 定数を定義
  const title = data.title || "新着メッセージ";	// 定数を定義
  const options = {	// 定数を定義
    body: data.body || "新しいメッセージが届きました",	// 処理を続ける
    icon: "https://cdn-icons-png.flaticon.com/512/149/149071.png",	// 処理を続ける
    badge: "https://cdn-icons-png.flaticon.com/512/149/149071.png",	// 処理を続ける
    data: { url: data.url || "messages.html" }	// 処理を完了する
  };	// 処理のまとまりを閉じる
  event.waitUntil(self.registration.showNotification(title, options));	// 処理を完了する
});	// 処理を完了する

self.addEventListener('notificationclick', (event) => {	// 操作イベントを登録
  event.notification.close();	// 処理を完了する
  event.waitUntil(	// 処理を続ける
    clients.openWindow(event.notification.data.url)	// 処理を続ける
  );	// 処理を完了する
});	// 処理を完了する
