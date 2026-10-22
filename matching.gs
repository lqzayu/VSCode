function doGet(e) {
  return createRes("success", "GAS API is working");
}

const SITE_URL = "https://lqzayu.github.io/VSCode/";
const FIREBASE_DATABASE_URL = PropertiesService.getScriptProperties().getProperty("FIREBASE_DATABASE_URL") || "https://heiko-matching-chat-default-rtdb.asia-southeast1.firebasedatabase.app";

const ADMIN_USER_ID = "admin";
const RECRUITMENT_DURATION_MINUTES = [15, 30, 45, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200, 1260, 1320, 1380, 1440];
const ONLINE_TIMEOUT_MS = 90 * 1000;
const AI_DAILY_LIMIT = 5;
const AI_SESSION_LIMIT = 2;
const USER_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SCHOOL_GRADES = ["1年", "2年", "3年"];
const SCHOOL_DEPARTMENTS = ["機械工学科", "電気工学科", "制御工学科", "土木環境工学科", "情報工学科"];

const LINE_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("LINE_ACCESS_TOKEN") || "";
const GEMINI_MODEL = PropertiesService.getScriptProperties().getProperty("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const USAGE_LOG_HEADERS = ["記録日時", "日付", "匿名ユーザーキー", "機能", "操作", "結果", "処理時間(ms)", "エラー内容"]; // 利用ログの見出しを定義する
const DAILY_ANALYSIS_HEADERS = ["日付", "ユニーク利用者数", "イベント数", "成功数", "失敗数", "ログイン関連数", "募集関連数", "チャット関連数", "AI相談数", "顔認証関連数", "LINE関連数", "通報・ブロック関連数", "エラー数", "平均処理時間(ms)", "処理時間合計(ms)", "処理時間件数", "最終更新", "利用者キーJSON"]; // 日別分析の見出しを定義する

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createRes("success", "VERIFIED_OK");
    }

    const rawData = e.postData.contents;
    let data;
    try {
      data = JSON.parse(rawData);
    } catch (parseError) {
      return createRes("error", "JSONの形式が正しくありません");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetsByName = {};
    ss.getSheets().forEach(sheet => { sheetsByName[sheet.getName()] = sheet; });

    const sheetUser = sheetsByName["シート1"] || null;
    const sheetRecruit = sheetsByName["募集"] || null;
    const sheetChat = sheetsByName["チャット"] || null;
    const sheetChatCopy = sheetsByName["chat-copy"] || null;
    const sheetOnline = sheetsByName["オンライン状況"] || null;
    const sheetHiddenChat = sheetsByName["チャット非表示"] || null;
    const sheetBlock = sheetsByName["ブロック"] || null;
    const sheetReport = sheetsByName["通報"] || null;
    const sheetLineLink = sheetsByName["LINE連携"] || null;

    if (Array.isArray(data.events)) {
      const lineData = data;

      if (lineData.events && lineData.events.length === 0) {
        return createRes("success", "EMPTY_EVENT_OK");
      }

      if (lineData.events && lineData.events.length > 0) {
        const rows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];
        lineData.events.forEach(event => {
          const lineUserId = event.source ? event.source.userId : "";
          const replyToken = event.replyToken;

          if (event.type === "message" && event.message && event.message.type === "text" && rows.length > 1) {
            const inputText = event.message.text.trim().toUpperCase();
            let matchedUserIndex = -1;
            let matchedUserName = "";
            let matchedLinkRow = -1;

            const linkRows = sheetLineLink && sheetLineLink.getLastRow() > 1 ? sheetLineLink.getDataRange().getValues() : [];
            for (let i = linkRows.length - 1; i >= 1; i--) {
              const code = cleanCell(linkRows[i][1]).toUpperCase();
              const expiresAt = new Date(linkRows[i][2]).getTime();
              const used = cleanCell(linkRows[i][3]) !== "未使用";
              if (code !== inputText || used || !expiresAt || Date.now() > expiresAt) continue;
              const targetUserId = cleanCell(linkRows[i][0]);
              const targetIndex = rows.findIndex((row, index) => index > 0 && cleanCell(row[0]) === targetUserId);
              if (targetIndex < 0) continue;
              matchedUserIndex = targetIndex + 1;
              matchedUserName = getUserDisplayName(rows[targetIndex], targetUserId);
              matchedLinkRow = i + 1;
              break;
            }

            if (matchedUserIndex !== -1) {
              sheetUser.getRange(matchedUserIndex, 12).setValue(lineUserId);
              if (matchedLinkRow !== -1) sheetLineLink.getRange(matchedLinkRow, 4).setValue("使用済み");
              const successMsg = `✅ 【平工マッチング】LINE連携完了\n\n${matchedUserName} さんのアカウントとLINEの連携が成功しました！\n今後はメッセージが届いた際に通知をお届けします。`;
              replyLineMessage(replyToken, successMsg);
            } else {
              const errorMsg = `⚠️ 有効な連携コードを確認できませんでした。\n\nマイページで新しいLINE連携コードを発行し、10分以内に送信してください。`;
              replyLineMessage(replyToken, errorMsg);
            }
          }
        });
      }

      return createRes("success", "LINE_WEBHOOK_PROCESSED");
    }

    const mode = data.mode;

    const publicModes = ["register", "verifyEmail", "resendVerificationCode", "login", "verify_face_1toN", "verify_face_for_user", "forgotPassword", "resetPassword"];
    const adminModes = ["adminGetOverview", "adminDeletePost", "adminBanUser", "adminClearChatHistory", "getReports", "updateReportStatus", "getDailyAnalysis"];
    if (!publicModes.includes(mode) && !adminModes.includes(mode)) {
      const actorId = getRequestActorId(mode, data);
      const adminProfileRequest = mode === "getUserProfile" && isAdminRequest(data);
      if (!adminProfileRequest && (!actorId || !isAuthenticatedUserRequest(data, actorId, sheetUser))) {
        return createRes("error", "ログインの有効期限が切れました。もう一度ログインしてください");
      }
    }

    if (mode === "refreshAdminToken") {
      const userId = cleanCell(data.userId);
      if (userId !== ADMIN_USER_ID) return createRes("error", "管理者権限がありません。再ログインしてください");
      return createRes("success", { adminToken: createAdminSessionToken() });
    }

    if (mode === "heartbeat") {
      const userId = String(data.userId || "").trim();
      if (!userId) return createRes("error", "ユーザーが見つかりません");

      const onlineSheet = sheetOnline || getOrCreateSheet(ss, "オンライン状況", ["UserID", "最終アクセス"]);
      touchOnlineUser(onlineSheet, userId);
      return createRes("success", "HEARTBEAT_OK");
    }

    if (mode === "firebaseCustomToken") {
      const userId = cleanCell(data.userId);
      if (!userId || !userExists(sheetUser, userId)) return createRes("error", "ユーザーが見つかりません");
      const token = createFirebaseCustomToken(userId);
      if (!token) return createRes("error", "Firebase接続の設定がまだ完了していません");
      return createRes("success", { token: token, expiresIn: 3600 });
    }

    if (mode === "registerAndroidDevice") {
      const userId = cleanCell(data.userId);
      const fcmToken = cleanCell(data.fcmToken).slice(0, 4096);
      const platform = cleanCell(data.platform).slice(0, 32) || "android";
      if (!userId || !userExists(sheetUser, userId)) return createRes("error", "ユーザーが見つかりません");
      if (!fcmToken || fcmToken.length < 20) return createRes("error", "通知設定を確認できませんでした");

      const deviceSheet = getOrCreateSheet(ss, "Android通知", ["UserID", "FCMトークン", "プラットフォーム", "更新日時", "状態"]);
      upsertAndroidDeviceToken(deviceSheet, userId, fcmToken, platform);
      return createRes("success", "ANDROID_DEVICE_REGISTERED");
    }

    if (mode === "unregisterAndroidDevice") {
      const userId = cleanCell(data.userId);
      const fcmToken = cleanCell(data.fcmToken).slice(0, 4096);
      if (!userId || !fcmToken) return createRes("error", "通知設定を確認できませんでした");
      const deviceSheet = ss.getSheetByName("Android通知");
      if (deviceSheet && deviceSheet.getLastRow() > 1) revokeAndroidDeviceToken(deviceSheet, userId, fcmToken);
      return createRes("success", "ANDROID_DEVICE_UNREGISTERED");
    }

    if (mode === "recordUsageLog") {
      const saved = saveUsageLog(ss, data);
      return createRes("success", saved);
    }

    if (mode === "recordUsageLogs") {
      const saved = saveUsageLogs(ss, data);
      return createRes("success", saved);
    }

    if (mode === "getDailyAnalysis") {
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");
      return createRes("success", getDailyAnalysisRows(ss, data.days));
    }

    if (mode === "createLineLinkCode") {
      const userId = cleanCell(data.userId);
      if (!userExists(sheetUser, userId)) return createRes("error", "ユーザーが見つかりません");
      if (!claimCooldown("line-link-code-" + userId, 20)) return createRes("error", "連携コードは20秒後に再発行できます");
      const linkSheet = sheetLineLink || getOrCreateSheet(ss, "LINE連携", ["UserID", "連携コード", "有効期限", "状態"]);
      const code = generateLineLinkCode(linkSheet);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      if (linkSheet.getLastRow() > 1) {
        const linkRows = linkSheet.getRange(2, 1, linkSheet.getLastRow() - 1, 4).getValues();
        const staleRanges = [];
        for (let i = 0; i < linkRows.length; i++) {
          if (cleanCell(linkRows[i][0]) === userId && cleanCell(linkRows[i][3]) === "未使用") staleRanges.push(`D${i + 2}`);
        }
        if (staleRanges.length > 0) linkSheet.getRangeList(staleRanges).setValue("無効");
      }
      linkSheet.appendRow([userId, code, expiresAt, "未使用"]);
      return createRes("success", { code: code, expiresAt: expiresAt.getTime() });
    }

    if (mode === "unlinkLineAccount") {
      const userId = cleanCell(data.userId);
      if (!userExists(sheetUser, userId)) return createRes("error", "ユーザーが見つかりません");
      const userRows = sheetUser.getDataRange().getValues();
      const userRowIndex = userRows.findIndex((row, index) => index > 0 && cleanCell(row[0]) === userId);
      if (userRowIndex < 1) return createRes("error", "ユーザーが見つかりません");
      sheetUser.getRange(userRowIndex + 1, 12).setValue("");
      if (sheetLineLink && sheetLineLink.getLastRow() > 1) {
        const linkRows = sheetLineLink.getRange(2, 1, sheetLineLink.getLastRow() - 1, 4).getValues();
        const staleRanges = [];
        for (let i = 0; i < linkRows.length; i++) {
          if (cleanCell(linkRows[i][0]) === userId && cleanCell(linkRows[i][3]) === "未使用") staleRanges.push(`D${i + 2}`);
        }
        if (staleRanges.length > 0) sheetLineLink.getRangeList(staleRanges).setValue("無効");
      }
      return createRes("success", "LINE_UNLINKED");
    }

    if (mode === "getUserProfile") {
      const identifiers = [data.userId, data.email].map(value => String(value || "").trim()).filter(Boolean);
      if (identifiers.length === 0 || !sheetUser || sheetUser.getLastRow() <= 1) {
        return createRes("error", "ユーザーが見つかりません");
      }

      const rows = sheetUser.getDataRange().getValues();
      let userRow = null;
      for (const identifier of identifiers) {
        userRow = findUserRow(rows, identifier);
        if (userRow) break;
      }
      if (!userRow) return createRes("error", "ユーザーが見つかりません");

      const profileResult = {
        userId: cleanCell(userRow[0]),
        email: cleanCell(userRow[5]) || cleanCell(userRow[0]),
        name: cleanCell(userRow[2]),
        profileImage: cleanCell(userRow[4]),
        grade: cleanCell(userRow[13]),
        dept: cleanCell(userRow[14]),
        lineLinked: Boolean(cleanCell(userRow[11]))
      };
      if (isAdminRequest(data)) profileResult.sessionToken = createUserSessionToken(cleanCell(userRow[0]), cleanCell(userRow[12]));
      return createRes("success", profileResult);
    }

    if (mode === "getUserProfiles") {
      const userId = cleanCell(data.userId);
      const targetUserIds = Array.isArray(data.targetUserIds) ? data.targetUserIds.map(cleanCell).filter(Boolean).slice(0, 50) : [];
      if (!userId || targetUserIds.length === 0 || !sheetUser || sheetUser.getLastRow() <= 1) return createRes("success", []);
      const rows = sheetUser.getDataRange().getValues();
      const profiles = targetUserIds.map(targetId => {
        const row = findUserRow(rows, targetId);
        return { userId: targetId, name: getUserDisplayName(row, targetId) };
      });
      return createRes("success", profiles);
    }

    if (mode === "aiStudyChat") {
      const userId = cleanCell(data.userId);
      const message = cleanCell(data.message);
      const requestId = cleanCell(data.requestId).slice(0, 100);
      if (!userId || !userExists(sheetUser, userId)) return createRes("error", "ログイン情報を確認できませんでした");
      if (!message || message.length > 1500) return createRes("error", "相談内容は1500文字以内で入力してください");
      if (!requestId) return createRes("error", "送信情報を確認できませんでした。ページを再読み込みしてください");

      const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
      if (!apiKey) return createRes("error", "AI機能の設定がまだ完了していません。管理者にAPIキーの設定を確認してください");

      const aiSheet = getOrCreateSheet(ss, "AIログ", [
        "記録日時", "ResponseID", "UserID", "セッションID", "教科", "目標", "困っていること",
        "勉強可能時間", "好み", "相談内容", "AI回答", "評価", "評価コメント", "推薦タイプ", "モデル", "段階", "RequestID"
      ]);
      if (!aiSheet.getRange(1, 16).getValue()) aiSheet.getRange(1, 16).setValue("段階");
      if (!aiSheet.getRange(1, 17).getValue()) aiSheet.getRange(1, 17).setValue("RequestID");

      const savedRequest = findAiRequest(aiSheet, userId, requestId);
      if (savedRequest) return createRes("success", savedRequest);

      const cache = CacheService.getScriptCache();
      const requestKey = "ai-request-" + userId.slice(0, 64) + "-" + requestId;
      const requestState = cache.get(requestKey);
      if (requestState) {
        try {
          const state = JSON.parse(requestState);
          if (state.state === "done" && state.message) return createRes("success", state.message);
          if (state.state === "processing") return createRes("success", { pending: true });
        } catch (e) {
          cache.remove(requestKey);
        }
      }

      const rateKey = "ai-study-" + userId;
      if (cache.get(rateKey)) return createRes("error", "短時間に続けて送信できません。少し待ってから送信してください");
      const sessionId = cleanCell(data.sessionId).slice(0, 100);
      const inFlightKey = "ai-user-inflight-" + userId.slice(0, 64);
      const aiLock = LockService.getScriptLock();
      if (!aiLock.tryLock(5000)) return createRes("error", "AI相談が混み合っています。少し待ってからお試しください");
      let sessionUsage;
      try {
        if (cache.get(inFlightKey)) {
          if (cache.get(inFlightKey) === requestId) return createRes("success", { pending: true });
          return createRes("error", "前のAI相談を処理中です。回答が表示されるまでお待ちください");
        }
        const dailyUsage = getAiDailyUsage(aiSheet, userId);
        if (dailyUsage >= AI_DAILY_LIMIT) return createRes("error", "本日のAI相談回数の上限に達しました。明日また利用できます");
        sessionUsage = getAiSessionUsage(aiSheet, userId, sessionId);
        if (sessionUsage === 0 && dailyUsage > AI_DAILY_LIMIT - 2) return createRes("error", "本日の残り回数ではおすすめまで完了できないため、明日また利用してください");
        if (sessionUsage >= AI_SESSION_LIMIT) return createRes("error", "この相談は完了しています。新しい相談を始める場合は、明日また利用してください");
        cache.put(inFlightKey, requestId, 120);
        cache.put(requestKey, JSON.stringify({ state: "processing" }), 120);
        cache.put(rateKey, "1", 4);
      } finally {
        if (aiLock.hasLock()) aiLock.releaseLock();
      }

      try {
        const profile = normalizeAiStudyProfile(data.profile);
        const feedbackProfile = getAiFeedbackProfile(aiSheet, userId);
        const analysis = buildStudyRecommendationProfile(profile, message, feedbackProfile);
        const history = normalizeAiHistory(data.history);
        const stage = sessionUsage + 1;
        const answer = callGeminiStudyAdvisor(apiKey, profile, analysis, history, message, stage, feedbackProfile);
        if (!answer) return createRes("error", "AIから回答を受け取れませんでした。しばらくしてから再度お試しください");
        const responseId = Utilities.getUuid();
        aiSheet.appendRow([
          new Date(), responseId, userId, sessionId, safeSheetText(profile.subject, 50),
          safeSheetText(profile.goal, 300), safeSheetText(profile.challenge, 300), safeSheetText(profile.minutes, 30), safeSheetText(profile.preference, 100), safeSheetText(message, 2000),
          safeSheetText(answer, 20000), "", "", safeSheetText(analysis.label, 100), safeSheetText(GEMINI_MODEL, 100), stage, requestId
        ]);
        const responseMessage = {
          responseId: responseId,
          reply: answer,
          analysis: analysis,
          stage: stage,
          completed: stage >= 2,
          dailyRemaining: Math.max(0, AI_DAILY_LIMIT - getAiDailyUsage(aiSheet, userId))
        };
        cache.put(requestKey, JSON.stringify({ state: "done", message: responseMessage }), 120);
        return createRes("success", responseMessage);
      } catch (aiError) {
        console.error("AI相談の処理に失敗しました", aiError);
        return createRes("error", "AI相談の保存に失敗しました。少し待ってからもう一度お試しください");
      } finally {
        cache.remove(inFlightKey);
        if (cache.get(requestKey)) {
          try { if (JSON.parse(cache.get(requestKey)).state === "processing") cache.remove(requestKey); } catch (cacheError) { cache.remove(requestKey); }
        }
      }
    }

    if (mode === "aiStudyFeedback") {
      const userId = cleanCell(data.userId);
      const responseId = cleanCell(data.responseId);
      const rating = data.rating === "helpful" ? "helpful" : data.rating === "not_helpful" ? "not_helpful" : "";
      if (!userId || !responseId || !rating) return createRes("error", "評価内容が正しくありません");
      const reasonLabels = {
        helpful: "役に立った",
        too_difficult: "難しすぎる",
        too_easy: "簡単すぎる",
        not_matched: "自分の状況に合わない",
        another_method: "別の方法を試したい"
      };
      const reason = rating === "helpful" ? "helpful" : cleanCell(data.reason);
      if (!reasonLabels[reason]) return createRes("error", "評価理由を選択してください");

      const aiSheet = ss.getSheetByName("AIログ");
      if (!aiSheet || aiSheet.getLastRow() <= 1) return createRes("error", "評価対象が見つかりません");
      const rows = aiSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (cleanCell(rows[i][1]) === responseId && cleanCell(rows[i][2]) === userId) {
          aiSheet.getRange(i + 1, 12).setValue(rating);
          aiSheet.getRange(i + 1, 13).setValue(safeSheetText(reasonLabels[reason], 100));
          CacheService.getScriptCache().remove("ai-feedback-" + userId.slice(0, 100));
          return createRes("success", "FEEDBACK_SAVED");
        }
      }
      return createRes("error", "評価対象が見つかりません");
    }

    if (mode === "adminGetOverview") {
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");

      const userRows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];
      let users = [];
      for (let i = 1; i < userRows.length; i++) {
        users.push({
          userId: userRows[i][0],
          name: userRows[i][2] || "未設定",
          email: userRows[i][5] || "",
          isVerified: userRows[i][6] === true
        });
      }

      const recruitRows = sheetRecruit && sheetRecruit.getLastRow() > 1 ? sheetRecruit.getDataRange().getValues() : [];
      let posts = [];
      for (let j = 1; j < recruitRows.length; j++) {
        posts.push({
          rowIndex: j + 1,
          name: recruitRows[j][0],
          grade: recruitRows[j][1],
          dept: recruitRows[j][2],
          content: recruitRows[j][3],
          time: recruitRows[j][4],
          email: recruitRows[j][5],
          tags: recruitRows[j][6] || ""
        });
      }

      const onlineUserIds = getOnlineUserIds(sheetOnline).filter(userId => userId !== ADMIN_USER_ID);

      return createRes("success", {
        users: users,
        posts: posts,
        onlineCount: onlineUserIds.length
      });
    }

    if (mode === "adminDeletePost") {
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");
      if (!sheetRecruit) return createRes("error", "シートが見つかりません");

      const targetEmail = data.targetEmail;
      const recruitRows = sheetRecruit.getDataRange().getValues();
      for (let k = recruitRows.length - 1; k >= 1; k--) {
        if (recruitRows[k][5] === targetEmail) {
          sheetRecruit.deleteRow(k + 1);
          return createRes("success", "POST_DELETED");
        }
      }
      return createRes("error", "対象の投稿が見つかりませんでした");
    }

    if (mode === "adminBanUser") {
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");
      if (!sheetUser) return createRes("error", "シートが見つかりません");

      const targetUserId = data.targetUserId;
      if (cleanCell(targetUserId) === ADMIN_USER_ID) return createRes("error", "管理者アカウントは凍結できません");
      const userRows = sheetUser.getDataRange().getValues();
      let targetEmail = "";
      let newStatus = false;
      let targetFound = false;

      for (let u = userRows.length - 1; u >= 1; u--) {
        if (userRows[u][0] === targetUserId) {
          targetEmail = userRows[u][5];
          targetFound = true;
          const currentStatus = userRows[u][6] === true;
          newStatus = !currentStatus;

          ensureUserSessionColumn(sheetUser);
          sheetUser.getRange(u + 1, 7).setValue(newStatus);
          sheetUser.getRange(u + 1, 13).setValue(Utilities.getUuid());
          break;
        }
      }

      if (!targetFound) return createRes("error", "対象ユーザーが見つかりません");
      const revokedKey = "revoked-user-" + cleanCell(targetUserId);
      if (newStatus) CacheService.getScriptCache().remove(revokedKey);
      else CacheService.getScriptCache().put(revokedKey, "1", Math.floor(USER_SESSION_DURATION_MS / 1000));

      if (!newStatus && targetEmail && sheetRecruit && sheetRecruit.getLastRow() > 1) {
        const recruitRows = sheetRecruit.getDataRange().getValues();
        for (let r = recruitRows.length - 1; r >= 1; r--) {
          if (recruitRows[r][5] === targetEmail) {
            sheetRecruit.deleteRow(r + 1);
          }
        }
      }

      return createRes("success", newStatus ? "USER_UNBANNED" : "USER_BANNED");
    }

    if (mode === "adminClearChatHistory") {
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");

      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) return createRes("error", "別の管理処理が実行中です。少し待ってからもう一度お試しください");

      try {
        clearFirebaseChatData();
        const chatRows = clearChatDataRows(sheetChat);
        const hiddenChatRows = clearChatDataRows(sheetHiddenChat);
        return createRes("success", {
          code: "CHAT_HISTORY_CLEARED",
          chatRows: chatRows,
          hiddenChatRows: hiddenChatRows,
          archivePreserved: Boolean(sheetChatCopy)
        });
      } catch (clearError) {
        console.error("チャット履歴一括消去失敗", clearError);
        return createRes("error", "チャット履歴を消去できませんでした。データは一部だけ消去されていない可能性があります");
      } finally {
        if (lock.hasLock()) lock.releaseLock();
      }
    }

    if (mode === "register") {
      if (!sheetUser) return createRes("error", "シートが存在しません");
      if (!data.userId || !data.email || !data.password) {
        return createRes("error", "必要な項目が入力されていません");
      }
      const registerUserId = cleanCell(data.userId);
      const registerEmail = cleanCell(data.email).toLowerCase();
      if (!isSafeIdentifier(registerUserId)) return createRes("error", "ユーザーIDに使用できない文字が含まれています");
      if (registerUserId.toLowerCase() === ADMIN_USER_ID) return createRes("error", "このユーザーIDは使用できません");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail)) return createRes("error", "メールアドレスの形式を確認してください");
      const passwordError = validatePasswordPolicy(data.password);
      if (passwordError) return createRes("error", passwordError);
      if (String(data.userId).length > 64 || String(data.email).length > 254 || String(data.name || "").length > 50) {
        return createRes("error", "ユーザー情報の文字数が上限を超えています");
      }
      if (data.faceFeatures && !isValidFaceFeatures(data.faceFeatures)) {
        return createRes("error", "顔情報の形式が正しくないか、データが大きすぎます");
      }
      if (!claimCooldown("register-mail-" + registerUserId, 60)) return createRes("error", "認証メールは1分後に再送できます");

      const rows = sheetUser.getLastRow() > 0 ? sheetUser.getDataRange().getValues() : [];
      let existingRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (cleanCell(rows[i][0]) === registerUserId) {
          existingRowIndex = i + 1;
        }
        if (i > 0 && cleanCell(rows[i][5]).toLowerCase() === registerEmail && cleanCell(rows[i][0]) !== registerUserId) return createRes("error", "このメールアドレスは既に使用されています");
      }

      if (existingRowIndex !== -1 && rows[existingRowIndex - 1][6] === true) {
        return createRes("error", "このユーザーIDは既に登録されています");
      }
      if (existingRowIndex !== -1 && cleanCell(rows[existingRowIndex - 1][5]).toLowerCase() !== registerEmail) return createRes("error", "このユーザーIDは既に仮登録されています");

      const code = generateVerificationCode();
      const expiry = new Date().getTime() + (10 * 60 * 1000);

      const rowData = [
        registerUserId,
        hashPassword(data.password),
        safeSheetText(data.name || "ユーザー", 50),
        data.faceFeatures || "",
        "",
        registerEmail,
        false,
        code,
        expiry,
        "",
        "",
        "",
        Utilities.getUuid(),
        "",
        ""
      ];

      const registerLock = LockService.getScriptLock();
      if (!registerLock.tryLock(5000)) return createRes("error", "登録処理が混み合っています。少し待ってからもう一度お試しください");
      try {
        ensureUserSchoolColumns(sheetUser);
        const latestRows = sheetUser.getLastRow() > 0 ? sheetUser.getDataRange().getValues() : [];
        let latestExistingRowIndex = -1;
        for (let i = 1; i < latestRows.length; i++) {
          const savedUserId = cleanCell(latestRows[i][0]);
          const savedEmail = cleanCell(latestRows[i][5]).toLowerCase();
          if (savedEmail && savedEmail === registerEmail.toLowerCase() && savedUserId !== registerUserId) {
            return createRes("error", "このメールアドレスは既に登録されています");
          }
          if (savedUserId === registerUserId) latestExistingRowIndex = i + 1;
        }
        if (latestExistingRowIndex !== -1 && latestRows[latestExistingRowIndex - 1][6] === true) {
          return createRes("error", "このユーザーIDは既に登録されています");
        }
        if (latestExistingRowIndex !== -1 && cleanCell(latestRows[latestExistingRowIndex - 1][5]).toLowerCase() !== registerEmail) return createRes("error", "このユーザーIDは既に仮登録されています");
        if (latestExistingRowIndex !== -1) {
          sheetUser.getRange(latestExistingRowIndex, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheetUser.appendRow(rowData);
        }
      } finally {
        if (registerLock.hasLock()) registerLock.releaseLock();
      }

      MailApp.sendEmail({
        to: registerEmail,
        name: "平工マッチング",
        subject: "【平工マッチング】認証コードのご案内",
        body: `平工マッチングにご登録いただきありがとうございます。\n\n以下の認証コードを、登録画面に入力してください。\n\n認証コード: ${code}\n\n（10分間有効です）`
      });

      return createRes("success", "CODE_SENT");
    }

    if (mode === "verifyEmail") {
      const userId = data.userId;
      const code = data.code;
      const verifyAttemptKey = "verify-attempt-" + cleanCell(userId);
      const verifyAttempts = Number(CacheService.getScriptCache().get(verifyAttemptKey) || 0);
      if (verifyAttempts >= 5) return createRes("error", "認証コードの入力回数が上限に達しました。10分後にもう一度お試しください");

      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");
      const rows = sheetUser.getDataRange().getValues();

      let userRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === userId) {
          userRowIndex = i + 1;
          break;
        }
      }
      if (userRowIndex === -1) return createRes("error", "ユーザーが見つかりません");

      const row = rows[userRowIndex - 1];

      if (row[6] === true) {
        return createRes("success", "ALREADY_VERIFIED");
      }

      const savedCode = row[7];
      const savedExpiry = row[8];

      if (!savedCode || savedCode.toString() !== code.toString()) {
        CacheService.getScriptCache().put(verifyAttemptKey, String(verifyAttempts + 1), 600);
        return createRes("error", "認証コードが間違っています");
      }
      if (!savedExpiry || new Date().getTime() > savedExpiry) {
        return createRes("error", "認証コードの有効期限が切れています。");
      }

      sheetUser.getRange(userRowIndex, 7).setValue(true);
      sheetUser.getRange(userRowIndex, 8).setValue("");
      sheetUser.getRange(userRowIndex, 9).setValue("");
      CacheService.getScriptCache().remove(verifyAttemptKey);

      return createRes("success", "VERIFIED");
    }

    if (mode === "resendVerificationCode") {
      const userId = data.userId;
      if (!claimCooldown("resend-code-" + cleanCell(userId), 60)) return createRes("error", "認証コードは1分後に再送できます");
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");
      const rows = sheetUser.getDataRange().getValues();

      let userRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === userId) {
          userRowIndex = i + 1;
          break;
        }
      }
      if (userRowIndex === -1) return createRes("error", "ユーザーが見つかりません");

      const row = rows[userRowIndex - 1];

      if (row[6] === true) return createRes("success", "ALREADY_VERIFIED");

      const email = row[5];
      const code = generateVerificationCode();
      const expiry = new Date().getTime() + (10 * 60 * 1000);

      sheetUser.getRange(userRowIndex, 8).setValue(code);
      sheetUser.getRange(userRowIndex, 9).setValue(expiry);

      MailApp.sendEmail({
        to: email,
        name: "平工マッチング",
        subject: "【平工マッチング】認証コードの再送",
        body: `認証コードを再送します。\n\n認証コード: ${code}`
      });

      return createRes("success", "CODE_RESENT");
    }

    if (mode === "login") {
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");
      const loginUserId = cleanCell(data.email).slice(0, 64);
      const loginAttemptKey = "login-attempt-" + loginUserId;
      const loginAttempts = getAttemptCount(loginAttemptKey);
      if (loginAttempts >= 10) return createRes("error", "ログイン試行回数が上限に達しました。10分後にもう一度お試しください");
      const rows = sheetUser.getDataRange().getValues();
      const userIndex = rows.findIndex((row, index) => index > 0 && cleanCell(row[0]) === loginUserId);
      const user = userIndex >= 0 ? rows[userIndex] : null;

      if (!user) {
        recordAttemptFailure(loginAttemptKey, loginAttempts, 600);
        return createRes("error", "ユーザーIDまたはパスワードが間違っています");
      }

      if (user[6] !== true) {
        return createRes("error", "メール認証が完了していません。");
      }

      const dbPassword = user[1] ? user[1].toString().trim() : "";
      const inputPassword = data.password ? data.password.toString().trim() : "";

      if (verifyPassword(dbPassword, inputPassword)) {
        clearAttemptFailures(loginAttemptKey);
        if (!dbPassword.startsWith("v2$")) sheetUser.getRange(userIndex + 1, 2).setValue(hashPassword(inputPassword));
        const loginResult = {
          userId: user[0],
          email: user[0],
          name: cleanCell(user[2]),
          profileImage: user[4] || ""
        };
        loginResult.sessionToken = createUserSessionToken(cleanCell(user[0]), cleanCell(user[12]));
        if (cleanCell(user[0]) === ADMIN_USER_ID) loginResult.adminToken = createAdminSessionToken();
        return createRes("success", loginResult);
      } else {
        recordAttemptFailure(loginAttemptKey, loginAttempts, 600);
        return createRes("error", "ユーザーIDまたはパスワードが間違っています");
      }
    }

    if (mode === "verify_face_1toN") {
      return createRes("error", "顔認証にはユーザーIDの入力が必要です。");
    }

    if (mode === "verify_face_for_user") {
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "登録データがありません");

      const userId = data.userId ? data.userId.toString().trim() : "";
      const currentLandmarks = data.currentFeatures;
      const currentSamples = Array.isArray(data.currentFeaturesSamples) ? data.currentFeaturesSamples : [];
      if (!userId) return createRes("error", "顔認証前にユーザーIDを入力してください。");
      const faceAttemptKey = "face-attempt-" + userId.slice(0, 64);
      const faceAttempts = getAttemptCount(faceAttemptKey);
      if (faceAttempts >= 5) return createRes("error", "顔認証の試行回数が上限に達しました。10分後にもう一度お試しください");
      if (!Array.isArray(currentLandmarks)) return createRes("error", "顔情報を取得できませんでした。");
      if (currentSamples.length < 2) return createRes("error", "顔情報を安定して取得できませんでした。もう一度お試しください。");

      const rows = sheetUser.getDataRange().getValues();
      const userRow = rows.find(row => row[0] && row[0].toString().trim() === userId);

      if (!userRow) return createRes("error", "ユーザーIDが見つかりません。");
      if (userRow[6] !== true) return createRes("error", "メール認証が完了していません。");
      if (!userRow[3]) return createRes("error", "このユーザーには顔情報が登録されていません。");

      try {
        const registeredLandmarks = JSON.parse(userRow[3]);
        const scores = currentSamples.map(sample => getFaceDistance(sample, registeredLandmarks));
        scores.push(getFaceDistance(currentLandmarks, registeredLandmarks));
        const validScores = scores.filter(score => score !== null).sort((a, b) => a - b);
        const passingScores = validScores.filter(score => score <= 0.06);
        const requiredPasses = Math.max(3, Math.ceil(validScores.length * 0.6));
        const claimedMedian = medianNumber(validScores);
        if (validScores.length < 3 || passingScores.length < requiredPasses || claimedMedian === null || claimedMedian > 0.06) {
          recordAttemptFailure(faceAttemptKey, faceAttempts, 600);
          return createRes("error", "顔情報が一致しませんでした。明るい場所で正面を向いて、もう一度お試しください。");
        }

        for (let i = 1; i < rows.length; i++) {
          if (rows[i] === userRow || rows[i][6] !== true || !rows[i][3]) continue;
          try {
            const otherLandmarks = JSON.parse(rows[i][3]);
            const otherScores = currentSamples.slice(0, 4).map(sample => getFaceDistance(sample, otherLandmarks)).filter(score => score !== null).sort((a, b) => a - b);
            const otherMedian = medianNumber(otherScores);
            if (otherScores.length >= 3 && otherMedian !== null && otherMedian <= claimedMedian + 0.003) {
              recordAttemptFailure(faceAttemptKey, faceAttempts, 600);
              return createRes("error", "安全のため顔だけでは本人を特定できませんでした。パスワードでログインしてください。");
            }
          } catch (otherFaceError) {
            console.warn("顔情報の比較を一件スキップしました", otherFaceError);
          }
        }

        const faceLoginResult = {
          userId: userRow[0],
          email: userRow[0],
          name: cleanCell(userRow[2]),
          profileImage: userRow[4] || ""
        };
        clearAttemptFailures(faceAttemptKey);
        faceLoginResult.sessionToken = createUserSessionToken(cleanCell(userRow[0]), cleanCell(userRow[12]));
        if (cleanCell(userRow[0]) === ADMIN_USER_ID) faceLoginResult.adminToken = createAdminSessionToken();
        return createRes("success", faceLoginResult);
      } catch (e) {
        recordAttemptFailure(faceAttemptKey, faceAttempts, 600);
        return createRes("error", "顔情報を確認できませんでした。");
      }
    }

    if (mode === "updateProfile") {
      const email = data.email;
      const name = data.name;
      const profileImage = data.profileImage;
      const grade = cleanCell(data.grade);
      const dept = cleanCell(data.dept);
      if (!cleanCell(name) || String(name).length > 50) return createRes("error", "表示名は50文字以内で入力してください");
      if (!SCHOOL_GRADES.includes(grade)) return createRes("error", "学年を選択してください");
      if (!SCHOOL_DEPARTMENTS.includes(dept)) return createRes("error", "学科を選択してください");
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");
      ensureUserSchoolColumns(sheetUser);
      const rows = sheetUser.getDataRange().getValues();

      let userRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === email) {
          userRowIndex = i + 1;
          break;
        }
      }

      if (userRowIndex !== -1) {
        if (profileImage && String(profileImage).length > 49000) {
          return createRes("error", "プロフィール画像のデータが大きすぎます。画像を選び直してください");
        }
        if (profileImage && !isSafeProfileImage(profileImage)) return createRes("error", "プロフィール画像の形式を確認してください");
        sheetUser.getRange(userRowIndex, 3).setValue(safeSheetText(name, 50));
        sheetUser.getRange(userRowIndex, 14, 1, 2).setValues([[grade, dept]]);
        if (profileImage) {
          sheetUser.getRange(userRowIndex, 5).setValue(profileImage);
        }
        return createRes("success", "PROFILE_UPDATED");
      } else {
        return createRes("error", "対象ユーザーが見つかりません");
      }
    }

    if (mode === "updateFaceFeatures") {
      const email = data.email;
      const faceFeatures = data.faceFeatures;
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");
      const rows = sheetUser.getDataRange().getValues();

      let userRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === email) {
          userRowIndex = i + 1;
          break;
        }
      }

      if (userRowIndex !== -1) {
        if (!isValidFaceFeatures(faceFeatures)) {
          return createRes("error", "顔情報の形式が正しくないか、データが大きすぎます");
        }
        sheetUser.getRange(userRowIndex, 4).setValue(faceFeatures);
        return createRes("success", "顔認証情報をアップデートしました");
      } else {
        return createRes("error", "対象ユーザーが見つかりません");
      }
    }

    if (mode === "getRecruitments") {
      if (!sheetRecruit || sheetRecruit.getLastRow() <= 1) return createRes("success", []);

      const recruitLastRow = sheetRecruit.getLastRow();
      const rows = sheetRecruit.getRange(1, 1, recruitLastRow, 8).getValues();
      const blockLastRow = sheetBlock ? sheetBlock.getLastRow() : 0;
      const blockRows = sheetBlock && blockLastRow > 1 ? sheetBlock.getRange(1, 1, blockLastRow, 4).getValues() : [];
      const blockedPairs = {};
      for (let i = 1; i < blockRows.length; i++) {
        if (blockRows[i][3] === "解除") continue;
        const first = cleanCell(blockRows[i][0]);
        const second = cleanCell(blockRows[i][1]);
        if (!first || !second) continue;
        blockedPairs[[first, second].sort().join("\u0001")] = true;
      }
      const now = Date.now();
      let list = [];

      for (let i = 1; i < rows.length; i++) {
        const postTime = new Date(rows[i][4]).getTime();

        if (Number.isNaN(postTime)) continue;

        const durationMinutes = normalizeRecruitmentDuration(rows[i][7]);
        const expiresAt = postTime + durationMinutes * 60 * 1000;

        const blockKey = [cleanCell(data.email), cleanCell(rows[i][5])].sort().join("\u0001");
        if (now < expiresAt && !blockedPairs[blockKey]) {
          list.push({
            name: rows[i][0],
            grade: rows[i][1],
            dept: rows[i][2],
            content: rows[i][3],
            time: postTime,
            email: rows[i][5],
            tags: rows[i][6] || "",
            durationMinutes: durationMinutes
          });
        }
      }

      return createRes("success", list);
    }

    if (mode === "postRecruitment") {
      if (!sheetRecruit) return createRes("error", "シートが存在しません");
      if (!cleanCell(data.content) || String(data.content).length > 2000) return createRes("error", "募集内容は2000文字以内で入力してください");
      if (String(data.tags || "").length > 500) return createRes("error", "タグが長すぎます");

      const requesterId = cleanCell(data.email);
      if (!requesterId || !sheetUser) return createRes("error", "ログイン情報を確認できませんでした");
      ensureUserSchoolColumns(sheetUser);
      const userRows = sheetUser.getDataRange().getValues();
      const requester = findUserRow(userRows, requesterId);
      if (!requester || requester[6] !== true) return createRes("error", "ログイン情報を確認できませんでした");
      const savedGrade = cleanCell(requester[13]);
      const savedDept = cleanCell(requester[14]);
      if (!SCHOOL_GRADES.includes(savedGrade) || !SCHOOL_DEPARTMENTS.includes(savedDept)) return createRes("error", "マイページで学年と学科を設定してから投稿してください");
      const savedName = getUserDisplayName(requester, requesterId);

      ensureRecruitmentDurationColumn(sheetRecruit);
      const rows = sheetRecruit.getLastRow() > 0 ? sheetRecruit.getDataRange().getValues() : [];
      let existingRowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][5] === requesterId) {
          existingRowIndex = i + 1;
          break;
        }
      }
      const durationMinutes = normalizeRecruitmentDuration(data.durationMinutes);
      const rowData = [safeSheetText(savedName, 50), safeSheetText(savedGrade, 30), safeSheetText(savedDept, 50), safeSheetText(data.content, 2000), new Date(), requesterId, safeSheetText(data.tags || "", 500), durationMinutes];

      if (existingRowIndex !== -1) {
        sheetRecruit.getRange(existingRowIndex, 1, 1, 8).setValues([rowData]);
        return createRes("success", "UPDATED");
      } else {
        sheetRecruit.appendRow(rowData);
        return createRes("success", "CREATED");
      }
    }

    if (mode === "deleteRecruitment") {
      if (!sheetRecruit || sheetRecruit.getLastRow() <= 1) return createRes("success", "NOT_FOUND");
      const rows = sheetRecruit.getDataRange().getValues();
      const myEmail = data.email;
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][5] === myEmail) {
          sheetRecruit.deleteRow(i + 1);
          return createRes("success", "DELETED");
        }
      }
      return createRes("success", "NOT_FOUND");
    }

    if (mode === "notifyFirebaseMessage") {
      const fromUser = cleanCell(data.from);
      const toUser = cleanCell(data.to);
      const messageText = cleanCell(data.text).slice(0, 2000);
      if (!fromUser || !toUser || fromUser === toUser || !messageText) return createRes("error", "通知情報が正しくありません");
      const userRows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];
      const senderRow = findUserRow(userRows, fromUser);
      const recipientRow = findUserRow(userRows, toUser);
      if (!senderRow || !recipientRow || isBlockedBetween(sheetBlock, fromUser, toUser)) return createRes("error", "通知対象を確認できません");
      const recipientLineId = cleanCell(recipientRow[11]);
      if (recipientLineId) sendLineNotification(recipientLineId, `💬【平工マッチング】新着メッセージ\n\n${getUserDisplayName(senderRow, fromUser)} さんからメッセージが届きました：\n「${messageText}」`);
      return createRes("success", "NOTIFIED");
    }

    if (mode === "sendMessage") {
      if (!sheetChat) return createRes("error", "チャットシートが存在しません");

      const fromUser = cleanCell(data.from);
      const toUser = cleanCell(data.to);
      const messageText = cleanCell(data.text);
      const requestId = cleanCell(data.requestId).slice(0, 100);
      if (!fromUser || !toUser || fromUser === toUser) return createRes("error", "送信先が正しくありません");
      if (!requestId || !/^[A-Za-z0-9._:-]+$/.test(requestId)) return createRes("error", "送信情報を確認できませんでした。ページを再読み込みしてください");
      if (messageText.length > 2000) return createRes("error", "メッセージは2000文字以内で入力してください");
      const messageUserRows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];
      const senderRow = findUserRow(messageUserRows, fromUser);
      const recipientRow = findUserRow(messageUserRows, toUser);
      if (!senderRow || !recipientRow) return createRes("error", "ユーザーが見つかりません");
      if (isBlockedBetween(sheetBlock, fromUser, toUser)) return createRes("error", "ブロック中の相手には送信できません");

      ensureChatColumns(sheetChat);
      if (sheetChatCopy) ensureChatColumns(sheetChatCopy);

      const attachmentInput = Array.isArray(data.attachments) ? data.attachments.slice(0, 8) : [];
      let attachmentUrls = [];

      if (!messageText && attachmentInput.length === 0) return createRes("error", "メッセージを入力してください");
      if (chatMessageExists(sheetChat, fromUser, requestId)) return createRes("success", "SENT");

      const lock = LockService.getScriptLock();
      let lockAcquired = false;
      try {
        if (attachmentInput.length > 0) {
          attachmentUrls = saveChatAttachments(attachmentInput, fromUser);
        }

        if (attachmentInput.length > 0 && attachmentUrls.length !== attachmentInput.length) {
          return createRes("error", "画像の保存に失敗しました。画像の容量またはDriveの共有設定を確認してください");
        }

        if (!messageText && attachmentUrls.length === 0) {
          return createRes("error", "画像を保存できませんでした。枚数や容量を確認してください");
        }

        for (let attempt = 0; attempt < 3 && !lockAcquired; attempt++) {
          lockAcquired = lock.tryLock(5000);
          if (!lockAcquired && attempt < 2) Utilities.sleep(250);
        }

        if (!lockAcquired) {
          deleteChatAttachmentUrls(attachmentUrls);
          return createRes("error", "チャットの保存処理が混み合っています。数秒後にもう一度お試しください");
        }

        if (chatMessageExists(sheetChat, fromUser, requestId)) {
          deleteChatAttachmentUrls(attachmentUrls);
          return createRes("success", "SENT");
        }

        const now = new Date();
        const messageId = requestId;
        const rowData = [fromUser, toUser, safeSheetText(messageText, 2000), now, "unread", messageId, "active", JSON.stringify(attachmentUrls)];

        appendChatRow(sheetChat, rowData);

        if (sheetChatCopy) {
          try {
            appendChatRow(sheetChatCopy, rowData);
          } catch (copyError) {
            console.error("chat-copyへのバックアップ保存失敗", copyError);
          }
        }
      } catch (e) {
        console.error("チャット送信失敗", e);
        deleteChatAttachmentUrls(attachmentUrls);
        const errorDetail = String(e && e.message ? e.message : e).replace(/\s+/g, " ").slice(0, 240);
        return createRes("error", `チャットシートへの保存に失敗しました。診断情報: ${errorDetail}`);
      } finally {
        if (lockAcquired && lock.hasLock()) lock.releaseLock();
      }

      const senderName = getUserDisplayName(senderRow, fromUser);
      const recipientLineId = cleanCell(recipientRow[11]);
      if (recipientLineId) {
        const attachmentNotice = attachmentUrls.length > 0 ? `\n（画像${attachmentUrls.length}枚が添付されています）` : "";
        const lineNoticeText = `💬【平工マッチング】新着メッセージ\n\n${senderName} さんからメッセージが届きました：\n「${messageText || "画像が送信されました"}」${attachmentNotice}`;
        sendLineNotification(recipientLineId, lineNoticeText);
      }

      const pushBody = `${senderName} さんからメッセージが届きました：${messageText || "画像が送信されました"}`.slice(0, 240);
      sendAndroidPushNotification(ss, toUser, "平工マッチング：新着メッセージ", pushBody, fromUser);

      return createRes("success", "SENT");
    }

    if (mode === "getMessages") {
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", []);
      if (isBlockedBetween(sheetBlock, data.user1, data.user2)) return createRes("success", []);
      const rows = getChatRows(sheetChat);
      const hiddenAt = getChatHiddenAt(sheetHiddenChat, data.user1, data.user2);
      let msgs = [];
      for (let i = 1; i < rows.length; i++) {
        const isPair = (rows[i][0] === data.user1 && rows[i][1] === data.user2) ||
          (rows[i][0] === data.user2 && rows[i][1] === data.user1);
        const sentAt = new Date(rows[i][3]).getTime();
        const isAfterHidden = !hiddenAt || Number.isNaN(sentAt) || sentAt > hiddenAt;

        if (isPair && isAfterHidden) {
          let attachments = [];
          try {
            const parsedAttachments = rows[i][7] ? JSON.parse(rows[i][7]) : [];
            if (Array.isArray(parsedAttachments)) attachments = parsedAttachments;
          } catch (e) {
            attachments = [];
          }

          msgs.push({
            messageId: rows[i][5] || `legacy-${i + 1}`,
            from: rows[i][0],
            text: rows[i][2],
            sentAt: rows[i][3],
            isRead: rows[i][4] === "read",
            isUnsent: rows[i][6] === "unsent",
            attachments
          });
        }
      }
      return createRes("success", msgs);
    }

    if (mode === "unsendMessage") {
      if (!sheetChat) return createRes("error", "チャットシートが存在しません");

      ensureChatColumns(sheetChat);

      const userId = String(data.userId || "").trim();
      const messageId = String(data.messageId || "").trim();
      if (!userId || !messageId) return createRes("error", "送信取り消しに必要な情報が不足しています");

      const rows = getChatRows(sheetChat);
      let targetRowIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        const rowMessageId = rows[i][5] || `legacy-${i + 1}`;
        if (rowMessageId === messageId && rows[i][0] === userId) {
          targetRowIndex = i + 1;
          break;
        }
      }

      if (targetRowIndex === -1) return createRes("error", "取り消せるメッセージが見つかりません");

      sheetChat.getRange(targetRowIndex, 3).setValue("このメッセージは送信取り消しされました。");
      if (!sheetChat.getRange(targetRowIndex, 6).getValue()) {
        sheetChat.getRange(targetRowIndex, 6).setValue(messageId);
      }
      sheetChat.getRange(targetRowIndex, 7).setValue("unsent");
      sheetChat.getRange(targetRowIndex, 8).setValue("[]");
      return createRes("success", "MESSAGE_UNSENT");
    }

    if (mode === "deleteChatHistory") {
      const userId = String(data.userId || "").trim();
      const targetUserId = String(data.targetUserId || "").trim();
      if (!userId || !targetUserId || userId === targetUserId) {
        return createRes("error", "削除対象のチャットが正しくありません");
      }

      const hiddenChatSheet = sheetHiddenChat || getOrCreateSheet(ss, "チャット非表示", ["UserID", "相手UserID", "非表示日時"]);
      const rows = hiddenChatSheet.getLastRow() > 1 ? hiddenChatSheet.getDataRange().getValues() : [];
      const now = new Date();
      let foundRowIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === userId && rows[i][1] === targetUserId) {
          foundRowIndex = i + 1;
          break;
        }
      }

      if (foundRowIndex === -1) {
        hiddenChatSheet.appendRow([userId, targetUserId, now]);
      } else {
        hiddenChatSheet.getRange(foundRowIndex, 3).setValue(now);
      }

      return createRes("success", "CHAT_HISTORY_HIDDEN");
    }

    if (mode === "getChatPartners") {
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", []);
      const rows = getChatRows(sheetChat);
      const myEmail = data.email;
      let partnersSet = new Set();
      const latestByPartner = {};
      const hiddenAtByPartner = {};
      if (sheetHiddenChat && sheetHiddenChat.getLastRow() > 1) {
        const hiddenRows = sheetHiddenChat.getDataRange().getValues();
        for (let i = 1; i < hiddenRows.length; i++) {
          if (hiddenRows[i][0] !== myEmail) continue;
          const partner = hiddenRows[i][1];
          const hiddenAt = new Date(hiddenRows[i][2]).getTime();
          if (!Number.isNaN(hiddenAt) && hiddenAt > (hiddenAtByPartner[partner] || 0)) {
            hiddenAtByPartner[partner] = hiddenAt;
          }
        }
      }

      for (let i = 1; i < rows.length; i++) {
        const fromUser = rows[i][0];
        const toUser = rows[i][1];
        const sentAt = new Date(rows[i][3]).getTime();
        const partner = fromUser === myEmail ? toUser : fromUser;
        const hiddenAt = hiddenAtByPartner[partner] || 0;
        const isAfterHidden = !hiddenAt || Number.isNaN(sentAt) || sentAt > hiddenAt;

        if (!isAfterHidden || rows[i][6] === "unsent") continue;

        if (fromUser === myEmail) {
          partnersSet.add(toUser);
        } else if (toUser === myEmail) {
          partnersSet.add(fromUser);
        }
        if (fromUser === myEmail || toUser === myEmail) {
          const current = latestByPartner[partner];
          if (!current || sentAt >= current.sentAt) latestByPartner[partner] = { text: rows[i][2] || "", sentAt: sentAt };
        }
      }

      const partnerEmails = Array.from(partnersSet);
      let partnerList = [];

      const userRows = (sheetUser && sheetUser.getLastRow() > 0) ? sheetUser.getDataRange().getValues() : [];
      const blockRows = sheetBlock && sheetBlock.getLastRow() > 1 ? sheetBlock.getDataRange().getValues() : [];
      partnerEmails.forEach(pEmail => {
        if (isBlockedInRows(blockRows, myEmail, pEmail)) return;
        const userRow = findUserRow(userRows, pEmail);
        const pName = getUserDisplayName(userRow, pEmail || "未設定");
        const latest = latestByPartner[pEmail] || {};
        partnerList.push({ email: pEmail, name: pName, preview: cleanCell(latest.text), sentAt: latest.sentAt || 0 });
      });

      return createRes("success", partnerList);
    }

    if (mode === "blockUser") {
      const blockerId = String(data.blockerId || "").trim();
      const blockedId = String(data.blockedId || "").trim();
      if (!blockerId || !blockedId || blockerId === blockedId) {
        return createRes("error", "ブロック対象が正しくありません");
      }
      if (!userExists(sheetUser, blockedId)) {
        return createRes("error", "対象ユーザーが見つかりません");
      }
      if (!userExists(sheetUser, blockerId)) return createRes("error", "ログインユーザーが見つかりません");

      const blockSheet = sheetBlock || getOrCreateSheet(ss, "ブロック", [
        "ブロックしたUserID", "ブロックされたUserID", "ブロック日時", "状態"
      ]);
      const rows = blockSheet.getLastRow() > 1 ? blockSheet.getDataRange().getValues() : [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === blockerId && rows[i][1] === blockedId && rows[i][3] !== "解除") {
          return createRes("success", "ALREADY_BLOCKED");
        }
      }

      blockSheet.appendRow([blockerId, blockedId, new Date(), "有効"]);
      return createRes("success", "BLOCKED");
    }

    if (mode === "unblockUser") {
      const blockerId = String(data.blockerId || "").trim();
      const blockedId = String(data.blockedId || "").trim();
      if (!sheetBlock || sheetBlock.getLastRow() <= 1) return createRes("success", "UNBLOCKED");
      const rows = sheetBlock.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === blockerId && rows[i][1] === blockedId && rows[i][3] !== "解除") {
          sheetBlock.getRange(i + 1, 4).setValue("解除");
        }
      }
      return createRes("success", "UNBLOCKED");
    }

    if (mode === "getBlockedUsers") {
      const blockerId = String(data.blockerId || "").trim();
      const rows = sheetBlock && sheetBlock.getLastRow() > 1 ? sheetBlock.getDataRange().getValues() : [];
      const userRows = sheetUser && sheetUser.getLastRow() > 1 ? sheetUser.getDataRange().getValues() : [];
      const blockedIds = [];

      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === blockerId && rows[i][3] !== "解除") {
          const blockedId = rows[i][1];
          const userRow = userRows.find(row => row[0] === blockedId || row[5] === blockedId);
          blockedIds.push({
            userId: blockedId,
            name: userRow ? (userRow[2] || "未設定") : "未設定"
          });
        }
      }

      return createRes("success", blockedIds);
    }

    if (mode === "reportContent") {
      const reporterId = String(data.reporterId || "").trim();
      const targetUserId = String(data.targetUserId || "").trim();
      const targetType = String(data.targetType || "").trim();
      const targetId = String(data.targetId || "").trim();
      const reason = String(data.reason || "").trim();
      const allowedTargetTypes = ["recruitment", "message", "user"];
      const allowedReasons = ["嫌がらせ・迷惑行為", "不適切な内容", "性的な内容", "脅迫・危険な発言", "個人情報の掲載", "なりすまし", "スパム", "その他"];

      if (!reporterId || !targetUserId || !targetType || !reason) {
        return createRes("error", "通報に必要な情報が不足しています");
      }
      if (!allowedTargetTypes.includes(targetType) || !allowedReasons.includes(reason)) return createRes("error", "通報内容が正しくありません");
      if (String(data.targetContent || "").length > 3000 || String(data.detail || "").length > 2000) {
        return createRes("error", "通報内容が長すぎます");
      }
      if (!userExists(sheetUser, targetUserId)) {
        return createRes("error", "通報対象のユーザーが見つかりません");
      }

      const reportSheet = sheetReport || getOrCreateSheet(ss, "通報", [
        "通報ID", "通報者UserID", "対象UserID", "対象種類", "対象ID",
        "対象内容", "通報理由", "詳細", "通報日時", "対応状況", "管理者メモ"
      ]);
      const reportId = Utilities.getUuid();
      reportSheet.appendRow([
        reportId,
        reporterId,
        targetUserId,
        targetType,
        targetId,
        safeSheetText(data.targetContent || "", 3000),
        safeSheetText(reason, 100),
        safeSheetText(data.detail || "", 2000),
        new Date(),
        "未対応",
        ""
      ]);
      return createRes("success", "REPORTED");
    }

    if (mode === "getReports") {
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");
      const rows = sheetReport && sheetReport.getLastRow() > 1 ? sheetReport.getDataRange().getValues() : [];
      const reports = [];
      for (let i = 1; i < rows.length; i++) {
        reports.push({
          reportId: rows[i][0], reporterId: rows[i][1], targetUserId: rows[i][2],
          targetType: rows[i][3], targetId: rows[i][4], targetContent: rows[i][5],
          reason: rows[i][6], detail: rows[i][7], reportedAt: rows[i][8],
          status: rows[i][9] || "未対応", adminMemo: rows[i][10] || ""
        });
      }
      return createRes("success", reports);
    }

    if (mode === "updateReportStatus") {
      if (!isAdminRequest(data)) return createRes("error", "管理者権限がありません。再ログインしてください");
      if (!sheetReport || sheetReport.getLastRow() <= 1) return createRes("error", "通報が見つかりません");
      const reportId = String(data.reportId || "").trim();
      const nextStatus = String(data.status || "未対応").trim();
      if (!["未対応", "確認中", "対応済み", "却下"].includes(nextStatus)) return createRes("error", "対応状況が正しくありません");
      if (String(data.adminMemo || "").length > 2000) return createRes("error", "管理者メモは2000文字以内で入力してください");
      const rows = sheetReport.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === reportId) {
          sheetReport.getRange(i + 1, 10).setValue(nextStatus);
          if (data.adminMemo !== undefined) sheetReport.getRange(i + 1, 11).setValue(safeSheetText(data.adminMemo, 2000));
          return createRes("success", "REPORT_UPDATED");
        }
      }
      return createRes("error", "通報が見つかりません");
    }

    if (mode === "getLatestIncomingMessage") {
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", null);
      const rows = getChatRows(sheetChat);
      const myEmail = data.email;
      const blockedPartners = getBlockedPartnerIds(sheetBlock, myEmail);

      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i] && rows[i][1] === myEmail && rows[i][6] !== "unsent" && !blockedPartners.has(cleanCell(rows[i][0]))) {
          const senderEmail = rows[i][0] || "";
          const text = rows[i][2] || "";
          const rawDate = rows[i][3];
          const time = rawDate ? new Date(rawDate).getTime() : 0;

          const userRows = (sheetUser && sheetUser.getLastRow() > 0) ? sheetUser.getDataRange().getValues() : [];
          const userRow = findUserRow(userRows, senderEmail);
          const senderName = getUserDisplayName(userRow, senderEmail || "ユーザー");

          return createRes("success", {
            fromEmail: senderEmail,
            fromName: senderName,
            text: text,
            time: time
          });
        }
      }
      return createRes("success", null);
    }

    if (mode === "getUnreadCount") {
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", { unreadCount: 0 });
      const rows = getChatRows(sheetChat);
      const myEmail = data.email;
      const blockedPartners = getBlockedPartnerIds(sheetBlock, myEmail);
      let unreadCount = 0;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i] && rows[i][1] === myEmail && rows[i][4] === "unread" && rows[i][6] !== "unsent" && !blockedPartners.has(cleanCell(rows[i][0]))) {
          unreadCount++;
        }
      }
      return createRes("success", { unreadCount: unreadCount });
    }

    if (mode === "getNotificationSummary") {
      if (!sheetChat || sheetChat.getLastRow() <= 1) {
        return createRes("success", { unreadCount: 0, latestIncoming: null });
      }

      const rows = getChatRows(sheetChat);
      const myEmail = data.email;
      const blockedPartners = getBlockedPartnerIds(sheetBlock, myEmail);
      let unreadCount = 0;
      let latestIncoming = null;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row[6] === "unsent" || blockedPartners.has(cleanCell(row[0]))) continue;

        if (row[1] === myEmail && row[4] === "unread") unreadCount++;

        if (row[1] === myEmail) {
          const time = row[3] ? new Date(row[3]).getTime() : 0;
          if (!latestIncoming || time >= latestIncoming.time) {
            latestIncoming = {
              fromEmail: row[0] || "",
              text: row[2] || "",
              time: time
            };
          }
        }
      }

      if (latestIncoming) {
        const userRows = (sheetUser && sheetUser.getLastRow() > 0) ? sheetUser.getDataRange().getValues() : [];
        const userRow = findUserRow(userRows, latestIncoming.fromEmail);
        latestIncoming.fromName = getUserDisplayName(userRow, latestIncoming.fromEmail || "ユーザー");
      }

      return createRes("success", {
        unreadCount: unreadCount,
        latestIncoming: latestIncoming
      });
    }

    if (mode === "markAsRead") {
      if (!sheetChat || sheetChat.getLastRow() <= 1) return createRes("success", "READ_MARKED");
      const rows = getChatRows(sheetChat);
      const myEmail = data.myEmail;
      const targetEmail = data.targetEmail;

      const unreadRanges = [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i] && rows[i][0] === targetEmail && rows[i][1] === myEmail && rows[i][4] === "unread") {
          unreadRanges.push(`E${i + 1}`);
        }
      }
      if (unreadRanges.length > 0) sheetChat.getRangeList(unreadRanges).setValue("read");
      return createRes("success", "READ_MARKED");
    }

    if (mode === "deleteAccount") {
      const email = data.email;
      if (cleanCell(email) === ADMIN_USER_ID) return createRes("error", "管理者アカウントは削除できません");
      if (!sheetUser || sheetUser.getLastRow() <= 1) return createRes("error", "ユーザーが見つかりません");

      const rows = sheetUser.getDataRange().getValues();
      let userDeleted = false;

      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === email || rows[i][5] === email) {
          sheetUser.deleteRow(i + 1);
          userDeleted = true;
          break;
        }
      }

      if (sheetRecruit && sheetRecruit.getLastRow() > 1) {
        const recruitRows = sheetRecruit.getDataRange().getValues();
        for (let j = recruitRows.length - 1; j >= 1; j--) {
          if (recruitRows[j][5] === email) {
            sheetRecruit.deleteRow(j + 1);
          }
        }
      }

      if (userDeleted) {
        CacheService.getScriptCache().put("revoked-user-" + cleanCell(email), "1", Math.floor(USER_SESSION_DURATION_MS / 1000));
        return createRes("success", "ACCOUNT_DELETED");
      } else {
        return createRes("error", "対象ユーザーが見つかりませんでした");
      }
    }

    if (mode === "forgotPassword") {
      const userId = data.userId;
      if (!claimCooldown("forgot-password-" + cleanCell(userId), 60)) return createRes("success", "MAIL_SENT_IF_EXISTS");
      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "ユーザーが見つかりません");
      const rows = sheetUser.getDataRange().getValues();

      let userRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === userId) {
          userRowIndex = i + 1;
          break;
        }
      }
      if (userRowIndex === -1) return createRes("success", "MAIL_SENT_IF_EXISTS");

      const row = rows[userRowIndex - 1];
      const email = row[5];
      if (!email) return createRes("success", "MAIL_SENT_IF_EXISTS");

      const token = generateResetToken();
      const expiry = new Date().getTime() + (30 * 60 * 1000);

      sheetUser.getRange(userRowIndex, 10).setValue(token);
      sheetUser.getRange(userRowIndex, 11).setValue(expiry);

      const resetLink = `${SITE_URL}reset.html?id=${encodeURIComponent(userId)}&token=${token}`;

      MailApp.sendEmail({
        to: email,
        name: "平工マッチング",
        subject: "【平工マッチング】認証コードのご案内",
        body: `パスワード再設定のリクエストを受け付けました。\n\n30分以内に、以下のリンクから新しいパスワードを設定してください。\n\n${resetLink}`
      });

      return createRes("success", "MAIL_SENT_IF_EXISTS");
    }

    if (mode === "resetPassword") {
      const userId = data.userId;
      const token = data.token;
      const newPassword = data.newPassword;

      if (!sheetUser || sheetUser.getLastRow() === 0) return createRes("error", "無効なリンクです。");
      const rows = sheetUser.getDataRange().getValues();

      let userRowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === userId) {
          userRowIndex = i + 1;
          break;
        }
      }
      if (userRowIndex === -1) return createRes("error", "無効なリンクです");

      const savedToken = rows[userRowIndex - 1][9];
      const savedExpiry = rows[userRowIndex - 1][10];

      if (!savedToken || savedToken !== token) return createRes("error", "リンクが無効です。");
      if (!savedExpiry || new Date().getTime() > savedExpiry) return createRes("error", "リンクの有効期限が切れています。");
      const passwordError = validatePasswordPolicy(newPassword);
      if (passwordError) return createRes("error", passwordError);

      sheetUser.getRange(userRowIndex, 2).setValue(hashPassword(newPassword));
      ensureUserSessionColumn(sheetUser);
      sheetUser.getRange(userRowIndex, 13).setValue(Utilities.getUuid());
      sheetUser.getRange(userRowIndex, 10).setValue("");
      sheetUser.getRange(userRowIndex, 11).setValue("");

      return createRes("success", "PASSWORD_RESET");
    }

    return createRes("error", "未対応のモードです: " + mode);

  } catch (err) {
    console.error("GAS処理エラー", err);
    return createRes("error", "サーバー処理中にエラーが発生しました。時間をおいてもう一度お試しください");
  }
}

