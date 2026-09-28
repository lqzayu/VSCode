function doGet(e) {	// 関数を定義
  return createRes("success", "GAS API is working");	// 結果を返す
}	// 処理のまとまりを閉じる

const SITE_URL = "https://lqzayu.github.io/VSCode/";	// 定数を定義

const ADMIN_USER_ID = "admin";	// 定数を定義
const RECRUITMENT_DURATION_MINUTES = [15, 30, 45, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200, 1260, 1320, 1380, 1440];	// 定数を定義
const ONLINE_TIMEOUT_MS = 90 * 1000;	// 定数を定義
const AI_DAILY_LIMIT = 5;	// 定数を定義
const AI_SESSION_LIMIT = 2;	// 画面で相談完了となる二回目までに制限する
const USER_SESSION_DURATION_MS = 6 * 60 * 60 * 1000;	// 通常ログインの有効時間を六時間にする

const LINE_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("LINE_ACCESS_TOKEN") || "";	// 定数を定義
const GEMINI_MODEL = PropertiesService.getScriptProperties().getProperty("GEMINI_MODEL") || "gemini-3.5-flash-lite";	// 定数を定義
const USAGE_LOG_HEADERS = ["記録日時", "日付", "匿名ユーザーキー", "機能", "操作", "結果", "処理時間(ms)", "エラー内容"]; // 利用ログの見出しを定義する
const DAILY_ANALYSIS_HEADERS = ["日付", "ユニーク利用者数", "イベント数", "成功数", "失敗数", "ログイン関連数", "募集関連数", "チャット関連数", "AI相談数", "顔認証関連数", "LINE関連数", "通報・ブロック関連数", "エラー数", "平均処理時間(ms)", "処理時間合計(ms)", "処理時間件数", "最終更新", "利用者キーJSON"]; // 日別分析の見出しを定義する

