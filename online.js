(() => {
    const ONLINE_GAS_URL = "https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec";
    const HEARTBEAT_INTERVAL_MS = 30 * 1000;
    let heartbeatTimer = null;

    function getCurrentUserId() {
        return localStorage.getItem("userId") || localStorage.getItem("userEmail") || "";
    }

    async function sendHeartbeat() {
        const userId = getCurrentUserId();
        if (!userId || document.visibilityState !== "visible") return;

        try {
            await fetch(ONLINE_GAS_URL, {
                method: "POST",
                body: JSON.stringify({ mode: "heartbeat", userId: userId })
            });
        } catch (error) {
            console.debug("オンライン状態を更新できませんでした。", error);
        }
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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startHeartbeat, { once: true });
    } else {
        startHeartbeat();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", startHeartbeat);
    window.addEventListener("pagehide", stopHeartbeat);
})();