function getFaceDistance(currentLandmarks, registeredLandmarks) {
  if (!Array.isArray(currentLandmarks) || !Array.isArray(registeredLandmarks)) return null;
  const pointCount = Math.min(currentLandmarks.length, registeredLandmarks.length);
  if (pointCount < 400 || Math.abs(currentLandmarks.length - registeredLandmarks.length) > 10) return null;

  const current = normalizeFaceLandmarks(currentLandmarks);
  const registered = normalizeFaceLandmarks(registeredLandmarks);
  if (!current || !registered) return null;

  const distances = [];
  for (let i = 0; i < pointCount; i++) {
    const dx = current[i].x - registered[i].x;
    const dy = current[i].y - registered[i].y;
    const dz = (current[i].z - registered[i].z) * 0.5;
    distances.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
  }

  distances.sort((a, b) => a - b);
  const trim = Math.floor(distances.length * 0.1);
  let totalDistance = 0;
  let usedPoints = 0;
  for (let i = trim; i < distances.length - trim; i++) {
    totalDistance += distances[i];
    usedPoints++;
  }

  return usedPoints ? totalDistance / usedPoints : null;
}

function normalizeFaceLandmarks(landmarks) {
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  if (!leftEye || !rightEye) return null;

  const values = [leftEye.x, leftEye.y, rightEye.x, rightEye.y];
  if (values.some(value => typeof value !== "number" || !isFinite(value))) return null;

  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (leftEye.y + rightEye.y) / 2;
  const centerZ = ((leftEye.z || 0) + (rightEye.z || 0)) / 2;
  const eyeX = rightEye.x - leftEye.x;
  const eyeY = rightEye.y - leftEye.y;
  const scale = Math.sqrt(eyeX * eyeX + eyeY * eyeY);
  if (!scale || !isFinite(scale)) return null;

  const angle = Math.atan2(eyeY, eyeX);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const normalized = [];

  for (let i = 0; i < landmarks.length; i++) {
    const point = landmarks[i];
    if (!point || typeof point.x !== "number" || typeof point.y !== "number" || !isFinite(point.x) || !isFinite(point.y)) return null;

    const x = (point.x - centerX) / scale;
    const y = (point.y - centerY) / scale;
    const z = ((point.z || 0) - centerZ) / scale;
    normalized.push({
      x: x * cos - y * sin,
      y: x * sin + y * cos,
      z: z
    });
  }

  return normalized;
}

