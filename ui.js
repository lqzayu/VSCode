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
