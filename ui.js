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
let heikoDeferredInstallPrompt = null;	// PWAインストール確認を一時的に保持する
window.addEventListener("beforeinstallprompt", event => {	// ブラウザのインストール案内を受け取る
    event.preventDefault();	// 自動表示を止めてマイページのボタンから表示する
    heikoDeferredInstallPrompt = event;	// 後でボタンから呼び出せるように保存する
    updateHeikoPwaInstallButton();	// ボタンをインストール可能な状態へ更新する
});	// PWA案内の受け取りを終える
window.addEventListener("appinstalled", () => {	// PWAがインストールされた場合に処理する
    heikoDeferredInstallPrompt = null;	// 使用済みの案内を破棄する
    updateHeikoPwaInstallButton(true);	// インストール済み表示へ更新する
});	// インストール完了処理を終える

function isHeikoPwaStandalone() {	// PWAとして起動中か確認する
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;	// iOSと通常ブラウザの両方に対応する
}	// PWA起動状態の確認を閉じる

function updateHeikoPwaInstallButton(installed = false) {	// PWAボタンの表示状態を更新する
    const button = document.getElementById("heiko-pwa-install-button");	// PWAボタンを取得する
    const hint = document.getElementById("heiko-pwa-install-hint");	// PWA案内文を取得する
    if (!button) return;	// マイページ以外では終了する
    if (installed || isHeikoPwaStandalone()) {	// すでにアプリとして起動中の場合に処理する
        button.disabled = true;	// インストールボタンを無効にする
        button.textContent = "ホーム画面に追加済み";	// 完了状態を表示する
        if (hint) hint.textContent = "このサービスはアプリとして起動できます。";	// 完了案内を表示する
        return;	// 表示更新を終える
    }	// インストール済み判定を閉じる
    button.disabled = false;	// ボタンを有効にする
    button.textContent = "ホーム画面に追加";	// ボタンの標準表示を設定する
    if (hint && heikoDeferredInstallPrompt) hint.textContent = "この端末のホーム画面からすぐに開けます。";	// 直接インストールできる場合の案内を表示する
}	// PWAボタン表示更新を閉じる

async function requestHeikoPwaInstall() {	// PWAの追加操作を開始する
    if (isHeikoPwaStandalone()) return;	// すでに追加済みなら何もしない
    if (heikoDeferredInstallPrompt) {	// ブラウザがインストール案内を提供している場合に処理する
        heikoDeferredInstallPrompt.prompt();	// インストール確認を表示する
        await heikoDeferredInstallPrompt.userChoice;	// 利用者の選択を待つ
        heikoDeferredInstallPrompt = null;	// 一度使った案内を破棄する
        updateHeikoPwaInstallButton();	// 選択後の状態へ更新する
        return;	// 操作を終える
    }	// ブラウザ標準案内の処理を閉じる
    const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);	// iPhoneやiPadか確認する
    const hint = document.getElementById("heiko-pwa-install-hint");	// 案内文を取得する
    if (hint) hint.textContent = isAppleMobile ? "Safariの共有ボタンから「ホーム画面に追加」を選択してください。" : "ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。";	// 手動追加方法を表示する
}	// PWA追加操作を閉じる