function medianNumber(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = values.slice().filter(value => typeof value === "number" && isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeAiStudyProfile(profile) {
  const source = profile && typeof profile === "object" ? profile : {};
  return {
    subject: cleanCell(source.subject).slice(0, 50) || "未指定",
    goal: cleanCell(source.goal).slice(0, 300) || "まだ決まっていない",
    challenge: cleanCell(source.challenge).slice(0, 300) || "特になし",
    minutes: cleanCell(source.minutes).slice(0, 30) || "未指定",
    preference: cleanCell(source.preference).slice(0, 100) || "未指定"
  };
}

function normalizeAiHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).map(item => ({
    role: item && item.role === "model" ? "model" : "user",
    text: cleanCell(item && item.text).slice(0, 1200)
  })).filter(item => item.text);
}

function getAiFeedbackProfile(aiSheet, userId) {
  const emptyProfile = { feedbackCount: 0, helpfulCount: 0, notHelpfulCount: 0, successfulTypes: [], adjustmentRequests: [], typeAdjustments: {} };
  if (!aiSheet || aiSheet.getLastRow() <= 1 || !userId) return emptyProfile;
  const cache = CacheService.getScriptCache();
  const cacheKey = "ai-feedback-" + userId.slice(0, 100);
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      cache.remove(cacheKey);
    }
  }

  const lastRow = aiSheet.getLastRow();
  const startRow = Math.max(2, lastRow - 499);
  const rows = aiSheet.getRange(startRow, 1, lastRow - startRow + 1, 14).getValues();
  const typeAdjustments = {};
  const adjustmentRequests = [];
  let helpfulCount = 0;
  let notHelpfulCount = 0;
  let feedbackCount = 0;

  for (let i = rows.length - 1; i >= 0 && feedbackCount < 30; i--) {
    const row = rows[i];
    if (cleanCell(row[2]) !== userId) continue;
    const rating = cleanCell(row[11]);
    if (rating !== "helpful" && rating !== "not_helpful") continue;
    const reason = cleanCell(row[12]);
    const recommendationType = cleanCell(row[13]);
    feedbackCount++;

    if (rating === "helpful") {
      helpfulCount++;
      if (recommendationType) typeAdjustments[recommendationType] = (typeAdjustments[recommendationType] || 0) + 1.5;
      continue;
    }

    notHelpfulCount++;
    if (reason === "難しすぎる" || reason === "too_difficult") adjustmentRequests.push("説明をやさしくし、一度に取り組む量を減らす");
    if (reason === "簡単すぎる" || reason === "too_easy") adjustmentRequests.push("説明を具体的にし、少し難しい実践課題も入れる");
    if (reason === "自分の状況に合わない" || reason === "not_matched") {
      adjustmentRequests.push("条件を決めつけず、本人の状況に合う複数案を示す");
      if (recommendationType) typeAdjustments[recommendationType] = (typeAdjustments[recommendationType] || 0) - 1;
    }
    if (reason === "別の方法を試したい" || reason === "another_method") {
      adjustmentRequests.push("過去に出した方法とは異なる学習方法を優先する");
      if (recommendationType) typeAdjustments[recommendationType] = (typeAdjustments[recommendationType] || 0) - 2;
    }
    if (!reason) adjustmentRequests.push("過去の提案を繰り返さず、別の具体案も示す");
  }

  Object.keys(typeAdjustments).forEach(type => {
    typeAdjustments[type] = Math.max(-3, Math.min(3, typeAdjustments[type]));
  });
  const successfulTypes = Object.keys(typeAdjustments).filter(type => typeAdjustments[type] > 0).sort((a, b) => typeAdjustments[b] - typeAdjustments[a]).slice(0, 3);
  const profile = {
    feedbackCount: feedbackCount,
    helpfulCount: helpfulCount,
    notHelpfulCount: notHelpfulCount,
    successfulTypes: successfulTypes,
    adjustmentRequests: Array.from(new Set(adjustmentRequests)).slice(0, 4),
    typeAdjustments: typeAdjustments
  };
  cache.put(cacheKey, JSON.stringify(profile), 300);
  return profile;
}

