(() => {	// 処理のまとまりを始める
    const ONLINE_GAS_URL = "https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec";	// 定数を定義
    const HEARTBEAT_INTERVAL_MS = 45 * 1000;	// オンライン更新の通信回数を抑える
    let heartbeatTimer = null;	// 状態を保持
    let heartbeatStartTimer = null;	// 初回送信を少し遅らせるタイマーを保持する
    let heartbeatRequest = null;	// 状態を保持
    let heartbeatController = null;	// 実行中の通信を保持する

    function getCurrentUserId() {	// 関数を定義
        if (!localStorage.getItem("sessionToken")) return "";	// 本人確認情報がなければ更新しない
        return localStorage.getItem("userId") || localStorage.getItem("userEmail") || "";	// 端末内の保存情報を扱う
    }	// 処理のまとまりを閉じる

    function returnToAdmin() {	// 関数を定義
        localStorage.setItem("userEmail", "admin");	// 端末内の保存情報を扱う
        localStorage.setItem("userId", "admin");	// 端末内の保存情報を扱う
        localStorage.setItem("userName", "管理者");	// 端末内の保存情報を扱う
        localStorage.setItem("profileImage", "");	// 端末内の保存情報を扱う
        localStorage.setItem("sessionToken", localStorage.getItem("adminSessionToken") || "");	// 管理者本人のログイン情報を戻す
        localStorage.removeItem("adminSessionToken");	// 退避した情報を消す
        localStorage.removeItem("isImpersonating");	// 端末内の保存情報を扱う
        window.location.href = "admin.html";	// 画面表示を更新する
    }	// 処理のまとまりを閉じる

    function renderImpersonationBanner() {	// 関数を定義
        if (!document.body || document.body.dataset.page === "admin") return;	// 条件に応じて処理を分ける

        let banner = document.getElementById("impersonate-bar");	// 状態を保持
        if (localStorage.getItem("isImpersonating") !== "true") {	// 端末内の保存情報を扱う
            if (banner) banner.style.display = "none";	// 条件に応じて処理を分ける
            return;	// 結果を返す
        }	// 処理のまとまりを閉じる

        if (!banner) {	// 条件に応じて処理を分ける
            banner = document.createElement("div");	// 処理を完了する
            banner.id = "impersonate-bar";	// 処理を続ける
            document.body.prepend(banner);	// 処理を完了する
        }	// 処理のまとまりを閉じる

        banner.style.cssText = "display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;background:#fef08a;color:#854d0e;text-align:center;padding:10px;font-weight:700;font-size:13px;border-bottom:1px solid #fde047;z-index:1000;position:relative;box-sizing:border-box;";	// 処理を続ける

        const userName = localStorage.getItem("userName") || "ユーザー";	// 定数を定義
        const userId = getCurrentUserId();	// 定数を定義
        const text = document.createElement("span");	// 定数を定義
        text.append("⚠️ 現在 ");	// 処理を完了する
        const identity = document.createElement("span");	// 定数を定義
        identity.id = "impersonate-user-id";	// 処理を続ける
        identity.style.textDecoration = "underline";	// 処理を続ける
        identity.textContent = `${userName} (${userId})`;	// 処理を続ける
        text.append(identity, " として代理ログイン中です。");	// 処理を完了する

        const button = document.createElement("button");	// 定数を定義
        button.type = "button";	// 処理を続ける
        button.textContent = "管理者ダッシュボードに戻る";	// 処理を続ける
        button.style.cssText = "background:#854d0e;color:#fff;border:0;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;";	// 処理を続ける
        button.addEventListener("click", returnToAdmin);	// 操作イベントを登録

        banner.replaceChildren(text, button);	// 処理を完了する
    }	// 処理のまとまりを閉じる

    async function sendHeartbeat() {	// 関数を定義
        const userId = getCurrentUserId();	// 定数を定義
        if (!userId || document.visibilityState !== "visible" || heartbeatRequest) return heartbeatRequest;	// 条件に応じて処理を分ける

        heartbeatRequest = (async () => {	// 処理のまとまりを始める
            heartbeatController = new AbortController();	// 停止できる通信を用意する
            const timeoutId = setTimeout(() => heartbeatController.abort(), 8000);	// 一定時間で通信を止める
            try {	// 失敗に備えて処理を始める
                const response = await fetch(ONLINE_GAS_URL, {	// APIへリクエストを送る
                    method: "POST",	// 処理を続ける
                    body: JSON.stringify({ mode: "heartbeat", userId: userId, sessionToken: localStorage.getItem("sessionToken") || "" }),	// 本人確認情報を付けて送信する
                    signal: heartbeatController.signal	// 停止制御を通信へ渡す
                });	// 処理を完了する
                if (response.ok) {	// 応答を読み込める場合に処理する
                    const result = await response.json();	// ログイン状態を確認する
                    if (window.handleHeikoSessionResponse) window.handleHeikoSessionResponse(result);	// ログイン切れを共通処理する
                }	// 応答確認を閉じる
            } catch (error) {	// 処理のまとまりを始める
                if (error.name !== "AbortError") console.debug("オンライン状態を更新できませんでした。", error);	// 通常の通信失敗だけを記録する
            } finally {	// 処理のまとまりを始める
                clearTimeout(timeoutId);	// 処理を完了する
                heartbeatController = null;	// 通信情報を破棄する
                heartbeatRequest = null;	// 処理を続ける
            }	// 処理のまとまりを閉じる
        })();	// 処理を完了する

        return heartbeatRequest;	// 結果を返す
    }	// 処理のまとまりを閉じる

    function startHeartbeat() {	// 関数を定義
        if (!getCurrentUserId() || heartbeatTimer || heartbeatStartTimer) return;	// 二重開始を防ぐ
        heartbeatStartTimer = setTimeout(() => {	// 初期画面の通信後にオンライン更新を始める
            heartbeatStartTimer = null;	// 初回タイマー情報を破棄する
            sendHeartbeat();	// 最初のオンライン更新を送る
        }, 1800);	// 募集などの初期通信を優先する
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);	// 時間を置いて処理する
    }	// 処理のまとまりを閉じる

    function stopHeartbeat() {	// 関数を定義
        if (heartbeatStartTimer) clearTimeout(heartbeatStartTimer);	// 初回送信の予約を止める
        heartbeatStartTimer = null;	// 初回タイマー情報を破棄する
        if (heartbeatTimer) clearInterval(heartbeatTimer);	// 定期更新があれば停止する
        heartbeatTimer = null;	// 処理を続ける
        if (heartbeatController) heartbeatController.abort();	// 画面を離れた後の通信を止める
    }	// 処理のまとまりを閉じる

    function handleVisibilityChange() {	// 関数を定義
        if (document.visibilityState === "visible") {	// 条件に応じて処理を分ける
            startHeartbeat();	// 処理を完了する
        } else {	// 処理のまとまりを始める
            stopHeartbeat();	// 処理を完了する
        }	// 処理のまとまりを閉じる
    }	// 処理のまとまりを閉じる

    function initializePageStatus() {	// 関数を定義
        renderImpersonationBanner();	// 処理を完了する
        startHeartbeat();	// 処理を完了する
    }	// 処理のまとまりを閉じる

    if (document.readyState === "loading") {	// 条件に応じて処理を分ける
        document.addEventListener("DOMContentLoaded", initializePageStatus, { once: true });	// 操作イベントを登録
    } else {	// 処理のまとまりを始める
        initializePageStatus();	// 処理を完了する
    }	// 処理のまとまりを閉じる

    document.addEventListener("visibilitychange", handleVisibilityChange);	// 操作イベントを登録
    window.addEventListener("pageshow", initializePageStatus);	// 操作イベントを登録
    window.addEventListener("pagehide", stopHeartbeat);	// 操作イベントを登録
})();	// 処理を完了する