function installHeikoPwaSupport() {	// PWAの共通準備を行う
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(error => console.warn("PWA準備に失敗しました。", error));	// すべてのページでサービスワーカーを登録する
    if (!document.body || document.body.dataset.page !== "profile") return;	// ボタンはマイページだけに表示する
    if (document.getElementById("heiko-pwa-install-card")) return;	// 二重追加を防ぐ
    const appearance = document.querySelector(".appearance-settings");	// 外観設定カードを取得する
    if (!appearance) return;	// 追加位置がない場合は終了する
    const card = document.createElement("section");	// PWA案内カードを作る
    card.id = "heiko-pwa-install-card";	// カードを識別する
    card.className = "heiko-pwa-install-card";	// 共通スタイルを適用する
    card.setAttribute("aria-labelledby", "heiko-pwa-install-title");	// 読み上げ用の見出しを設定する
    card.innerHTML = "<div><span class=\"heiko-pwa-kicker\">QUICK ACCESS</span><h3 id=\"heiko-pwa-install-title\">ホーム画面からすぐに開く</h3><p id=\"heiko-pwa-install-hint\">スマホのホーム画面に追加すると、アプリのように使えます。</p></div><button type=\"button\" id=\"heiko-pwa-install-button\" onclick=\"requestHeikoPwaInstall()\">ホーム画面に追加</button>";	// PWA案内の内容を設定する
    appearance.insertAdjacentElement("afterend", card);	// 外観設定の下へ表示する
    updateHeikoPwaInstallButton();	// 初期状態を反映する
}	// PWA共通準備を閉じる

function installHeikoFooterNavigation() {	// フッターメニューを上部ナビとそろえる
    const footerLinks = document.querySelector(".footer-links");	// フッターメニューを取得する
    if (!footerLinks) return;	// フッターがないページでは終了する
    const isLoggedIn = Boolean(localStorage.getItem("sessionToken") && (localStorage.getItem("userId") || localStorage.getItem("userEmail")));	// ログイン状態を確認する
    const isAdmin = localStorage.getItem("userId") === "admin" && localStorage.getItem("isImpersonating") !== "true";	// 管理者表示条件を確認する
    footerLinks.innerHTML = `<a href="main.html?guide=1">使い方</a><a href="https://docs.google.com/forms/d/e/1FAIpQLSft5k1kroOLIzgbv5YArbYzkpBQfPG4CWsJsqjOE9YvUSK3gA/viewform?usp=header">意見箱</a><a href="main.html?tab=recruit">募集投稿</a><a href="main.html?tab=search">ユーザーを探す</a><a href="messages.html">メッセージ</a><a href="profile.html">マイページ</a><a href="ai-study.html">AI学習相談</a><a class="heiko-footer-admin" href="admin.html"${isAdmin ? "" : " style=\"display:none\""}>管理者</a>${isLoggedIn ? "<button type=\"button\" class=\"heiko-footer-logout\" onclick=\"if (typeof logout === 'function') { logout(); } else { clearHeikoSession(); location.href='index.html'; } return false;\">ログアウト</button>" : ""}<a href="terms.html">利用規約</a><a href="privacy.html">プライバシーポリシー</a>`;	// 上部ナビと同じ項目を設定する
}	// フッターナビの統一を閉じる
const HEIKO_SESSION_KEYS = ["userId", "userEmail", "userName", "profileImage", "userGrade", "userDept", "sessionToken", "adminSessionToken", "adminToken", "isImpersonating", "chatTarget"];	// ログアウト時に消す情報をまとめる
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

function getHeaderActionStack() {	// ヘッダー右側の共通操作欄を用意する
    const navbar = document.querySelector(".navbar");	// 共通ヘッダーを取得する
    if (!navbar) return null;	// ヘッダーがないページでは操作欄を作らない

    let stack = document.getElementById("heiko-header-actions");	// 既存の操作欄を取得する
    if (stack) return stack;	// 作成済みならそのまま使う

    stack = document.createElement("div");	// 操作欄を作る
    stack.id = "heiko-header-actions";	// 操作欄を識別する
    stack.className = "heiko-header-actions";	// 共通レイアウトを適用する
    const menuButton = navbar.querySelector(".hamburger-btn");	// ハンバーガーボタンを取得する
    const navigation = navbar.querySelector(".nav-links");	// 通常メニューを取得する
    navbar.insertBefore(stack, menuButton || navigation || null);	// ロゴの右、メニューの手前へ配置する
    return stack;	// 作成した操作欄を返す
}	// 操作欄の準備を閉じる