function buildStudyRecommendationProfile(profile, message, feedbackProfile) {
  const text = [profile.subject, profile.goal, profile.challenge, profile.preference, message].join(" ");
  const scores = {
    "短時間集中型": 0,
    "反復定着型": 0,
    "説明整理型": 0,
    "演習実践型": 0,
    "伴走計画型": 0
  };

  if (/続か|やる気|先延ばし|時間がない|集中できない/.test(text)) scores["短時間集中型"] += 3;
  if (/暗記|覚え|忘れ|記憶|用語/.test(text)) scores["反復定着型"] += 3;
  if (/理解|なぜ|説明|読解|意味|整理/.test(text)) scores["説明整理型"] += 3;
  if (/問題|計算|演習|実技|解けない|ミス/.test(text)) scores["演習実践型"] += 3;
  if (/計画|予定|一人|相談|誰か|一緒|管理/.test(text)) scores["伴走計画型"] += 3;

  if (/短|15分|25分|30分/.test(profile.minutes)) scores["短時間集中型"] += 2;
  if (/動画|図|見る|書いて/.test(profile.preference)) scores["説明整理型"] += 1;
  if (/聞く|話す|説明する/.test(profile.preference)) scores["説明整理型"] += 1;
  if (/問題|実践|手を動かす/.test(profile.preference)) scores["演習実践型"] += 1;
  if (/友達|一緒|相談/.test(profile.preference)) scores["伴走計画型"] += 1;

  const typeAdjustments = feedbackProfile && feedbackProfile.typeAdjustments ? feedbackProfile.typeAdjustments : {};
  Object.keys(scores).forEach(type => {
    scores[type] += Number(typeAdjustments[type]) || 0;
  });

  const label = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
  const focusMap = {
    "短時間集中型": "短い時間で始めやすく、休憩を挟みながら継続する方法",
    "反復定着型": "思い出す回数を増やし、忘れる前に復習する方法",
    "説明整理型": "自分の言葉で説明し、理解の抜けを見つける方法",
    "演習実践型": "問題を解いて、間違いから次の学習内容を決める方法",
    "伴走計画型": "小さな予定と振り返りを決め、誰かと進捗を共有する方法"
  };
  return { label: label, focus: focusMap[label], scores: scores, feedbackApplied: Boolean(feedbackProfile && feedbackProfile.feedbackCount) };
}

