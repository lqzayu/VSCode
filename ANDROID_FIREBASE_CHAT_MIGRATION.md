# Android版 Firebaseチャット移行メモ

## 現在の状態

Web版とiOS版は、テキストチャットをFirebase Realtime Databaseへ保存し、画像付きメッセージは従来どおりGAS経由でDriveへ保存する構成に変更済みです。

Android版はGitHub PagesをWebViewで表示する構成だったため、同じWeb版コードがFirebaseチャットを実行します。Android側でチャット処理を二重実装せず、WebViewのJavaScript・DOM Storage・HTTPS通信を有効にした状態を維持します。詳細はAndroidプロジェクト内の`FIREBASE_CHAT_ANDROID.md`を確認してください。

## Firebaseプロジェクト

- projectId: `heiko-matching-chat`
- Realtime Database URL: `https://heiko-matching-chat-default-rtdb.asia-southeast1.firebasedatabase.app`
- Database location: `asia-southeast1`
- Web API key: 既存のWeb設定にあるキーを使用する

Androidでは、APIキーをパスワードのように扱う必要はありません。ただし、Realtime DatabaseのルールとGASの認証を必ず併用してください。

## 推奨ライブラリ

Android Studioの`app`モジュールへFirebase BoM、Authentication、Realtime Databaseを追加します。

```kotlin
implementation(platform("com.google.firebase:firebase-bom:<最新版>"))
implementation("com.google.firebase:firebase-auth")
implementation("com.google.firebase:firebase-database")
```

FirebaseコンソールからAndroidアプリを登録し、`google-services.json`を`app/`へ配置します。

## ログイン後のFirebase認証

1. 既存のGAS `login`で通常ログインする。
2. 返ってきたセッション情報を使って、GASへ`firebaseCustomToken`をリクエストする。
3. 返されたカスタムトークンを次の形でFirebase Authenticationへ渡す。

```kotlin
FirebaseAuth.getInstance().signInWithCustomToken(firebaseCustomToken)
```

Firebaseの`auth.currentUser.uid`は、GASが発行したトークンのユーザーIDと一致します。未認証のままRealtime Databaseへアクセスしないでください。

## Realtime Databaseの保存形式

ユーザーIDは、Web版・iOS版と同じく、UTF-8のBase64URLに変換して`u_`を付けます。末尾の`=`は削除します。

```text
uid(userId) = "u_" + base64url(UTF-8(userId))
```

テキストメッセージは次の3か所へ保存します。

```text
chats/{uidA}/{uidB}/{messageKey}
inbox/{uidA}/{messageKey}
inbox/{uidB}/{messageKey}
```

メッセージの主な項目は次のとおりです。

```json
{
  "messageId": "UUID",
  "from": "送信元ユーザーID",
  "to": "送信先ユーザーID",
  "fromUid": "u_...",
  "toUid": "u_...",
  "text": "本文",
  "sentAt": 1710000000000,
  "isRead": false,
  "isUnsent": false
}
```

## 実装する動作

- チャット画面を開いたら`chats/{uidA}/{uidB}`を読み込む。
- `ChildEventListener`または`ValueEventListener`で新着テキストを購読する。
- 送信時はFirebaseへ保存し、画面にはすぐ追加する。
- 受信時は`inbox/{自分のuid}`を読み込み、未読数を更新する。
- 開封時は相手から届いたメッセージの`isRead`を更新する。
- 送信取り消し時は`isUnsent: true`にして本文を「このメッセージは送信取り消しされました。」へ置き換える。
- チャット履歴を削除するときは、Firebaseの`hidden/{自分のuid}/{相手のuid}`へ時刻を保存し、その時刻より前のメッセージを一覧から隠す。

## 画像送信

画像はFirebaseへ移行せず、現在と同じGASの`sendMessage`を使用します。

- 画像だけ、または画像付きメッセージはGASへ送信する。
- Driveへ保存されたURLをチャット行へ保存する。
- 画像サイズ・枚数の上限はWeb版の入力制限に合わせる。
- Android側でFirebase Storageへ画像を送らない。

## GASフォールバック

Firebase送信が失敗した場合は、既存のGAS `sendMessage`へテキストを送り直します。これにより、Firebaseの一時障害や利用上限時も会話を継続できます。

ただし、同じ本文が二重保存されないよう、Firebase送信の成功後にGASの通常保存を実行しないでください。GASはLINE通知用の`notifyFirebaseMessage`だけを呼び出します。

## セキュリティ確認

- Realtime Databaseは未認証アクセスを拒否する現在のルールを使用する。
- `google-services.json`やGASのサービスアカウント秘密鍵をGitHubへ公開しない。
- Firebaseのテストモードへ戻さない。
- Firebaseの画面で直接データを書き換える運用はテスト時だけにする。

## 動作確認順

1. Androidで通常ログインする。
2. Firebase Authenticationにユーザーが表示されることを確認する。
3. 2台の端末または2ユーザーでテキストを送受信する。
4. 画面を開いたまま、相手からの新着が即時表示されることを確認する。
5. 未読数、既読、送信取り消し、履歴非表示を確認する。
6. 画像を送信し、GAS・Drive経由で表示できることを確認する。
7. Firebaseを一時的に利用できない状態にして、GASへフォールバックすることを確認する。