function installPageRefreshButton() {	// 各ページのヘッダーへ更新ボタンを追加する
    if (!document.body || document.getElementById("heiko-page-refresh")) return;	// ページ本体がない場合や二重追加を防ぐ

    const stack = getHeaderActionStack();	// ヘッダー内の操作欄を取得する
    const button = document.createElement("button");	// 更新ボタンを作る
    button.id = "heiko-page-refresh";	// 更新ボタンを識別する
    button.type = "button";	// フォーム送信を防ぐ
    button.className = "heiko-page-refresh";	// 共通スタイルを適用する
    if (!stack) button.classList.add("is-floating");	// ヘッダーがないページでは右上へ固定する
    button.setAttribute("aria-label", "ページを更新");	// 読み上げ用の説明を設定する
    button.innerHTML = "<span aria-hidden=\"true\">↻</span><span>更新</span>";	// ボタンの表示内容を設定する
    button.addEventListener("click", () => {	// 更新ボタンの操作を受け取る
        button.disabled = true;	// 連続操作を防ぐ
        button.classList.add("is-loading");	// 更新中の見た目へ変更する
        button.querySelector("span").textContent = "⟳";	// 更新中の記号を表示する
        window.location.reload();	// 現在のページを再読み込みする
    });	// 操作イベントの登録を終える
    (stack || document.body).appendChild(button);	// ヘッダー操作欄またはページ右上へ追加する
}	// 更新ボタンの追加処理を閉じる