function getAiDailyUsage(aiSheet, userId) {
  if (!aiSheet || aiSheet.getLastRow() <= 1) return 0;
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const rows = aiSheet.getDataRange().getValues();
  return rows.slice(1).filter(row => {
    if (cleanCell(row[2]) !== userId || !row[0]) return false;
    try {
      return Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "yyyy-MM-dd") === today;
    } catch (e) {
      return false;
    }
  }).length;
}

function findAiRequest(aiSheet, userId, requestId) {
  if (!aiSheet || aiSheet.getLastRow() <= 1 || !requestId) return null;
  const rows = aiSheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const row = rows[i];
    if (cleanCell(row[2]) !== userId || cleanCell(row[16]) !== requestId) continue;
    const stage = Number(row[15]) || 1;
    return {
      responseId: cleanCell(row[1]),
      reply: cleanCell(row[10]),
      analysis: { label: cleanCell(row[13]) },
      stage: stage,
      completed: stage >= 2,
      pending: false
    };
  }
  return null;
}

function getAiSessionUsage(aiSheet, userId, sessionId) {
  if (!aiSheet || aiSheet.getLastRow() <= 1 || !sessionId) return 0;
  const rows = aiSheet.getDataRange().getValues();
  return rows.slice(1).filter(row => cleanCell(row[2]) === userId && cleanCell(row[3]) === sessionId).length;
}