function doPost(e) {	// 関数を定義
  try {	// 失敗に備えて処理を始める
    if (!e || !e.postData || !e.postData.contents) {	// 条件に応じて処理を分ける
      return createRes("success", "VERIFIED_OK");	// 結果を返す
    }	// 処理のまとまりを閉じる

    const rawData = e.postData.contents;	// 定数を定義
    let data;	// 状態を保持
    try {	// 失敗に備えて処理を始める
      data = JSON.parse(rawData);	// 処理を完了する
    } catch (parseError) {	// 処理のまとまりを始める
      return createRes("error", "JSONの形式が正しくありません");	// 結果を返す
    }	// 処理のまとまりを閉じる

    const ss = SpreadsheetApp.getActiveSpreadsheet();	// 定数を定義

    const sheetUser = ss.getSheetByName("シート1");	// 定数を定義
    const sheetRecruit = ss.getSheetByName("募集");	// 定数を定義
    const sheetChat = ss.getSheetByName("チャット");	// 定数を定義
    const sheetChatCopy = ss.getSheetByName("chat-copy");	// 定数を定義
    const sheetOnline = ss.getSheetByName("オンライン状況");	// 定数を定義
    const sheetHiddenChat = ss.getSheetByName("チャット非表示");	// 定数を定義
    const sheetBlock = ss.getSheetByName("ブロック");	// 定数を定義
    const sheetReport = ss.getSheetByName("通報");	// 定数を定義
    const sheetLineLink = ss.getSheetByName("LINE連携");	// LINE連携コードの保存先を取得する

    if (Array.isArray(data.events)) {	// 条件に応じて処理を分ける
      const lineData = data;	// 定数を定義

      if (lineData.events && lineData.events.length === 0) {	// 条件に応じて処理を分ける
        return createRes("success", "EMPTY_EVENT_OK");	// 結果を返す
      }	// 処理のまとまりを閉じる

      if (lineData.events && lineData.events.length > 0) {	// 条件に応じて処理を分ける
        const rows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];	// 定数を定義
        lineData.events.forEach(event => {	// 処理のまとまりを始める
          const lineUserId = event.source ? event.source.userId : "";	// 定数を定義
          const replyToken = event.replyToken;	// 定数を定義

          if (event.type === "message" && event.message && event.message.type === "text" && rows.length > 1) {	// 条件に応じて処理を分ける
            const inputText = event.message.text.trim().toUpperCase();	// 送られた連携コードを整える
            let matchedUserIndex = -1;	// 状態を保持
            let matchedUserName = "";	// 状態を保持
            let matchedLinkRow = -1;	// 使用した連携コードの行を保持する

            const linkRows = sheetLineLink && sheetLineLink.getLastRow() > 1 ? sheetLineLink.getDataRange().getValues() : [];	// 発行済みコードを取得する
            for (let i = linkRows.length - 1; i >= 1; i--) {	// 新しいコードから確認する
              const code = cleanCell(linkRows[i][1]).toUpperCase();	// 保存済みコードを取得する
              const expiresAt = new Date(linkRows[i][2]).getTime();	// 有効期限を取得する
              const used = cleanCell(linkRows[i][3]) !== "未使用";	// 使用済み・無効化済みのコードを除外する
              if (code !== inputText || used || !expiresAt || Date.now() > expiresAt) continue;	// 無効なコードは飛ばす
              const targetUserId = cleanCell(linkRows[i][0]);	// コードを発行したユーザーIDを取得する
              const targetIndex = rows.findIndex((row, index) => index > 0 && cleanCell(row[0]) === targetUserId);	// 対象ユーザーを探す
              if (targetIndex < 0) continue;	// ユーザーがいないコードは飛ばす
              matchedUserIndex = targetIndex + 1;	// ユーザーの行番号を保存する
              matchedUserName = getUserDisplayName(rows[targetIndex], targetUserId);	// 表示名を取得する
              matchedLinkRow = i + 1;	// コードの行番号を保存する
              break;	// 一致したコードが見つかったら終了する
            }	// 連携コードの確認を終える

            if (matchedUserIndex !== -1) {	// 条件に応じて処理を分ける
              sheetUser.getRange(matchedUserIndex, 12).setValue(lineUserId);	// 保存データを読み込む
              if (matchedLinkRow !== -1) sheetLineLink.getRange(matchedLinkRow, 4).setValue("使用済み");	// 連携コードを再利用できない状態にする
              const successMsg = `✅ 【平工マッチング】LINE連携完了\n\n${matchedUserName} さんのアカウントとLINEの連携が成功しました！\n今後はメッセージが届いた際に通知をお届けします。`;	// 定数を定義
              replyLineMessage(replyToken, successMsg);	// 処理を完了する
            } else {	// 処理のまとまりを始める
              const errorMsg = `⚠️ 有効な連携コードを確認できませんでした。\n\nマイページで新しいLINE連携コードを発行し、10分以内に送信してください。`;	// 定数を定義
              replyLineMessage(replyToken, errorMsg);	// 処理を完了する
            }	// 処理のまとまりを閉じる
          }	// 処理のまとまりを閉じる
        });	// 処理を完了する
      }	// 処理のまとまりを閉じる

      return createRes("success", "LINE_WEBHOOK_PROCESSED");	// 結果を返す
    }	// 処理のまとまりを閉じる

    const mode = data.mode;	// 定数を定義

    const publicModes = ["register", "verifyEmail", "resendVerificationCode", "login", "verify_face_1toN", "verify_face_for_user", "forgotPassword", "resetPassword"];	// ログイン前に使える処理を限定する
    const adminModes = ["adminGetOverview", "adminDeletePost", "adminBanUser", "getReports", "updateReportStatus", "getDailyAnalysis"];	// 管理者認証を個別に確認する処理をまとめる
    if (!publicModes.includes(mode) && !adminModes.includes(mode)) {	// 通常ユーザー向け処理を確認する
      const actorId = getRequestActorId(mode, data);	// 処理を行う本人のIDを取得する
      const adminProfileRequest = mode === "getUserProfile" && isAdminRequest(data);	// 管理者の代理ログイン用取得か確認する
      if (!adminProfileRequest && (!actorId || !isAuthenticatedUserRequest(data, actorId, sheetUser))) {	// 本人確認に失敗した場合に処理する
        return createRes("error", "ログインの有効期限が切れました。もう一度ログインしてください");	// 未認証の操作を拒否する
      }	// 本人確認を閉じる
    }	// 通常ユーザー認証を閉じる

    if (mode === "heartbeat") {	// 条件に応じて処理を分ける
      const userId = String(data.userId || "").trim();	// 定数を定義
      if (!userId || !userExists(sheetUser, userId)) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける

      const onlineSheet = sheetOnline || getOrCreateSheet(ss, "オンライン状況", ["UserID", "最終アクセス"]);	// 定数を定義
      touchOnlineUser(onlineSheet, userId);	// 処理を完了する
      return createRes("success", "HEARTBEAT_OK");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "registerAndroidDevice") {	// Android端末の通知先を登録する
      const userId = cleanCell(data.userId);	// ログイン中のユーザーIDを取得する
      const fcmToken = cleanCell(data.fcmToken).slice(0, 4096);	// FCMトークンを安全な長さに収める
      const platform = cleanCell(data.platform).slice(0, 32) || "android";	// 端末種別を保存する
      if (!userId || !userExists(sheetUser, userId)) return createRes("error", "ユーザーが見つかりません");	// ユーザーの存在を確認する
      if (!fcmToken || fcmToken.length < 20) return createRes("error", "通知設定を確認できませんでした");	// 空のトークンを拒否する

      const deviceSheet = getOrCreateSheet(ss, "Android通知", ["UserID", "FCMトークン", "プラットフォーム", "更新日時", "状態"]);	// Android通知用シートを用意する
      upsertAndroidDeviceToken(deviceSheet, userId, fcmToken, platform);	// 同じ端末は更新し、複数端末は保持する
      return createRes("success", "ANDROID_DEVICE_REGISTERED");	// 登録結果を返す
    }	// Android端末登録を閉じる

    if (mode === "unregisterAndroidDevice") {	// Android端末の通知先を解除する
      const userId = cleanCell(data.userId);	// ログイン中のユーザーIDを取得する
      const fcmToken = cleanCell(data.fcmToken).slice(0, 4096);	// FCMトークンを取得する
      if (!userId || !fcmToken) return createRes("error", "通知設定を確認できませんでした");	// 不正な解除情報を拒否する
      const deviceSheet = ss.getSheetByName("Android通知");	// Android通知用シートを取得する
      if (deviceSheet && deviceSheet.getLastRow() > 1) revokeAndroidDeviceToken(deviceSheet, userId, fcmToken);	// 対象端末だけを無効化する
      return createRes("success", "ANDROID_DEVICE_UNREGISTERED");	// 解除結果を返す
    }	// Android端末解除を閉じる

    if (mode === "recordUsageLog") {	// 利用ログを保存する
      const saved = saveUsageLog(ss, data);	// 利用ログと日別集計を更新する
      return createRes("success", saved);	// 保存結果を返す
    }	// 利用ログ保存を閉じる

    if (mode === "getDailyAnalysis") {	// 管理者向けの日別分析を返す
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");	// 管理者以外を拒否する
      return createRes("success", getDailyAnalysisRows(ss, data.days));	// 日別分析を返す
    }	// 日別分析取得を閉じる

    if (mode === "createLineLinkCode") {	// LINE連携用の一時コードを発行する
      const userId = cleanCell(data.userId);	// ログイン中のユーザーIDを取得する
      if (!userExists(sheetUser, userId)) return createRes("error", "ユーザーが見つかりません");	// ユーザーの存在を確認する
      if (!claimCooldown("line-link-code-" + userId, 20)) return createRes("error", "連携コードは20秒後に再発行できます");	// 短時間の連続発行を防ぐ
      const linkSheet = sheetLineLink || getOrCreateSheet(ss, "LINE連携", ["UserID", "連携コード", "有効期限", "状態"]);	// 連携コード用シートを用意する
      const code = generateLineLinkCode(linkSheet);	// 重複しない連携コードを作る
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);	// 十分後の有効期限を作る
      if (linkSheet.getLastRow() > 1) {	// 過去の未使用コードがある場合に処理する
        const linkRows = linkSheet.getRange(2, 1, linkSheet.getLastRow() - 1, 4).getValues();	// 既存の連携コードを読み込む
        const staleRanges = [];	// 無効化するセルをまとめる
        for (let i = 0; i < linkRows.length; i++) {	// 既存コードを順番に確認する
          if (cleanCell(linkRows[i][0]) === userId && cleanCell(linkRows[i][3]) === "未使用") staleRanges.push(`D${i + 2}`);	// 同じユーザーの古いコードを対象にする
        }	// 既存コードの確認を閉じる
        if (staleRanges.length > 0) linkSheet.getRangeList(staleRanges).setValue("無効");	// 古い未使用コードを無効にする
      }	// 過去コードの処理を閉じる
      linkSheet.appendRow([userId, code, expiresAt, "未使用"]);	// 連携コードを保存する
      return createRes("success", { code: code, expiresAt: expiresAt.getTime() });	// コードと期限を返す
    }	// LINE連携コード発行を閉じる

    if (mode === "unlinkLineAccount") {	// LINE連携を解除する
      const userId = cleanCell(data.userId);	// 解除対象のユーザーIDを取得する
      if (!userExists(sheetUser, userId)) return createRes("error", "ユーザーが見つかりません");	// ユーザーの存在を確認する
      const userRows = sheetUser.getDataRange().getValues();	// ユーザー情報を読み込む
      const userRowIndex = userRows.findIndex((row, index) => index > 0 && cleanCell(row[0]) === userId);	// 対象ユーザーの行を探す
      if (userRowIndex < 1) return createRes("error", "ユーザーが見つかりません");	// 対象がない場合は処理を終了する
      sheetUser.getRange(userRowIndex + 1, 12).setValue("");	// ユーザーシートのLINE UserIDを解除する
      if (sheetLineLink && sheetLineLink.getLastRow() > 1) {	// 連携コードシートがある場合に処理する
        const linkRows = sheetLineLink.getRange(2, 1, sheetLineLink.getLastRow() - 1, 4).getValues();	// 連携コードの履歴を読み込む
        const staleRanges = [];	// 無効化対象のセルを保持する
        for (let i = 0; i < linkRows.length; i++) {	// 連携コードを順番に確認する
          if (cleanCell(linkRows[i][0]) === userId && cleanCell(linkRows[i][3]) === "未使用") staleRanges.push(`D${i + 2}`);	// 未使用のコードだけを無効化対象にする
        }	// 連携コードの確認を閉じる
        if (staleRanges.length > 0) sheetLineLink.getRangeList(staleRanges).setValue("無効");	// 解除後に未使用コードを使えなくする
      }	// 連携コードの処理を閉じる
      return createRes("success", "LINE_UNLINKED");	// 解除結果を返す
    }	// LINE連携解除を閉じる

    if (mode === "getUserProfile") {	// 条件に応じて処理を分ける
      const identifiers = [data.userId, data.email].map(value => String(value || "").trim()).filter(Boolean);	// 定数を定義
      if (identifiers.length === 0 || !sheetUser || sheetUser.getLastRow() <= 1) {	// 条件に応じて処理を分ける
        return createRes("error", "ユーザーが見つかりません");	// 結果を返す
      }	// 処理のまとまりを閉じる

      const rows = sheetUser.getDataRange().getValues();	// 定数を定義
      let userRow = null;	// 状態を保持
      for (const identifier of identifiers) {	// 対象を順番に処理する
        userRow = findUserRow(rows, identifier);	// 処理を完了する
        if (userRow) break;	// 条件に応じて処理を分ける
      }	// 処理のまとまりを閉じる
      if (!userRow) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける

      const profileResult = {	// 返却するプロフィールをまとめる
        userId: cleanCell(userRow[0]),	// 処理を続ける
        email: cleanCell(userRow[5]) || cleanCell(userRow[0]),	// 処理を続ける
        name: cleanCell(userRow[2]),	// 処理を続ける
        profileImage: cleanCell(userRow[4]),	// 処理を続ける
        lineLinked: Boolean(cleanCell(userRow[11]))	// LINE UserIDが保存されているかを返す
      };	// プロフィール情報を閉じる
      if (isAdminRequest(data)) profileResult.sessionToken = createUserSessionToken(cleanCell(userRow[0]), cleanCell(userRow[12]));	// 代理ログイン用の本人トークンを発行する
      return createRes("success", profileResult);	// プロフィールを返す
    }	// 処理のまとまりを閉じる

    if (mode === "aiStudyChat") {	// 条件に応じて処理を分ける
      const userId = cleanCell(data.userId);	// 定数を定義
      const message = cleanCell(data.message);	// 定数を定義
      const requestId = cleanCell(data.requestId).slice(0, 100);	// 定数を定義
      if (!userId || !userExists(sheetUser, userId)) return createRes("error", "ログイン情報を確認できませんでした");	// 条件に応じて処理を分ける
      if (!message || message.length > 1500) return createRes("error", "相談内容は1500文字以内で入力してください");	// 条件に応じて処理を分ける
      if (!requestId) return createRes("error", "送信情報を確認できませんでした。ページを再読み込みしてください");	// 条件に応じて処理を分ける

      const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");	// 定数を定義
      if (!apiKey) return createRes("error", "AI機能の設定がまだ完了していません。管理者にAPIキーの設定を確認してください");	// 条件に応じて処理を分ける

      const aiSheet = getOrCreateSheet(ss, "AIログ", [	// 定数を定義
        "記録日時", "ResponseID", "UserID", "セッションID", "教科", "目標", "困っていること",	// 処理を続ける
        "勉強可能時間", "好み", "相談内容", "AI回答", "評価", "評価コメント", "推薦タイプ", "モデル", "段階", "RequestID"	// 処理を続ける
      ]);	// 処理を完了する
      if (!aiSheet.getRange(1, 16).getValue()) aiSheet.getRange(1, 16).setValue("段階");	// 保存データを読み込む
      if (!aiSheet.getRange(1, 17).getValue()) aiSheet.getRange(1, 17).setValue("RequestID");	// 保存データを読み込む

      const savedRequest = findAiRequest(aiSheet, userId, requestId);	// 定数を定義
      if (savedRequest) return createRes("success", savedRequest);	// 条件に応じて処理を分ける

      const cache = CacheService.getScriptCache();	// 定数を定義
      const requestKey = "ai-request-" + userId.slice(0, 64) + "-" + requestId;	// ユーザーごとに再送判定を分ける
      const requestState = cache.get(requestKey);	// 定数を定義
      if (requestState) {	// 条件に応じて処理を分ける
        try {	// 失敗に備えて処理を始める
          const state = JSON.parse(requestState);	// 定数を定義
          if (state.state === "done" && state.message) return createRes("success", state.message);	// 条件に応じて処理を分ける
          if (state.state === "processing") return createRes("success", { pending: true });	// 条件に応じて処理を分ける
        } catch (e) {	// 処理のまとまりを始める
          cache.remove(requestKey);	// 処理を完了する
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      const rateKey = "ai-study-" + userId;	// 定数を定義
      if (cache.get(rateKey)) return createRes("error", "短時間に続けて送信できません。少し待ってから送信してください");	// 条件に応じて処理を分ける
      const sessionId = cleanCell(data.sessionId).slice(0, 100);	// 定数を定義
      const inFlightKey = "ai-user-inflight-" + userId.slice(0, 64);	// 同一ユーザーの同時相談を防ぐ保存名を作る
      const aiLock = LockService.getScriptLock();	// 利用回数の確認をまとめて保護する
      if (!aiLock.tryLock(5000)) return createRes("error", "AI相談が混み合っています。少し待ってからお試しください");	// ロックを取得できない場合は再試行を案内する
      let sessionUsage;	// 今回の相談段階を保持する
      try {	// 利用回数と処理中状態を確認する
        if (cache.get(inFlightKey)) {	// 同じユーザーの相談が処理中の場合
          if (cache.get(inFlightKey) === requestId) return createRes("success", { pending: true });	// 同じ送信なら処理待ちを返す
          return createRes("error", "前のAI相談を処理中です。回答が表示されるまでお待ちください");	// 別送信は待ってもらう
        }	// 処理中確認を閉じる
        const dailyUsage = getAiDailyUsage(aiSheet, userId);	// 今日の使用回数を確認する
        if (dailyUsage >= AI_DAILY_LIMIT) return createRes("error", "本日のAI相談回数の上限に達しました。明日また利用できます");	// 一日上限を守る
        sessionUsage = getAiSessionUsage(aiSheet, userId, sessionId);	// 今回の相談回数を確認する
        if (sessionUsage === 0 && dailyUsage > AI_DAILY_LIMIT - 2) return createRes("error", "本日の残り回数ではおすすめまで完了できないため、明日また利用してください");	// 提案までの残り回数を確保する
        if (sessionUsage >= AI_SESSION_LIMIT) return createRes("error", "この相談は完了しています。新しい相談を始める場合は、明日また利用してください");	// 相談ごとの上限を守る
        cache.put(inFlightKey, requestId, 120);	// 回答を保存するまで同じユーザーの別送信を止める
        cache.put(requestKey, JSON.stringify({ state: "processing" }), 120);	// 同じ送信の再試行には待機状態を返す
        cache.put(rateKey, "1", 4);	// 短時間の連続送信を抑える
      } finally {	// 回数確認の終了時に処理する
        if (aiLock.hasLock()) aiLock.releaseLock();	// 共通ロックを解放する
      }	// 利用回数と処理中状態の確認を閉じる

      try {	// AI回答の取得と保存を行う
        const profile = normalizeAiStudyProfile(data.profile);	// 相談者の情報を整える
        const feedbackProfile = getAiFeedbackProfile(aiSheet, userId);	// 過去の評価傾向を読み込む
        const analysis = buildStudyRecommendationProfile(profile, message, feedbackProfile);	// 評価傾向を含めて推薦方法を決める
        const history = normalizeAiHistory(data.history);	// 直近の会話を整える
        const stage = sessionUsage + 1;	// 今回の相談段階を求める
        const answer = callGeminiStudyAdvisor(apiKey, profile, analysis, history, message, stage, feedbackProfile);	// 評価傾向をAIの回答に反映する
        if (!answer) return createRes("error", "AIから回答を受け取れませんでした。しばらくしてから再度お試しください");	// 回答がなければ再試行を案内する
        const responseId = Utilities.getUuid();	// 回答を識別するIDを作る
        aiSheet.appendRow([	// AI相談をログへ保存する
          new Date(), responseId, userId, sessionId, safeSheetText(profile.subject, 50),	// 数式にならない教科情報を保存する
          safeSheetText(profile.goal, 300), safeSheetText(profile.challenge, 300), safeSheetText(profile.minutes, 30), safeSheetText(profile.preference, 100), safeSheetText(message, 2000),	// 相談情報を文字列として保存する
          safeSheetText(answer, 20000), "", "", safeSheetText(analysis.label, 100), safeSheetText(GEMINI_MODEL, 100), stage, requestId	// AI回答と分析情報を安全に保存する
        ]);	// AIログの保存を閉じる
        const responseMessage = {	// 画面へ返す回答をまとめる
          responseId: responseId,	// 回答IDを返す
          reply: answer,	// 回答本文を返す
          analysis: analysis,	// おすすめの分析を返す
          stage: stage,	// 相談段階を返す
          completed: stage >= 2,	// 相談が完了したか返す
          dailyRemaining: Math.max(0, AI_DAILY_LIMIT - getAiDailyUsage(aiSheet, userId))	// 今日の残り回数を返す
        };	// 回答データを閉じる
        cache.put(requestKey, JSON.stringify({ state: "done", message: responseMessage }), 120);	// 再送時に同じ回答を返せるよう保存する
        return createRes("success", responseMessage);	// 回答を返す
      } catch (aiError) {	// AI回答の取得か保存に失敗した場合に処理する
        console.error("AI相談の処理に失敗しました", aiError);	// 診断用の記録を残す
        return createRes("error", "AI相談の保存に失敗しました。少し待ってからもう一度お試しください");	// ユーザーに再試行を案内する
      } finally {	// 回答処理を終了する
        cache.remove(inFlightKey);	// 同じユーザーの次の相談を許可する
        if (cache.get(requestKey)) {	// 再送判定の保存状態を確認する
          try { if (JSON.parse(cache.get(requestKey)).state === "processing") cache.remove(requestKey); } catch (cacheError) { cache.remove(requestKey); }	// 未完了状態だけを消す
        }	// 再送判定の確認を閉じる
      }	// 回答処理を閉じる
    }	// 処理のまとまりを閉じる

    if (mode === "aiStudyFeedback") {	// 条件に応じて処理を分ける
      const userId = cleanCell(data.userId);	// 定数を定義
      const responseId = cleanCell(data.responseId);	// 定数を定義
      const rating = data.rating === "helpful" ? "helpful" : data.rating === "not_helpful" ? "not_helpful" : "";	// 定数を定義
      if (!userId || !responseId || !rating) return createRes("error", "評価内容が正しくありません");	// 条件に応じて処理を分ける
      const reasonLabels = {	// 評価理由の表示名を定義する
        helpful: "役に立った",	// 良い評価の表示名
        too_difficult: "難しすぎる",	// 難易度が高い評価の表示名
        too_easy: "簡単すぎる",	// 難易度が低い評価の表示名
        not_matched: "自分の状況に合わない",	// 状況に合わない評価の表示名
        another_method: "別の方法を試したい"	// 別案を求める評価の表示名
      };	// 評価理由の定義を閉じる
      const reason = rating === "helpful" ? "helpful" : cleanCell(data.reason);	// 送られた理由を取得する
      if (!reasonLabels[reason]) return createRes("error", "評価理由を選択してください");	// 未知の理由を拒否する

      const aiSheet = ss.getSheetByName("AIログ");	// 定数を定義
      if (!aiSheet || aiSheet.getLastRow() <= 1) return createRes("error", "評価対象が見つかりません");	// 条件に応じて処理を分ける
      const rows = aiSheet.getDataRange().getValues();	// 定数を定義
      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (cleanCell(rows[i][1]) === responseId && cleanCell(rows[i][2]) === userId) {	// 条件に応じて処理を分ける
          aiSheet.getRange(i + 1, 12).setValue(rating);	// 保存データを読み込む
          aiSheet.getRange(i + 1, 13).setValue(safeSheetText(reasonLabels[reason], 100));	// 選ばれた理由を文字列として保存する
          CacheService.getScriptCache().remove("ai-feedback-" + userId.slice(0, 100));	// 評価傾向のキャッシュを更新する
          return createRes("success", "FEEDBACK_SAVED");	// 結果を返す
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      return createRes("error", "評価対象が見つかりません");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "adminGetOverview") {	// 条件に応じて処理を分ける
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");	// 条件に応じて処理を分ける

      const userRows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];	// 定数を定義
      let users = [];	// 状態を保持
      for (let i = 1; i < userRows.length; i++) {	// 対象を順番に処理する
        users.push({	// 処理のまとまりを始める
          userId: userRows[i][0],	// 処理を続ける
          name: userRows[i][2] || "未設定",	// 処理を続ける
          email: userRows[i][5] || "",	// 処理を続ける
          isVerified: userRows[i][6] === true	// 処理を続ける
        });	// 処理を完了する
      }	// 処理のまとまりを閉じる

      const recruitRows = sheetRecruit && sheetRecruit.getLastRow() > 1 ? sheetRecruit.getDataRange().getValues() : [];	// 定数を定義
      let posts = [];	// 状態を保持
      for (let j = 1; j < recruitRows.length; j++) {	// 対象を順番に処理する
        posts.push({	// 処理のまとまりを始める
          rowIndex: j + 1,	// 処理を続ける
          name: recruitRows[j][0],	// 処理を続ける
          grade: recruitRows[j][1],	// 処理を続ける
          dept: recruitRows[j][2],	// 処理を続ける
          content: recruitRows[j][3],	// 処理を続ける
          time: recruitRows[j][4],	// 処理を続ける
          email: recruitRows[j][5],	// 処理を続ける
          tags: recruitRows[j][6] || ""	// 処理を続ける
        });	// 処理を完了する
      }	// 処理のまとまりを閉じる

      const onlineUserIds = getOnlineUserIds(sheetOnline).filter(userId => userId !== ADMIN_USER_ID);	// 定数を定義

      return createRes("success", {	// 結果を返す
        users: users,	// 処理を続ける
        posts: posts,	// 処理を続ける
        onlineCount: onlineUserIds.length	// 処理を続ける
      });	// 処理を完了する
    }	// 処理のまとまりを閉じる

    if (mode === "adminDeletePost") {	// 条件に応じて処理を分ける
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");	// 条件に応じて処理を分ける
      if (!sheetRecruit) return createRes("error", "シートが見つかりません");	// 条件に応じて処理を分ける

      const targetEmail = data.targetEmail;	// 定数を定義
      const recruitRows = sheetRecruit.getDataRange().getValues();	// 定数を定義
      for (let k = recruitRows.length - 1; k >= 1; k--) {	// 対象を順番に処理する
        if (recruitRows[k][5] === targetEmail) {	// 条件に応じて処理を分ける
          sheetRecruit.deleteRow(k + 1);	// 保存データを更新する
          return createRes("success", "POST_DELETED");	// 結果を返す
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      return createRes("error", "対象の投稿が見つかりませんでした");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "adminBanUser") {	// 条件に応じて処理を分ける
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");	// 条件に応じて処理を分ける
      if (!sheetUser) return createRes("error", "シートが見つかりません");	// 条件に応じて処理を分ける

      const targetUserId = data.targetUserId;	// 定数を定義
      if (cleanCell(targetUserId) === ADMIN_USER_ID) return createRes("error", "管理者アカウントは凍結できません");	// 管理者自身の凍結を拒否する
      const userRows = sheetUser.getDataRange().getValues();	// 定数を定義
      let targetEmail = "";	// 状態を保持
      let newStatus = false;	// 状態を保持
      let targetFound = false;	// 対象ユーザーが見つかったか保持する

      for (let u = userRows.length - 1; u >= 1; u--) {	// 対象を順番に処理する
        if (userRows[u][0] === targetUserId) {	// 条件に応じて処理を分ける
          targetEmail = userRows[u][5];	// 処理を続ける
          targetFound = true;	// 対象ユーザーが見つかった状態にする
          const currentStatus = userRows[u][6] === true;	// 定数を定義
          newStatus = !currentStatus;	// 処理を続ける

          ensureUserSessionColumn(sheetUser);	// ログイン世代の保存先を用意する
          sheetUser.getRange(u + 1, 7).setValue(newStatus);	// 利用状態を更新する
          sheetUser.getRange(u + 1, 13).setValue(Utilities.getUuid());	// 凍結・解除前のログインを無効にする
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      if (!targetFound) return createRes("error", "対象ユーザーが見つかりません");	// 存在しないユーザーの処理完了を防ぐ
      const revokedKey = "revoked-user-" + cleanCell(targetUserId);	// ログイン停止用の保存名を作る
      if (newStatus) CacheService.getScriptCache().remove(revokedKey);	// BAN解除時はログイン停止を解除する
      else CacheService.getScriptCache().put(revokedKey, "1", Math.floor(USER_SESSION_DURATION_MS / 1000));	// BAN時は既存ログインを無効化する

      if (!newStatus && targetEmail && sheetRecruit && sheetRecruit.getLastRow() > 1) {	// 条件に応じて処理を分ける
        const recruitRows = sheetRecruit.getDataRange().getValues();	// 定数を定義
        for (let r = recruitRows.length - 1; r >= 1; r--) {	// 対象を順番に処理する
          if (recruitRows[r][5] === targetEmail) {	// 条件に応じて処理を分ける
            sheetRecruit.deleteRow(r + 1);	// 保存データを更新する
          }	// 処理のまとまりを閉じる
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      return createRes("success", newStatus ? "USER_UNBANNED" : "USER_BANNED");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "register") {	// 条件に応じて処理を分ける
      if (!sheetUser) return createRes("error", "シートが存在しません");	// 条件に応じて処理を分ける
      if (!data.userId || !data.email || !data.password) {	// 条件に応じて処理を分ける
        return createRes("error", "必要な項目が入力されていません");	// 結果を返す
      }	// 処理のまとまりを閉じる
      const registerUserId = cleanCell(data.userId);	// 登録するユーザーIDを整える
      const registerEmail = cleanCell(data.email).toLowerCase();	// 登録メールアドレスを整える
      if (!isSafeIdentifier(registerUserId)) return createRes("error", "ユーザーIDに使用できない文字が含まれています");	// 危険な識別子を拒否する
      if (registerUserId.toLowerCase() === ADMIN_USER_ID) return createRes("error", "このユーザーIDは使用できません");	// 管理者IDの新規登録を防ぐ
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail)) return createRes("error", "メールアドレスの形式を確認してください");	// メール形式を確認する
      const passwordError = validatePasswordPolicy(data.password);	// 定数を定義
      if (passwordError) return createRes("error", passwordError);	// 条件に応じて処理を分ける
      if (String(data.userId).length > 64 || String(data.email).length > 254 || String(data.name || "").length > 50) {	// 条件に応じて処理を分ける
        return createRes("error", "ユーザー情報の文字数が上限を超えています");	// 結果を返す
      }	// 処理のまとまりを閉じる
      if (data.faceFeatures && !isValidFaceFeatures(data.faceFeatures)) {	// 条件に応じて処理を分ける
        return createRes("error", "顔情報の形式が正しくないか、データが大きすぎます");	// 結果を返す
      }	// 処理のまとまりを閉じる
      if (!claimCooldown("register-mail-" + registerUserId, 60)) return createRes("error", "認証メールは1分後に再送できます");	// 認証メールの連続送信を防ぐ

      const rows = sheetUser.getLastRow() > 0 ? sheetUser.getDataRange().getValues() : [];	// 定数を定義
      let existingRowIndex = -1;	// 状態を保持
      for (let i = 0; i < rows.length; i++) {	// 対象を順番に処理する
        if (cleanCell(rows[i][0]) === registerUserId) {	// 同じユーザーIDを確認する
          existingRowIndex = i + 1;	// 処理を続ける
        }	// 処理のまとまりを閉じる
        if (i > 0 && cleanCell(rows[i][5]).toLowerCase() === registerEmail && cleanCell(rows[i][0]) !== registerUserId) return createRes("error", "このメールアドレスは既に使用されています");	// 別ユーザーによるメールアドレスの重複を拒否する
      }	// 処理のまとまりを閉じる

      if (existingRowIndex !== -1 && rows[existingRowIndex - 1][6] === true) {	// 条件に応じて処理を分ける
        return createRes("error", "このユーザーIDは既に登録されています");	// 結果を返す
      }	// 処理のまとまりを閉じる
      if (existingRowIndex !== -1 && cleanCell(rows[existingRowIndex - 1][5]).toLowerCase() !== registerEmail) return createRes("error", "このユーザーIDは既に仮登録されています");	// 他人の仮登録を上書きさせない

      const code = generateVerificationCode();	// 定数を定義
      const expiry = new Date().getTime() + (10 * 60 * 1000);	// 定数を定義

      const rowData = [	// 定数を定義
        registerUserId,	// 整えたユーザーIDを保存する
        hashPassword(data.password),	// 処理を続ける
        safeSheetText(data.name || "ユーザー", 50),	// 数式として実行されない表示名を保存する
        data.faceFeatures || "",	// 処理を続ける
        "",	// 処理を続ける
        registerEmail,	// 整えたメールアドレスを保存する
        false,	// 処理を続ける
        code,	// 処理を続ける
        expiry,	// 処理を続ける
        "",	// 処理を続ける
        "",	// 処理を続ける
        "",	// LINE連携欄を空で用意する
        Utilities.getUuid()	// 新しいアカウントのログイン世代を作る
      ];	// 処理を続ける

      const registerLock = LockService.getScriptLock();	// 同時登録による重複を防ぐ
      if (!registerLock.tryLock(5000)) return createRes("error", "登録処理が混み合っています。少し待ってからもう一度お試しください");	// ロックを取得できない場合は再試行を案内する
      try {	// 登録データを安全に書き込む
        ensureUserSessionColumn(sheetUser);	// ログイン世代の保存先を用意する
        const latestRows = sheetUser.getLastRow() > 0 ? sheetUser.getDataRange().getValues() : [];	// 最新の登録状況を読み直す
        let latestExistingRowIndex = -1;	// 同じユーザーIDの行番号を保持する
        for (let i = 1; i < latestRows.length; i++) {	// 最新データから重複を確認する
          const savedUserId = cleanCell(latestRows[i][0]);	// 保存済みユーザーIDを取得する
          const savedEmail = cleanCell(latestRows[i][5]).toLowerCase();	// 保存済みメールアドレスを取得する
          if (savedEmail && savedEmail === registerEmail.toLowerCase() && savedUserId !== registerUserId) {	// 別アカウントで同じメールが使われているか確認する
            return createRes("error", "このメールアドレスは既に登録されています");	// メールアドレスの重複を拒否する
          }	// メール確認を閉じる
          if (savedUserId === registerUserId) latestExistingRowIndex = i + 1;	// 同じユーザーIDの行を記録する
        }	// 重複確認を閉じる
        if (latestExistingRowIndex !== -1 && latestRows[latestExistingRowIndex - 1][6] === true) {	// 認証済みユーザーの上書きを防ぐ
          return createRes("error", "このユーザーIDは既に登録されています");	// 登録済みとして返す
        }	// 認証済み確認を閉じる
        if (latestExistingRowIndex !== -1 && cleanCell(latestRows[latestExistingRowIndex - 1][5]).toLowerCase() !== registerEmail) return createRes("error", "このユーザーIDは既に仮登録されています");	// 同時登録中の仮登録上書きを防ぐ
        if (latestExistingRowIndex !== -1) {	// 未認証の仮登録がある場合
          sheetUser.getRange(latestExistingRowIndex, 1, 1, rowData.length).setValues([rowData]);	// 仮登録を更新する
        } else {	// 新規ユーザーの場合
          sheetUser.appendRow(rowData);	// 新しい行を追加する
        }	// 登録方法の分岐を閉じる
      } finally {	// 登録処理の終了時に必ず実行する
        if (registerLock.hasLock()) registerLock.releaseLock();	// 登録ロックを解放する
      }	// 登録データの書き込みを閉じる

      MailApp.sendEmail({	// 外部サービスを扱う
        to: registerEmail,	// 整えたメールアドレスへ送信する
        name: "平工マッチング",	// 処理を続ける
        subject: "【平工マッチング】認証コードのご案内",	// 処理を続ける
        body: `平工マッチングにご登録いただきありがとうございます。\n\n以下の認証コードを、登録画面に入力してください。\n\n認証コード: ${code}\n\n（10分間有効です）`	// 処理を続ける
      });	// 処理を完了する

      return createRes("success", "CODE_SENT");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "verifyEmail") {	// 条件に応じて処理を分ける
      const userId = data.userId;	// 定数を定義
      const code = data.code;	// 定数を定義
      const verifyAttemptKey = "verify-attempt-" + cleanCell(userId);	// 認証失敗回数の保存名を作る
      const verifyAttempts = Number(CacheService.getScriptCache().get(verifyAttemptKey) || 0);	// 現在の失敗回数を取得する
      if (verifyAttempts >= 5) return createRes("error", "認証コードの入力回数が上限に達しました。10分後にもう一度お試しください");	// 総当たりを防ぐ

      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける
      const rows = sheetUser.getDataRange().getValues();	// 定数を定義

      let userRowIndex = -1;	// 状態を保持
      for (let i = 0; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === userId) {	// 条件に応じて処理を分ける
          userRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      if (userRowIndex === -1) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける

      const row = rows[userRowIndex - 1];	// 定数を定義

      if (row[6] === true) {	// 条件に応じて処理を分ける
        return createRes("success", "ALREADY_VERIFIED");	// 結果を返す
      }	// 処理のまとまりを閉じる

      const savedCode = row[7];	// 定数を定義
      const savedExpiry = row[8];	// 定数を定義

      if (!savedCode || savedCode.toString() !== code.toString()) {	// 条件に応じて処理を分ける
        CacheService.getScriptCache().put(verifyAttemptKey, String(verifyAttempts + 1), 600);	// 認証失敗回数を10分間保存する
        return createRes("error", "認証コードが間違っています");	// 結果を返す
      }	// 処理のまとまりを閉じる
      if (!savedExpiry || new Date().getTime() > savedExpiry) {	// 条件に応じて処理を分ける
        return createRes("error", "認証コードの有効期限が切れています。");	// 結果を返す
      }	// 処理のまとまりを閉じる

      sheetUser.getRange(userRowIndex, 7).setValue(true);	// 保存データを読み込む
      sheetUser.getRange(userRowIndex, 8).setValue("");	// 保存データを読み込む
      sheetUser.getRange(userRowIndex, 9).setValue("");	// 保存データを読み込む
      CacheService.getScriptCache().remove(verifyAttemptKey);	// 認証失敗回数を削除する

      return createRes("success", "VERIFIED");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "resendVerificationCode") {	// 条件に応じて処理を分ける
      const userId = data.userId;	// 定数を定義
      if (!claimCooldown("resend-code-" + cleanCell(userId), 60)) return createRes("error", "認証コードは1分後に再送できます");	// メールの連続送信を防ぐ
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける
      const rows = sheetUser.getDataRange().getValues();	// 定数を定義

      let userRowIndex = -1;	// 状態を保持
      for (let i = 0; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === userId) {	// 条件に応じて処理を分ける
          userRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      if (userRowIndex === -1) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける

      const row = rows[userRowIndex - 1];	// 定数を定義

      if (row[6] === true) return createRes("success", "ALREADY_VERIFIED");	// 条件に応じて処理を分ける

      const email = row[5];	// 定数を定義
      const code = generateVerificationCode();	// 定数を定義
      const expiry = new Date().getTime() + (10 * 60 * 1000);	// 定数を定義

      sheetUser.getRange(userRowIndex, 8).setValue(code);	// 保存データを読み込む
      sheetUser.getRange(userRowIndex, 9).setValue(expiry);	// 保存データを読み込む

      MailApp.sendEmail({	// 外部サービスを扱う
        to: email,	// 処理を続ける
        name: "平工マッチング",	// 処理を続ける
        subject: "【平工マッチング】認証コードの再送",	// 処理を続ける
        body: `認証コードを再送します。\n\n認証コード: ${code}`	// 処理を続ける
      });	// 処理を完了する

      return createRes("success", "CODE_RESENT");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "login") {	// 条件に応じて処理を分ける
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける
      const loginUserId = cleanCell(data.email).slice(0, 64);	// 入力されたユーザーIDを整える
      const loginAttemptKey = "login-attempt-" + loginUserId;	// ログイン失敗回数の保存名を作る
      const loginAttempts = getAttemptCount(loginAttemptKey);	// 現在の失敗回数を取得する
      if (loginAttempts >= 10) return createRes("error", "ログイン試行回数が上限に達しました。10分後にもう一度お試しください");	// 総当たりを防ぐ
      const rows = sheetUser.getDataRange().getValues();	// 定数を定義
      const userIndex = rows.findIndex((row, index) => index > 0 && cleanCell(row[0]) === loginUserId);	// ヘッダーを除いてユーザーを探す
      const user = userIndex >= 0 ? rows[userIndex] : null;	// 見つかったユーザー行を取得する

      if (!user) {	// 条件に応じて処理を分ける
        recordAttemptFailure(loginAttemptKey, loginAttempts, 600);	// ログイン失敗回数を記録する
        return createRes("error", "ユーザーIDまたはパスワードが間違っています");	// 登録状況を推測されない共通メッセージを返す
      }	// 処理のまとまりを閉じる

      if (user[6] !== true) {	// 条件に応じて処理を分ける
        return createRes("error", "メール認証が完了していません。");	// 結果を返す
      }	// 処理のまとまりを閉じる

      const dbPassword = user[1] ? user[1].toString().trim() : "";	// 定数を定義
      const inputPassword = data.password ? data.password.toString().trim() : "";	// 入力されたパスワードを整える

      if (verifyPassword(dbPassword, inputPassword)) {	// 保存済みパスワードと安全に照合する
        clearAttemptFailures(loginAttemptKey);	// ログイン成功時に失敗回数を消す
        if (!dbPassword.startsWith("v2$")) sheetUser.getRange(userIndex + 1, 2).setValue(hashPassword(inputPassword));	// 旧形式のパスワードをログイン時に更新する
        const loginResult = {	// 定数を定義
          userId: user[0],	// 処理を続ける
          email: user[0],	// 処理を続ける
          name: cleanCell(user[2]),	// 処理を続ける
          profileImage: user[4] || ""	// 処理を続ける
        };	// 処理のまとまりを閉じる
        loginResult.sessionToken = createUserSessionToken(cleanCell(user[0]), cleanCell(user[12]));	// 通常ユーザー用のログイン情報を発行する
        if (cleanCell(user[0]) === ADMIN_USER_ID) loginResult.adminToken = createAdminSessionToken();	// 条件に応じて処理を分ける
        return createRes("success", loginResult);	// 結果を返す
      } else {	// 処理のまとまりを始める
        recordAttemptFailure(loginAttemptKey, loginAttempts, 600);	// ログイン失敗回数を記録する
        return createRes("error", "ユーザーIDまたはパスワードが間違っています");	// 共通メッセージを返す
      }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる

    if (mode === "verify_face_1toN") {	// 条件に応じて処理を分ける
      return createRes("error", "顔認証にはユーザーIDの入力が必要です。");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "verify_face_for_user") {	// 条件に応じて処理を分ける
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "登録データがありません");	// 条件に応じて処理を分ける

      const userId = data.userId ? data.userId.toString().trim() : "";	// 定数を定義
      const currentLandmarks = data.currentFeatures;	// 定数を定義
      const currentSamples = Array.isArray(data.currentFeaturesSamples) ? data.currentFeaturesSamples : [];	// 定数を定義
      if (!userId) return createRes("error", "顔認証前にユーザーIDを入力してください。");	// 条件に応じて処理を分ける
      const faceAttemptKey = "face-attempt-" + userId.slice(0, 64);	// 顔認証失敗回数の保存名を作る
      const faceAttempts = getAttemptCount(faceAttemptKey);	// 現在の失敗回数を取得する
      if (faceAttempts >= 5) return createRes("error", "顔認証の試行回数が上限に達しました。10分後にもう一度お試しください");	// 顔認証の連続試行を防ぐ
      if (!Array.isArray(currentLandmarks)) return createRes("error", "顔情報を取得できませんでした。");	// 条件に応じて処理を分ける
      if (currentSamples.length < 2) return createRes("error", "顔情報を安定して取得できませんでした。もう一度お試しください。");	// 条件に応じて処理を分ける

      const rows = sheetUser.getDataRange().getValues();	// 定数を定義
      const userRow = rows.find(row => row[0] && row[0].toString().trim() === userId);	// 定数を定義

      if (!userRow) return createRes("error", "ユーザーIDが見つかりません。");	// 条件に応じて処理を分ける
      if (userRow[6] !== true) return createRes("error", "メール認証が完了していません。");	// 条件に応じて処理を分ける
      if (!userRow[3]) return createRes("error", "このユーザーには顔情報が登録されていません。");	// 条件に応じて処理を分ける

      try {	// 失敗に備えて処理を始める
        const registeredLandmarks = JSON.parse(userRow[3]);	// 定数を定義
        const scores = currentSamples.map(sample => getFaceDistance(sample, registeredLandmarks));	// 定数を定義
        scores.push(getFaceDistance(currentLandmarks, registeredLandmarks));	// 処理を完了する
        const validScores = scores.filter(score => score !== null).sort((a, b) => a - b);	// 有効な比較値を小さい順に並べる
        const passingScores = validScores.filter(score => score <= 0.06);	// 定数を定義
        const requiredPasses = Math.max(3, Math.ceil(validScores.length * 0.6));	// 一部の偶然一致だけでは通さない
        const claimedMedian = medianNumber(validScores);	// 複数回の中央の一致度を取得する
        if (validScores.length < 3 || passingScores.length < requiredPasses || claimedMedian === null || claimedMedian > 0.06) {	// 複数回安定して一致したか確認する
          recordAttemptFailure(faceAttemptKey, faceAttempts, 600);	// 顔認証失敗回数を記録する
          return createRes("error", "顔情報が一致しませんでした。明るい場所で正面を向いて、もう一度お試しください。");	// 結果を返す
        }	// 処理のまとまりを閉じる

        for (let i = 1; i < rows.length; i++) {	// 他ユーザーとの曖昧な一致を確認する
          if (rows[i] === userRow || rows[i][6] !== true || !rows[i][3]) continue;	// 本人と未認証ユーザーは飛ばす
          try {	// 壊れた顔情報に備える
            const otherLandmarks = JSON.parse(rows[i][3]);	// 他ユーザーの登録顔情報を読み込む
            const otherScores = currentSamples.slice(0, 4).map(sample => getFaceDistance(sample, otherLandmarks)).filter(score => score !== null).sort((a, b) => a - b);	// 他ユーザーとの一致度を求める
            const otherMedian = medianNumber(otherScores);	// 他ユーザーとの中央の一致度を取得する
            if (otherScores.length >= 3 && otherMedian !== null && otherMedian <= claimedMedian + 0.003) {	// 本人と同程度以上に似ている場合に処理する
              recordAttemptFailure(faceAttemptKey, faceAttempts, 600);	// 曖昧な一致も失敗として記録する
              return createRes("error", "安全のため顔だけでは本人を特定できませんでした。パスワードでログインしてください。");	// 誤認証を防いで顔ログインを拒否する
            }	// 曖昧一致の確認を閉じる
          } catch (otherFaceError) {	// 他ユーザーの顔情報を読めない場合に処理する
            console.warn("顔情報の比較を一件スキップしました", otherFaceError);	// 実行ログへ記録する
          }	// 顔情報の読み込みを閉じる
        }	// 他ユーザーとの確認を終える

        const faceLoginResult = {	// 定数を定義
          userId: userRow[0],	// 処理を続ける
          email: userRow[0],	// 処理を続ける
          name: cleanCell(userRow[2]),	// 処理を続ける
          profileImage: userRow[4] || ""	// 処理を続ける
        };	// 処理のまとまりを閉じる
        clearAttemptFailures(faceAttemptKey);	// 顔認証成功時に失敗回数を消す
        faceLoginResult.sessionToken = createUserSessionToken(cleanCell(userRow[0]), cleanCell(userRow[12]));	// 顔認証後のログイン情報を発行する
        if (cleanCell(userRow[0]) === ADMIN_USER_ID) faceLoginResult.adminToken = createAdminSessionToken();	// 条件に応じて処理を分ける
        return createRes("success", faceLoginResult);	// 結果を返す
      } catch (e) {	// 処理のまとまりを始める
        recordAttemptFailure(faceAttemptKey, faceAttempts, 600);	// 顔情報を確認できない場合も失敗回数を記録する
        return createRes("error", "顔情報を確認できませんでした。");	// 結果を返す
      }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる

    if (mode === "updateProfile") {	// 条件に応じて処理を分ける
      const email = data.email;	// 定数を定義
      const name = data.name;	// 定数を定義
      const profileImage = data.profileImage;	// 定数を定義
      if (!cleanCell(name) || String(name).length > 50) return createRes("error", "表示名は50文字以内で入力してください");	// 条件に応じて処理を分ける
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける
      const rows = sheetUser.getDataRange().getValues();	// 定数を定義

      let userRowIndex = -1;	// 状態を保持
      for (let i = 0; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === email) {	// 条件に応じて処理を分ける
          userRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      if (userRowIndex !== -1) {	// 条件に応じて処理を分ける
        if (profileImage && String(profileImage).length > 49000) {	// 条件に応じて処理を分ける
          return createRes("error", "プロフィール画像のデータが大きすぎます。画像を選び直してください");	// 結果を返す
        }	// 処理のまとまりを閉じる
        if (profileImage && !isSafeProfileImage(profileImage)) return createRes("error", "プロフィール画像の形式を確認してください");	// 想定外の画像形式を拒否する
        sheetUser.getRange(userRowIndex, 3).setValue(safeSheetText(name, 50));	// 表示名を数式として実行されない形で保存する
        if (profileImage) {	// 条件に応じて処理を分ける
          sheetUser.getRange(userRowIndex, 5).setValue(profileImage);	// 保存データを読み込む
        }	// 処理のまとまりを閉じる
        return createRes("success", "PROFILE_UPDATED");	// 結果を返す
      } else {	// 処理のまとまりを始める
        return createRes("error", "対象ユーザーが見つかりません");	// 結果を返す
      }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる

    if (mode === "updateFaceFeatures") {	// 条件に応じて処理を分ける
      const email = data.email;	// 定数を定義
      const faceFeatures = data.faceFeatures;	// 定数を定義
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける
      const rows = sheetUser.getDataRange().getValues();	// 定数を定義

      let userRowIndex = -1;	// 状態を保持
      for (let i = 0; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === email) {	// 条件に応じて処理を分ける
          userRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      if (userRowIndex !== -1) {	// 条件に応じて処理を分ける
        if (!isValidFaceFeatures(faceFeatures)) {	// 条件に応じて処理を分ける
          return createRes("error", "顔情報の形式が正しくないか、データが大きすぎます");	// 結果を返す
        }	// 処理のまとまりを閉じる
        sheetUser.getRange(userRowIndex, 4).setValue(faceFeatures);	// 保存データを読み込む
        return createRes("success", "顔認証情報をアップデートしました");	// 結果を返す
      } else {	// 処理のまとまりを始める
        return createRes("error", "対象ユーザーが見つかりません");	// 結果を返す
      }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる

    if (mode === "getRecruitments") {	// 条件に応じて処理を分ける
      if (!sheetRecruit || sheetRecruit.getLastRow() <= 1) return createRes("success", []);	// 条件に応じて処理を分ける

      const recruitLastRow = sheetRecruit.getLastRow();	// 定数を定義
      const rows = sheetRecruit.getRange(1, 1, recruitLastRow, 8).getValues();	// 定数を定義
      const blockLastRow = sheetBlock ? sheetBlock.getLastRow() : 0;	// 定数を定義
      const blockRows = sheetBlock && blockLastRow > 1 ? sheetBlock.getRange(1, 1, blockLastRow, 4).getValues() : [];	// 定数を定義
      const blockedPairs = {};	// 定数を定義
      for (let i = 1; i < blockRows.length; i++) {	// 対象を順番に処理する
        if (blockRows[i][3] === "解除") continue;	// 条件に応じて処理を分ける
        const first = cleanCell(blockRows[i][0]);	// 定数を定義
        const second = cleanCell(blockRows[i][1]);	// 定数を定義
        if (!first || !second) continue;	// 条件に応じて処理を分ける
        blockedPairs[[first, second].sort().join("\u0001")] = true;	// 処理を続ける
      }	// 処理のまとまりを閉じる
      const now = Date.now();	// 定数を定義
      let list = [];	// 状態を保持

      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        const postTime = new Date(rows[i][4]).getTime();	// 定数を定義

        if (Number.isNaN(postTime)) continue;	// 条件に応じて処理を分ける

        const durationMinutes = normalizeRecruitmentDuration(rows[i][7]);	// 定数を定義
        const expiresAt = postTime + durationMinutes * 60 * 1000;	// 定数を定義

        const blockKey = [cleanCell(data.email), cleanCell(rows[i][5])].sort().join("\u0001");	// 定数を定義
        if (now < expiresAt && !blockedPairs[blockKey]) {	// 条件に応じて処理を分ける
          list.push({	// 処理のまとまりを始める
            name: rows[i][0],	// 処理を続ける
            grade: rows[i][1],	// 処理を続ける
            dept: rows[i][2],	// 処理を続ける
            content: rows[i][3],	// 処理を続ける
            time: postTime,	// 処理を続ける
            email: rows[i][5],	// 処理を続ける
            tags: rows[i][6] || "",	// 処理を続ける
            durationMinutes: durationMinutes	// 処理を続ける
          });	// 処理を完了する
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      return createRes("success", list);	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "postRecruitment") {	// 条件に応じて処理を分ける
      if (!sheetRecruit) return createRes("error", "シートが存在しません");	// 条件に応じて処理を分ける
      if (!cleanCell(data.content) || String(data.content).length > 2000) return createRes("error", "募集内容は2000文字以内で入力してください");	// 条件に応じて処理を分ける
      if (String(data.tags || "").length > 500) return createRes("error", "タグが長すぎます");	// 条件に応じて処理を分ける

      ensureRecruitmentDurationColumn(sheetRecruit);	// 処理を完了する
      const rows = sheetRecruit.getLastRow() > 0 ? sheetRecruit.getDataRange().getValues() : [];	// 定数を定義
      let existingRowIndex = -1;	// 状態を保持
      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][5] === data.email) {	// 条件に応じて処理を分ける
          existingRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      const durationMinutes = normalizeRecruitmentDuration(data.durationMinutes);	// 定数を定義
      const rowData = [safeSheetText(data.name, 50), safeSheetText(data.grade, 30), safeSheetText(data.dept, 50), safeSheetText(data.content, 2000), new Date(), cleanCell(data.email), safeSheetText(data.tags || "", 500), durationMinutes];	// 募集内容を文字列として安全に保存する

      if (existingRowIndex !== -1) {	// 条件に応じて処理を分ける
        sheetRecruit.getRange(existingRowIndex, 1, 1, 8).setValues([rowData]);	// 保存データを読み込む
        return createRes("success", "UPDATED");	// 結果を返す
      } else {	// 処理のまとまりを始める
        sheetRecruit.appendRow(rowData);	// 保存データを更新する
        return createRes("success", "CREATED");	// 結果を返す
      }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる

    if (mode === "deleteRecruitment") {	// 条件に応じて処理を分ける
      if (!sheetRecruit || sheetRecruit.getLastRow() <= 1) return createRes("success", "NOT_FOUND");	// 条件に応じて処理を分ける
      const rows = sheetRecruit.getDataRange().getValues();	// 定数を定義
      const myEmail = data.email;	// 定数を定義
      for (let i = rows.length - 1; i >= 1; i--) {	// 対象を順番に処理する
        if (rows[i][5] === myEmail) {	// 条件に応じて処理を分ける
          sheetRecruit.deleteRow(i + 1);	// 保存データを更新する
          return createRes("success", "DELETED");	// 結果を返す
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      return createRes("success", "NOT_FOUND");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "sendMessage") {	// 条件に応じて処理を分ける
      if (!sheetChat) return createRes("error", "チャットシートが存在しません");	// 条件に応じて処理を分ける

      const fromUser = cleanCell(data.from);	// 定数を定義
      const toUser = cleanCell(data.to);	// 定数を定義
      const messageText = cleanCell(data.text);	// 定数を定義
      const requestId = cleanCell(data.requestId).slice(0, 100);	// クライアントが作成した送信IDを取得する
      if (!fromUser || !toUser || fromUser === toUser) return createRes("error", "送信先が正しくありません");	// 条件に応じて処理を分ける
      if (!requestId || !/^[A-Za-z0-9._:-]+$/.test(requestId)) return createRes("error", "送信情報を確認できませんでした。ページを再読み込みしてください");	// 再送判定に使うIDを確認する
      if (messageText.length > 2000) return createRes("error", "メッセージは2000文字以内で入力してください");	// 条件に応じて処理を分ける
      const messageUserRows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];	// 定数を定義
      const senderRow = findUserRow(messageUserRows, fromUser);	// 定数を定義
      const recipientRow = findUserRow(messageUserRows, toUser);	// 定数を定義
      if (!senderRow || !recipientRow) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける
      if (isBlockedBetween(sheetBlock, fromUser, toUser)) return createRes("error", "ブロック中の相手には送信できません");	// 条件に応じて処理を分ける

      ensureChatColumns(sheetChat);	// 処理を完了する
      if (sheetChatCopy) ensureChatColumns(sheetChatCopy);	// 条件に応じて処理を分ける

      const attachmentInput = Array.isArray(data.attachments) ? data.attachments.slice(0, 8) : [];	// 定数を定義
      let attachmentUrls = [];	// 状態を保持

      if (!messageText && attachmentInput.length === 0) return createRes("error", "メッセージを入力してください");	// 条件に応じて処理を分ける
      if (chatMessageExists(sheetChat, fromUser, requestId)) return createRes("success", "SENT");	// 通信再試行による二重送信を防ぐ

      const lock = LockService.getScriptLock();	// 定数を定義
      let lockAcquired = false;	// 状態を保持
      try {	// 失敗に備えて処理を始める
        if (attachmentInput.length > 0) {	// 条件に応じて処理を分ける
          attachmentUrls = saveChatAttachments(attachmentInput, fromUser);	// 処理を完了する
        }	// 処理のまとまりを閉じる

        if (attachmentInput.length > 0 && attachmentUrls.length !== attachmentInput.length) {	// 条件に応じて処理を分ける
          return createRes("error", "画像の保存に失敗しました。画像の容量またはDriveの共有設定を確認してください");	// 結果を返す
        }	// 処理のまとまりを閉じる

        if (!messageText && attachmentUrls.length === 0) {	// 条件に応じて処理を分ける
          return createRes("error", "画像を保存できませんでした。枚数や容量を確認してください");	// 結果を返す
        }	// 処理のまとまりを閉じる

        for (let attempt = 0; attempt < 3 && !lockAcquired; attempt++) {	// 対象を順番に処理する
          lockAcquired = lock.tryLock(5000);	// 処理を完了する
          if (!lockAcquired && attempt < 2) Utilities.sleep(250);	// 条件に応じて処理を分ける
        }	// 処理のまとまりを閉じる

        if (!lockAcquired) {	// 条件に応じて処理を分ける
          deleteChatAttachmentUrls(attachmentUrls);	// 保存できなかったメッセージの画像を削除する
          return createRes("error", "チャットの保存処理が混み合っています。数秒後にもう一度お試しください");	// 結果を返す
        }	// 処理のまとまりを閉じる

        if (chatMessageExists(sheetChat, fromUser, requestId)) {	// ロック待ちの間に同じ送信が保存されたか確認する
          deleteChatAttachmentUrls(attachmentUrls);	// 再試行で重複作成した画像を削除する
          return createRes("success", "SENT");	// 保存済みとして成功を返す
        }	// 二重送信確認を閉じる

        const now = new Date();	// 定数を定義
        const messageId = requestId;	// クライアントの送信IDをメッセージIDとして使う
        const rowData = [fromUser, toUser, safeSheetText(messageText, 2000), now, "unread", messageId, "active", JSON.stringify(attachmentUrls)];	// メッセージ本文を文字列として安全に保存する

        appendChatRow(sheetChat, rowData);	// 処理を完了する

        if (sheetChatCopy) {	// 条件に応じて処理を分ける
          try {	// 失敗に備えて処理を始める
            appendChatRow(sheetChatCopy, rowData);	// 処理を完了する
          } catch (copyError) {	// 処理のまとまりを始める
            console.error("chat-copyへのバックアップ保存失敗", copyError);	// 処理を完了する
          }	// 処理のまとまりを閉じる
        }	// 処理のまとまりを閉じる
      } catch (e) {	// 処理のまとまりを始める
        console.error("チャット送信失敗", e);	// 処理を完了する
        deleteChatAttachmentUrls(attachmentUrls);	// メッセージ保存前に作成した画像を削除する
        const errorDetail = String(e && e.message ? e.message : e).replace(/\s+/g, " ").slice(0, 240);	// 定数を定義
        return createRes("error", `チャットシートへの保存に失敗しました。診断情報: ${errorDetail}`);	// 結果を返す
      } finally {	// 処理のまとまりを始める
        if (lockAcquired && lock.hasLock()) lock.releaseLock();	// 条件に応じて処理を分ける
      }	// 処理のまとまりを閉じる

      const senderName = getUserDisplayName(senderRow, fromUser);	// 定数を定義
      const recipientLineId = cleanCell(recipientRow[11]);	// 定数を定義
      if (recipientLineId) {	// 条件に応じて処理を分ける
        const attachmentNotice = attachmentUrls.length > 0 ? `\n（画像${attachmentUrls.length}枚が添付されています）` : "";	// 定数を定義
        const lineNoticeText = `💬【平工マッチング】新着メッセージ\n\n${senderName} さんからメッセージが届きました：\n「${messageText || "画像が送信されました"}」${attachmentNotice}`;	// 定数を定義
        sendLineNotification(recipientLineId, lineNoticeText);	// 処理を完了する
      }	// 処理のまとまりを閉じる

      const pushBody = `${senderName} さんからメッセージが届きました：${messageText || "画像が送信されました"}`.slice(0, 240);	// Android通知本文を短く整える
      sendAndroidPushNotification(ss, toUser, "平工マッチング：新着メッセージ", pushBody, fromUser);	// Android端末へ通知する

      return createRes("success", "SENT");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "getMessages") {	// 条件に応じて処理を分ける
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", []);	// 条件に応じて処理を分ける
      if (isBlockedBetween(sheetBlock, data.user1, data.user2)) return createRes("success", []);	// ブロック中の会話を表示しない
      const rows = getChatRows(sheetChat);	// 定数を定義
      const hiddenAt = getChatHiddenAt(sheetHiddenChat, data.user1, data.user2);	// 定数を定義
      let msgs = [];	// 状態を保持
      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        const isPair = (rows[i][0] === data.user1 && rows[i][1] === data.user2) ||	// 定数を定義
          (rows[i][0] === data.user2 && rows[i][1] === data.user1);	// 処理を完了する
        const sentAt = new Date(rows[i][3]).getTime();	// 定数を定義
        const isAfterHidden = !hiddenAt || Number.isNaN(sentAt) || sentAt > hiddenAt;	// 定数を定義

        if (isPair && isAfterHidden) {	// 条件に応じて処理を分ける
          let attachments = [];	// 状態を保持
          try {	// 失敗に備えて処理を始める
            const parsedAttachments = rows[i][7] ? JSON.parse(rows[i][7]) : [];	// 定数を定義
            if (Array.isArray(parsedAttachments)) attachments = parsedAttachments;	// 条件に応じて処理を分ける
          } catch (e) {	// 処理のまとまりを始める
            attachments = [];	// 処理を続ける
          }	// 処理のまとまりを閉じる

          msgs.push({	// 処理のまとまりを始める
            messageId: rows[i][5] || `legacy-${i + 1}`,	// 処理を続ける
            from: rows[i][0],	// 処理を続ける
            text: rows[i][2],	// 処理を続ける
            sentAt: rows[i][3],	// 処理を続ける
            isRead: rows[i][4] === "read",	// 処理を続ける
            isUnsent: rows[i][6] === "unsent",	// 処理を続ける
            attachments	// 処理を続ける
          });	// 処理を完了する
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      return createRes("success", msgs);	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "unsendMessage") {	// 条件に応じて処理を分ける
      if (!sheetChat) return createRes("error", "チャットシートが存在しません");	// 条件に応じて処理を分ける

      ensureChatColumns(sheetChat);	// 処理を完了する

      const userId = String(data.userId || "").trim();	// 定数を定義
      const messageId = String(data.messageId || "").trim();	// 定数を定義
      if (!userId || !messageId) return createRes("error", "送信取り消しに必要な情報が不足しています");	// 条件に応じて処理を分ける

      const rows = getChatRows(sheetChat);	// 定数を定義
      let targetRowIndex = -1;	// 状態を保持

      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        const rowMessageId = rows[i][5] || `legacy-${i + 1}`;	// 定数を定義
        if (rowMessageId === messageId && rows[i][0] === userId) {	// 条件に応じて処理を分ける
          targetRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      if (targetRowIndex === -1) return createRes("error", "取り消せるメッセージが見つかりません");	// 条件に応じて処理を分ける

      sheetChat.getRange(targetRowIndex, 3).setValue("このメッセージは送信取り消しされました。");	// 保存データを読み込む
      if (!sheetChat.getRange(targetRowIndex, 6).getValue()) {	// 保存データを読み込む
        sheetChat.getRange(targetRowIndex, 6).setValue(messageId);	// 保存データを読み込む
      }	// 処理のまとまりを閉じる
      sheetChat.getRange(targetRowIndex, 7).setValue("unsent");	// 保存データを読み込む
      sheetChat.getRange(targetRowIndex, 8).setValue("[]");	// 保存データを読み込む
      return createRes("success", "MESSAGE_UNSENT");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "deleteChatHistory") {	// 条件に応じて処理を分ける
      const userId = String(data.userId || "").trim();	// 定数を定義
      const targetUserId = String(data.targetUserId || "").trim();	// 定数を定義
      if (!userId || !targetUserId || userId === targetUserId) {	// 条件に応じて処理を分ける
        return createRes("error", "削除対象のチャットが正しくありません");	// 結果を返す
      }	// 処理のまとまりを閉じる

      const hiddenChatSheet = sheetHiddenChat || getOrCreateSheet(ss, "チャット非表示", ["UserID", "相手UserID", "非表示日時"]);	// 定数を定義
      const rows = hiddenChatSheet.getLastRow() > 1 ? hiddenChatSheet.getDataRange().getValues() : [];	// 定数を定義
      const now = new Date();	// 定数を定義
      let foundRowIndex = -1;	// 状態を保持

      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === userId && rows[i][1] === targetUserId) {	// 条件に応じて処理を分ける
          foundRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      if (foundRowIndex === -1) {	// 条件に応じて処理を分ける
        hiddenChatSheet.appendRow([userId, targetUserId, now]);	// 保存データを更新する
      } else {	// 処理のまとまりを始める
        hiddenChatSheet.getRange(foundRowIndex, 3).setValue(now);	// 保存データを読み込む
      }	// 処理のまとまりを閉じる

      return createRes("success", "CHAT_HISTORY_HIDDEN");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "getChatPartners") {	// 条件に応じて処理を分ける
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", []);	// 条件に応じて処理を分ける
      const rows = getChatRows(sheetChat);	// 定数を定義
      const myEmail = data.email;	// 定数を定義
      let partnersSet = new Set();	// 状態を保持
      const hiddenAtByPartner = {};	// 定数を定義
      if (sheetHiddenChat && sheetHiddenChat.getLastRow() > 1) {	// 条件に応じて処理を分ける
        const hiddenRows = sheetHiddenChat.getDataRange().getValues();	// 定数を定義
        for (let i = 1; i < hiddenRows.length; i++) {	// 対象を順番に処理する
          if (hiddenRows[i][0] !== myEmail) continue;	// 条件に応じて処理を分ける
          const partner = hiddenRows[i][1];	// 定数を定義
          const hiddenAt = new Date(hiddenRows[i][2]).getTime();	// 定数を定義
          if (!Number.isNaN(hiddenAt) && hiddenAt > (hiddenAtByPartner[partner] || 0)) {	// 条件に応じて処理を分ける
            hiddenAtByPartner[partner] = hiddenAt;	// 処理を続ける
          }	// 処理のまとまりを閉じる
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        const fromUser = rows[i][0];	// 定数を定義
        const toUser = rows[i][1];	// 定数を定義
        const sentAt = new Date(rows[i][3]).getTime();	// 定数を定義
        const partner = fromUser === myEmail ? toUser : fromUser;	// 定数を定義
        const hiddenAt = hiddenAtByPartner[partner] || 0;	// 定数を定義
        const isAfterHidden = !hiddenAt || Number.isNaN(sentAt) || sentAt > hiddenAt;	// 定数を定義

        if (!isAfterHidden || rows[i][6] === "unsent") continue;	// 条件に応じて処理を分ける

        if (fromUser === myEmail) {	// 条件に応じて処理を分ける
          partnersSet.add(toUser);	// 処理を完了する
        } else if (toUser === myEmail) {	// 処理のまとまりを始める
          partnersSet.add(fromUser);	// 処理を完了する
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      const partnerEmails = Array.from(partnersSet);	// 定数を定義
      let partnerList = [];	// 状態を保持

      const userRows = (sheetUser && sheetUser.getLastRow() > 0) ? sheetUser.getDataRange().getValues() : [];	// 定数を定義
      const blockRows = sheetBlock && sheetBlock.getLastRow() > 1 ? sheetBlock.getDataRange().getValues() : [];	// 定数を定義
      partnerEmails.forEach(pEmail => {	// 処理のまとまりを始める
        if (isBlockedInRows(blockRows, myEmail, pEmail)) return;	// 条件に応じて処理を分ける
        const userRow = findUserRow(userRows, pEmail);	// 定数を定義
        const pName = getUserDisplayName(userRow, pEmail || "未設定");	// 定数を定義
        partnerList.push({ email: pEmail, name: pName });	// 処理を完了する
      });	// 処理を完了する

      return createRes("success", partnerList);	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "blockUser") {	// 条件に応じて処理を分ける
      const blockerId = String(data.blockerId || "").trim();	// 定数を定義
      const blockedId = String(data.blockedId || "").trim();	// 定数を定義
      if (!blockerId || !blockedId || blockerId === blockedId) {	// 条件に応じて処理を分ける
        return createRes("error", "ブロック対象が正しくありません");	// 結果を返す
      }	// 処理のまとまりを閉じる
      if (!userExists(sheetUser, blockedId)) {	// 条件に応じて処理を分ける
        return createRes("error", "対象ユーザーが見つかりません");	// 結果を返す
      }	// 処理のまとまりを閉じる
      if (!userExists(sheetUser, blockerId)) return createRes("error", "ログインユーザーが見つかりません");	// 操作者の存在も確認する

      const blockSheet = sheetBlock || getOrCreateSheet(ss, "ブロック", [	// 定数を定義
        "ブロックしたUserID", "ブロックされたUserID", "ブロック日時", "状態"	// 処理を続ける
      ]);	// 処理を完了する
      const rows = blockSheet.getLastRow() > 1 ? blockSheet.getDataRange().getValues() : [];	// 定数を定義
      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === blockerId && rows[i][1] === blockedId && rows[i][3] !== "解除") {	// 条件に応じて処理を分ける
          return createRes("success", "ALREADY_BLOCKED");	// 結果を返す
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      blockSheet.appendRow([blockerId, blockedId, new Date(), "有効"]);	// 保存データを更新する
      return createRes("success", "BLOCKED");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "unblockUser") {	// 条件に応じて処理を分ける
      const blockerId = String(data.blockerId || "").trim();	// 定数を定義
      const blockedId = String(data.blockedId || "").trim();	// 定数を定義
      if (!sheetBlock || sheetBlock.getLastRow() <= 1) return createRes("success", "UNBLOCKED");	// 条件に応じて処理を分ける
      const rows = sheetBlock.getDataRange().getValues();	// 定数を定義
      for (let i = rows.length - 1; i >= 1; i--) {	// 対象を順番に処理する
        if (rows[i][0] === blockerId && rows[i][1] === blockedId && rows[i][3] !== "解除") {	// 条件に応じて処理を分ける
          sheetBlock.getRange(i + 1, 4).setValue("解除");	// 保存データを読み込む
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      return createRes("success", "UNBLOCKED");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "getBlockedUsers") {	// 条件に応じて処理を分ける
      const blockerId = String(data.blockerId || "").trim();	// 定数を定義
      const rows = sheetBlock && sheetBlock.getLastRow() > 1 ? sheetBlock.getDataRange().getValues() : [];	// 定数を定義
      const userRows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];	// 定数を定義
      const blockedIds = [];	// 定数を定義

      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === blockerId && rows[i][3] !== "解除") {	// 条件に応じて処理を分ける
          const blockedId = rows[i][1];	// 定数を定義
          const userRow = userRows.find(row => row[0] === blockedId || row[5] === blockedId);	// 定数を定義
          blockedIds.push({	// 処理のまとまりを始める
            userId: blockedId,	// 処理を続ける
            name: userRow ? (userRow[2] || "未設定") : "未設定"	// 処理を続ける
          });	// 処理を完了する
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      return createRes("success", blockedIds);	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "reportContent") {	// 条件に応じて処理を分ける
      const reporterId = String(data.reporterId || "").trim();	// 定数を定義
      const targetUserId = String(data.targetUserId || "").trim();	// 定数を定義
      const targetType = String(data.targetType || "").trim();	// 定数を定義
      const targetId = String(data.targetId || "").trim();	// 定数を定義
      const reason = String(data.reason || "").trim();	// 定数を定義
      const allowedTargetTypes = ["recruitment", "message", "user"];	// 通報できる対象種類を限定する
      const allowedReasons = ["嫌がらせ・迷惑行為", "不適切な内容", "性的な内容", "脅迫・危険な発言", "個人情報の掲載", "なりすまし", "スパム", "その他"];	// 通報理由を限定する

      if (!reporterId || !targetUserId || !targetType || !reason) {	// 条件に応じて処理を分ける
        return createRes("error", "通報に必要な情報が不足しています");	// 結果を返す
      }	// 処理のまとまりを閉じる
      if (!allowedTargetTypes.includes(targetType) || !allowedReasons.includes(reason)) return createRes("error", "通報内容が正しくありません");	// 想定外の通報値を拒否する
      if (String(data.targetContent || "").length > 3000 || String(data.detail || "").length > 2000) {	// 条件に応じて処理を分ける
        return createRes("error", "通報内容が長すぎます");	// 結果を返す
      }	// 処理のまとまりを閉じる
      if (!userExists(sheetUser, targetUserId)) {	// 条件に応じて処理を分ける
        return createRes("error", "通報対象のユーザーが見つかりません");	// 結果を返す
      }	// 処理のまとまりを閉じる

      const reportSheet = sheetReport || getOrCreateSheet(ss, "通報", [	// 定数を定義
        "通報ID", "通報者UserID", "対象UserID", "対象種類", "対象ID",	// 処理を続ける
        "対象内容", "通報理由", "詳細", "通報日時", "対応状況", "管理者メモ"	// 処理を続ける
      ]);	// 処理を完了する
      const reportId = Utilities.getUuid();	// 定数を定義
      reportSheet.appendRow([	// 保存データを更新する
        reportId,	// 処理を続ける
        reporterId,	// 処理を続ける
        targetUserId,	// 処理を続ける
        targetType,	// 処理を続ける
        targetId,	// 処理を続ける
        safeSheetText(data.targetContent || "", 3000),	// 対象内容を文字列として保存する
        safeSheetText(reason, 100),	// 通報理由を文字列として保存する
        safeSheetText(data.detail || "", 2000),	// 詳細を文字列として保存する
        new Date(),	// 処理を続ける
        "未対応",	// 処理を続ける
        ""	// 処理を続ける
      ]);	// 処理を完了する
      return createRes("success", "REPORTED");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "getReports") {	// 条件に応じて処理を分ける
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");	// 条件に応じて処理を分ける
      const rows = sheetReport && sheetReport.getLastRow() > 1 ? sheetReport.getDataRange().getValues() : [];	// 定数を定義
      const reports = [];	// 定数を定義
      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        reports.push({	// 処理のまとまりを始める
          reportId: rows[i][0], reporterId: rows[i][1], targetUserId: rows[i][2],	// 処理を続ける
          targetType: rows[i][3], targetId: rows[i][4], targetContent: rows[i][5],	// 処理を続ける
          reason: rows[i][6], detail: rows[i][7], reportedAt: rows[i][8],	// 処理を続ける
          status: rows[i][9] || "未対応", adminMemo: rows[i][10] || ""	// 処理を続ける
        });	// 処理を完了する
      }	// 処理のまとまりを閉じる
      return createRes("success", reports);	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "updateReportStatus") {	// 条件に応じて処理を分ける
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");	// 条件に応じて処理を分ける
      if (!sheetReport || sheetReport.getLastRow() <= 1) return createRes("error", "通報が見つかりません");	// 条件に応じて処理を分ける
      const reportId = String(data.reportId || "").trim();	// 定数を定義
      const nextStatus = String(data.status || "未対応").trim();	// 定数を定義
      if (!["未対応", "確認中", "対応済み", "却下"].includes(nextStatus)) return createRes("error", "対応状況が正しくありません");	// 未知の状態を拒否する
      if (String(data.adminMemo || "").length > 2000) return createRes("error", "管理者メモは2000文字以内で入力してください");	// メモの上限を確認する
      const rows = sheetReport.getDataRange().getValues();	// 定数を定義
      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === reportId) {	// 条件に応じて処理を分ける
          sheetReport.getRange(i + 1, 10).setValue(nextStatus);	// 保存データを読み込む
          if (data.adminMemo !== undefined) sheetReport.getRange(i + 1, 11).setValue(safeSheetText(data.adminMemo, 2000));	// 管理者メモを文字列として保存する
          return createRes("success", "REPORT_UPDATED");	// 結果を返す
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      return createRes("error", "通報が見つかりません");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "getLatestIncomingMessage") {	// 条件に応じて処理を分ける
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", null);	// 条件に応じて処理を分ける
      const rows = getChatRows(sheetChat);	// 定数を定義
      const myEmail = data.email;	// 定数を定義
      const blockedPartners = getBlockedPartnerIds(sheetBlock, myEmail);	// 通知から除外する相手を取得する

      for (let i = rows.length - 1; i >= 1; i--) {	// 対象を順番に処理する
        if (rows[i] && rows[i][1] === myEmail && rows[i][6] !== "unsent" && !blockedPartners.has(cleanCell(rows[i][0]))) {	// ブロック中の相手を除く
          const senderEmail = rows[i][0] || "";	// 定数を定義
          const text = rows[i][2] || "";	// 定数を定義
          const rawDate = rows[i][3];	// 定数を定義
          const time = rawDate ? new Date(rawDate).getTime() : 0;	// 定数を定義

          const userRows = (sheetUser && sheetUser.getLastRow() > 0) ? sheetUser.getDataRange().getValues() : [];	// 定数を定義
          const userRow = findUserRow(userRows, senderEmail);	// 定数を定義
          const senderName = getUserDisplayName(userRow, senderEmail || "ユーザー");	// 定数を定義

          return createRes("success", {	// 結果を返す
            fromEmail: senderEmail,	// 処理を続ける
            fromName: senderName,	// 処理を続ける
            text: text,	// 処理を続ける
            time: time	// 処理を続ける
          });	// 処理を完了する
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      return createRes("success", null);	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "getUnreadCount") {	// 条件に応じて処理を分ける
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", { unreadCount: 0 });	// 条件に応じて処理を分ける
      const rows = getChatRows(sheetChat);	// 定数を定義
      const myEmail = data.email;	// 定数を定義
      const blockedPartners = getBlockedPartnerIds(sheetBlock, myEmail);	// 未読から除外する相手を取得する
      let unreadCount = 0;	// 状態を保持

      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i] && rows[i][1] === myEmail && rows[i][4] === "unread" && rows[i][6] !== "unsent" && !blockedPartners.has(cleanCell(rows[i][0]))) {	// ブロック中の相手を除く
          unreadCount++;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      return createRes("success", { unreadCount: unreadCount });	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "getNotificationSummary") {	// 条件に応じて処理を分ける
      if (!sheetChat || sheetChat.getLastRow() <= 1) {	// 条件に応じて処理を分ける
        return createRes("success", { unreadCount: 0, latestIncoming: null });	// 結果を返す
      }	// 処理のまとまりを閉じる

      const rows = getChatRows(sheetChat);	// 定数を定義
      const myEmail = data.email;	// 定数を定義
      const blockedPartners = getBlockedPartnerIds(sheetBlock, myEmail);	// 通知から除外する相手を取得する
      let unreadCount = 0;	// 状態を保持
      let latestIncoming = null;	// 状態を保持

      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        const row = rows[i];	// 定数を定義
        if (!row || row[6] === "unsent" || blockedPartners.has(cleanCell(row[0]))) continue;	// 送信取消とブロック中の相手を除く

        if (row[1] === myEmail && row[4] === "unread") unreadCount++;	// 条件に応じて処理を分ける

        if (row[1] === myEmail) {	// 条件に応じて処理を分ける
          const time = row[3] ? new Date(row[3]).getTime() : 0;	// 定数を定義
          if (!latestIncoming || time >= latestIncoming.time) {	// 条件に応じて処理を分ける
            latestIncoming = {	// 処理のまとまりを始める
              fromEmail: row[0] || "",	// 処理を続ける
              text: row[2] || "",	// 処理を続ける
              time: time	// 処理を続ける
            };	// 処理のまとまりを閉じる
          }	// 処理のまとまりを閉じる
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      if (latestIncoming) {	// 条件に応じて処理を分ける
        const userRows = (sheetUser && sheetUser.getLastRow() > 0) ? sheetUser.getDataRange().getValues() : [];	// 定数を定義
        const userRow = findUserRow(userRows, latestIncoming.fromEmail);	// 定数を定義
        latestIncoming.fromName = getUserDisplayName(userRow, latestIncoming.fromEmail || "ユーザー");	// 処理を完了する
      }	// 処理のまとまりを閉じる

      return createRes("success", {	// 結果を返す
        unreadCount: unreadCount,	// 処理を続ける
        latestIncoming: latestIncoming	// 処理を続ける
      });	// 処理を完了する
    }	// 処理のまとまりを閉じる

    if (mode === "markAsRead") {	// 条件に応じて処理を分ける
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", "READ_MARKED");	// 条件に応じて処理を分ける
      const rows = getChatRows(sheetChat);	// 定数を定義
      const myEmail = data.myEmail;	// 定数を定義
      const targetEmail = data.targetEmail;	// 定数を定義

      const unreadRanges = [];	// 定数を定義
      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i] && rows[i][0] === targetEmail && rows[i][1] === myEmail && rows[i][4] === "unread") {	// 条件に応じて処理を分ける
          unreadRanges.push(`E${i + 1}`);	// 処理を完了する
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      if (unreadRanges.length > 0) sheetChat.getRangeList(unreadRanges).setValue("read");	// 保存データを更新する
      return createRes("success", "READ_MARKED");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "deleteAccount") {	// 条件に応じて処理を分ける
      const email = data.email;	// 定数を定義
      if (cleanCell(email) === ADMIN_USER_ID) return createRes("error", "管理者アカウントは削除できません");	// 管理者自身の削除を拒否する
      if (!sheetUser || sheetUser.getLastRow() <= 1) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける

      const rows = sheetUser.getDataRange().getValues();	// 定数を定義
      let userDeleted = false;	// 状態を保持

      for (let i = rows.length - 1; i >= 1; i--) {	// 対象を順番に処理する
        if (rows[i][0] === email || rows[i][5] === email) {	// 条件に応じて処理を分ける
          sheetUser.deleteRow(i + 1);	// 保存データを更新する
          userDeleted = true;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      if (sheetRecruit && sheetRecruit.getLastRow() > 1) {	// 条件に応じて処理を分ける
        const recruitRows = sheetRecruit.getDataRange().getValues();	// 定数を定義
        for (let j = recruitRows.length - 1; j >= 1; j--) {	// 対象を順番に処理する
          if (recruitRows[j][5] === email) {	// 条件に応じて処理を分ける
            sheetRecruit.deleteRow(j + 1);	// 保存データを更新する
          }	// 処理のまとまりを閉じる
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる

      if (userDeleted) {	// 条件に応じて処理を分ける
        CacheService.getScriptCache().put("revoked-user-" + cleanCell(email), "1", Math.floor(USER_SESSION_DURATION_MS / 1000));	// 既存ログインを無効化する
        return createRes("success", "ACCOUNT_DELETED");	// 結果を返す
      } else {	// 処理のまとまりを始める
        return createRes("error", "対象ユーザーが見つかりませんでした");	// 結果を返す
      }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる

    if (mode === "forgotPassword") {	// 条件に応じて処理を分ける
      const userId = data.userId;	// 定数を定義
      if (!claimCooldown("forgot-password-" + cleanCell(userId), 60)) return createRes("success", "MAIL_SENT_IF_EXISTS");	// 存在を明かさず連続送信を防ぐ
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");	// 条件に応じて処理を分ける
      const rows = sheetUser.getDataRange().getValues();	// 定数を定義

      let userRowIndex = -1;	// 状態を保持
      for (let i = 0; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === userId) {	// 条件に応じて処理を分ける
          userRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      if (userRowIndex === -1) return createRes("success", "MAIL_SENT_IF_EXISTS");	// 条件に応じて処理を分ける

      const row = rows[userRowIndex - 1];	// 定数を定義
      const email = row[5];	// 定数を定義
      if (!email) return createRes("success", "MAIL_SENT_IF_EXISTS");	// 条件に応じて処理を分ける

      const token = generateResetToken();	// 定数を定義
      const expiry = new Date().getTime() + (30 * 60 * 1000);	// 定数を定義

      sheetUser.getRange(userRowIndex, 10).setValue(token);	// 保存データを読み込む
      sheetUser.getRange(userRowIndex, 11).setValue(expiry);	// 保存データを読み込む

      const resetLink = `${SITE_URL}reset.html?id=${encodeURIComponent(userId)}&token=${token}`;	// 定数を定義

      MailApp.sendEmail({	// 外部サービスを扱う
        to: email,	// 処理を続ける
        name: "平工マッチング",	// 処理を続ける
        subject: "【平工マッチング】認証コードのご案内",	// 処理を続ける
        body: `パスワード再設定のリクエストを受け付けました。\n\n30分以内に、以下のリンクから新しいパスワードを設定してください。\n\n${resetLink}`	// 処理を続ける
      });	// 処理を完了する

      return createRes("success", "MAIL_SENT_IF_EXISTS");	// 結果を返す
    }	// 処理のまとまりを閉じる

    if (mode === "resetPassword") {	// 条件に応じて処理を分ける
      const userId = data.userId;	// 定数を定義
      const token = data.token;	// 定数を定義
      const newPassword = data.newPassword;	// 定数を定義

      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "無効なリンクです。");	// 条件に応じて処理を分ける
      const rows = sheetUser.getDataRange().getValues();	// 定数を定義

      let userRowIndex = -1;	// 状態を保持
      for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
        if (rows[i][0] === userId) {	// 条件に応じて処理を分ける
          userRowIndex = i + 1;	// 処理を続ける
          break;	// 処理を続ける
        }	// 処理のまとまりを閉じる
      }	// 処理のまとまりを閉じる
      if (userRowIndex === -1) return createRes("error", "無効なリンクです");	// 条件に応じて処理を分ける

      const savedToken = rows[userRowIndex - 1][9];	// 定数を定義
      const savedExpiry = rows[userRowIndex - 1][10];	// 定数を定義

      if (!savedToken || savedToken !== token) return createRes("error", "リンクが無効です。");	// 条件に応じて処理を分ける
      if (!savedExpiry || new Date().getTime() > savedExpiry) return createRes("error", "リンクの有効期限が切れています。");	// 条件に応じて処理を分ける
      const passwordError = validatePasswordPolicy(newPassword);	// 定数を定義
      if (passwordError) return createRes("error", passwordError);	// 条件に応じて処理を分ける

      sheetUser.getRange(userRowIndex, 2).setValue(hashPassword(newPassword));	// 保存データを読み込む
      ensureUserSessionColumn(sheetUser);	// ログイン世代の保存先を用意する
      sheetUser.getRange(userRowIndex, 13).setValue(Utilities.getUuid());	// 古いログインを無効にする
      sheetUser.getRange(userRowIndex, 10).setValue("");	// 保存データを読み込む
      sheetUser.getRange(userRowIndex, 11).setValue("");	// 保存データを読み込む

      return createRes("success", "PASSWORD_RESET");	// 結果を返す
    }	// 処理のまとまりを閉じる

    return createRes("error", "未対応のモードです: " + mode);	// 結果を返す

  } catch (err) {	// 処理のまとまりを始める
    console.error("GAS処理エラー", err);	// 詳細は実行ログだけへ記録する
    return createRes("error", "サーバー処理中にエラーが発生しました。時間をおいてもう一度お試しください");	// 内部情報を隠して返す
  }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function getFaceDistance(currentLandmarks, registeredLandmarks) {	// 関数を定義
  if (!Array.isArray(currentLandmarks) || !Array.isArray(registeredLandmarks)) return null;	// 条件に応じて処理を分ける
  const pointCount = Math.min(currentLandmarks.length, registeredLandmarks.length);	// 定数を定義
  if (pointCount < 400 || Math.abs(currentLandmarks.length - registeredLandmarks.length) > 10) return null;	// 条件に応じて処理を分ける

  const current = normalizeFaceLandmarks(currentLandmarks);	// 定数を定義
  const registered = normalizeFaceLandmarks(registeredLandmarks);	// 定数を定義
  if (!current || !registered) return null;	// 条件に応じて処理を分ける

  const distances = [];	// 定数を定義
  for (let i = 0; i < pointCount; i++) {	// 対象を順番に処理する
    const dx = current[i].x - registered[i].x;	// 定数を定義
    const dy = current[i].y - registered[i].y;	// 定数を定義
    const dz = (current[i].z - registered[i].z) * 0.5;	// 定数を定義
    distances.push(Math.sqrt(dx * dx + dy * dy + dz * dz));	// 処理を完了する
  }	// 処理のまとまりを閉じる

  distances.sort((a, b) => a - b);	// 処理を完了する
  const trim = Math.floor(distances.length * 0.1);	// 定数を定義
  let totalDistance = 0;	// 状態を保持
  let usedPoints = 0;	// 状態を保持
  for (let i = trim; i < distances.length - trim; i++) {	// 対象を順番に処理する
    totalDistance += distances[i];	// 処理を続ける
    usedPoints++;	// 処理を続ける
  }	// 処理のまとまりを閉じる

  return usedPoints ? totalDistance / usedPoints : null;	// 結果を返す
}	// 処理のまとまりを閉じる

function normalizeFaceLandmarks(landmarks) {	// 関数を定義
  const leftEye = landmarks[33];	// 定数を定義
  const rightEye = landmarks[263];	// 定数を定義
  if (!leftEye || !rightEye) return null;	// 条件に応じて処理を分ける

  const values = [leftEye.x, leftEye.y, rightEye.x, rightEye.y];	// 定数を定義
  if (values.some(value => typeof value !== "number" || !isFinite(value))) return null;	// 条件に応じて処理を分ける

  const centerX = (leftEye.x + rightEye.x) / 2;	// 定数を定義
  const centerY = (leftEye.y + rightEye.y) / 2;	// 定数を定義
  const centerZ = ((leftEye.z || 0) + (rightEye.z || 0)) / 2;	// 定数を定義
  const eyeX = rightEye.x - leftEye.x;	// 定数を定義
  const eyeY = rightEye.y - leftEye.y;	// 定数を定義
  const scale = Math.sqrt(eyeX * eyeX + eyeY * eyeY);	// 定数を定義
  if (!scale || !isFinite(scale)) return null;	// 条件に応じて処理を分ける

  const angle = Math.atan2(eyeY, eyeX);	// 定数を定義
  const cos = Math.cos(-angle);	// 定数を定義
  const sin = Math.sin(-angle);	// 定数を定義
  const normalized = [];	// 定数を定義

  for (let i = 0; i < landmarks.length; i++) {	// 対象を順番に処理する
    const point = landmarks[i];	// 定数を定義
    if (!point || typeof point.x !== "number" || typeof point.y !== "number" || !isFinite(point.x) || !isFinite(point.y)) return null;	// 条件に応じて処理を分ける

    const x = (point.x - centerX) / scale;	// 定数を定義
    const y = (point.y - centerY) / scale;	// 定数を定義
    const z = ((point.z || 0) - centerZ) / scale;	// 定数を定義
    normalized.push({	// 処理のまとまりを始める
      x: x * cos - y * sin,	// 処理を続ける
      y: x * sin + y * cos,	// 処理を続ける
      z: z	// 処理を続ける
    });	// 処理を完了する
  }	// 処理のまとまりを閉じる

  return normalized;	// 結果を返す
}	// 処理のまとまりを閉じる

function medianNumber(values) {	// 数値一覧の中央値を求める
  if (!Array.isArray(values) || values.length === 0) return null;	// 比較値がなければ計算しない
  const sorted = values.slice().filter(value => typeof value === "number" && isFinite(value)).sort((a, b) => a - b);	// 有効な数値を並べる
  if (sorted.length === 0) return null;	// 有効値がなければ計算しない
  const middle = Math.floor(sorted.length / 2);	// 中央位置を求める
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;	// 奇数と偶数に合わせて中央値を返す
}	// 処理のまとまりを閉じる

function normalizeAiStudyProfile(profile) {	// 関数を定義
  const source = profile && typeof profile === "object" ? profile : {};	// 定数を定義
  return {	// 結果を返す
    subject: cleanCell(source.subject).slice(0, 50) || "未指定",	// 処理を続ける
    goal: cleanCell(source.goal).slice(0, 300) || "まだ決まっていない",	// 処理を続ける
    challenge: cleanCell(source.challenge).slice(0, 300) || "特になし",	// 処理を続ける
    minutes: cleanCell(source.minutes).slice(0, 30) || "未指定",	// 処理を続ける
    preference: cleanCell(source.preference).slice(0, 100) || "未指定"	// 処理を続ける
  };	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function normalizeAiHistory(history) {	// 関数を定義
  if (!Array.isArray(history)) return [];	// 条件に応じて処理を分ける
  return history.slice(-8).map(item => ({	// 結果を返す
    role: item && item.role === "model" ? "model" : "user",	// 処理を続ける
    text: cleanCell(item && item.text).slice(0, 1200)	// 処理を続ける
  })).filter(item => item.text);	// 処理を完了する
}	// 処理のまとまりを閉じる

function getAiFeedbackProfile(aiSheet, userId) {	// 過去の評価から回答の調整方針を作る
  const emptyProfile = { feedbackCount: 0, helpfulCount: 0, notHelpfulCount: 0, successfulTypes: [], adjustmentRequests: [], typeAdjustments: {} };	// 評価がない場合の初期値を用意する
  if (!aiSheet || aiSheet.getLastRow() <= 1 || !userId) return emptyProfile;	// 必要な情報がなければ初期値を返す
  const cache = CacheService.getScriptCache();	// 一時保存領域を取得する
  const cacheKey = "ai-feedback-" + userId.slice(0, 100);	// ユーザーごとの保存名を作る
  const cached = cache.get(cacheKey);	// 保存済みの評価傾向を取得する
  if (cached) {	// 保存済みデータがある場合
    try {	// 壊れたデータに備える
      return JSON.parse(cached);	// 保存済みの評価傾向を返す
    } catch (e) {	// 読み込めなかった場合
      cache.remove(cacheKey);	// 壊れた保存データを消す
    }	// 読み込み処理を閉じる
  }	// 保存済みデータの確認を閉じる

  const lastRow = aiSheet.getLastRow();	// AIログの最終行を取得する
  const startRow = Math.max(2, lastRow - 499);	// 新しい500件だけを確認する
  const rows = aiSheet.getRange(startRow, 1, lastRow - startRow + 1, 14).getValues();	// 評価に必要な列をまとめて読む
  const typeAdjustments = {};	// 推薦タイプごとの補正値を保存する
  const adjustmentRequests = [];	// 回答内容の調整方針を保存する
  let helpfulCount = 0;	// 良い評価の数を数える
  let notHelpfulCount = 0;	// 合わなかった評価の数を数える
  let feedbackCount = 0;	// 参照した評価の数を数える

  for (let i = rows.length - 1; i >= 0 && feedbackCount < 30; i--) {	// 新しい評価から最大30件を確認する
    const row = rows[i];	// 今回確認する行を取得する
    if (cleanCell(row[2]) !== userId) continue;	// 別のユーザーの行は飛ばす
    const rating = cleanCell(row[11]);	// 評価を取得する
    if (rating !== "helpful" && rating !== "not_helpful") continue;	// 未評価の回答は飛ばす
    const reason = cleanCell(row[12]);	// 評価理由を取得する
    const recommendationType = cleanCell(row[13]);	// 推薦タイプを取得する
    feedbackCount++;	// 参照した評価数を増やす

    if (rating === "helpful") {	// 良い評価だった場合
      helpfulCount++;	// 良い評価数を増やす
      if (recommendationType) typeAdjustments[recommendationType] = (typeAdjustments[recommendationType] || 0) + 1.5;	// 合った推薦タイプを優先する
      continue;	// 次の評価へ進む
    }	// 良い評価の処理を閉じる

    notHelpfulCount++;	// 合わなかった評価数を増やす
    if (reason === "難しすぎる" || reason === "too_difficult") adjustmentRequests.push("説明をやさしくし、一度に取り組む量を減らす");	// 難易度を下げる
    if (reason === "簡単すぎる" || reason === "too_easy") adjustmentRequests.push("説明を具体的にし、少し難しい実践課題も入れる");	// 難易度を上げる
    if (reason === "自分の状況に合わない" || reason === "not_matched") {	// 状況に合わなかった場合
      adjustmentRequests.push("条件を決めつけず、本人の状況に合う複数案を示す");	// 状況の確認を優先する
      if (recommendationType) typeAdjustments[recommendationType] = (typeAdjustments[recommendationType] || 0) - 1;	// 合わなかった推薦タイプを少し下げる
    }	// 状況に合わない場合の処理を閉じる
    if (reason === "別の方法を試したい" || reason === "another_method") {	// 別の方法を求められた場合
      adjustmentRequests.push("過去に出した方法とは異なる学習方法を優先する");	// 新しい方法を優先する
      if (recommendationType) typeAdjustments[recommendationType] = (typeAdjustments[recommendationType] || 0) - 2;	// 同じ推薦タイプの優先度を下げる
    }	// 別の方法を求められた場合の処理を閉じる
    if (!reason) adjustmentRequests.push("過去の提案を繰り返さず、別の具体案も示す");	// 旧形式の評価にも対応する
  }	// 評価の確認を終える

  Object.keys(typeAdjustments).forEach(type => {	// 補正値ごとに処理する
    typeAdjustments[type] = Math.max(-3, Math.min(3, typeAdjustments[type]));	// 一種類の評価が強くなりすぎないようにする
  });	// 補正値の調整を終える
  const successfulTypes = Object.keys(typeAdjustments).filter(type => typeAdjustments[type] > 0).sort((a, b) => typeAdjustments[b] - typeAdjustments[a]).slice(0, 3);	// 評価の良い推薦タイプをまとめる
  const profile = {	// AIへ渡す評価傾向をまとめる
    feedbackCount: feedbackCount,	// 参照した評価数
    helpfulCount: helpfulCount,	// 良い評価数
    notHelpfulCount: notHelpfulCount,	// 合わなかった評価数
    successfulTypes: successfulTypes,	// 過去に合った推薦タイプ
    adjustmentRequests: Array.from(new Set(adjustmentRequests)).slice(0, 4),	// 重複を除いた調整方針
    typeAdjustments: typeAdjustments	// 推薦タイプごとの補正値
  };	// 評価傾向を閉じる
  cache.put(cacheKey, JSON.stringify(profile), 300);	// 評価傾向を5分間保存する
  return profile;	// 作成した評価傾向を返す
}	// 評価傾向の作成を閉じる

function buildStudyRecommendationProfile(profile, message, feedbackProfile) {	// 評価傾向を含めて推薦方法を決める
  const text = [profile.subject, profile.goal, profile.challenge, profile.preference, message].join(" ");	// 定数を定義
  const scores = {	// 定数を定義
    "短時間集中型": 0,	// 処理を続ける
    "反復定着型": 0,	// 処理を続ける
    "説明整理型": 0,	// 処理を続ける
    "演習実践型": 0,	// 処理を続ける
    "伴走計画型": 0	// 処理を続ける
  };	// 処理のまとまりを閉じる

  if (/続か|やる気|先延ばし|時間がない|集中できない/.test(text)) scores["短時間集中型"] += 3;	// 条件に応じて処理を分ける
  if (/暗記|覚え|忘れ|記憶|用語/.test(text)) scores["反復定着型"] += 3;	// 条件に応じて処理を分ける
  if (/理解|なぜ|説明|読解|意味|整理/.test(text)) scores["説明整理型"] += 3;	// 条件に応じて処理を分ける
  if (/問題|計算|演習|実技|解けない|ミス/.test(text)) scores["演習実践型"] += 3;	// 条件に応じて処理を分ける
  if (/計画|予定|一人|相談|誰か|一緒|管理/.test(text)) scores["伴走計画型"] += 3;	// 条件に応じて処理を分ける

  if (/短|15分|25分|30分/.test(profile.minutes)) scores["短時間集中型"] += 2;	// 条件に応じて処理を分ける
  if (/動画|図|見る|書いて/.test(profile.preference)) scores["説明整理型"] += 1;	// 条件に応じて処理を分ける
  if (/聞く|話す|説明する/.test(profile.preference)) scores["説明整理型"] += 1;	// 条件に応じて処理を分ける
  if (/問題|実践|手を動かす/.test(profile.preference)) scores["演習実践型"] += 1;	// 条件に応じて処理を分ける
  if (/友達|一緒|相談/.test(profile.preference)) scores["伴走計画型"] += 1;	// 条件に応じて処理を分ける

  const typeAdjustments = feedbackProfile && feedbackProfile.typeAdjustments ? feedbackProfile.typeAdjustments : {};	// 過去評価による補正値を取得する
  Object.keys(scores).forEach(type => {	// 推薦タイプごとに補正する
    scores[type] += Number(typeAdjustments[type]) || 0;	// 過去の評価を点数に反映する
  });	// 推薦点数の補正を終える

  const label = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];	// 定数を定義
  const focusMap = {	// 定数を定義
    "短時間集中型": "短い時間で始めやすく、休憩を挟みながら継続する方法",	// 処理を続ける
    "反復定着型": "思い出す回数を増やし、忘れる前に復習する方法",	// 処理を続ける
    "説明整理型": "自分の言葉で説明し、理解の抜けを見つける方法",	// 処理を続ける
    "演習実践型": "問題を解いて、間違いから次の学習内容を決める方法",	// 処理を続ける
    "伴走計画型": "小さな予定と振り返りを決め、誰かと進捗を共有する方法"	// 処理を続ける
  };	// 処理のまとまりを閉じる
  return { label: label, focus: focusMap[label], scores: scores, feedbackApplied: Boolean(feedbackProfile && feedbackProfile.feedbackCount) };	// 評価を反映した推薦結果を返す
}	// 処理のまとまりを閉じる

function getAiDailyUsage(aiSheet, userId) {	// 関数を定義
  if (!aiSheet || aiSheet.getLastRow() <= 1) return 0;	// 条件に応じて処理を分ける
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");	// 定数を定義
  const rows = aiSheet.getDataRange().getValues();	// 定数を定義
  return rows.slice(1).filter(row => {	// 結果を返す
    if (cleanCell(row[2]) !== userId || !row[0]) return false;	// 条件に応じて処理を分ける
    try {	// 失敗に備えて処理を始める
      return Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "yyyy-MM-dd") === today;	// 結果を返す
    } catch (e) {	// 処理のまとまりを始める
      return false;	// 結果を返す
    }	// 処理のまとまりを閉じる
  }).length;	// 処理を続ける
}	// 処理のまとまりを閉じる

function findAiRequest(aiSheet, userId, requestId) {	// 関数を定義
  if (!aiSheet || aiSheet.getLastRow() <= 1 || !requestId) return null;	// 条件に応じて処理を分ける
  const rows = aiSheet.getDataRange().getValues();	// 定数を定義
  for (let i = rows.length - 1; i >= 1; i--) {	// 対象を順番に処理する
    const row = rows[i];	// 定数を定義
    if (cleanCell(row[2]) !== userId || cleanCell(row[16]) !== requestId) continue;	// 条件に応じて処理を分ける
    const stage = Number(row[15]) || 1;	// 定数を定義
    return {	// 結果を返す
      responseId: cleanCell(row[1]),	// 処理を続ける
      reply: cleanCell(row[10]),	// 処理を続ける
      analysis: { label: cleanCell(row[13]) },	// 処理を続ける
      stage: stage,	// 処理を続ける
      completed: stage >= 2,	// 処理を続ける
      pending: false	// 処理を続ける
    };	// 処理のまとまりを閉じる
  }	// 処理のまとまりを閉じる
  return null;	// 結果を返す
}	// 処理のまとまりを閉じる

function getAiSessionUsage(aiSheet, userId, sessionId) {	// 関数を定義
  if (!aiSheet || aiSheet.getLastRow() <= 1 || !sessionId) return 0;	// 条件に応じて処理を分ける
  const rows = aiSheet.getDataRange().getValues();	// 定数を定義
  return rows.slice(1).filter(row => cleanCell(row[2]) === userId && cleanCell(row[3]) === sessionId).length;	// 結果を返す
}	// 処理のまとまりを閉じる

function callGeminiStudyAdvisor(apiKey, profile, analysis, history, message, stage, feedbackProfile) {	// 評価傾向を含めてAIへ相談する
  const systemInstruction = [	// 定数を定義
    "あなたは高校生向けの勉強相談アドバイザーです。回答は日本語で、親しみやすく具体的にしてください。",	// 処理を続ける
    "医療・心理・進路の断定をせず、必要なら先生や保護者など信頼できる大人への相談を勧めてください。",	// 処理を続ける
    "相談者を責めず、今日から実行できる小さな行動に落とし込んでください。",	// 処理を続ける
    "過去の回答評価がある場合は調整方針を優先し、同じ不満が繰り返されない回答にしてください。",	// 評価内容を回答へ反映する
    stage === 1	// 処理を続ける
      ? "今回は最終提案をまだ出さず、相談者の状況を短く整理して、追加質問を1つだけしてください。"	// 処理を続ける
      : "今回は相談を完結させてください。「状況の整理」「おすすめの勉強法」「今日やること」「続ける工夫」を含め、最後に質問は書かないでください。"	// 処理を続ける
  ].join("\n");	// 処理を完了する

  const context = [	// 定数を定義
    "相談者の情報:", JSON.stringify(profile),	// 処理を続ける
    "自作推薦ロジックの分析:", JSON.stringify(analysis),	// 処理を続ける
    "過去の回答評価から得た調整方針:", JSON.stringify(feedbackProfile || {}),	// 過去評価をAIへ伝える
    "今回の相談:", message,	// 処理を続ける
    "直近の会話:", JSON.stringify(history)	// 処理を続ける
  ].join("\n");	// 処理を完了する

  const payload = {	// 定数を定義
    system_instruction: { parts: [{ text: systemInstruction }] },	// 処理を続ける
    contents: [{ role: "user", parts: [{ text: context }] }],	// 処理を続ける
    generationConfig: { maxOutputTokens: 900, responseMimeType: "text/plain" }	// 処理を完了する
  };	// 処理のまとまりを閉じる
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(GEMINI_MODEL) + ":generateContent";	// 定数を定義
  try {	// 失敗に備えて処理を始める
    const response = UrlFetchApp.fetch(url, {	// 定数を定義
      method: "post",	// 処理を続ける
      contentType: "application/json",	// 処理を続ける
      headers: { "x-goog-api-key": apiKey },	// 処理を続ける
      payload: JSON.stringify(payload),	// 処理を続ける
      muteHttpExceptions: true	// 処理を続ける
    });	// 処理を完了する
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return "";	// 条件に応じて処理を分ける
    const data = JSON.parse(response.getContentText());	// 定数を定義
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;	// 定数を定義
    return Array.isArray(parts) ? parts.map(part => cleanCell(part.text)).join("\n").trim() : "";	// 結果を返す
  } catch (error) {	// 処理のまとまりを始める
    return "";	// 結果を返す
  }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function createRes(status, msg) {	// 関数を定義
  return ContentService.createTextOutput(JSON.stringify({ status: status, message: msg }))	// 結果を返す
    .setMimeType(ContentService.MimeType.JSON);	// 処理を完了する
}	// 処理のまとまりを閉じる

function cleanCell(value) {	// 関数を定義
  if (value === null || value === undefined) return "";	// 条件に応じて処理を分ける
  const text = String(value).trim();	// 定数を定義
  return text === "undefined" || text === "null" ? "" : text;	// 結果を返す
}	// 処理のまとまりを閉じる

function claimCooldown(key, seconds) {	// 短時間の連続実行を防ぐ
  const cache = CacheService.getScriptCache();	// 一時保存領域を取得する
  const cacheKey = String(key || "").slice(0, 240);	// 保存名を安全な長さに収める
  if (!cacheKey || cache.get(cacheKey)) return false;	// 実行済みなら拒否する
  cache.put(cacheKey, "1", Math.max(1, Number(seconds) || 1));	// 指定時間だけ実行済みとして保存する
  return true;	// 実行を許可する
}	// 処理のまとまりを閉じる

function getAttemptCount(key) {	// 保存済みの失敗回数を取得する
  return Number(CacheService.getScriptCache().get(String(key || "").slice(0, 240)) || 0);	// 数値へ変換して返す
}	// 失敗回数の取得を閉じる

function recordAttemptFailure(key, currentCount, seconds) {	// 認証の失敗回数を記録する
  const cacheKey = String(key || "").slice(0, 240);	// 保存名を安全な長さに収める
  if (!cacheKey) return;	// 保存名がない場合は終了する
  CacheService.getScriptCache().put(cacheKey, String((Number(currentCount) || 0) + 1), Math.max(1, Number(seconds) || 600));	// 指定時間だけ失敗回数を保存する
}	// 失敗回数の記録を閉じる

function clearAttemptFailures(key) {	// 認証成功後に失敗回数を消す
  const cacheKey = String(key || "").slice(0, 240);	// 保存名を安全な長さに収める
  if (cacheKey) CacheService.getScriptCache().remove(cacheKey);	// 保存済みの失敗回数を削除する
}	// 失敗回数の削除を閉じる

function isSafeIdentifier(value) {	// ユーザーIDとして安全な文字列か確認する
  const text = cleanCell(value);	// 識別子を整える
  return Boolean(text && text.length <= 64 && !/^[=+\-@]/.test(text) && !/[\u0000-\u001F\u007F]/.test(text));	// 数式や制御文字として解釈される値を拒否する
}	// 処理のまとまりを閉じる

function safeSheetText(value, maxLength) {	// ユーザー入力をシート用の文字列へ整える
  let text = cleanCell(value);	// 入力値を文字列へ変換する
  if (Number(maxLength) > 0) text = text.slice(0, Number(maxLength));	// 指定された長さに収める
  if (/^[=+\-@]/.test(text)) text = "'" + text;	// 数式として実行されないよう先頭を保護する
  return text;	// 安全な文字列を返す
}	// 処理のまとまりを閉じる

function findUserRow(rows, identifier) {	// 関数を定義
  const key = cleanCell(identifier);	// 定数を定義
  if (!key) return null;	// 条件に応じて処理を分ける
  return rows.find(row => cleanCell(row[0]) === key || cleanCell(row[5]) === key) || null;	// 結果を返す
}	// 処理のまとまりを閉じる

function getUserDisplayName(userRow, fallback) {	// 関数を定義
  const name = userRow ? cleanCell(userRow[2]) : "";	// 定数を定義
  return name || cleanCell(fallback) || "ユーザー";	// 結果を返す
}	// 処理のまとまりを閉じる

function isValidFaceFeatures(value) {	// 関数を定義
  if (!value || typeof value !== "string" || value.length > 49000) return false;	// 条件に応じて処理を分ける
  try {	// 失敗に備えて処理を始める
    const points = JSON.parse(value);	// 定数を定義
    return Array.isArray(points) && points.length >= 400 && points.every(point =>	// 結果を返す
      point && typeof point.x === "number" && typeof point.y === "number" && typeof point.z === "number" &&	// 処理を続ける
      isFinite(point.x) && isFinite(point.y) && isFinite(point.z)	// 処理を続ける
    );	// 処理を完了する
  } catch (e) {	// 処理のまとまりを始める
    return false;	// 結果を返す
  }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function isSafeProfileImage(value) {	// プロフィール画像の保存形式を確認する
  const source = cleanCell(value);	// 画像の文字列を整える
  if (!source || source.length > 49000) return false;	// 空または大きすぎる画像を拒否する
  if (/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(source)) return true;	// HTTPSの画像URLを許可する
  return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(source);	// 安全な画像データ形式だけを許可する
}	// 画像形式の確認を閉じる

function getAdminTokenSecret() {	// 関数を定義
  const properties = PropertiesService.getScriptProperties();	// 定数を定義
  let secret = properties.getProperty("ADMIN_TOKEN_SECRET");	// 状態を保持
  if (!secret) {	// 条件に応じて処理を分ける
    const lock = LockService.getScriptLock();	// 同時作成を防ぐロックを取得する
    lock.waitLock(5000);	// 署名鍵の作成順を待つ
    try {	// ロック中に署名鍵を確認する
      secret = properties.getProperty("ADMIN_TOKEN_SECRET");	// 別処理が作成した鍵を再確認する
      if (!secret) {	// まだ署名鍵がない場合に作成する
        secret = Utilities.getUuid() + Utilities.getUuid();	// 推測しにくい署名鍵を作る
        properties.setProperty("ADMIN_TOKEN_SECRET", secret);	// 署名鍵を保存する
      }	// 署名鍵の作成を閉じる
    } finally {	// 鍵の確認後に処理する
      if (lock.hasLock()) lock.releaseLock();	// ロックを解放する
    }	// ロック処理を閉じる
  }	// 処理のまとまりを閉じる
  return secret;	// 結果を返す
}	// 処理のまとまりを閉じる

function getRequestActorId(mode, data) {	// 処理ごとの本人IDを取得する
  const actorFields = {	// 本人確認に使う項目をまとめる
    heartbeat: "userId",	// オンライン更新の本人を指定する
    registerAndroidDevice: "userId",	// Android通知先の登録者を指定する
    unregisterAndroidDevice: "userId",	// Android通知先の解除者を指定する
    recordUsageLog: "userId",	// 利用ログ保存者を指定する
    createLineLinkCode: "userId",	// LINE連携コードの発行者を指定する
    unlinkLineAccount: "userId",	// LINE連携解除の本人を指定する
    getUserProfile: data.userId ? "userId" : "email",	// プロフィール取得者を指定する
    aiStudyChat: "userId",	// AI相談者を指定する
    aiStudyFeedback: "userId",	// AI評価者を指定する
    updateProfile: "email",	// プロフィール更新者を指定する
    updateFaceFeatures: "email",	// 顔情報更新者を指定する
    getRecruitments: "email",	// 募集取得者を指定する
    postRecruitment: "email",	// 募集投稿者を指定する
    deleteRecruitment: "email",	// 募集削除者を指定する
    sendMessage: "from",	// メッセージ送信者を指定する
    getMessages: "user1",	// チャット閲覧者を指定する
    unsendMessage: "userId",	// 送信取消者を指定する
    deleteChatHistory: "userId",	// 履歴削除者を指定する
    getChatPartners: "email",	// メッセージ一覧の本人を指定する
    blockUser: "blockerId",	// ブロック実行者を指定する
    unblockUser: "blockerId",	// ブロック解除者を指定する
    getBlockedUsers: "blockerId",	// ブロック一覧の本人を指定する
    reportContent: "reporterId",	// 通報者を指定する
    getLatestIncomingMessage: "email",	// 通知取得者を指定する
    getUnreadCount: "email",	// 未読取得者を指定する
    getNotificationSummary: "email",	// 通知概要の本人を指定する
    markAsRead: "myEmail",	// 既読更新者を指定する
    deleteAccount: "email"	// アカウント削除者を指定する
  };	// 本人項目の定義を閉じる
  const field = actorFields[mode];	// 処理に対応する項目を取得する
  return field ? cleanCell(data && data[field]) : "";	// 本人IDを返す
}	// 処理のまとまりを閉じる

function getUserTokenSecret() {	// 通常ユーザー用の署名鍵を取得する
  const properties = PropertiesService.getScriptProperties();	// スクリプト設定を取得する
  let secret = properties.getProperty("USER_TOKEN_SECRET");	// 保存済みの署名鍵を取得する
  if (!secret) {	// 署名鍵がない場合に処理する
    const lock = LockService.getScriptLock();	// 同時作成を防ぐロックを取得する
    lock.waitLock(5000);	// 署名鍵の作成順を待つ
    try {	// ロック中に署名鍵を確認する
      secret = properties.getProperty("USER_TOKEN_SECRET");	// 別処理が作成した鍵を再確認する
      if (!secret) {	// まだ署名鍵がない場合に作成する
        secret = Utilities.getUuid() + Utilities.getUuid();	// 推測しにくい署名鍵を作る
        properties.setProperty("USER_TOKEN_SECRET", secret);	// 署名鍵を保存する
      }	// 署名鍵の作成を閉じる
    } finally {	// 鍵の確認後に処理する
      if (lock.hasLock()) lock.releaseLock();	// ロックを解放する
    }	// ロック処理を閉じる
  }	// 署名鍵の確認を閉じる
  return secret;	// 署名鍵を返す
}	// 処理のまとまりを閉じる

function createUserSessionToken(userId, sessionVersion) {	// 通常ユーザー用のログイントークンを作る
  const payload = JSON.stringify({ userId: cleanCell(userId), version: cleanCell(sessionVersion), expiresAt: Date.now() + USER_SESSION_DURATION_MS });	// 本人IDとログイン世代と有効期限をまとめる
  const encodedPayload = Utilities.base64EncodeWebSafe(payload);	// トークン用の文字列へ変換する
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(encodedPayload, getUserTokenSecret()));	// 改ざん確認用の署名を作る
  return encodedPayload + "." + signature;	// 署名付きトークンを返す
}	// 処理のまとまりを閉じる

function getUserIdFromSessionToken(token) {	// ログイントークンを検証する
  try {	// 不正な形式に備えて処理する
    if (String(token || "").length > 2048) return "";	// 異常に大きいトークンを処理しない
    const parts = String(token || "").split(".");	// 本文と署名を分ける
    if (parts.length !== 2) return "";	// 形式が違う場合は拒否する
    const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], getUserTokenSecret()));	// 正しい署名を計算する
    if (!constantTimeEquals(parts[1], expected)) return "";	// 改ざんされている場合は拒否する
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());	// トークン本文を読み込む
    if (!payload || !cleanCell(payload.userId) || Date.now() > Number(payload.expiresAt || 0)) return "";	// 本人IDと期限を確認する
    if (CacheService.getScriptCache().get("revoked-user-" + cleanCell(payload.userId))) return "";	// 凍結または削除済みユーザーを拒否する
    return { userId: cleanCell(payload.userId), version: cleanCell(payload.version) };	// 確認できた本人IDとログイン世代を返す
  } catch (error) {	// 読み込みに失敗した場合に処理する
    return "";	// 無効なトークンとして扱う
  }	// 検証処理を閉じる
}	// 処理のまとまりを閉じる

function isAuthenticatedUserRequest(data, actorId, sheetUser) {	// リクエストが本人のものか確認する
  const tokenSession = getUserIdFromSessionToken(data && data.sessionToken);	// トークンの本人IDとログイン世代を取得する
  if (!tokenSession || tokenSession.userId !== cleanCell(actorId)) return false;	// 操作者と本人IDが違う場合は拒否する
  if (!sheetUser || sheetUser.getLastRow() <= 1) return false;	// ユーザー情報を確認できない場合は拒否する
  const width = Math.min(13, sheetUser.getMaxColumns());	// 現在のシート列数に収める
  const rows = sheetUser.getRange(2, 1, sheetUser.getLastRow() - 1, width).getValues();	// ユーザーIDと利用状態とログイン世代を読み込む
  const userRow = rows.find(row => cleanCell(row[0]) === tokenSession.userId);	// ログイン中のユーザーを探す
  return Boolean(userRow && userRow[6] === true && cleanCell(userRow[12]) === tokenSession.version);	// 利用可能で世代が一致するユーザーだけ許可する
}	// 処理のまとまりを閉じる

function createAdminSessionToken() {	// 関数を定義
  const expiresAt = Date.now() + 6 * 60 * 60 * 1000;	// 定数を定義
  const payload = `${ADMIN_USER_ID}|${expiresAt}`;	// 定数を定義
  const signature = Utilities.base64EncodeWebSafe(	// 定数を定義
    Utilities.computeHmacSha256Signature(payload, getAdminTokenSecret())	// 処理を続ける
  );	// 処理を完了する
  return Utilities.base64EncodeWebSafe(payload) + "." + signature;	// 結果を返す
}	// 処理のまとまりを閉じる

function isAdminRequest(data) {	// 関数を定義
  if (!data || cleanCell(data.adminId) !== ADMIN_USER_ID || !data.adminToken) return false;	// 条件に応じて処理を分ける
  if (String(data.adminToken).length > 2048) return false;	// 異常に大きい管理者トークンを拒否する
  try {	// 失敗に備えて処理を始める
    const parts = String(data.adminToken).split(".");	// 定数を定義
    if (parts.length !== 2) return false;	// 条件に応じて処理を分ける
    const payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();	// 定数を定義
    const payloadParts = payload.split("|");	// 定数を定義
    if (payloadParts.length !== 2 || payloadParts[0] !== ADMIN_USER_ID) return false;	// 条件に応じて処理を分ける
    if (!Number(payloadParts[1]) || Date.now() > Number(payloadParts[1])) return false;	// 条件に応じて処理を分ける
    const expected = Utilities.base64EncodeWebSafe(	// 定数を定義
      Utilities.computeHmacSha256Signature(payload, getAdminTokenSecret())	// 処理を続ける
    );	// 処理を完了する
    return constantTimeEquals(parts[1], expected);	// 結果を返す
  } catch (e) {	// 処理のまとまりを始める
    return false;	// 結果を返す
  }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function constantTimeEquals(left, right) {	// 関数を定義
  const a = String(left || "");	// 定数を定義
  const b = String(right || "");	// 定数を定義
  if (a.length !== b.length) return false;	// 条件に応じて処理を分ける
  let difference = 0;	// 状態を保持
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);	// 対象を順番に処理する
  return difference === 0;	// 結果を返す
}	// 処理のまとまりを閉じる

function getOrCreateSheet(ss, name, headers) {	// 関数を定義
  let sheet = ss.getSheetByName(name);	// 状態を保持
  if (!sheet) sheet = ss.insertSheet(name);	// 条件に応じて処理を分ける
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);	// 保存データを読み込む
  return sheet;	// 結果を返す
}	// 処理のまとまりを閉じる

function initializeUsageAnalytics() {	// 利用ログ用シートを手動で準備する
  const ss = SpreadsheetApp.getActiveSpreadsheet();	// 現在のスプレッドシートを取得する
  ensureUsageSheets(ss);	// 必要なシートと見出しを作る
  return "利用ログと日別分析シートを準備しました";	// 実行結果を返す
}	// 初期化処理を閉じる

function ensureUsageSheets(ss) {	// 利用分析用のシートを準備する
  const usageSheet = getOrCreateSheet(ss, "利用ログ", USAGE_LOG_HEADERS);	// 生ログの保存先を用意する
  const dailySheet = getOrCreateSheet(ss, "日別分析", DAILY_ANALYSIS_HEADERS);	// 日別集計の保存先を用意する
  return { usageSheet: usageSheet, dailySheet: dailySheet };	// 用意したシートを返す
}	// シート準備を閉じる

function saveUsageLog(ss, data) {	// 利用イベントを保存する
  const userId = cleanCell(data && data.userId);	// 操作したユーザーIDを取得する
  if (!isSafeIdentifier(userId)) return { saved: false, skipped: true };	// 不正なユーザーIDは記録しない

  const sourceMode = safeSheetText(data && data.sourceMode, 80) || "unknown";	// 元のAPIモードを保存する
  const result = ["success", "error", "started"].includes(cleanCell(data && data.result)) ? cleanCell(data.result) : "unknown";	// 結果の種類を整える
  const rawDuration = Number(data && data.durationMs);	// 処理時間を数値に変換する
  const durationMs = Number.isFinite(rawDuration) ? Math.max(0, Math.min(600000, Math.round(rawDuration))) : 0;	// 異常な処理時間を制限する
  const errorMessage = safeSheetText(data && data.errorMessage, 300);	// エラー内容を短く保存する
  const recordedAt = new Date();	// 記録時刻を作る
  const dateKey = Utilities.formatDate(recordedAt, Session.getScriptTimeZone(), "yyyy-MM-dd");	// 日本時間の日付を作る
  const userKey = createUsageUserKey(userId);	// 個人情報を直接保存しないキーを作る
  const sheets = ensureUsageSheets(ss);	// 保存先シートを準備する
  const lock = LockService.getScriptLock();	// 同時保存を防ぐロックを取得する
  let locked = false;	// ロック取得状態を保持する

  try {	// 保存処理を開始する
    locked = lock.tryLock(1500);	// 短時間だけロックを待つ
    if (!locked) return { saved: false, skipped: true };	// 混雑時は本来の操作を止めずに終了する
    sheets.usageSheet.appendRow([recordedAt, dateKey, userKey, getUsageFeatureLabel(sourceMode), sourceMode, result, durationMs, errorMessage]);	// 生ログを追加する
    upsertDailyAnalysis(sheets.dailySheet, dateKey, userKey, sourceMode, result, durationMs, recordedAt);	// 日別集計を更新する
    return { saved: true, dateKey: dateKey };	// 保存結果を返す
  } catch (error) {	// ログ保存の失敗に備える
    console.error("利用ログ保存失敗", error);	// 管理者向けに失敗を記録する
    return { saved: false, skipped: true };	// 本来の画面操作は成功扱いにする
  } finally {	// 保存処理の最後に実行する
    if (locked && lock.hasLock()) lock.releaseLock();	// 取得したロックを解放する
  }	// 保存処理を閉じる
}	// 利用ログ保存を閉じる

function createUsageUserKey(userId) {	// ユーザーIDを分析用の匿名キーへ変換する
  const signature = Utilities.computeHmacSha256Signature(cleanCell(userId), getUserTokenSecret());	// 署名鍵で一方向変換する
  return Utilities.base64EncodeWebSafe(signature).slice(0, 22);	// 短い匿名キーを返す
}	// 匿名キー作成を閉じる

function getUsageFeatureLabel(sourceMode) {	// APIモードを分析用の機能名へ変換する
  const mode = cleanCell(sourceMode);	// モード名を整える
  if (["login", "register", "verifyEmail", "forgotPassword", "resetPassword", "resendVerificationCode"].includes(mode)) return "ログイン";	// 認証系をまとめる
  if (["verify_face_for_user", "verify_face_1toN", "updateFaceFeatures"].includes(mode)) return "顔認証";	// 顔認証系をまとめる
  if (["getRecruitments", "postRecruitment", "deleteRecruitment"].includes(mode)) return "募集";	// 募集系をまとめる
  if (["sendMessage", "getMessages", "getChatPartners", "markAsRead", "unsendMessage", "deleteChatHistory", "getUnreadCount", "getNotificationSummary", "getLatestIncomingMessage"].includes(mode)) return "チャット";	// チャット系をまとめる
  if (["aiStudyChat", "aiStudyFeedback"].includes(mode)) return "AI相談";	// AI系をまとめる
  if (["createLineLinkCode", "unlinkLineAccount"].includes(mode)) return "LINE";	// LINE連携をまとめる
  if (["reportContent", "getReports", "updateReportStatus", "blockUser", "unblockUser", "getBlockedUsers"].includes(mode)) return "通報・ブロック";	// 安全機能をまとめる
  return "その他";	// 未分類の操作をまとめる
}	// 機能名変換を閉じる

function upsertDailyAnalysis(sheet, dateKey, userKey, sourceMode, result, durationMs, updatedAt) {	// 日別分析の1行を追加または更新する
  const lastRow = sheet.getLastRow();	// 日別分析の最終行を取得する
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, DAILY_ANALYSIS_HEADERS.length).getValues() : [];	// 既存の日別データを読み込む
  let rowIndex = rows.findIndex(row => cleanCell(row[0]) === dateKey);	// 同じ日付の行を探す
  let values;	// 保存する行を保持する

  if (rowIndex < 0) {	// 新しい日付の場合に処理する
    values = Array(DAILY_ANALYSIS_HEADERS.length).fill(0);	// 空の集計行を作る
    values[0] = dateKey;	// 日付を保存する
    values[16] = updatedAt;	// 最終更新時刻を保存する
    values[17] = "[]";	// 利用者キーの一覧を初期化する
    rowIndex = lastRow + 1;	// シート上の行番号を作る
  } else {	// 既存の日付の場合に処理する
    values = rows[rowIndex].slice(0, DAILY_ANALYSIS_HEADERS.length);	// 既存の集計値をコピーする
    rowIndex += 2;	// シート上の行番号へ変換する
  }	// 日付行の準備を閉じる

  const userKeys = parseUsageUserKeys(values[17]);	// 既存の匿名ユーザー一覧を読む
  if (userKey && !userKeys.includes(userKey)) userKeys.push(userKey);	// 新しい利用者を追加する
  values[1] = userKeys.length;	// ユニーク利用者数を更新する
  values[2] = Number(values[2] || 0) + 1;	// イベント数を増やす
  if (result === "success") values[3] = Number(values[3] || 0) + 1;	// 成功数を増やす
  if (result === "error") values[4] = Number(values[4] || 0) + 1;	// 失敗数を増やす

  const feature = getUsageFeatureLabel(sourceMode);	// 機能名を取得する
  const featureColumnMap = { "ログイン": 5, "募集": 6, "チャット": 7, "AI相談": 8, "顔認証": 9, "LINE": 10, "通報・ブロック": 11 };	// 機能ごとの列番号を定義する
  if (featureColumnMap[feature]) values[featureColumnMap[feature]] = Number(values[featureColumnMap[feature]] || 0) + 1;	// 機能別イベント数を増やす
  if (result === "error") values[12] = Number(values[12] || 0) + 1;	// エラー数を増やす
  if (durationMs > 0) {	// 処理時間がある場合に集計する
    values[14] = Number(values[14] || 0) + durationMs;	// 処理時間の合計を増やす
    values[15] = Number(values[15] || 0) + 1;	// 処理時間の件数を増やす
    values[13] = Math.round(values[14] / values[15]);	// 平均処理時間を更新する
  }	// 処理時間集計を閉じる
  values[16] = updatedAt;	// 最終更新時刻を更新する
  values[17] = JSON.stringify(userKeys.slice(-500));	// 匿名キー一覧を保存する
  sheet.getRange(rowIndex, 1, 1, DAILY_ANALYSIS_HEADERS.length).setValues([values]);	// 日別分析を保存する
}	// 日別分析更新を閉じる

function parseUsageUserKeys(value) {	// 匿名キー一覧を読み込む
  try {	// JSONの読み込みを試す
    const parsed = JSON.parse(cleanCell(value) || "[]");	// JSONを配列へ変換する
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string").slice(-500) : [];	// 安全な文字列だけ返す
  } catch (error) {	// 壊れたJSONに備える
    return [];	// 空の一覧を返す
  }	// 読み込み処理を閉じる
}	// 匿名キー一覧の読み込みを閉じる

function getDailyAnalysisRows(ss, days) {	// 日別分析を管理者向けの形式で返す
  const sheet = ss.getSheetByName("日別分析");	// 日別分析シートを取得する
  if (!sheet || sheet.getLastRow() <= 1) return [];	// データがなければ空配列を返す
  const limit = Math.max(1, Math.min(90, Number(days) || 30));	// 取得日数を制限する
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, DAILY_ANALYSIS_HEADERS.length).getValues();	// 日別データを読み込む
  return rows.slice(-limit).reverse().map(row => ({	// 新しい日付から返す
    date: cleanCell(row[0]),	// 日付を返す
    uniqueUsers: Number(row[1]) || 0,	// ユニーク利用者数を返す
    events: Number(row[2]) || 0,	// イベント数を返す
    successes: Number(row[3]) || 0,	// 成功数を返す
    failures: Number(row[4]) || 0,	// 失敗数を返す
    loginCount: Number(row[5]) || 0,	// ログイン関連数を返す
    recruitmentCount: Number(row[6]) || 0,	// 募集関連数を返す
    chatCount: Number(row[7]) || 0,	// チャット関連数を返す
    aiCount: Number(row[8]) || 0,	// AI相談数を返す
    faceCount: Number(row[9]) || 0,	// 顔認証関連数を返す
    lineCount: Number(row[10]) || 0,	// LINE関連数を返す
    moderationCount: Number(row[11]) || 0,	// 通報・ブロック関連数を返す
    errorCount: Number(row[12]) || 0,	// エラー数を返す
    averageDurationMs: Number(row[13]) || 0,	// 平均処理時間を返す
    updatedAt: row[16] || ""	// 最終更新時刻を返す
  }));	// 日別データの変換を完了する
}	// 日別分析取得を閉じる

function ensureUserSessionColumn(sheetUser) {	// ログイン世代の保存列を用意する
  if (sheetUser.getMaxColumns() < 13) sheetUser.insertColumnsAfter(sheetUser.getMaxColumns(), 13 - sheetUser.getMaxColumns());	// M列まで不足している列を増やす
  if (!sheetUser.getRange(1, 13).getValue()) sheetUser.getRange(1, 13).setValue("sessionVersion");	// M列の見出しを設定する
}	// ログイン世代の列確認を閉じる

function ensureRecruitmentDurationColumn(sheetRecruit) {	// 関数を定義
  if (sheetRecruit.getLastRow() === 0) {	// 条件に応じて処理を分ける
    sheetRecruit.getRange(1, 1, 1, 8).setValues([["名前", "学年", "学科", "勉強内容", "投稿時刻", "UserID", "tags", "表示時間（分）"]]);	// 保存データを読み込む
    return;	// 結果を返す
  }	// 処理のまとまりを閉じる

  if (!sheetRecruit.getRange(1, 8).getValue()) {	// 保存データを読み込む
    sheetRecruit.getRange(1, 8).setValue("表示時間（分）");	// 保存データを読み込む
  }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function ensureChatColumns(sheetChat) {	// 関数を定義
  if (sheetChat.getLastRow() === 0) {	// 条件に応じて処理を分ける
    sheetChat.getRange(1, 1, 1, 8).setValues([["送信元", "送信先", "内容", "日時", "既読", "メッセージID", "状態", "添付JSON"]]);	// 保存データを読み込む
    return;	// 結果を返す
  }	// 処理のまとまりを閉じる

  if (!sheetChat.getRange(1, 6).getValue()) sheetChat.getRange(1, 6).setValue("メッセージID");	// 保存データを読み込む
  if (!sheetChat.getRange(1, 7).getValue()) sheetChat.getRange(1, 7).setValue("状態");	// 保存データを読み込む
  if (!sheetChat.getRange(1, 8).getValue()) sheetChat.getRange(1, 8).setValue("添付JSON");	// 保存データを読み込む
}	// 処理のまとまりを閉じる

function appendChatRow(sheetChat, rowData) {	// 関数を定義
  const nextRow = Math.max(sheetChat.getLastRow() + 1, 2);	// 定数を定義
  sheetChat.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);	// 保存データを読み込む
}	// 処理のまとまりを閉じる

function getChatRows(sheetChat) {	// 関数を定義
  const lastRow = sheetChat.getLastRow();	// 定数を定義
  return lastRow > 0 ? sheetChat.getRange(1, 1, lastRow, 8).getValues() : [];	// 保存データを読み込む
}	// 処理のまとまりを閉じる

function chatMessageExists(sheetChat, senderId, messageId) {	// 同じメッセージが保存済みか確認する
  if (!sheetChat || !senderId || !messageId || sheetChat.getLastRow() <= 1) return false;	// 確認できるデータがなければ未保存とする
  const lastRow = sheetChat.getLastRow();	// チャットの最終行を取得する
  const startRow = Math.max(2, lastRow - 199);	// 直近200件を確認対象にする
  const rows = sheetChat.getRange(startRow, 1, lastRow - startRow + 1, 6).getValues();	// 送信者とメッセージIDをまとめて読む
  return rows.some(row => cleanCell(row[0]) === senderId && cleanCell(row[5]) === messageId);	// 同じ送信があれば保存済みとして返す
}	// 二重送信確認を閉じる

function getChatImageFolder() {	// 関数を定義
  const properties = PropertiesService.getScriptProperties();	// 定数を定義
  const savedFolderId = properties.getProperty("CHAT_IMAGE_FOLDER_ID");	// 定数を定義

  if (savedFolderId) {	// 条件に応じて処理を分ける
    try {	// 失敗に備えて処理を始める
      return DriveApp.getFolderById(savedFolderId);	// 外部サービスを扱う
    } catch (e) {	// 処理のまとまりを始める
      properties.deleteProperty("CHAT_IMAGE_FOLDER_ID");	// 処理を完了する
    }	// 処理のまとまりを閉じる
  }	// 処理のまとまりを閉じる

  const folder = DriveApp.createFolder("平工マッチング_チャット画像");	// 定数を定義
  properties.setProperty("CHAT_IMAGE_FOLDER_ID", folder.getId());	// 処理を完了する
  return folder;	// 結果を返す
}	// 処理のまとまりを閉じる

function authorizeChatDrive() {	// 関数を定義
  const folder = getChatImageFolder();	// 定数を定義
  Logger.log("チャット画像フォルダを使用できます: " + folder.getUrl());	// 処理を完了する
  return "チャット画像保存用のDrive権限を確認しました";	// 結果を返す
}	// 処理のまとまりを閉じる

function saveChatAttachments(attachments, senderId) {	// 関数を定義
  if (!Array.isArray(attachments) || attachments.length === 0) return [];	// 条件に応じて処理を分ける

  const folder = getChatImageFolder();	// 定数を定義
  const savedUrls = [];	// 定数を定義
  const errors = [];	// 画像ごとの保存失敗を記録する
  let totalBytes = 0;	// 一回の送信容量を数える

  attachments.slice(0, 8).forEach((attachment, index) => {	// 処理のまとまりを始める
    let createdFile = null;	// 今回作成したファイルを保持する
    try {	// 失敗に備えて処理を始める
      const dataUrl = String(attachment && attachment.data || "");	// 定数を定義
      const commaIndex = dataUrl.indexOf(",");	// 定数を定義
      if (commaIndex < 0) throw new Error("画像データの形式が正しくありません");	// 画像データの形式を確認する

      const metadata = dataUrl.slice(0, commaIndex);	// 定数を定義
      const base64 = dataUrl.slice(commaIndex + 1);	// 定数を定義
      const mimeMatch = metadata.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);	// 定数を定義
      const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : "image/jpeg";	// 定数を定義
      if (!mimeMatch || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("JPEG・PNG・WebP以外の画像は送信できません");	// 安全な画像形式だけを許可する

      const bytes = Utilities.base64Decode(base64);	// 定数を定義
      if (bytes.length > 450 * 1024) throw new Error("画像容量が450KBを超えています");	// 画像容量を確認する
      totalBytes += bytes.length;	// 合計容量へ加える
      if (totalBytes > 2 * 1024 * 1024) throw new Error("画像の合計容量が2MBを超えています");	// リクエスト全体の容量を制限する

      const originalName = cleanCell(attachment && attachment.name) || `image-${index + 1}.jpg`;	// 定数を定義
      const safeName = originalName.replace(/[^\w.\-ぁ-んァ-ヶ一-龠]/g, "_").slice(0, 80);	// 定数を定義
      const fileName = `${Date.now()}_${cleanCell(senderId) || "user"}_${safeName}`;	// 定数を定義
      createdFile = folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));	// 画像ファイルを作成する
      createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);	// 閲覧権限を設定する
      savedUrls.push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(createdFile.getId())}&sz=w1200`);	// 画像表示用URLを保存する
    } catch (e) {	// 処理のまとまりを始める
      if (createdFile) {	// ファイル作成後に失敗した場合に処理する
        try { createdFile.setTrashed(true); } catch (cleanupError) { console.error("未使用画像を片付けられませんでした", cleanupError); }	// 未使用画像をゴミ箱へ移す
      }	// ファイルの後始末を閉じる
      console.log(`チャット画像保存失敗: ${e}`);	// 処理を完了する
      const detail = String(e && e.message ? e.message : e).replace(/\s+/g, " ").slice(0, 160);	// 失敗理由を整える
      errors.push(`画像${index + 1}: ${detail}`);	// 失敗理由を記録する
    }	// 処理のまとまりを閉じる
  });	// 処理を完了する

  if (errors.length > 0) {	// 一枚でも保存に失敗した場合に処理する
    deleteChatAttachmentUrls(savedUrls);	// 途中まで保存した画像をゴミ箱へ移す
    throw new Error(errors.join(" / "));	// 画像保存の失敗を呼び出し元へ返す
  }	// 失敗画像の後始末を閉じる
  return savedUrls;	// 結果を返す
}	// 処理のまとまりを閉じる

function deleteChatAttachmentUrls(urls) {	// 保存に失敗した画像ファイルを片付ける
  (Array.isArray(urls) ? urls : []).forEach(url => {	// URLを順番に確認する
    try {	// ファイル削除の失敗に備える
      const match = String(url || "").match(/[?&]id=([^&]+)/);	// DriveのファイルIDを取得する
      if (match && match[1]) DriveApp.getFileById(decodeURIComponent(match[1])).setTrashed(true);	// 対象画像をゴミ箱へ移す
    } catch (error) {	// 削除できなかった場合に処理する
      console.error("未使用チャット画像の削除失敗", error);	// 実行ログへ記録する
    }	// 削除処理を閉じる
  });	// URLの確認を終える
}	// 処理のまとまりを閉じる

function getChatHiddenAt(sheetHiddenChat, user1, user2) {	// 関数を定義
  if (!sheetHiddenChat || sheetHiddenChat.getLastRow() <= 1) return 0;	// 条件に応じて処理を分ける

  const rows = sheetHiddenChat.getDataRange().getValues();	// 定数を定義
  let hiddenAt = 0;	// 状態を保持

  for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
    if (rows[i][0] !== user1 || rows[i][1] !== user2) continue;	// 条件に応じて処理を分ける
    const currentHiddenAt = new Date(rows[i][2]).getTime();	// 定数を定義
    if (!Number.isNaN(currentHiddenAt) && currentHiddenAt > hiddenAt) {	// 条件に応じて処理を分ける
      hiddenAt = currentHiddenAt;	// 処理を続ける
    }	// 処理のまとまりを閉じる
  }	// 処理のまとまりを閉じる

  return hiddenAt;	// 結果を返す
}	// 処理のまとまりを閉じる

function normalizeRecruitmentDuration(value) {	// 関数を定義
  const minutes = Number(value);	// 定数を定義
  return RECRUITMENT_DURATION_MINUTES.includes(minutes) ? minutes : 1440;	// 結果を返す
}	// 処理のまとまりを閉じる

function touchOnlineUser(sheetOnline, userId) {	// 関数を定義
  const lock = LockService.getScriptLock();	// 定数を定義

  try {	// 失敗に備えて処理を始める
    lock.waitLock(3000);	// 処理を完了する
    const rows = sheetOnline.getLastRow() > 1 ? sheetOnline.getDataRange().getValues() : [];	// 定数を定義
    let rowIndex = -1;	// 状態を保持

    for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
      if (String(rows[i][0] || "") === userId) {	// 条件に応じて処理を分ける
        rowIndex = i + 1;	// 処理を続ける
        break;	// 処理を続ける
      }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる

    if (rowIndex === -1) {	// 条件に応じて処理を分ける
      sheetOnline.appendRow([userId, new Date()]);	// 保存データを更新する
    } else {	// 処理のまとまりを始める
      sheetOnline.getRange(rowIndex, 2).setValue(new Date());	// 保存データを読み込む
    }	// 処理のまとまりを閉じる
  } finally {	// 処理のまとまりを始める
    if (lock.hasLock()) lock.releaseLock();	// 条件に応じて処理を分ける
  }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function getOnlineUserIds(sheetOnline) {	// 関数を定義
  if (!sheetOnline || sheetOnline.getLastRow() <= 1) return [];	// 条件に応じて処理を分ける

  const cutoff = Date.now() - ONLINE_TIMEOUT_MS;	// 定数を定義
  const rows = sheetOnline.getDataRange().getValues();	// 定数を定義
  const userIds = [];	// 定数を定義
  const seen = {};	// 定数を定義

  for (let i = 1; i < rows.length; i++) {	// 対象を順番に処理する
    const userId = String(rows[i][0] || "").trim();	// 定数を定義
    const lastSeen = new Date(rows[i][1]).getTime();	// 定数を定義

    if (userId && !Number.isNaN(lastSeen) && lastSeen >= cutoff && !seen[userId]) {	// 条件に応じて処理を分ける
      seen[userId] = true;	// 処理を続ける
      userIds.push(userId);	// 処理を完了する
    }	// 処理のまとまりを閉じる
  }	// 処理のまとまりを閉じる

  return userIds;	// 結果を返す
}	// 処理のまとまりを閉じる

function userExists(sheetUser, userId) {	// 関数を定義
  if (!sheetUser || sheetUser.getLastRow() <= 1) return false;	// 条件に応じて処理を分ける
  const rows = sheetUser.getDataRange().getValues();	// 定数を定義
  return rows.slice(1).some(row => row[0] === userId || row[5] === userId);	// 結果を返す
}	// 処理のまとまりを閉じる

function isBlockedBetween(sheetBlock, userA, userB) {	// 関数を定義
  if (!sheetBlock || !userA || !userB || sheetBlock.getLastRow() <= 1) return false;	// 条件に応じて処理を分ける
  const rows = sheetBlock.getDataRange().getValues();	// 定数を定義
  return isBlockedInRows(rows, userA, userB);	// 結果を返す
}	// 処理のまとまりを閉じる

function getBlockedPartnerIds(sheetBlock, userId) {	// ブロック関係にある相手を取得する
  const partners = new Set();	// 除外する相手を重複なく保持する
  if (!sheetBlock || !userId || sheetBlock.getLastRow() <= 1) return partners;	// ブロック情報がなければ空で返す
  const rows = sheetBlock.getDataRange().getValues();	// ブロック情報をまとめて読む
  for (let i = 1; i < rows.length; i++) {	// 各ブロックを確認する
    if (cleanCell(rows[i][3]) === "解除") continue;	// 解除済みは除外する
    if (cleanCell(rows[i][0]) === userId) partners.add(cleanCell(rows[i][1]));	// 自分がブロックした相手を追加する
    if (cleanCell(rows[i][1]) === userId) partners.add(cleanCell(rows[i][0]));	// 自分をブロックした相手も追加する
  }	// ブロック確認を閉じる
  return partners;	// ブロック中の相手を返す
}	// ブロック相手の取得を閉じる

function isBlockedInRows(rows, userA, userB) {	// 関数を定義
  if (!Array.isArray(rows) || !userA || !userB) return false;	// 条件に応じて処理を分ける
  return rows.slice(1).some(row => {	// 結果を返す
    if (row[3] === "解除") return false;	// 条件に応じて処理を分ける
    return (row[0] === userA && row[1] === userB) || (row[0] === userB && row[1] === userA);	// 結果を返す
  });	// 処理を完了する
}	// 処理のまとまりを閉じる

function hasWeakNumberSequence(password) {	// 関数を定義
  const numberRuns = String(password).match(/\d{4,}/g) || [];	// 定数を定義
  return numberRuns.some(run => {	// 結果を返す
    for (let i = 0; i <= run.length - 4; i++) {	// 対象を順番に処理する
      const digits = run.slice(i, i + 4).split("").map(Number);	// 定数を定義
      const same = digits.every(digit => digit === digits[0]);	// 定数を定義
      const ascending = digits.slice(1).every((digit, index) => digit === (digits[index] + 1) % 10);	// 定数を定義
      const descending = digits.slice(1).every((digit, index) => digit === (digits[index] + 9) % 10);	// 定数を定義
      if (same || ascending || descending) return true;	// 条件に応じて処理を分ける
    }	// 処理のまとまりを閉じる
    return false;	// 結果を返す
  });	// 処理を完了する
}	// 処理のまとまりを閉じる

function validatePasswordPolicy(password) {	// 関数を定義
  const value = String(password || "");	// 定数を定義
  if (value.length < 4) return "パスワードは4文字以上で入力してください";	// 条件に応じて処理を分ける
  if (value.length > 128) return "パスワードは128文字以内で入力してください";	// 条件に応じて処理を分ける
  if (!/^[\x21-\x7E]+$/.test(value)) return "パスワードは半角英数字・記号のみ使用できます";	// 条件に応じて処理を分ける
  if (!/[A-Z]/.test(value)) return "パスワードに英大文字を1文字以上含めてください";	// 条件に応じて処理を分ける
  if (!/[a-z]/.test(value)) return "パスワードに英小文字を1文字以上含めてください";	// 条件に応じて処理を分ける
  if (!/[0-9]/.test(value)) return "パスワードに数字を1文字以上含めてください";	// 条件に応じて処理を分ける
  if (!/[^A-Za-z0-9]/.test(value)) return "パスワードに記号を1文字以上含めてください";	// 条件に応じて処理を分ける
  if (hasWeakNumberSequence(value)) return "同じ数字4桁の繰り返しや、1234・4321のような4桁の連番は使用できません";	// 条件に応じて処理を分ける
  return "";	// 結果を返す
}	// 処理のまとまりを閉じる

function hashPassword(password) {	// パスワードを保存用の形式へ変換する
  const salt = Utilities.getUuid().replace(/-/g, "");	// ユーザーごとのランダム値を作る
  const signature = Utilities.computeHmacSha256Signature(String(password || ""), getUserTokenSecret() + "|" + salt);	// 秘密鍵とランダム値を使って署名する
  return "v2$" + salt + "$" + Utilities.base64EncodeWebSafe(signature);	// バージョン付きの保存値を返す
}	// 処理のまとまりを閉じる

function legacyPasswordHash(password) {	// 旧形式のパスワード値を計算する
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password || ""), Utilities.Charset.UTF_8);	// 旧形式と同じ方法で計算する
  return rawHash.map(byte => {	// 結果を返す
    const v = (byte < 0 ? byte + 256 : byte).toString(16);	// 定数を定義
    return v.length === 1 ? "0" + v : v;	// 結果を返す
  }).join("");	// 処理を完了する
}	// 処理のまとまりを閉じる

function verifyPassword(savedPassword, inputPassword) {	// 新旧両方の保存形式を照合する
  const saved = String(savedPassword || "");	// 保存値を文字列へ整える
  if (saved.startsWith("v2$")) {	// 新しい保存形式の場合に処理する
    const parts = saved.split("$");	// バージョンとランダム値と署名へ分ける
    if (parts.length !== 3 || !parts[1] || !parts[2]) return false;	// 壊れた保存値を拒否する
    const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(inputPassword || ""), getUserTokenSecret() + "|" + parts[1]));	// 入力値の署名を計算する
    return constantTimeEquals(parts[2], signature);	// 一定時間比較で一致を確認する
  }	// 新形式の確認を閉じる
  return constantTimeEquals(saved, legacyPasswordHash(inputPassword));	// 旧形式を互換確認する
}	// 処理のまとまりを閉じる

function generateResetToken() { return Utilities.getUuid(); }	// 関数を定義
function generateVerificationCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }	// 関数を定義

function generateLineLinkCode(linkSheet) {	// 重複しにくいLINE連携コードを作る
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";	// 見間違いにくい文字を用意する
  const existing = linkSheet && linkSheet.getLastRow() > 1 ? linkSheet.getRange(2, 2, linkSheet.getLastRow() - 1, 1).getValues().flat().map(cleanCell) : [];	// 発行済みコードを取得する
  for (let attempt = 0; attempt < 10; attempt++) {	// 重複時に作り直す
    let code = "";	// 新しいコードを用意する
    for (let i = 0; i < 8; i++) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));	// 八文字のコードを作る
    if (!existing.includes(code)) return code;	// 未使用のコードなら返す
  }	// コード作成を閉じる
  return Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();	// 重複が続いた場合はUUIDから作る
}	// 処理のまとまりを閉じる

function upsertAndroidDeviceToken(deviceSheet, userId, fcmToken, platform) {	// Android端末の通知トークンを追加または更新する
  const now = new Date();	// 更新時刻を作る
  if (deviceSheet.getLastRow() > 1) {	// 登録済み端末を確認する
    const rows = deviceSheet.getRange(2, 1, deviceSheet.getLastRow() - 1, 5).getValues();	// 登録済み端末を読み込む
    for (let i = 0; i < rows.length; i++) {	// 端末を順番に確認する
      if (cleanCell(rows[i][1]) !== fcmToken) continue;	// 同じFCMトークンだけを更新する
      deviceSheet.getRange(i + 2, 1, 1, 5).setValues([[userId, safeSheetText(fcmToken, 4096), safeSheetText(platform, 32), now, "有効"]]);	// 端末情報を最新化する
      return;	// 更新が完了したら終了する
    }	// 登録済み端末の確認を閉じる
  }	// 既存端末の確認を閉じる
  deviceSheet.appendRow([userId, safeSheetText(fcmToken, 4096), safeSheetText(platform, 32), now, "有効"]);	// 新しい端末を追加する
}	// Android端末登録を閉じる

function getFcmServiceAccount() {	// GAS側に保存したFCMサービスアカウント設定を読み込む
  const properties = PropertiesService.getScriptProperties();	// スクリプトプロパティを取得する
  const jsonText = properties.getProperty("FCM_SERVICE_ACCOUNT_JSON") || "";	// JSON形式の設定を取得する
  let account = null;	// サービスアカウント情報を保持する
  if (jsonText) {	// JSON設定がある場合に解析する
    try {	// 壊れたJSONに備える
      account = JSON.parse(jsonText);	// サービスアカウントを解析する
    } catch (e) {	// 解析できない設定は無効として扱う
      console.error("FCM_SERVICE_ACCOUNT_JSONの解析に失敗しました", e);	// 管理者向けに原因を記録する
      return null;	// 通知を送信せずに終了する
    }	// 解析処理を閉じる
  }	// JSON設定の確認を閉じる

  const projectId = cleanCell((account && account.project_id) || properties.getProperty("FCM_PROJECT_ID"));	// FirebaseプロジェクトIDを取得する
  const clientEmail = cleanCell((account && account.client_email) || properties.getProperty("FCM_CLIENT_EMAIL"));	// サービスアカウントのメールアドレスを取得する
  const privateKey = String((account && account.private_key) || properties.getProperty("FCM_PRIVATE_KEY") || "").replace(/\\n/g, "\n");	// 改行を復元した秘密鍵を取得する
  if (!projectId || !clientEmail || !privateKey) return null;	// 設定がない間は通知機能を無効にする
  return { projectId: projectId, clientEmail: clientEmail, privateKey: privateKey };	// 必要な設定だけを返す
}	// FCM設定取得を閉じる

function base64UrlEncode(value) {	// JWT用のBase64URL文字列を作る
  const bytes = typeof value === "string" ? Utilities.newBlob(value).getBytes() : value;	// 文字列またはバイト列を統一する
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");	// JWTの形式に合わせてパディングを除く
}	// Base64URL変換を閉じる

function getFcmAccessToken(account) {	// Firebase HTTP v1 API用のアクセストークンを取得する
  const cache = CacheService.getScriptCache();	// 短時間のトークンキャッシュを取得する
  const cached = cache.get("fcm-access-token");	// 保存済みトークンを確認する
  if (cached) return cached;	// 有効期限内なら再利用する

  try {	// Google OAuth APIの失敗に備える
    const issuedAt = Math.floor(Date.now() / 1000);	// JWT発行時刻を秒で作る
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));	// JWTヘッダーを作る
    const claim = base64UrlEncode(JSON.stringify({
      iss: account.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600
    }));	// OAuth用JWTの本文を作る
    const unsignedJwt = header + "." + claim;	// 署名前のJWTを作る
    const signature = base64UrlEncode(Utilities.computeRsaSha256Signature(unsignedJwt, account.privateKey));	// サービスアカウント秘密鍵で署名する
    const assertion = unsignedJwt + "." + signature;	// 署名済みJWTを作る
    const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {	// アクセストークンを要求する
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assertion
      },
      muteHttpExceptions: true
    });	// OAuth応答を取得する
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {	// エラー応答を確認する
      console.error("FCMアクセストークン取得失敗", response.getResponseCode(), response.getContentText().slice(0, 500));	// 詳細をログに残す
      return "";	// 通知を送信せずに終了する
    }	// エラー応答の確認を閉じる
    const token = cleanCell(JSON.parse(response.getContentText()).access_token);	// アクセストークンを読み込む
    if (token) cache.put("fcm-access-token", token, 3300);	// 期限前にキャッシュする
    return token;	// トークンを返す
  } catch (error) {	// 通信または解析エラーに備える
    console.error("FCMアクセストークン取得エラー", error);	// 通知処理だけを失敗させる
    return "";	// チャット保存結果には影響させない
  }	// アクセストークン取得を閉じる
}	// FCMアクセストークン取得を閉じる

function sendAndroidPushNotification(ss, toUserId, title, body, chatTargetUserId) {	// Android端末へチャット通知を送信する
  const account = getFcmServiceAccount();	// FCM設定を取得する
  if (!account) {	// FCM設定がない場合を記録する
    recordAndroidPushLog(ss, toUserId, "設定不足", "FCM_SERVICE_ACCOUNT_JSONまたはFCM設定プロパティがありません");	// 診断情報を残す
    return;	// 設定前はWeb版の動作を変更しない
  }	// FCM設定確認を閉じる
  const deviceSheet = ss.getSheetByName("Android通知");	// 登録済み端末のシートを取得する
  if (!deviceSheet || deviceSheet.getLastRow() <= 1) {	// 通知先がない場合を記録する
    recordAndroidPushLog(ss, toUserId, "送信先なし", "Android通知シートに端末登録がありません");	// 診断情報を残す
    return;	// 通知先がなければ終了する
  }	// 通知先確認を閉じる
  const accessToken = getFcmAccessToken(account);	// FCM API用の認証トークンを取得する
  if (!accessToken) {	// FCM認証に失敗した場合を記録する
    recordAndroidPushLog(ss, toUserId, "認証失敗", "FCMアクセストークンを取得できませんでした");	// 診断情報を残す
    return;	// 認証できない場合はチャット成功を優先する
  }	// FCM認証確認を閉じる

  const rows = deviceSheet.getRange(2, 1, deviceSheet.getLastRow() - 1, 5).getValues();	// 通知先を読み込む
  const targets = rows.filter(row => cleanCell(row[0]) === cleanCell(toUserId) && cleanCell(row[1]) && cleanCell(row[4]) !== "無効");	// 対象ユーザーの有効端末だけに絞る
  if (targets.length === 0) {	// 対象端末がない場合を記録する
    recordAndroidPushLog(ss, toUserId, "送信先なし", "対象UserIDの有効なFCMトークンがありません");	// 診断情報を残す
    return;	// 送信先がなければ終了する
  }	// 対象端末確認を閉じる
  const endpoint = "https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(account.projectId) + "/messages:send";	// FCM送信先を作る
  targets.forEach(row => {	// 複数端末へ順番に送信する
    const payload = {
      message: {
        token: cleanCell(row[1]),
        notification: {
          title: cleanCell(title).slice(0, 100),
          body: cleanCell(body).slice(0, 240)
        },
        data: {
          type: "chat_message",
          title: cleanCell(title).slice(0, 100),
          body: cleanCell(body).slice(0, 240),
          openChat: "true",
          chatTargetUserId: cleanCell(chatTargetUserId)
        },
        android: { priority: "HIGH" }
      }
    };	// Androidアプリが通知タップ先を判断できるデータを作る
    try {	// 端末ごとの送信失敗に備える
      const response = UrlFetchApp.fetch(endpoint, {	// FCMへ通知を送信する
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + accessToken },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });	// FCM応答を取得する
      const code = response.getResponseCode();	// 応答コードを取得する
      if (code < 200 || code >= 300) {	// 送信失敗を確認する
        const responseText = response.getContentText();	// エラー内容を取得する
        console.error("FCM通知送信失敗", code, responseText.slice(0, 500));	// 送信失敗を記録する
        recordAndroidPushLog(ss, toUserId, "送信失敗", `${code}: ${responseText.slice(0, 500)}`);	// 診断情報を残す
        if (/UNREGISTERED|INVALID_ARGUMENT/.test(responseText)) markAndroidDeviceTokenInvalid(deviceSheet, row[1]);	// 期限切れトークンを無効化する
      } else {	// 送信成功を記録する
        recordAndroidPushLog(ss, toUserId, "送信成功", `HTTP ${code}`);	// 診断情報を残す
      }	// 送信失敗確認を閉じる
    } catch (error) {	// 端末単位の通信エラーに備える
      console.error("FCM通知送信エラー", error);	// チャット送信には影響させない
      recordAndroidPushLog(ss, toUserId, "送信エラー", String(error && error.message ? error.message : error).slice(0, 500));	// 診断情報を残す
    }	// 端末送信を閉じる
  });	// 端末送信を完了する
}	// Android通知送信を閉じる

function recordAndroidPushLog(ss, toUserId, status, detail) {	// Android通知の診断結果を記録する
  try {	// 診断記録の失敗でチャットを止めない
    const logSheet = getOrCreateSheet(ss, "Android通知ログ", ["記録日時", "対象UserID", "結果", "詳細"]);	// 診断用シートを用意する
    logSheet.appendRow([new Date(), safeSheetText(toUserId, 128), safeSheetText(status, 32), safeSheetText(detail, 1000)]);	// 診断結果を追加する
  } catch (error) {	// 記録自体の失敗を処理する
    console.error("Android通知ログの記録失敗", error);	// GAS実行ログへ残す
  }	// 診断記録を閉じる
}	// Android通知診断を閉じる

function markAndroidDeviceTokenInvalid(deviceSheet, fcmToken) {	// 無効になったFCMトークンを次回送信対象から外す
  if (!deviceSheet || deviceSheet.getLastRow() <= 1) return;	// シートがなければ終了する
  const tokens = deviceSheet.getRange(2, 2, deviceSheet.getLastRow() - 1, 1).getValues();	// トークン一覧を取得する
  const index = tokens.findIndex(row => cleanCell(row[0]) === cleanCell(fcmToken));	// 対象トークンを探す
  if (index >= 0) deviceSheet.getRange(index + 2, 5).setValue("無効");	// 対象端末を無効化する
}	// 無効トークン処理を閉じる

function revokeAndroidDeviceToken(deviceSheet, userId, fcmToken) {	// ログアウトしたユーザーの端末通知を無効化する
  const rows = deviceSheet.getRange(2, 1, deviceSheet.getLastRow() - 1, 5).getValues();	// 登録端末を読み込む
  rows.forEach((row, index) => {	// 対象端末を順番に確認する
    if (cleanCell(row[0]) === cleanCell(userId) && cleanCell(row[1]) === cleanCell(fcmToken)) {	// 本人の同じトークンだけを対象にする
      deviceSheet.getRange(index + 2, 5).setValue("無効");	// 次回以降の通知対象から外す
    }	// 対象確認を閉じる
  });	// 端末確認を完了する
}	// Android端末解除を閉じる

function sendLineNotification(toUserId, messageText) {	// 関数を定義
  if (!LINE_ACCESS_TOKEN || LINE_ACCESS_TOKEN.includes("ここに")) return;	// 条件に応じて処理を分ける

  const url = "https://api.line.me/v2/bot/message/push";	// 定数を定義

  const payload = {	// 定数を定義
    to: toUserId,	// 処理を続ける
    messages: [	// 処理を続ける
      {	// 処理のまとまりを始める
        type: "text",	// 処理を続ける
        text: messageText	// 処理を続ける
      }	// 処理のまとまりを閉じる
    ]	// 処理を続ける
  };	// 処理のまとまりを閉じる

  const options = {	// 定数を定義
    method: "post",	// 処理を続ける
    headers: {	// 処理のまとまりを始める
      "Content-Type": "application/json",	// 処理を続ける
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN	// 処理を続ける
    },	// 処理のまとまりを閉じる
    payload: JSON.stringify(payload),	// 処理を続ける
    muteHttpExceptions: true	// 処理を続ける
  };	// 処理のまとまりを閉じる

  try {	// 失敗に備えて処理を始める
    UrlFetchApp.fetch(url, options);	// APIへリクエストを送る
  } catch (e) {	// 処理のまとまりを始める
    console.error("LINE通知エラー:", e);	// 処理を完了する
  }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function replyLineMessage(replyToken, messageText) {	// 関数を定義
  if (!LINE_ACCESS_TOKEN || !replyToken) {	// 条件に応じて処理を分ける
    console.log("エラー: アクセストークンまたはreplyTokenがありません");	// 処理を完了する
    return;	// 結果を返す
  }	// 処理のまとまりを閉じる

  const url = "https://api.line.me/v2/bot/message/reply";	// 定数を定義

  const payload = {	// 定数を定義
    replyToken: replyToken,	// 処理を続ける
    messages: [	// 処理を続ける
      {	// 処理のまとまりを始める
        type: "text",	// 処理を続ける
        text: messageText	// 処理を続ける
      }	// 処理のまとまりを閉じる
    ]	// 処理を続ける
  };	// 処理のまとまりを閉じる

  const options = {	// 定数を定義
    method: "post",	// 処理を続ける
    headers: {	// 処理のまとまりを始める
      "Content-Type": "application/json",	// 処理を続ける
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN	// 処理を続ける
    },	// 処理のまとまりを閉じる
    payload: JSON.stringify(payload),	// 処理を続ける
    muteHttpExceptions: true	// 処理を続ける
  };	// 処理のまとまりを閉じる

  try {	// 失敗に備えて処理を始める
    const response = UrlFetchApp.fetch(url, options);	// 定数を定義
    console.log("LINE APIレスポンスコード: " + response.getResponseCode());	// 処理を完了する
    console.log("LINE APIレスポンス内容: " + response.getContentText());	// 処理を完了する
  } catch (e) {	// 処理のまとまりを始める
    console.error("LINE返信エラー:", e);	// 処理を完了する
  }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる
