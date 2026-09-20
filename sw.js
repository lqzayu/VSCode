self.addEventListener('install', (event) => {	// 操作イベントを登録
  self.skipWaiting();	// 処理を完了する
});	// 処理を完了する

self.addEventListener('activate', (event) => {	// 操作イベントを登録
  event.waitUntil(clients.claim());	// 処理を完了する
});	// 処理を完了する

self.addEventListener('push', (event) => {	// 操作イベントを登録
  let data = {};	// 通知データの初期値を用意する
  try {	// JSON形式の通知を読み込む
    data = event.data ? event.data.json() : {};	// 通知データを取得する
  } catch (error) {	// JSON以外の通知を受け取った場合に処理する
    data = { body: event.data ? event.data.text() : "" };	// 文字列として通知本文を使う
  }	// 読み込み処理を閉じる
  const title = data.title || "新着メッセージ";	// 定数を定義
  const options = {	// 定数を定義
    body: data.body || "新しいメッセージが届きました",	// 処理を続ける
    icon: "icon-192.png",	// 端末内のアイコンを使う
    badge: "icon-192.png",	// 端末内のアイコンを使う
    data: { url: data.url || "messages.html" }	// 処理を完了する
  };	// 処理のまとまりを閉じる
  event.waitUntil(self.registration.showNotification(title, options));	// 処理を完了する
});	// 処理を完了する

self.addEventListener('notificationclick', (event) => {	// 操作イベントを登録
  event.notification.close();	// 処理を完了する
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : "messages.html";	// 移動先を安全に決める
  event.waitUntil(	// 処理を続ける
    clients.openWindow(targetUrl)	// 通知に対応する画面を開く
  );	// 処理を完了する
});	// 処理を完了する
