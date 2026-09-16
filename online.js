(() => {
    const ONLINE_GAS_URL = "https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec";
    const HEARTBEAT_INTERVAL_MS = 30 * 1000;
    let heartbeatTimer = null;
    let heartbeatRequest = null;

    function getCurrentUserId() {
        return localStorage.getItem("userId") || localStorage.getItem("userEmail") || "";
    }

    function returnToAdmin() {
        localStorage.setItem("userEmail", "admin");
        localStorage.setItem("userId", "admin");
        localStorage.setItem("userName", "管理者");
        localStorage.setItem("profileImage", "");
        localStorage.removeItem("isImpersonating");
        window.location.href = "admin.html";
    }

    function renderImpersonationBanner() {
        if (!document.body || document.body.dataset.page === "admin") return;

        let banner = document.getElementById("impersonate-bar");
        if (localStorage.getItem("isImpersonating") !== "true") {
            if (banner) banner.style.display = "none";
            return;
        }

        if (!banner) {
            banner = document.createElement("div");
            banner.id = "impersonate-bar";
            document.body.prepend(banner);
        }

        banner.style.cssText = "display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;background:#fef08a;color:#854d0e;text-align:center;padding:10px;font-weight:700;font-size:13px;border-bottom:1px solid #fde047;z-index:1000;position:relative;box-sizing:border-box;";

        const userName = localStorage.getItem("userName") || "ユーザー";
        const userId = getCurrentUserId();
        const text = document.createElement("span");
        text.append("⚠️ 現在 ");
        const identity = document.createElement("span");
        identity.id = "impersonate-user-id";
        identity.style.textDecoration = "underline";
        identity.textContent = `${userName} (${userId})`;
        text.append(identity, " として代理ログイン中です。");

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "管理者ダッシュボードに戻る";
        button.style.cssText = "background:#854d0e;color:#fff;border:0;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;";
        button.addEventListener("click", returnToAdmin);

        banner.replaceChildren(text, button);
    }

    async function sendHeartbeat() {
        const userId = getCurrentUserId();
        if (!userId || document.visibilityState !== "visible" || heartbeatRequest) return heartbeatRequest;

        heartbeatRequest = (async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            try {
                await fetch(ONLINE_GAS_URL, {
                    method: "POST",
                    body: JSON.stringify({ mode: "heartbeat", userId: userId }),
                    signal: controller.signal
                });
            } catch (error) {
                console.debug("オンライン状態を更新できませんでした。", error);
            } finally {
                clearTimeout(timeoutId);
                heartbeatRequest = null;
            }
        })();

        return heartbeatRequest;
    }

    function startHeartbeat() {
        if (!getCurrentUserId() || heartbeatTimer) return;
        sendHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat() {
        if (!heartbeatTimer) return;
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    function handleVisibilityChange() {
        if (document.visibilityState === "visible") {
            startHeartbeat();
            sendHeartbeat();
        } else {
            stopHeartbeat();
        }
    }

    function initializePageStatus() {
        renderImpersonationBanner();
        startHeartbeat();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializePageStatus, { once: true });
    } else {
        initializePageStatus();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", initializePageStatus);
    window.addEventListener("pagehide", stopHeartbeat);
})();