function callGeminiStudyAdvisor(apiKey, profile, analysis, history, message, stage, feedbackProfile) {
  const systemInstruction = [
    "あなたは高校生向けの勉強相談アドバイザーです。回答は日本語で、親しみやすく具体的にしてください。",
    "医療・心理・進路の断定をせず、必要なら先生や保護者など信頼できる大人への相談を勧めてください。",
    "相談者を責めず、今日から実行できる小さな行動に落とし込んでください。",
    "過去の回答評価がある場合は調整方針を優先し、同じ不満が繰り返されない回答にしてください。",
    stage === 1
      ? "今回は最終提案をまだ出さず、相談者の状況を短く整理して、追加質問を1つだけしてください。"
      : "今回は相談を完結させてください。「状況の整理」「おすすめの勉強法」「今日やること」「続ける工夫」を含め、最後に質問は書かないでください。"
  ].join("\n");

  const context = [
    "相談者の情報:", JSON.stringify(profile),
    "自作推薦ロジックの分析:", JSON.stringify(analysis),
    "過去の回答評価から得た調整方針:", JSON.stringify(feedbackProfile || {}),
    "今回の相談:", message,
    "直近の会話:", JSON.stringify(history)
  ].join("\n");

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: context }] }],
    generationConfig: { maxOutputTokens: 900, responseMimeType: "text/plain" }
  };
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(GEMINI_MODEL) + ":generateContent";
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return "";
    const data = JSON.parse(response.getContentText());
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    return Array.isArray(parts) ? parts.map(part => cleanCell(part.text)).join("\n").trim() : "";
  } catch (error) {
    return "";
  }
}

function createRes(status, msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: status, message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "undefined" || text === "null" ? "" : text;
}

function claimCooldown(key, seconds) {
  const cache = CacheService.getScriptCache();
  const cacheKey = String(key || "").slice(0, 240);
  if (!cacheKey || cache.get(cacheKey)) return false;
  cache.put(cacheKey, "1", Math.max(1, Number(seconds) || 1));
  return true;
}

function getAttemptCount(key) {
  return Number(CacheService.getScriptCache().get(String(key || "").slice(0, 240)) || 0);
}

function recordAttemptFailure(key, currentCount, seconds) {
  const cacheKey = String(key || "").slice(0, 240);
  if (!cacheKey) return;
  CacheService.getScriptCache().put(cacheKey, String((Number(currentCount) || 0) + 1), Math.max(1, Number(seconds) || 600));
}

function clearAttemptFailures(key) {
  const cacheKey = String(key || "").slice(0, 240);
  if (cacheKey) CacheService.getScriptCache().remove(cacheKey);
}

function isSafeIdentifier(value) {
  const text = cleanCell(value);
  return Boolean(text && text.length <= 64 && !/^[=+\-@]/.test(text) && !/[\u0000-\u001F\u007F]/.test(text));
}

function safeSheetText(value, maxLength) {
  let text = cleanCell(value);
  if (Number(maxLength) > 0) text = text.slice(0, Number(maxLength));
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function findUserRow(rows, identifier) {
  const key = cleanCell(identifier);
  if (!key) return null;
  return rows.find(row => cleanCell(row[0]) === key || cleanCell(row[5]) === key) || null;
}

function getUserDisplayName(userRow, fallback) {
  const name = userRow ? cleanCell(userRow[2]) : "";
  return name || cleanCell(fallback) || "ユーザー";
}

function isValidFaceFeatures(value) {
  if (!value || typeof value !== "string" || value.length > 49000) return false;
  try {
    const points = JSON.parse(value);
    return Array.isArray(points) && points.length >= 400 && points.every(point =>
      point && typeof point.x === "number" && typeof point.y === "number" && typeof point.z === "number" &&
      isFinite(point.x) && isFinite(point.y) && isFinite(point.z)
    );
  } catch (e) {
    return false;
  }
}

function isSafeProfileImage(value) {
  const source = cleanCell(value);
  if (!source || source.length > 49000) return false;
  if (/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(source)) return true;
  return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(source);
}

function getAdminTokenSecret() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty("ADMIN_TOKEN_SECRET");
  if (!secret) {
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      secret = properties.getProperty("ADMIN_TOKEN_SECRET");
      if (!secret) {
        secret = Utilities.getUuid() + Utilities.getUuid();
        properties.setProperty("ADMIN_TOKEN_SECRET", secret);
      }
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  }
  return secret;
}

function getRequestActorId(mode, data) {
  const actorFields = {
    heartbeat: "userId",
    refreshAdminToken: "userId",
    firebaseCustomToken: "userId",
    registerAndroidDevice: "userId",
    unregisterAndroidDevice: "userId",
    recordUsageLog: "userId",
    recordUsageLogs: "userId",
    createLineLinkCode: "userId",
    unlinkLineAccount: "userId",
    getUserProfile: data.userId ? "userId" : "email",
    getUserProfiles: "userId",
    aiStudyChat: "userId",
    aiStudyFeedback: "userId",
    updateProfile: "email",
    updateFaceFeatures: "email",
    getRecruitments: "email",
    postRecruitment: "email",
    deleteRecruitment: "email",
    sendMessage: "from",
    notifyFirebaseMessage: "from",
    getMessages: "user1",
    unsendMessage: "userId",
    deleteChatHistory: "userId",
    getChatPartners: "email",
    blockUser: "blockerId",
    unblockUser: "blockerId",
    getBlockedUsers: "blockerId",
    reportContent: "reporterId",
    getLatestIncomingMessage: "email",
    getUnreadCount: "email",
    getNotificationSummary: "email",
    markAsRead: "myEmail",
    deleteAccount: "email"
  };
  const field = actorFields[mode];
  return field ? cleanCell(data && data[field]) : "";
}

function createFirebaseCustomToken(userId) {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!raw) return "";

    const account = JSON.parse(raw);
    const clientEmail = cleanCell(account.client_email);
    const privateKey = cleanCell(account.private_key).replace(/\\n/g, "\n");
    if (!clientEmail || !privateKey || !cleanCell(account.project_id)) return "";

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: clientEmail,
      sub: clientEmail,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat: now,
      exp: now + 3600,
      uid: firebaseUserUid(userId),
      claims: { userId: cleanCell(userId).slice(0, 64) }
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = encodedHeader + "." + encodedPayload;
    const signature = Utilities.computeRsaSha256Signature(signingInput, privateKey);
    return signingInput + "." + Utilities.base64EncodeWebSafe(signature).replace(/=+$/g, "");
  } catch (error) {
    console.error("Firebaseカスタムトークン発行失敗", error);
    return "";
  }
}

function firebaseUserUid(userId) {
  return "u_" + base64UrlEncode(cleanCell(userId));
}

function clearFirebaseChatData() {
  const account = getFcmServiceAccount();
  if (!account) throw new Error("Firebaseサービスアカウント設定がありません");

  const accessToken = getFirebaseDatabaseAccessToken(account);
  if (!accessToken) throw new Error("Firebase Realtime Databaseのアクセストークンを取得できません");

  const endpoint = FIREBASE_DATABASE_URL.replace(/\/+$/, "") + "/.json";
  const response = UrlFetchApp.fetch(endpoint, {
    method: "patch",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + accessToken },
    payload: JSON.stringify({ chats: null, inbox: null, hidden: null }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("Firebase消去失敗: HTTP " + code);
  return true;
}

function getFirebaseDatabaseAccessToken(account) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "firebase-database-access-token";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = base64UrlEncode(JSON.stringify({
      iss: account.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.database",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600
    }));
    const unsignedJwt = header + "." + claim;
    const signature = base64UrlEncode(Utilities.computeRsaSha256Signature(unsignedJwt, account.privateKey));
    const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: unsignedJwt + "." + signature
      },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return "";
    const token = cleanCell(JSON.parse(response.getContentText()).access_token);
    if (token) cache.put(cacheKey, token, 3300);
    return token;
  } catch (error) {
    console.error("Firebase Databaseアクセストークン取得失敗", error);
    return "";
  }
}

function clearChatDataRows(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  const rowCount = sheet.getLastRow() - 1;
  const columnCount = Math.max(1, sheet.getLastColumn());
  sheet.getRange(2, 1, rowCount, columnCount).clearContent();
  return rowCount;
}

function getUserTokenSecret() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty("USER_TOKEN_SECRET");
  if (!secret) {
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      secret = properties.getProperty("USER_TOKEN_SECRET");
      if (!secret) {
        secret = Utilities.getUuid() + Utilities.getUuid();
        properties.setProperty("USER_TOKEN_SECRET", secret);
      }
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  }
  return secret;
}

function createUserSessionToken(userId, sessionVersion) {
  const payload = JSON.stringify({ userId: cleanCell(userId), version: cleanCell(sessionVersion), expiresAt: Date.now() + USER_SESSION_DURATION_MS });
  const encodedPayload = Utilities.base64EncodeWebSafe(payload);
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(encodedPayload, getUserTokenSecret()));
  return encodedPayload + "." + signature;
}

function getUserIdFromSessionToken(token) {
  try {
    if (String(token || "").length > 2048) return "";
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return "";
    const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], getUserTokenSecret()));
    if (!constantTimeEquals(parts[1], expected)) return "";
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!payload || !cleanCell(payload.userId) || Date.now() > Number(payload.expiresAt || 0)) return "";
    if (CacheService.getScriptCache().get("revoked-user-" + cleanCell(payload.userId))) return "";
    return { userId: cleanCell(payload.userId), version: cleanCell(payload.version), cacheKey: "auth-session-" + parts[1].slice(0, 48) };
  } catch (error) {
    return "";
  }
}

function isAuthenticatedUserRequest(data, actorId, sheetUser) {
  const tokenSession = getUserIdFromSessionToken(data && data.sessionToken);
  if (!tokenSession || tokenSession.userId !== cleanCell(actorId)) return false;
  const authCache = CacheService.getScriptCache();
  if (authCache.get(tokenSession.cacheKey) === "1") return true;
  if (!sheetUser || sheetUser.getLastRow() <= 1) return false;
  const width = Math.min(13, sheetUser.getMaxColumns());
  const rows = sheetUser.getRange(2, 1, sheetUser.getLastRow() - 1, width).getValues();
  const userRow = rows.find(row => cleanCell(row[0]) === tokenSession.userId);
  const authenticated = Boolean(userRow && userRow[6] === true && cleanCell(userRow[12]) === tokenSession.version);
  if (authenticated) authCache.put(tokenSession.cacheKey, "1", 60);
  return authenticated;
}

function createAdminSessionToken() {
  const expiresAt = Date.now() + 6 * 60 * 60 * 1000;
  const payload = `${ADMIN_USER_ID}|${expiresAt}`;
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, getAdminTokenSecret())
  );
  return Utilities.base64EncodeWebSafe(payload) + "." + signature;
}

function isAdminRequest(data) {
  if (!data || cleanCell(data.adminId) !== ADMIN_USER_ID || !data.adminToken) return false;
  if (String(data.adminToken).length > 2048) return false;
  try {
    const parts = String(data.adminToken).split(".");
    if (parts.length !== 2) return false;
    const payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
    const payloadParts = payload.split("|");
    if (payloadParts.length !== 2 || payloadParts[0] !== ADMIN_USER_ID) return false;
    if (!Number(payloadParts[1]) || Date.now() > Number(payloadParts[1])) return false;
    const expected = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(payload, getAdminTokenSecret())
    );
    return constantTimeEquals(parts[1], expected);
  } catch (e) {
    return false;
  }
}

