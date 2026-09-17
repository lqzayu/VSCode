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
document.addEventListener("DOMContentLoaded", () => {	// 画面の読み込み完了後に処理する
    const selector = document.getElementById("theme-preference");	// 外観設定の選択欄を取得する
    if (selector) selector.value = readThemePreference();	// 保存済みの外観設定を選択欄へ表示する
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