function installRecruitmentPostButton() {	// ログイン後ページへ募集投稿の共通導線を追加する
    if (!document.body || document.getElementById("heiko-recruit-post-panel")) return;	// ページ本体がない場合や二重追加を防ぐ
    const navbar = document.querySelector(".navbar");	// ログイン後の共通ヘッダーを取得する
    const refreshButton = document.getElementById("heiko-page-refresh");	// 更新ボタンを取得する
    if (!navbar || !refreshButton) return;	// ログイン前・規約ページでは追加しない

    const panel = document.createElement("section");	// 募集投稿用のカードを作る
    panel.id = "heiko-recruit-post-panel";	// 募集投稿カードを識別する
    panel.className = "heiko-recruit-post-panel";	// 共通スタイルを適用する
    const currentRecruitment = document.getElementById("my-post-area");	// ホームの現在の募集カードを取得する
    if (currentRecruitment) {	// ホーム画面では募集状況のすぐ下へ置く
        panel.classList.add("is-sidebar-action");	// サイドバー用の見た目を指定する
        currentRecruitment.insertAdjacentElement("afterend", panel);	// 現在の募集カードの直下へ追加する
    } else {	// ほかのログイン後ページではメイン内容の直前へ置く
        const main = document.querySelector("main");	// 各ページの主内容を取得する
        if (!main) return;	// 主内容がないページでは表示しない
        panel.classList.add("is-page-action");	// 通常ページ用の見た目を指定する
        main.insertAdjacentElement("beforebegin", panel);	// ページ内容の直前へ追加する
    }	// 配置場所の判定を閉じる

    const copy = document.createElement("div");	// カードの案内文を作る
    copy.className = "heiko-recruit-post-copy";	// 案内文のスタイルを指定する
    copy.innerHTML = "<span>QUICK MATCH</span><strong>いっしょに勉強する仲間を探そう</strong><small>学年・学科はマイページの設定が使われます</small>";	// 案内文を設定する
    const actions = document.createElement("div");	// ボタンをまとめる領域を作る
    actions.className = "heiko-recruit-post-actions";	// ボタン領域のスタイルを指定する
    const button = document.createElement("a");	// 募集投稿ボタンを作る
    button.id = "heiko-recruit-post";	// 募集投稿ボタンを識別する
    button.className = "heiko-recruit-post";	// 目立つ共通スタイルを適用する
    button.href = "main.html?tab=recruit";	// 募集投稿欄を直接開く
    button.setAttribute("aria-label", "募集を投稿する");	// 読み上げ用の説明を設定する
    button.innerHTML = "<span class=\"heiko-recruit-post-icon\" aria-hidden=\"true\">＋</span><span>募集を投稿する</span><span class=\"heiko-recruit-post-arrow\" aria-hidden=\"true\">→</span>";	// 投稿ボタンの表示内容を設定する
    panel.appendChild(copy);	// 案内文をカードへ追加する
    actions.appendChild(button);	// 投稿ボタンを操作欄へ追加する
    actions.appendChild(refreshButton);	// 更新ボタンも投稿ボタンの下へ移動する
    panel.appendChild(actions);	// 操作欄をカードへ追加する

    const headerActions = document.getElementById("heiko-header-actions");	// 一時的に作られたヘッダー操作欄を取得する
    if (headerActions && !headerActions.children.length) headerActions.remove();	// 空になった操作欄を取り除いてヘッダーを整える
}	// 募集投稿導線の追加処理を閉じる

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
        .navbar > .heiko-header-actions {
            display: flex;
            flex: 0 0 auto;
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
            min-width: 150px;
            margin-left: 8px;
        }
        .navbar > .nav-links {
            margin-left: auto;
            justify-content: flex-end;
        }
        .navbar .nav-guide-button {
            font-family: inherit;
            font-size: inherit;
            font-weight: inherit;
            line-height: inherit;
        }
        .navbar .nav-item#nav-admin-btn,
        [data-page="admin"] .navbar .nav-item.active {
            color: #dc2626 !important;
        }
        .navbar .nav-item#nav-admin-btn:hover,
        [data-page="admin"] .navbar .nav-item.active:hover {
            color: #b91c1c !important;
        }
        .footer-links {
            align-items: center;
            gap: 10px 18px !important;
        }
        .footer-links a,
        .footer-links button {
            box-sizing: border-box;
            font-family: inherit;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.4;
        }
        .footer-links .heiko-footer-admin {
            color: #dc2626 !important;
        }
        .footer-links .heiko-footer-admin:hover {
            color: #b91c1c !important;
        }
        .heiko-footer-logout {
            appearance: none;
            border: 0;
            border-radius: 8px;
            padding: 4px 8px;
            background: transparent;
            color: var(--ui-muted, #64748b);
            cursor: pointer;
        }
        .heiko-footer-logout:hover {
            color: var(--ui-green, #07828a);
            background: var(--ui-soft, rgba(28, 189, 197, .08));
        }
        .heiko-pwa-install-card {
            display: grid;
            gap: 14px;
            margin-top: 20px;
            padding: 18px;
            border: 1px solid var(--ui-line, rgba(28, 189, 197, .2));
            border-radius: 18px;
            background: linear-gradient(135deg, var(--glass-surface-strong, rgba(255, 255, 255, .82)), var(--glass-surface, rgba(255, 254, 251, .66)));
            box-shadow: var(--glass-shadow, 0 12px 30px rgba(36, 60, 50, .08));
            text-align: left;
        }
        .heiko-pwa-kicker {
            display: block;
            margin-bottom: 5px;
            color: var(--ui-green, #07828a);
            font-size: 10px;
            font-weight: 900;
            letter-spacing: .14em;
        }
        .heiko-pwa-install-card h3 {
            margin: 0 0 5px;
            color: var(--ui-ink, #243c32);
            font-size: 16px;
        }
        .heiko-pwa-install-card p {
            margin: 0;
            color: var(--ui-muted, #66736a);
            font-size: 12px;
            line-height: 1.6;
        }
        #heiko-pwa-install-button {
            min-height: 44px;
            border: 1px solid rgba(125, 211, 252, .48);
            border-radius: 12px;
            background: linear-gradient(135deg, #1689b5, #355fca);
            color: #fff;
            font: inherit;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 9px 18px rgba(9, 27, 70, .2);
        }
        #heiko-pwa-install-button:hover {
            transform: translateY(-1px);
            filter: brightness(1.06);
        }
        #heiko-pwa-install-button:disabled {
            opacity: .7;
            cursor: default;
        }
        .navbar > .hamburger-btn {
            align-self: center;
        }
        .heiko-page-refresh {
            display: inline-flex;
            width: 100%;
            align-items: center;
            justify-content: center;
            gap: 5px;
            min-height: 36px;
            padding: 7px 11px;
            margin: 0;
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
        .heiko-recruit-post {
            display: inline-flex;
            width: 100%;
            box-sizing: border-box;
            align-items: center;
            justify-content: center;
            gap: 6px;
            min-height: 44px;
            padding: 9px 16px;
            margin: 0;
            border: 1px solid rgba(12, 122, 128, .16);
            border-radius: 12px;
            background: linear-gradient(135deg, #129fa6 0%, #0b7782 100%);
            color: #ffffff;
            font: inherit;
            font-size: 14px;
            font-weight: 800;
            line-height: 1;
            letter-spacing: .02em;
            text-decoration: none;
            box-shadow: 0 8px 18px rgba(11, 119, 130, .24);
            transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
            white-space: nowrap;
        }
        .heiko-recruit-post:hover {
            transform: translateY(-1px);
            filter: brightness(1.05);
            box-shadow: 0 11px 22px rgba(11, 119, 130, .3);
        }
        .heiko-recruit-post:focus-visible {
            outline: 3px solid rgba(28, 189, 197, .35);
            outline-offset: 2px;
        }
        .heiko-recruit-post span:first-child {
            font-size: 19px;
            line-height: 12px;
        }
        :root {
            --heiko-recruit-panel-bg: radial-gradient(circle at 94% 7%, rgba(61, 212, 219, .2), transparent 36%), linear-gradient(135deg, rgba(245, 255, 255, .96), rgba(232, 250, 250, .9));
            --heiko-recruit-panel-border: rgba(23, 165, 171, .22);
            --heiko-recruit-panel-shadow: 0 14px 30px rgba(13, 88, 96, .1);
            --heiko-recruit-orb: rgba(25, 166, 172, .2);
            --heiko-recruit-label: #07828a;
            --heiko-recruit-title: var(--ui-ink, #12384a);
            --heiko-recruit-muted: var(--ui-muted, #5d7782);
            --heiko-recruit-button-bg: linear-gradient(135deg, #11a7ad 0%, #087a85 100%);
            --heiko-recruit-button-border: rgba(7, 110, 117, .18);
            --heiko-recruit-button-shadow: 0 10px 20px rgba(5, 119, 130, .26);
            --heiko-recruit-button-hover-shadow: 0 14px 26px rgba(5, 119, 130, .32);
            --heiko-recruit-refresh-bg: rgba(255, 255, 255, .64);
            --heiko-recruit-refresh-hover: rgba(255, 255, 255, .92);
            --heiko-recruit-refresh-border: rgba(18, 137, 145, .2);
        }
        :root[data-theme="dark"] {
            --heiko-recruit-panel-bg: radial-gradient(circle at 94% 7%, rgba(125, 211, 252, .23), transparent 39%), linear-gradient(135deg, rgba(22, 33, 54, .97), rgba(31, 43, 70, .95));
            --heiko-recruit-panel-border: rgba(147, 197, 253, .36);
            --heiko-recruit-panel-shadow: 0 18px 34px rgba(0, 0, 0, .3);
            --heiko-recruit-orb: rgba(167, 214, 255, .34);
            --heiko-recruit-label: #8bdcff;
            --heiko-recruit-title: #f2f6ff;
            --heiko-recruit-muted: #bdcbe0;
            --heiko-recruit-button-bg: linear-gradient(135deg, #1689b5 0%, #355fca 100%);
            --heiko-recruit-button-border: rgba(191, 219, 254, .48);
            --heiko-recruit-button-shadow: 0 11px 23px rgba(9, 27, 70, .42);
            --heiko-recruit-button-hover-shadow: 0 15px 30px rgba(9, 27, 70, .56);
            --heiko-recruit-refresh-bg: rgba(12, 22, 40, .78);
            --heiko-recruit-refresh-hover: rgba(31, 49, 80, .94);
            --heiko-recruit-refresh-border: rgba(147, 197, 253, .38);
        }
        @media (prefers-color-scheme: dark) {
            :root:not([data-theme="light"]) {
                --heiko-recruit-panel-bg: radial-gradient(circle at 94% 7%, rgba(125, 211, 252, .23), transparent 39%), linear-gradient(135deg, rgba(22, 33, 54, .97), rgba(31, 43, 70, .95));
                --heiko-recruit-panel-border: rgba(147, 197, 253, .36);
                --heiko-recruit-panel-shadow: 0 18px 34px rgba(0, 0, 0, .3);
                --heiko-recruit-orb: rgba(167, 214, 255, .34);
                --heiko-recruit-label: #8bdcff;
                --heiko-recruit-title: #f2f6ff;
                --heiko-recruit-muted: #bdcbe0;
                --heiko-recruit-button-bg: linear-gradient(135deg, #1689b5 0%, #355fca 100%);
                --heiko-recruit-button-border: rgba(191, 219, 254, .48);
                --heiko-recruit-button-shadow: 0 11px 23px rgba(9, 27, 70, .42);
                --heiko-recruit-button-hover-shadow: 0 15px 30px rgba(9, 27, 70, .56);
                --heiko-recruit-refresh-bg: rgba(12, 22, 40, .78);
                --heiko-recruit-refresh-hover: rgba(31, 49, 80, .94);
                --heiko-recruit-refresh-border: rgba(147, 197, 253, .38);
            }
        }
        .heiko-recruit-post-panel {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            box-sizing: border-box;
            overflow: hidden;
            padding: 18px;
            border: 1px solid var(--heiko-recruit-panel-border);
            border-radius: 20px;
            background: var(--heiko-recruit-panel-bg);
            box-shadow: var(--heiko-recruit-panel-shadow);
        }
        .heiko-recruit-post-panel::before {
            position: absolute;
            top: -44px;
            right: -34px;
            width: 110px;
            height: 110px;
            border: 1px solid var(--heiko-recruit-orb);
            border-radius: 50%;
            content: "";
            pointer-events: none;
        }
        .heiko-recruit-post-copy {
            position: relative;
            z-index: 1;
            display: grid;
            gap: 4px;
            min-width: 0;
            color: var(--ui-ink, #164e63);
        }
        .heiko-recruit-post-copy span {
            color: var(--heiko-recruit-label);
            font-size: 10px;
            font-weight: 900;
            letter-spacing: .14em;
        }
        .heiko-recruit-post-copy strong {
            color: var(--heiko-recruit-title);
            font-size: 15px;
            line-height: 1.45;
        }
        .heiko-recruit-post-copy small {
            color: var(--heiko-recruit-muted);
            font-size: 11px;
            line-height: 1.45;
        }
        .heiko-recruit-post-actions {
            position: relative;
            z-index: 1;
            display: grid;
            flex: 0 0 218px;
            gap: 8px;
        }
        .heiko-recruit-post-panel.is-sidebar-action {
            width: 100%;
            padding: 17px;
        }
        .heiko-recruit-post-panel.is-sidebar-action .heiko-recruit-post-copy strong {
            font-size: 14px;
        }
        .heiko-recruit-post-panel.is-sidebar-action .heiko-recruit-post-actions {
            flex-basis: auto;
            width: 100%;
        }
        .heiko-recruit-post-panel.is-sidebar-action {
            display: grid;
        }
        .heiko-recruit-post-panel.is-page-action {
            width: min(calc(100% - 32px), 1080px);
            margin: 20px auto 0;
        }
        .heiko-recruit-post-panel .heiko-recruit-post {
            min-height: 50px;
            padding: 11px 15px;
            border: 1px solid var(--heiko-recruit-button-border);
            border-radius: 14px;
            background: var(--heiko-recruit-button-bg);
            box-shadow: var(--heiko-recruit-button-shadow);
        }
        .heiko-recruit-post-panel .heiko-recruit-post:hover {
            transform: translateY(-2px);
            box-shadow: var(--heiko-recruit-button-hover-shadow);
        }
        .heiko-recruit-post-icon {
            display: inline-grid;
            width: 22px;
            height: 22px;
            place-items: center;
            border-radius: 8px;
            background: rgba(255, 255, 255, .2);
            font-size: 19px !important;
            line-height: 1 !important;
        }
        .heiko-recruit-post-arrow {
            margin-left: auto;
            font-size: 18px;
            line-height: 1;
            transition: transform .2s ease;
        }
        .heiko-recruit-post:hover .heiko-recruit-post-arrow {
            transform: translateX(3px);
        }
        .heiko-recruit-post-actions .heiko-page-refresh {
            min-height: 36px;
            border-color: var(--heiko-recruit-refresh-border);
            border-radius: 12px;
            background: var(--heiko-recruit-refresh-bg);
            color: var(--heiko-recruit-title);
            box-shadow: none;
        }
        .heiko-recruit-post-actions .heiko-page-refresh:hover {
            background: var(--heiko-recruit-refresh-hover);
            box-shadow: 0 7px 15px rgba(13, 88, 96, .1);
        }
        @keyframes heiko-refresh-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
            .navbar {
                flex-wrap: nowrap !important;
                align-items: center !important;
            }
            .navbar > .heiko-header-actions {
                min-width: 124px;
                gap: 4px;
                margin-left: 4px;
            }
            .navbar > .hamburger-btn {
                display: flex !important;
                flex-shrink: 0;
                margin-left: auto !important;
                align-self: center;
            }
            .heiko-page-refresh {
                min-height: 32px;
                padding: 6px 9px;
                border-radius: 11px;
            }
            .heiko-recruit-post {
                min-height: 38px;
                padding: 8px 9px;
                border-radius: 11px;
                font-size: 12px;
            }
            .heiko-recruit-post-panel,
            .heiko-recruit-post-panel.is-page-action {
                width: calc(100% - 24px);
                margin: 14px auto 0;
                padding: 15px;
                border-radius: 18px;
            }
            .heiko-recruit-post-panel {
                display: grid;
                gap: 14px;
            }
            .heiko-recruit-post-actions {
                width: 100%;
                flex-basis: auto;
            }
            .heiko-recruit-post-panel .heiko-recruit-post {
                min-height: 48px;
                font-size: 14px;
            }
        }
        @media (max-width: 380px) {
            .navbar > .heiko-header-actions {
                min-width: 112px;
            }
            .heiko-recruit-post {
                font-size: 11px;
            }
            .heiko-recruit-post span:first-child {
                font-size: 16px;
            }
        }
        @media (max-aspect-ratio: 4/5) {
            .navbar > .hamburger-btn {
                margin-left: auto !important;
                align-self: center;
            }
        }
    `;	// 共通スタイルを定義する
    document.head.appendChild(style);	// style要素をページへ追加する
}	// 共通スタイル追加処理を閉じる

(function installUsageLogging() {	// GAS通信を利用ログへ記録する仕組みを準備する
    const nativeFetch = window.fetch.bind(window);	// 元の通信関数を保存する
    const ignoredModes = new Set(["recordUsageLog", "recordUsageLogs", "heartbeat", "login", "register", "verifyEmail", "resendVerificationCode", "forgotPassword", "resetPassword", "verify_face_1toN", "verify_face_for_user", "firebaseCustomToken", "getMessages", "getUnreadCount", "getNotificationSummary", "getLatestIncomingMessage", "markAsRead"]);	// 自動確認の通信は利用回数へ含めない
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
    installRecruitmentPostButton();	// ヘッダーがある各ページへ募集投稿ボタンを追加する
    installHeikoPwaSupport();	// PWAの登録とマイページの追加ボタンを準備する
    installHeikoFooterNavigation();	// フッターメニューを上部ナビと統一する
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