function constantTimeEquals(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function initializeUsageAnalytics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureUsageSheets(ss);
  return "利用ログと日別分析シートを準備しました";
}

function ensureUsageSheets(ss) {
  const usageSheet = getOrCreateSheet(ss, "利用ログ", USAGE_LOG_HEADERS);
  const dailySheet = getOrCreateSheet(ss, "日別分析", DAILY_ANALYSIS_HEADERS);
  return { usageSheet: usageSheet, dailySheet: dailySheet };
}

function saveUsageLog(ss, data) {
  const userId = cleanCell(data && data.userId);
  if (!isSafeIdentifier(userId)) return { saved: false, skipped: true };

  const sourceMode = safeSheetText(data && data.sourceMode, 80) || "unknown";
  const result = ["success", "error", "started"].includes(cleanCell(data && data.result)) ? cleanCell(data.result) : "unknown";
  const rawDuration = Number(data && data.durationMs);
  const durationMs = Number.isFinite(rawDuration) ? Math.max(0, Math.min(600000, Math.round(rawDuration))) : 0;
  const errorMessage = safeSheetText(data && data.errorMessage, 300);
  const recordedAt = new Date();
  const dateKey = Utilities.formatDate(recordedAt, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const userKey = createUsageUserKey(userId);
  const sheets = ensureUsageSheets(ss);
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    locked = lock.tryLock(1500);
    if (!locked) return { saved: false, skipped: true };
    sheets.usageSheet.appendRow([recordedAt, dateKey, userKey, getUsageFeatureLabel(sourceMode), sourceMode, result, durationMs, errorMessage]);
    upsertDailyAnalysis(sheets.dailySheet, dateKey, userKey, sourceMode, result, durationMs, recordedAt);
    return { saved: true, dateKey: dateKey };
  } catch (error) {
    console.error("利用ログ保存失敗", error);
    return { saved: false, skipped: true };
  } finally {
    if (locked && lock.hasLock()) lock.releaseLock();
  }
}

function saveUsageLogs(ss, data) {
  const userId = cleanCell(data && data.userId);
  if (!isSafeIdentifier(userId)) return { saved: false, skipped: true };
  const sourceEvents = Array.isArray(data && data.events) ? data.events.slice(0, 20) : [];
  if (sourceEvents.length === 0) return { saved: false, skipped: true };

  const recordedAt = new Date();
  const dateKey = Utilities.formatDate(recordedAt, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const userKey = createUsageUserKey(userId);
  const events = sourceEvents.map(event => {
    const sourceMode = safeSheetText(event && event.sourceMode, 80) || "unknown";
    const result = ["success", "error", "started"].includes(cleanCell(event && event.result)) ? cleanCell(event.result) : "unknown";
    const rawDuration = Number(event && event.durationMs);
    const durationMs = Number.isFinite(rawDuration) ? Math.max(0, Math.min(600000, Math.round(rawDuration))) : 0;
    const errorMessage = safeSheetText(event && event.errorMessage, 300);
    return { sourceMode: sourceMode, result: result, durationMs: durationMs, errorMessage: errorMessage };
  });
  const sheets = ensureUsageSheets(ss);
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    locked = lock.tryLock(1500);
    if (!locked) return { saved: false, skipped: true };
    const rows = events.map(event => [recordedAt, dateKey, userKey, getUsageFeatureLabel(event.sourceMode), event.sourceMode, event.result, event.durationMs, event.errorMessage]);
    const firstRow = Math.max(2, sheets.usageSheet.getLastRow() + 1);
    sheets.usageSheet.getRange(firstRow, 1, rows.length, USAGE_LOG_HEADERS.length).setValues(rows);
    upsertDailyAnalysisBatch(sheets.dailySheet, dateKey, userKey, events, recordedAt);
    return { saved: true, count: rows.length, dateKey: dateKey };
  } catch (error) {
    console.error("利用ログ一括保存失敗", error);
    return { saved: false, skipped: true };
  } finally {
    if (locked && lock.hasLock()) lock.releaseLock();
  }
}

function upsertDailyAnalysisBatch(sheet, dateKey, userKey, events, updatedAt) {
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, DAILY_ANALYSIS_HEADERS.length).getValues() : [];
  let rowIndex = rows.findIndex(row => cleanCell(row[0]) === dateKey);
  let values;

  if (rowIndex < 0) {
    values = Array(DAILY_ANALYSIS_HEADERS.length).fill(0);
    values[0] = dateKey;
    values[17] = "[]";
    rowIndex = lastRow + 1;
  } else {
    values = rows[rowIndex].slice(0, DAILY_ANALYSIS_HEADERS.length);
    rowIndex += 2;
  }

  const userKeys = parseUsageUserKeys(values[17]);
  if (userKey && !userKeys.includes(userKey)) userKeys.push(userKey);
  values[1] = userKeys.length;
  const featureColumnMap = { "ログイン": 5, "募集": 6, "チャット": 7, "AI相談": 8, "顔認証": 9, "LINE": 10, "通報・ブロック": 11 };

  events.forEach(event => {
    values[2] = Number(values[2] || 0) + 1;
    if (event.result === "success") values[3] = Number(values[3] || 0) + 1;
    if (event.result === "error") values[4] = Number(values[4] || 0) + 1;
    const feature = getUsageFeatureLabel(event.sourceMode);
    const featureColumn = featureColumnMap[feature];
    if (featureColumn) values[featureColumn] = Number(values[featureColumn] || 0) + 1;
    if (event.result === "error") values[12] = Number(values[12] || 0) + 1;
    if (event.durationMs > 0) {
      values[14] = Number(values[14] || 0) + event.durationMs;
      values[15] = Number(values[15] || 0) + 1;
    }
  });

  values[13] = values[15] > 0 ? Math.round(values[14] / values[15]) : 0;
  values[16] = updatedAt;
  values[17] = JSON.stringify(userKeys.slice(-500));
  sheet.getRange(rowIndex, 1, 1, DAILY_ANALYSIS_HEADERS.length).setValues([values]);
}

function createUsageUserKey(userId) {
  const signature = Utilities.computeHmacSha256Signature(cleanCell(userId), getUserTokenSecret());
  return Utilities.base64EncodeWebSafe(signature).slice(0, 22);
}

function getUsageFeatureLabel(sourceMode) {
  const mode = cleanCell(sourceMode);
  if (["login", "register", "verifyEmail", "forgotPassword", "resetPassword", "resendVerificationCode"].includes(mode)) return "ログイン";
  if (["verify_face_for_user", "verify_face_1toN", "updateFaceFeatures"].includes(mode)) return "顔認証";
  if (["getRecruitments", "postRecruitment", "deleteRecruitment"].includes(mode)) return "募集";
  if (["sendMessage", "getMessages", "getChatPartners", "markAsRead", "unsendMessage", "deleteChatHistory", "getUnreadCount", "getNotificationSummary", "getLatestIncomingMessage"].includes(mode)) return "チャット";
  if (["aiStudyChat", "aiStudyFeedback"].includes(mode)) return "AI相談";
  if (["createLineLinkCode", "unlinkLineAccount"].includes(mode)) return "LINE";
  if (["reportContent", "getReports", "updateReportStatus", "blockUser", "unblockUser", "getBlockedUsers"].includes(mode)) return "通報・ブロック";
  return "その他";
}

function upsertDailyAnalysis(sheet, dateKey, userKey, sourceMode, result, durationMs, updatedAt) {
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, DAILY_ANALYSIS_HEADERS.length).getValues() : [];
  let rowIndex = rows.findIndex(row => cleanCell(row[0]) === dateKey);
  let values;

  if (rowIndex < 0) {
    values = Array(DAILY_ANALYSIS_HEADERS.length).fill(0);
    values[0] = dateKey;
    values[16] = updatedAt;
    values[17] = "[]";
    rowIndex = lastRow + 1;
  } else {
    values = rows[rowIndex].slice(0, DAILY_ANALYSIS_HEADERS.length);
    rowIndex += 2;
  }

  const userKeys = parseUsageUserKeys(values[17]);
  if (userKey && !userKeys.includes(userKey)) userKeys.push(userKey);
  values[1] = userKeys.length;
  values[2] = Number(values[2] || 0) + 1;
  if (result === "success") values[3] = Number(values[3] || 0) + 1;
  if (result === "error") values[4] = Number(values[4] || 0) + 1;

  const feature = getUsageFeatureLabel(sourceMode);
  const featureColumnMap = { "ログイン": 5, "募集": 6, "チャット": 7, "AI相談": 8, "顔認証": 9, "LINE": 10, "通報・ブロック": 11 };
  if (featureColumnMap[feature]) values[featureColumnMap[feature]] = Number(values[featureColumnMap[feature]] || 0) + 1;
  if (result === "error") values[12] = Number(values[12] || 0) + 1;
  if (durationMs > 0) {
    values[14] = Number(values[14] || 0) + durationMs;
    values[15] = Number(values[15] || 0) + 1;
    values[13] = Math.round(values[14] / values[15]);
  }
  values[16] = updatedAt;
  values[17] = JSON.stringify(userKeys.slice(-500));
  sheet.getRange(rowIndex, 1, 1, DAILY_ANALYSIS_HEADERS.length).setValues([values]);
}

function parseUsageUserKeys(value) {
  try {
    const parsed = JSON.parse(cleanCell(value) || "[]");
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string").slice(-500) : [];
  } catch (error) {
    return [];
  }
}

function getDailyAnalysisRows(ss, days) {
  const sheet = ss.getSheetByName("日別分析");
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const limit = Math.max(1, Math.min(90, Number(days) || 30));
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, DAILY_ANALYSIS_HEADERS.length).getValues();
  return rows.slice(-limit).reverse().map(row => ({
    date: cleanCell(row[0]),
    uniqueUsers: Number(row[1]) || 0,
    events: Number(row[2]) || 0,
    successes: Number(row[3]) || 0,
    failures: Number(row[4]) || 0,
    loginCount: Number(row[5]) || 0,
    recruitmentCount: Number(row[6]) || 0,
    chatCount: Number(row[7]) || 0,
    aiCount: Number(row[8]) || 0,
    faceCount: Number(row[9]) || 0,
    lineCount: Number(row[10]) || 0,
    moderationCount: Number(row[11]) || 0,
    errorCount: Number(row[12]) || 0,
    averageDurationMs: Number(row[13]) || 0,
    updatedAt: row[16] || ""
  }));
}

function ensureUserSessionColumn(sheetUser) {
  if (sheetUser.getMaxColumns() < 13) sheetUser.insertColumnsAfter(sheetUser.getMaxColumns(), 13 - sheetUser.getMaxColumns());
  if (!sheetUser.getRange(1, 13).getValue()) sheetUser.getRange(1, 13).setValue("sessionVersion");
}

function ensureUserSchoolColumns(sheetUser) {
  ensureUserSessionColumn(sheetUser);
  if (sheetUser.getMaxColumns() < 15) sheetUser.insertColumnsAfter(sheetUser.getMaxColumns(), 15 - sheetUser.getMaxColumns());
  if (!sheetUser.getRange(1, 14).getValue()) sheetUser.getRange(1, 14).setValue("学年");
  if (!sheetUser.getRange(1, 15).getValue()) sheetUser.getRange(1, 15).setValue("学科");
}

function ensureRecruitmentDurationColumn(sheetRecruit) {
  if (sheetRecruit.getLastRow() === 0) {
    sheetRecruit.getRange(1, 1, 1, 8).setValues([["名前", "学年", "学科", "勉強内容", "投稿時刻", "UserID", "tags", "表示時間（分）"]]);
    return;
  }

  if (!sheetRecruit.getRange(1, 8).getValue()) {
    sheetRecruit.getRange(1, 8).setValue("表示時間（分）");
  }
}

function ensureChatColumns(sheetChat) {
  if (sheetChat.getLastRow() === 0) {
    sheetChat.getRange(1, 1, 1, 8).setValues([["送信元", "送信先", "内容", "日時", "既読", "メッセージID", "状態", "添付JSON"]]);
    return;
  }

  if (!sheetChat.getRange(1, 6).getValue()) sheetChat.getRange(1, 6).setValue("メッセージID");
  if (!sheetChat.getRange(1, 7).getValue()) sheetChat.getRange(1, 7).setValue("状態");
  if (!sheetChat.getRange(1, 8).getValue()) sheetChat.getRange(1, 8).setValue("添付JSON");
}

function appendChatRow(sheetChat, rowData) {
  const nextRow = Math.max(sheetChat.getLastRow() + 1, 2);
  sheetChat.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
}

function getChatRows(sheetChat) {
  const lastRow = sheetChat.getLastRow();
  return lastRow > 0 ? sheetChat.getRange(1, 1, lastRow, 8).getValues() : [];
}

function chatMessageExists(sheetChat, senderId, messageId) {
  if (!sheetChat || !senderId || !messageId || sheetChat.getLastRow() <= 1) return false;
  const lastRow = sheetChat.getLastRow();
  const startRow = Math.max(2, lastRow - 199);
  const rows = sheetChat.getRange(startRow, 1, lastRow - startRow + 1, 6).getValues();
  return rows.some(row => cleanCell(row[0]) === senderId && cleanCell(row[5]) === messageId);
}

function getChatImageFolder() {
  const properties = PropertiesService.getScriptProperties();
  const savedFolderId = properties.getProperty("CHAT_IMAGE_FOLDER_ID");

  if (savedFolderId) {
    try {
      return DriveApp.getFolderById(savedFolderId);
    } catch (e) {
      properties.deleteProperty("CHAT_IMAGE_FOLDER_ID");
    }
  }

  const folder = DriveApp.createFolder("平工マッチング_チャット画像");
  properties.setProperty("CHAT_IMAGE_FOLDER_ID", folder.getId());
  return folder;
}

function authorizeChatDrive() {
  const folder = getChatImageFolder();
  Logger.log("チャット画像フォルダを使用できます: " + folder.getUrl());
  return "チャット画像保存用のDrive権限を確認しました";
}

