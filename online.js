(() => {	// 処理のまとまりを始める
    const ONLINE_GAS_URL = "https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec";	// 定数を定義
    const HEARTBEAT_INTERVAL_MS = 30 * 1000;	// 定数を定義
    let heartbeatTimer = null;	// 状態を保持
    let heartbeatRequest = null;	// 状態を保持

    function getCurrentUserId() {	// 関数を定義
        return localStorage.getItem("userId") || localStorage.getItem("userEmail") || "";	// 端末内の保存情報を扱う
    }	// 処理のまとまりを閉じる

    function returnToAdmin() {	// 関数を定義
        localStorage.setItem("userEmail", "admin");	// 端末内の保存情報を扱う
        localStorage.setItem("userId", "admin");	// 端末内の保存情報を扱う
        localStorage.setItem("userName", "管理者");	// 端末内の保存情報を扱う
        localStorage.setItem("profileImage", "");	// 端末内の保存情報を扱う
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
            const controller = new AbortController();	// 定数を定義
            const timeoutId = setTimeout(() => controller.abort(), 8000);	// 定数を定義
            try {	// 失敗に備えて処理を始める
                await fetch(ONLINE_GAS_URL, {	// APIへリクエストを送る
                    method: "POST",	// 処理を続ける
                    body: JSON.stringify({ mode: "heartbeat", userId: userId }),	// 処理を続ける
                    signal: controller.signal	// 処理を続ける
                });	// 処理を完了する
            } catch (error) {	// 処理のまとまりを始める
                console.debug("オンライン状態を更新できませんでした。", error);	// 処理を完了する
            } finally {	// 処理のまとまりを始める
                clearTimeout(timeoutId);	// 処理を完了する
                heartbeatRequest = null;	// 処理を続ける
            }	// 処理のまとまりを閉じる
        })();	// 処理を完了する

        return heartbeatRequest;	// 結果を返す
    }	// 処理のまとまりを閉じる

    function startHeartbeat() {	// 関数を定義
        if (!getCurrentUserId() || heartbeatTimer) return;	// 条件に応じて処理を分ける
        sendHeartbeat();	// 処理を完了する
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);	// 時間を置いて処理する
    }	// 処理のまとまりを閉じる

    function stopHeartbeat() {	// 関数を定義
        if (!heartbeatTimer) return;	// 条件に応じて処理を分ける
        clearInterval(heartbeatTimer);	// 処理を完了する
        heartbeatTimer = null;	// 処理を続ける
    }	// 処理のまとまりを閉じる

    function handleVisibilityChange() {	// 関数を定義
        if (document.visibilityState === "visible") {	// 条件に応じて処理を分ける
            startHeartbeat();	// 処理を完了する
            sendHeartbeat();	// 処理を完了する
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
