(function () {
    function getNoticeType(message) {
        const text = String(message || "");
        if (/失敗|エラー|通信|不足|見つかりません|入力してください|必要です|無効|権限|間違|ありません/.test(text)) {
            return "error";
        }
        if (/完了|保存|削除|受け付け|成功|送りました|しました|更新/.test(text)) {
            return "success";
        }
        return "info";
    }

    function getRoot() {
        let root = document.getElementById("ui-notice-root");
        if (!root) {
            root = document.createElement("div");
            root.id = "ui-notice-root";
            root.setAttribute("aria-live", "polite");
            root.setAttribute("aria-atomic", "true");
            document.body.appendChild(root);
        }
        return root;
    }

    function showNotice(message, type) {
        const root = getRoot();
        const notice = document.createElement("div");
        const noticeType = type || getNoticeType(message);
        const icon = noticeType === "success" ? "✓" : noticeType === "error" ? "!" : "i";

        notice.className = `ui-notice ui-notice-${noticeType}`;
        notice.setAttribute("role", noticeType === "error" ? "alert" : "status");
        notice.innerHTML = `
            <span class="ui-notice-icon">${icon}</span>
            <span class="ui-notice-message"></span>
            <button type="button" class="ui-notice-close" aria-label="通知を閉じる">×</button>
        `;
        notice.querySelector(".ui-notice-message").textContent = String(message || "");
        notice.querySelector(".ui-notice-close").addEventListener("click", () => removeNotice(notice));
        root.appendChild(notice);

        requestAnimationFrame(() => notice.classList.add("is-visible"));
        const duration = noticeType === "error" ? 5200 : 3600;
        let timer = setTimeout(() => removeNotice(notice), duration);
        notice.addEventListener("mouseenter", () => clearTimeout(timer));
        notice.addEventListener("mouseleave", () => {
            timer = setTimeout(() => removeNotice(notice), duration);
        });
    }

    function removeNotice(notice) {
        if (!notice || notice.classList.contains("is-leaving")) return;
        notice.classList.remove("is-visible");
        notice.classList.add("is-leaving");
        setTimeout(() => notice.remove(), 220);
    }

    window.showNotice = showNotice;
    window.alert = message => showNotice(message);
})();
