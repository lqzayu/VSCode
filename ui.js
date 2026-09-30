const THEME_STORAGE_KEY = "heikoThemePreference";	// 外観設定の保存名を決める

function normalizeThemePreference(value) {	// 外観設定の値を確認する
    return value === "light" || value === "dark" ? value : "auto";	// 使用できる外観設定だけを返す
}	// 処理のまとまりを閉じる

function readThemePreference() {	// 保存済みの外観設定を読み込む
    try {	// 保存情報の読み込みを試す
        return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));	// 保存値を整えて返す
    } catch (error) {	// 保存情報を読めない場合に処理する
        return "auto";	// 端末設定を初期値にする
    }	// 処理のまとまりを閉じる
}	// 処理のまとまりを閉じる

function applyThemePreference(value, save = true) {	// 外観設定を画面へ反映する
    const preference = normalizeThemePreference(value);	// 外観設定の値を整える
    if (preference === "auto") {	// 端末設定を使う場合に処理する
        document.documentElement.removeAttribute("data-theme");	// 手動設定を解除する
    } else {	// 手動設定を使う場合に処理する
        document.documentElement.setAttribute("data-theme", preference);	// 選択した外観を設定する
    }	// 処理のまとまりを閉じる
    if (save) {	// 保存が必要な場合に処理する
        try {	// 外観設定の保存を試す
            localStorage.setItem(THEME_STORAGE_KEY, preference);	// 選択した外観を保存する
        } catch (error) {	// 保存できない場合に処理する
            console.warn("外観設定を保存できませんでした。", error);	// 保存失敗を記録する
        }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる
    const selector = document.getElementById("theme-preference");	// 外観設定の選択欄を取得する
    if (selector) selector.value = preference;	// 選択欄へ現在値を表示する
    return preference;	// 適用した外観設定を返す
}	// 処理のまとまりを閉じる

applyThemePreference(readThemePreference(), false);	// ページ表示前に外観設定を反映する
window.applyThemePreference = applyThemePreference;	// ページ側から外観設定を変更できるようにする
window.getThemePreference = readThemePreference;	// ページ側から外観設定を確認できるようにする
const HEIKO_SESSION_KEYS = ["userId", "userEmail", "userName", "profileImage", "sessionToken", "adminSessionToken", "adminToken", "isImpersonating", "chatTarget"];	// ログアウト時に消す情報をまとめる
function clearHeikoSession() {	// 外観設定を残してログイン情報だけ消す
    HEIKO_SESSION_KEYS.forEach(key => localStorage.removeItem(key));	// 認証情報を一件ずつ削除する
}	// 処理のまとまりを閉じる
window.clearHeikoSession = clearHeikoSession;	// 各ページから共通処理を使えるようにする
function handleHeikoSessionResponse(result) {	// APIからログイン切れが返った場合に処理する
    const message = result && result.status === "error" ? String(result.message || "") : "";	// エラー内容を取得する
    if (!message.includes("ログインの有効期限")) return false;	// 通常のエラーはそのまま扱う
    clearHeikoSession();	// 期限切れのログイン情報を消す
    window.location.replace("index.html");	// ログイン画面へ戻す
    return true;	// ログイン切れを処理したことを返す
}	// ログイン切れ処理を閉じる
window.handleHeikoSessionResponse = handleHeikoSessionResponse;	// 各ページからログイン切れ処理を使えるようにする

function installPageRefreshButton() {	// 各ページのヘッダーへ更新ボタンを追加する
    if (!document.body) return;	// ページ本体がない場合は処理しない
    if (document.getElementById("heiko-page-refresh")) return;	// 二重追加を防ぐ

    const navbar = document.querySelector(".navbar");	// 共通ヘッダーを取得する

    const button = document.createElement("button");	// 更新ボタンを作る
    button.id = "heiko-page-refresh";	// 更新ボタンを識別する
    button.type = "button";	// フォーム送信を防ぐ
    button.className = "heiko-page-refresh";	// 共通スタイルを適用する
    if (!navbar) button.classList.add("is-floating");	// 共通ヘッダーがないページでは右上へ固定する
    button.setAttribute("aria-label", "ページを更新");	// 読み上げ用の説明を設定する
    button.innerHTML = "<span aria-hidden=\"true\">↻</span><span>更新</span>";	// ボタンの表示内容を設定する
    button.addEventListener("click", () => {	// 更新ボタンの操作を受け取る
        button.disabled = true;	// 連続操作を防ぐ
        button.classList.add("is-loading");	// 更新中の見た目へ変更する
        button.querySelector("span").textContent = "⟳";	// 更新中の記号を表示する
        window.location.reload();	// 現在のページを再読み込みする
    });	// 操作イベントの登録を終える
    (navbar || document.body).appendChild(button);	// ヘッダーまたはページ右上へボタンを追加する
}	// 更新ボタンの追加処理を閉じる

function prefetchHeikoPages() {	// 主要ページをバックグラウンドで先読みする
    if (!document.body || document.body.dataset.page !== "main") return;	// ホーム画面だけで実行する

    const pages = [	// 先読みするページをまとめる
        "messages.html",	// メッセージ一覧を先読みする
        "chat.html",	// チャット画面を先読みする
        "profile.html",	// マイページを先読みする
        "ai-study.html",	// AI相談画面を先読みする
        "admin.html",	// 管理者画面を先読みする
        "privacy.html",	// プライバシーポリシーを先読みする
        "terms.html"	// 利用規約を先読みする
    ];	// 先読み対象の定義を終える

    const cacheKey = "heiko-prefetched-pages-v20260930";	// 先読み済み状態の保存名を決める
    try {	// sessionStorageの利用を試す
        if (sessionStorage.getItem(cacheKey) === "1") return;	// 同じタブでは再実行しない
        sessionStorage.setItem(cacheKey, "1");	// 先読み開始済みとして保存する
    } catch (error) {	// 保存できない環境に備える
        console.warn("ページ先読み状態を保存できませんでした。", error);	// 保存失敗を記録する
    }	// sessionStorage処理を閉じる

    Promise.allSettled(pages.map(page => {	// ページを並列で取得する
        return fetch(page, { cache: "force-cache", credentials: "same-origin" }).then(response => {	// HTMLをキャッシュへ読み込む
            if (!response.ok) throw new Error(`${page}: HTTP ${response.status}`);	// 取得失敗を検出する
            return response.text();	// 本文を最後まで読み込む
        });	// ページ取得を完了する
    })).then(results => {	// 先読み結果を受け取る
        const failed = results.filter(result => result.status === "rejected").length;	// 失敗したページ数を数える
        if (failed > 0) console.info(`ページ先読み: ${pages.length - failed}/${pages.length}件完了`);	// 部分的な失敗だけ記録する
    });	// 並列先読みを完了する
}	// ページ先読み処理を閉じる

function installHeikoSharedStyles() {	// 共通ボタンのスタイルを追加する
    if (document.getElementById("heiko-shared-ui-style")) return;	// スタイルの二重追加を防ぐ

    const style = document.createElement("style");	// style要素を作る
    style.id = "heiko-shared-ui-style";	// style要素を識別する
    style.textContent = `
        .heiko-page-refresh {
            display: inline-flex;
            width: auto;
            align-items: center;
            justify-content: center;
            gap: 5px;
            min-height: 36px;
            padding: 7px 11px;
            margin-left: 8px;
            border: 1px solid var(--ui-line, rgba(28, 189, 197, .25));
            border-radius: 10px;
            background: var(--ui-paper, rgba(255, 255, 255, .86));
            color: var(--ui-ink, #164e63);
            font: inherit;
            font-size: 12px;
            font-weight: 800;
            line-height: 1;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(15, 78, 88, .08);
            transition: transform .2s ease, box-shadow .2s ease, opacity .2s ease;
            white-space: nowrap;
        }
        .heiko-page-refresh:hover {
            transform: translateY(-1px);
            box-shadow: 0 7px 16px rgba(15, 78, 88, .13);
        }
        .heiko-page-refresh:focus-visible {
            outline: 3px solid rgba(28, 189, 197, .28);
            outline-offset: 2px;
        }
        .heiko-page-refresh span:first-child {
            display: inline-block;
            font-size: 18px;
            line-height: 12px;
        }
        .heiko-page-refresh.is-loading span:first-child {
            animation: heiko-refresh-spin .8s linear infinite;
        }
        .heiko-page-refresh:disabled {
            opacity: .7;
            cursor: wait;
        }
        .heiko-page-refresh.is-floating {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 1000;
        }
        @keyframes heiko-refresh-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @media (max-width: 760px) {
            .heiko-page-refresh {
                min-width: 40px;
                min-height: 40px;
                padding: 7px 9px;
                margin-left: 5px;
                border-radius: 11px;
            }
            .heiko-page-refresh span:last-child {
                display: none;
            }
        }
    `;	// 共通スタイルを定義する
    document.head.appendChild(style);	// style要素をページへ追加する
}	// 共通スタイル追加処理を閉じる

(function installUsageLogging() {	// GAS通信を利用ログへ記録する仕組みを準備する
    const nativeFetch = window.fetch.bind(window);	// 元の通信関数を保存する
    const ignoredModes = new Set(["recordUsageLog", "recordUsageLogs", "heartbeat", "login", "register", "verifyEmail", "resendVerificationCode", "forgotPassword", "resetPassword", "verify_face_1toN", "verify_face_for_user"]);	// 記録しない処理をまとめる
    const usageLogQueue = [];	// 利用ログを一時的にまとめる
    let usageLogTimer = null;	// まとめて送るタイマーを保持する
    let usageLogUrl = "";	// 実際に使われたGASのURLを保持する

    function parsePayload(body) {	// 通信本文からJSONを読み取る
        if (typeof body !== "string") return null;	// JSON文字列以外は対象外にする
        try {	// JSONの読み込みを試す
            const payload = JSON.parse(body);	// 通信本文をオブジェクトへ変換する
            return payload && typeof payload === "object" ? payload : null;	// オブジェクトだけ返す
        } catch (error) {	// 壊れたJSONに備える
            return null;	// 読み込み失敗を無視する
        }	// JSON読み込みを閉じる
    }	// 本文解析を閉じる

    function getRequestUrl(input) {	// fetchの入力からURLを取得する
        return typeof input === "string" ? input : input && input.url ? input.url : "";	// URL文字列を返す
    }	// URL取得を閉じる

    function flushUsageLogs() {	// たまった利用ログを一度に送る
        const sessionToken = localStorage.getItem("sessionToken") || "";	// 現在のセッションを取得する
        const userId = localStorage.getItem("userId") || localStorage.getItem("userEmail") || "";	// 本人のUserIDを取得する
        if (!sessionToken || !userId || usageLogQueue.length === 0) return;	// 送る情報がなければ終了する
        if (usageLogTimer) clearTimeout(usageLogTimer);	// 予約済みの送信を解除する
        usageLogTimer = null;	// タイマー情報を破棄する
        const events = usageLogQueue.splice(0, 20);	// 一度に送る件数を制限する
        const logPayload = {	// ログ保存用の本文を作る
            mode: "recordUsageLogs",	// 一括保存モードを指定する
            userId: String(userId).slice(0, 64),	// UserIDを短くして送る
            events: events,	// まとめた利用ログを送る
            sessionToken: sessionToken	// 本人確認情報を送る
        };	// ログ本文の定義を閉じる
        nativeFetch(usageLogUrl || window.HEIKO_GAS_URL || "https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec", {	// 元の通信と同じGASへログを送る
            method: "POST",	// POST通信を使う
            body: JSON.stringify(logPayload),	// ログ本文をJSONへ変換する
            keepalive: true	// 画面移動直前でも送信を続ける
        }).catch(() => {});	// ログ失敗で本来の操作を止めない
        if (usageLogQueue.length > 0) usageLogTimer = setTimeout(flushUsageLogs, 1500);	// 残りがあれば続けて送る
    }	// 一括送信を閉じる

    function queueUsageLog(url, payload, result, durationMs, errorMessage) {	// 利用ログを送信待ちへ追加する
        if (!payload || payload.adminToken) return;	// 管理者操作は記録しない
        if (url) usageLogUrl = url;	// 通信に使ったGASのURLを保存する
        usageLogQueue.push({	// 利用イベントを追加する
            sourceMode: String(payload.mode || "unknown").slice(0, 80),	// 元のAPIモードを保存する
            result: result,	// 成否を保存する
            durationMs: Math.round(durationMs),	// 処理時間を保存する
            errorMessage: String(errorMessage || "").slice(0, 300)	// エラー内容を短く保存する
        });	// 利用イベントの追加を閉じる
        if (usageLogQueue.length >= 10 || result === "error") {	// 件数が多い場合や失敗時は早めに送る
            flushUsageLogs();	// たまったログを送る
        } else if (!usageLogTimer) {	// 通常時は一定時間まとめる
            usageLogTimer = setTimeout(flushUsageLogs, 20000);	// 二十秒後に一括送信する
        }	// 送信時期の判定を閉じる
    }	// ログ追加処理を閉じる

    window.fetch = async function (input, init = {}) {	// すべてのGAS通信を確認する
        const url = getRequestUrl(input);	// 通信先URLを取得する
        const payload = parsePayload(init.body);	// 通信本文を取得する
        const shouldLog = Boolean(payload && payload.mode && url.includes("script.google.com/macros/") && !ignoredModes.has(payload.mode) && !payload.adminToken);	// 記録対象か確認する
        const startedAt = performance.now();	// 通信開始時刻を保存する

        try {	// 通信を実行する
            const response = await nativeFetch(input, init);	// 元のfetchで通信する
            if (shouldLog) {	// 記録対象の場合に処理する
                const copy = response.clone();	// 本来の処理を邪魔しない複製を作る
                copy.json().then(result => {	// GASの応答を読み込む
                    const status = result && result.status === "success" ? "success" : "error";	// 応答から成否を判定する
                    queueUsageLog(url, payload, status, performance.now() - startedAt, status === "error" ? result.message : "");	// 結果を保存する
                }).catch(error => queueUsageLog(url, payload, "error", performance.now() - startedAt, error.message));	// JSON読込失敗を保存する
            }	// 記録対象の処理を閉じる
            return response;	// 元の応答を返す
        } catch (error) {	// 通信失敗に備える
            if (shouldLog) queueUsageLog(url, payload, "error", performance.now() - startedAt, error.message);	// 通信エラーを保存する
            throw error;	// 元のエラーを呼び出し元へ返す
        }	// 通信処理を閉じる
    };	// fetchの差し替えを完了する

    document.addEventListener("visibilitychange", () => {	// 画面が隠れる前にログを送る
        if (document.visibilityState === "hidden") flushUsageLogs();	// 未送信ログを一括送信する
    });	// 表示状態の監視を閉じる
})();	// 利用ログ記録の準備を完了する

document.addEventListener("DOMContentLoaded", () => {	// 画面の読み込み完了後に処理する
    const selector = document.getElementById("theme-preference");	// 外観設定の選択欄を取得する
    if (selector) selector.value = readThemePreference();	// 保存済みの外観設定を選択欄へ表示する
    installHeikoSharedStyles();	// 共通ボタンのスタイルを読み込む
    installPageRefreshButton();	// ページ上部へ更新ボタンを追加する
    if (document.body && document.body.dataset.page === "main") {	// ホーム画面だけ先読みを開始する
        if ("requestIdleCallback" in window) {	// ブラウザが待機時間を通知できる場合に処理する
            window.requestIdleCallback(prefetchHeikoPages, { timeout: 3000 });	// 初期通信が落ち着いてから先読みする
        } else {	// 待機時間通知に対応していない場合に処理する
            window.setTimeout(prefetchHeikoPages, 1800);	// 初期表示の後に先読みする
        }	// 先読み開始方法の判定を閉じる
    }	// ホーム画面の先読み条件を閉じる
});	// 読み込み完了時の処理を登録する

(function () {	// 処理のまとまりを始める
    function getNoticeType(message) {	// 関数を定義
        const text = String(message || "");	// 定数を定義
        if (/失敗|エラー|通信|不足|見つかりません|入力してください|必要です|無効|権限|間違|ありません/.test(text)) {	// 条件に応じて処理を分ける
            return "error";	// 結果を返す
        }	// 処理のまとまりを閉じる
        if (/完了|保存|削除|受け付け|成功|送りました|しました|更新/.test(text)) {	// 条件に応じて処理を分ける
            return "success";	// 結果を返す
        }	// 処理のまとまりを閉じる
        return "info";	// 結果を返す
    }	// 処理のまとまりを閉じる

    function getRoot() {	// 関数を定義
        let root = document.getElementById("ui-notice-root");	// 状態を保持
        if (!root) {	// 条件に応じて処理を分ける
            root = document.createElement("div");	// 処理を完了する
            root.id = "ui-notice-root";	// 処理を続ける
            root.setAttribute("aria-live", "polite");	// 処理を完了する
            root.setAttribute("aria-atomic", "true");	// 処理を完了する
            document.body.appendChild(root);	// 処理を完了する
        }	// 処理のまとまりを閉じる
        return root;	// 結果を返す
    }	// 処理のまとまりを閉じる

    function showNotice(message, type) {	// 関数を定義
        const root = getRoot();	// 定数を定義
        const notice = document.createElement("div");	// 定数を定義
        const noticeType = type || getNoticeType(message);	// 定数を定義
        const icon = noticeType === "success" ? "✓" : noticeType === "error" ? "!" : "i";	// 定数を定義

        notice.className = `ui-notice ui-notice-${noticeType}`;	// 処理を続ける
        notice.setAttribute("role", noticeType === "error" ? "alert" : "status");	// 処理を完了する
        notice.innerHTML = `
            <span class="ui-notice-icon">${icon}</span>
            <span class="ui-notice-message"></span>
            <button type="button" class="ui-notice-close" aria-label="通知を閉じる">×</button>
        `;
        notice.querySelector(".ui-notice-message").textContent = String(message || "");	// 処理を完了する
        notice.querySelector(".ui-notice-close").addEventListener("click", () => removeNotice(notice));	// 操作イベントを登録
        root.appendChild(notice);	// 処理を完了する

        requestAnimationFrame(() => notice.classList.add("is-visible"));	// 処理を完了する
        const duration = noticeType === "error" ? 5200 : 3600;	// 定数を定義
        let timer = setTimeout(() => removeNotice(notice), duration);	// 状態を保持
        notice.addEventListener("mouseenter", () => clearTimeout(timer));	// 操作イベントを登録
        notice.addEventListener("mouseleave", () => {	// 操作イベントを登録
            timer = setTimeout(() => removeNotice(notice), duration);	// 時間を置いて処理する
        });	// 処理を完了する
    }	// 処理のまとまりを閉じる

    function removeNotice(notice) {	// 関数を定義
        if (!notice || notice.classList.contains("is-leaving")) return;	// 条件に応じて処理を分ける
        notice.classList.remove("is-visible");	// 処理を完了する
        notice.classList.add("is-leaving");	// 処理を完了する
        setTimeout(() => notice.remove(), 220);	// 時間を置いて処理する
    }	// 処理のまとまりを閉じる

    window.showNotice = showNotice;	// 処理を続ける
    window.alert = message => showNotice(message);	// 処理結果を知らせる
})();	// 処理を完了する