function saveChatAttachments(attachments, senderId) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  const folder = getChatImageFolder();
  const savedUrls = [];
  const errors = [];
  let totalBytes = 0;

  attachments.slice(0, 8).forEach((attachment, index) => {
    let createdFile = null;
    try {
      const dataUrl = String(attachment && attachment.data || "");
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex < 0) throw new Error("画像データの形式が正しくありません");

      const metadata = dataUrl.slice(0, commaIndex);
      const base64 = dataUrl.slice(commaIndex + 1);
      const mimeMatch = metadata.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);
      const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : "image/jpeg";
      if (!mimeMatch || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("JPEG・PNG・WebP以外の画像は送信できません");

      const bytes = Utilities.base64Decode(base64);
      if (bytes.length > 450 * 1024) throw new Error("画像容量が450KBを超えています");
      totalBytes += bytes.length;
      if (totalBytes > 2 * 1024 * 1024) throw new Error("画像の合計容量が2MBを超えています");

      const originalName = cleanCell(attachment && attachment.name) || `image-${index + 1}.jpg`;
      const safeName = originalName.replace(/[^\w.\-ぁ-んァ-ヶ一-龠]/g, "_").slice(0, 80);
      const fileName = `${Date.now()}_${cleanCell(senderId) || "user"}_${safeName}`;
      try {
        createdFile = folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));
      } catch (createError) {
        throw new Error("Driveへの画像ファイル作成に失敗しました: " + String(createError && createError.message ? createError.message : createError));
      }
      savedUrls.push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(createdFile.getId())}&sz=w1200`);
    } catch (e) {
      if (createdFile) {
        try { createdFile.setTrashed(true); } catch (cleanupError) { console.error("未使用画像を片付けられませんでした", cleanupError); }
      }
      console.log(`チャット画像保存失敗: ${e}`);
      const detail = String(e && e.message ? e.message : e).replace(/\s+/g, " ").slice(0, 160);
      errors.push(`画像${index + 1}: ${detail}`);
    }
  });

  if (errors.length > 0) {
    deleteChatAttachmentUrls(savedUrls);
    throw new Error(errors.join(" / "));
  }
  return savedUrls;
}

function deleteChatAttachmentUrls(urls) {
  (Array.isArray(urls) ? urls : []).forEach(url => {
    try {
      const match = String(url || "").match(/[?&]id=([^&]+)/);
      if (match && match[1]) DriveApp.getFileById(decodeURIComponent(match[1])).setTrashed(true);
    } catch (error) {
      console.error("未使用チャット画像の削除失敗", error);
    }
  });
}

function getChatHiddenAt(sheetHiddenChat, user1, user2) {
  if (!sheetHiddenChat || sheetHiddenChat.getLastRow() <= 1) return 0;

  const rows = sheetHiddenChat.getDataRange().getValues();
  let hiddenAt = 0;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== user1 || rows[i][1] !== user2) continue;
    const currentHiddenAt = new Date(rows[i][2]).getTime();
    if (!Number.isNaN(currentHiddenAt) && currentHiddenAt > hiddenAt) {
      hiddenAt = currentHiddenAt;
    }
  }

  return hiddenAt;
}

function normalizeRecruitmentDuration(value) {
  const minutes = Number(value);
  return RECRUITMENT_DURATION_MINUTES.includes(minutes) ? minutes : 1440;
}

function touchOnlineUser(sheetOnline, userId) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(3000);
    const rows = sheetOnline.getLastRow() > 1 ? sheetOnline.getDataRange().getValues() : [];
    let rowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || "") === userId) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      sheetOnline.appendRow([userId, new Date()]);
    } else {
      sheetOnline.getRange(rowIndex, 2).setValue(new Date());
    }
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getOnlineUserIds(sheetOnline) {
  if (!sheetOnline || sheetOnline.getLastRow() <= 1) return [];

  const cutoff = Date.now() - ONLINE_TIMEOUT_MS;
  const rows = sheetOnline.getDataRange().getValues();
  const userIds = [];
  const seen = {};

  for (let i = 1; i < rows.length; i++) {
    const userId = String(rows[i][0] || "").trim();
    const lastSeen = new Date(rows[i][1]).getTime();

    if (userId && !Number.isNaN(lastSeen) && lastSeen >= cutoff && !seen[userId]) {
      seen[userId] = true;
      userIds.push(userId);
    }
  }

  return userIds;
}

function userExists(sheetUser, userId) {
  if (!sheetUser || sheetUser.getLastRow() <= 1) return false;
  const rows = sheetUser.getDataRange().getValues();
  return rows.slice(1).some(row => row[0] === userId || row[5] === userId);
}

function isBlockedBetween(sheetBlock, userA, userB) {
  if (!sheetBlock || !userA || !userB || sheetBlock.getLastRow() <= 1) return false;
  const rows = sheetBlock.getDataRange().getValues();
  return isBlockedInRows(rows, userA, userB);
}

function getBlockedPartnerIds(sheetBlock, userId) {
  const partners = new Set();
  if (!sheetBlock || !userId || sheetBlock.getLastRow() <= 1) return partners;
  const rows = sheetBlock.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (cleanCell(rows[i][3]) === "解除") continue;
    if (cleanCell(rows[i][0]) === userId) partners.add(cleanCell(rows[i][1]));
    if (cleanCell(rows[i][1]) === userId) partners.add(cleanCell(rows[i][0]));
  }
  return partners;
}

function isBlockedInRows(rows, userA, userB) {
  if (!Array.isArray(rows) || !userA || !userB) return false;
  return rows.slice(1).some(row => {
    if (row[3] === "解除") return false;
    return (row[0] === userA && row[1] === userB) || (row[0] === userB && row[1] === userA);
  });
}

function hasWeakNumberSequence(password) {
  const numberRuns = String(password).match(/\d{4,}/g) || [];
  return numberRuns.some(run => {
    for (let i = 0; i <= run.length - 4; i++) {
      const digits = run.slice(i, i + 4).split("").map(Number);
      const same = digits.every(digit => digit === digits[0]);
      const ascending = digits.slice(1).every((digit, index) => digit === (digits[index] + 1) % 10);
      const descending = digits.slice(1).every((digit, index) => digit === (digits[index] + 9) % 10);
      if (same || ascending || descending) return true;
    }
    return false;
  });
}

function validatePasswordPolicy(password) {
  const value = String(password || "");
  if (value.length < 4) return "パスワードは4文字以上で入力してください";
  if (value.length > 128) return "パスワードは128文字以内で入力してください";
  if (!/^[\x21-\x7E]+$/.test(value)) return "パスワードは半角英数字・記号のみ使用できます";
  if (!/[A-Z]/.test(value)) return "パスワードに英大文字を1文字以上含めてください";
  if (!/[a-z]/.test(value)) return "パスワードに英小文字を1文字以上含めてください";
  if (!/[0-9]/.test(value)) return "パスワードに数字を1文字以上含めてください";
  if (!/[^A-Za-z0-9]/.test(value)) return "パスワードに記号を1文字以上含めてください";
  if (hasWeakNumberSequence(value)) return "同じ数字4桁の繰り返しや、1234・4321のような4桁の連番は使用できません";
  return "";
}

function hashPassword(password) {
  const salt = Utilities.getUuid().replace(/-/g, "");
  const signature = Utilities.computeHmacSha256Signature(String(password || ""), getUserTokenSecret() + "|" + salt);
  return "v2$" + salt + "$" + Utilities.base64EncodeWebSafe(signature);
}

function legacyPasswordHash(password) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password || ""), Utilities.Charset.UTF_8);
  return rawHash.map(byte => {
    const v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function verifyPassword(savedPassword, inputPassword) {
  const saved = String(savedPassword || "");
  if (saved.startsWith("v2$")) {
    const parts = saved.split("$");
    if (parts.length !== 3 || !parts[1] || !parts[2]) return false;
    const signature = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(inputPassword || ""), getUserTokenSecret() + "|" + parts[1]));
    return constantTimeEquals(parts[2], signature);
  }
  return constantTimeEquals(saved, legacyPasswordHash(inputPassword));
}

function generateResetToken() { return Utilities.getUuid(); }
function generateVerificationCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function generateLineLinkCode(linkSheet) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const existing = linkSheet && linkSheet.getLastRow() > 1 ? linkSheet.getRange(2, 2, linkSheet.getLastRow() - 1, 1).getValues().flat().map(cleanCell) : [];
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    if (!existing.includes(code)) return code;
  }
  return Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function upsertAndroidDeviceToken(deviceSheet, userId, fcmToken, platform) {
  const now = new Date();
  if (deviceSheet.getLastRow() > 1) {
    const rows = deviceSheet.getRange(2, 1, deviceSheet.getLastRow() - 1, 5).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (cleanCell(rows[i][1]) !== fcmToken) continue;
      deviceSheet.getRange(i + 2, 1, 1, 5).setValues([[userId, safeSheetText(fcmToken, 4096), safeSheetText(platform, 32), now, "有効"]]);
      return;
    }
  }
  deviceSheet.appendRow([userId, safeSheetText(fcmToken, 4096), safeSheetText(platform, 32), now, "有効"]);
}

function getFcmServiceAccount() {
  const properties = PropertiesService.getScriptProperties();
  const jsonText = properties.getProperty("FCM_SERVICE_ACCOUNT_JSON") || "";
  let account = null;
  if (jsonText) {
    try {
      account = JSON.parse(jsonText);
    } catch (e) {
      console.error("FCM_SERVICE_ACCOUNT_JSONの解析に失敗しました", e);
      return null;
    }
  }

  const projectId = cleanCell((account && account.project_id) || properties.getProperty("FCM_PROJECT_ID"));
  const clientEmail = cleanCell((account && account.client_email) || properties.getProperty("FCM_CLIENT_EMAIL"));
  const privateKey = String((account && account.private_key) || properties.getProperty("FCM_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId: projectId, clientEmail: clientEmail, privateKey: privateKey };
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? Utilities.newBlob(value).getBytes() : value;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function getFcmAccessToken(account) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("fcm-access-token");
  if (cached) return cached;

  try {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = base64UrlEncode(JSON.stringify({
      iss: account.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600
    }));
    const unsignedJwt = header + "." + claim;
    const signature = base64UrlEncode(Utilities.computeRsaSha256Signature(unsignedJwt, account.privateKey));
    const assertion = unsignedJwt + "." + signature;
    const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assertion
      },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      console.error("FCMアクセストークン取得失敗", response.getResponseCode(), response.getContentText().slice(0, 500));
      return "";
    }
    const token = cleanCell(JSON.parse(response.getContentText()).access_token);
    if (token) cache.put("fcm-access-token", token, 3300);
    return token;
  } catch (error) {
    console.error("FCMアクセストークン取得エラー", error);
    return "";
  }
}

function sendAndroidPushNotification(ss, toUserId, title, body, chatTargetUserId) {
  const account = getFcmServiceAccount();
  if (!account) {
    recordAndroidPushLog(ss, toUserId, "設定不足", "FCM_SERVICE_ACCOUNT_JSONまたはFCM設定プロパティがありません");
    return;
  }
  const deviceSheet = ss.getSheetByName("Android通知");
  if (!deviceSheet || deviceSheet.getLastRow() <= 1) {
    recordAndroidPushLog(ss, toUserId, "送信先なし", "Android通知シートに端末登録がありません");
    return;
  }
  const accessToken = getFcmAccessToken(account);
  if (!accessToken) {
    recordAndroidPushLog(ss, toUserId, "認証失敗", "FCMアクセストークンを取得できませんでした");
    return;
  }

  const rows = deviceSheet.getRange(2, 1, deviceSheet.getLastRow() - 1, 5).getValues();
  const targets = rows.filter(row => cleanCell(row[0]) === cleanCell(toUserId) && cleanCell(row[1]) && cleanCell(row[4]) !== "無効");
  if (targets.length === 0) {
    recordAndroidPushLog(ss, toUserId, "送信先なし", "対象UserIDの有効なFCMトークンがありません");
    return;
  }
  const endpoint = "https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(account.projectId) + "/messages:send";
  targets.forEach(row => {
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
    };
    try {
      const response = UrlFetchApp.fetch(endpoint, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + accessToken },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      const code = response.getResponseCode();
      if (code < 200 || code >= 300) {
        const responseText = response.getContentText();
        console.error("FCM通知送信失敗", code, responseText.slice(0, 500));
        recordAndroidPushLog(ss, toUserId, "送信失敗", `${code}: ${responseText.slice(0, 500)}`);
        if (/UNREGISTERED|INVALID_ARGUMENT/.test(responseText)) markAndroidDeviceTokenInvalid(deviceSheet, row[1]);
      } else {
        recordAndroidPushLog(ss, toUserId, "送信成功", `HTTP ${code}`);
      }
    } catch (error) {
      console.error("FCM通知送信エラー", error);
      recordAndroidPushLog(ss, toUserId, "送信エラー", String(error && error.message ? error.message : error).slice(0, 500));
    }
  });
}

function recordAndroidPushLog(ss, toUserId, status, detail) {
  try {
    const logSheet = getOrCreateSheet(ss, "Android通知ログ", ["記録日時", "対象UserID", "結果", "詳細"]);
    logSheet.appendRow([new Date(), safeSheetText(toUserId, 128), safeSheetText(status, 32), safeSheetText(detail, 1000)]);
  } catch (error) {
    console.error("Android通知ログの記録失敗", error);
  }
}

function markAndroidDeviceTokenInvalid(deviceSheet, fcmToken) {
  if (!deviceSheet || deviceSheet.getLastRow() <= 1) return;
  const tokens = deviceSheet.getRange(2, 2, deviceSheet.getLastRow() - 1, 1).getValues();
  const index = tokens.findIndex(row => cleanCell(row[0]) === cleanCell(fcmToken));
  if (index >= 0) deviceSheet.getRange(index + 2, 5).setValue("無効");
}

function revokeAndroidDeviceToken(deviceSheet, userId, fcmToken) {
  const rows = deviceSheet.getRange(2, 1, deviceSheet.getLastRow() - 1, 5).getValues();
  rows.forEach((row, index) => {
    if (cleanCell(row[0]) === cleanCell(userId) && cleanCell(row[1]) === cleanCell(fcmToken)) {
      deviceSheet.getRange(index + 2, 5).setValue("無効");
    }
  });
}

function sendLineNotification(toUserId, messageText) {
  if (!LINE_ACCESS_TOKEN || LINE_ACCESS_TOKEN.includes("ここに")) return;

  const url = "https://api.line.me/v2/bot/message/push";

  const payload = {
    to: toUserId,
    messages: [
      {
        type: "text",
        text: messageText
      }
    ]
  };

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error("LINE通知エラー:", e);
  }
}

function replyLineMessage(replyToken, messageText) {
  if (!LINE_ACCESS_TOKEN || !replyToken) {
    console.log("エラー: アクセストークンまたはreplyTokenがありません");
    return;
  }

  const url = "https://api.line.me/v2/bot/message/reply";

  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: "text",
        text: messageText
      }
    ]
  };

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    console.log("LINE APIレスポンスコード: " + response.getResponseCode());
    console.log("LINE APIレスポンス内容: " + response.getContentText());
  } catch (e) {
    console.error("LINE返信エラー:", e);
  }
}
