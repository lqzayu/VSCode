const THEME_STORAGE_KEY = "heikoThemePreference";

function normalizeThemePreference(value) {
    return value === "light" || value === "dark" ? value : "auto";
}

function readThemePreference() {
    try {
        return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
    } catch (error) {
        return "auto";
    }
}

function applyThemePreference(value, save = true) {
    const preference = normalizeThemePreference(value);
    if (preference === "auto") {
        document.documentElement.removeAttribute("data-theme");
    } else {
        document.documentElement.setAttribute("data-theme", preference);
    }
    if (save) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, preference);
        } catch (error) {
            console.warn("外観設定を保存できませんでした。", error);
        }
    }
    const selector = document.getElementById("theme-preference");
    if (selector) selector.value = preference;
    return preference;
}

applyThemePreference(readThemePreference(), false);
window.applyThemePreference = applyThemePreference;
window.getThemePreference = readThemePreference;
let heikoDeferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    heikoDeferredInstallPrompt = event;
    updateHeikoPwaInstallButton();
});
window.addEventListener("appinstalled", () => {
    heikoDeferredInstallPrompt = null;
    updateHeikoPwaInstallButton(true);
});

function isHeikoPwaStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateHeikoPwaInstallButton(installed = false) {
    const button = document.getElementById("heiko-pwa-install-button");
    const hint = document.getElementById("heiko-pwa-install-hint");
    if (!button) return;
    if (installed || isHeikoPwaStandalone()) {
        button.disabled = true;
        button.textContent = "ホーム画面に追加済み";
        if (hint) hint.textContent = "このサービスはアプリとして起動できます。";
        return;
    }
    button.disabled = false;
    button.textContent = "ホーム画面に追加";
    if (hint && heikoDeferredInstallPrompt) hint.textContent = "この端末のホーム画面からすぐに開けます。";
}

function showHeikoPwaInstallDialog(kind) {
    let dialog = document.getElementById("heiko-pwa-install-dialog");
    if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "heiko-pwa-install-dialog";
        dialog.className = "heiko-pwa-install-dialog";
        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });
        document.body.appendChild(dialog);
    }

    const isAppleMobile = kind === "apple-mobile";
    const isSafariDesktop = kind === "safari-desktop";
    const title = isAppleMobile ? "ホーム画面に追加" : isSafariDesktop ? "Dockに追加" : "アプリとして追加";
    const description = isAppleMobile
        ? "Safariでは安全上の仕様により、この画面から直接追加を確定できません。共有メニューを開いたら「ホーム画面に追加」を選んでください。"
        : isSafariDesktop
            ? "Safariでは安全上の仕様により、この画面から直接追加を確定できません。メニューバーの「ファイル」から「Dockに追加」を選んでください。"
            : "このブラウザでは、メニューから「ホーム画面に追加」または「アプリをインストール」を選ぶと追加できます。";

    dialog.innerHTML = `<section class="heiko-pwa-install-dialog-content" aria-labelledby="heiko-pwa-dialog-title"><span class="heiko-pwa-dialog-icon" aria-hidden="true">⌂</span><h3 id="heiko-pwa-dialog-title">${title}</h3><p>${description}</p><button type="button" class="heiko-pwa-dialog-close">わかった</button></section>`;
    dialog.querySelector(".heiko-pwa-dialog-close").addEventListener("click", () => dialog.close());
    if (typeof dialog.showModal === "function") dialog.showModal();
    else window.alert(`${title}\n\n${description}`);
}

async function openHeikoAppleShareMenu() {
    if (!navigator.share) return false;
    try {
        await navigator.share({ title: document.title, url: window.location.href });
        return true;
    } catch (error) {
        return error && error.name === "AbortError";
    }
}

async function requestHeikoPwaInstall() {
    if (isHeikoPwaStandalone()) return;
    if (heikoDeferredInstallPrompt) {
        heikoDeferredInstallPrompt.prompt();
        await heikoDeferredInstallPrompt.userChoice;
        heikoDeferredInstallPrompt = null;
        updateHeikoPwaInstallButton();
        return;
    }
    const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isAppleMobile && await openHeikoAppleShareMenu()) return;
    showHeikoPwaInstallDialog(isAppleMobile ? "apple-mobile" : isSafari ? "safari-desktop" : "other");
}

function installHeikoPwaSupport() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(error => console.warn("PWA準備に失敗しました。", error));
    if (!document.body || document.body.dataset.page !== "profile") return;
    if (document.getElementById("heiko-pwa-install-card")) return;
    const appearance = document.querySelector(".appearance-settings");
    if (!appearance) return;
    const card = document.createElement("section");
    card.id = "heiko-pwa-install-card";
    card.className = "heiko-pwa-install-card";
    card.setAttribute("aria-labelledby", "heiko-pwa-install-title");
    card.innerHTML = "<div><span class=\"heiko-pwa-kicker\">QUICK ACCESS</span><h3 id=\"heiko-pwa-install-title\">ホーム画面からすぐに開く</h3><p id=\"heiko-pwa-install-hint\">スマホのホーム画面に追加すると、アプリのように使えます。</p></div><button type=\"button\" id=\"heiko-pwa-install-button\" onclick=\"requestHeikoPwaInstall()\">ホーム画面に追加</button>";
    appearance.insertAdjacentElement("afterend", card);
    updateHeikoPwaInstallButton();
}

function installHeikoFooterNavigation() {
    const footerLinks = document.querySelector(".footer-links");
    if (!footerLinks) return;
    const isLoggedIn = Boolean(localStorage.getItem("sessionToken") && (localStorage.getItem("userId") || localStorage.getItem("userEmail")));
    const isAdmin = localStorage.getItem("userId") === "admin" && localStorage.getItem("isImpersonating") !== "true";
    footerLinks.innerHTML = `<a href="main.html?guide=1">使い方</a><a href="https://docs.google.com/forms/d/e/1FAIpQLSft5k1kroOLIzgbv5YArbYzkpBQfPG4CWsJsqjOE9YvUSK3gA/viewform?usp=header">意見箱</a><a href="main.html?tab=recruit">募集投稿</a><a href="main.html?tab=search">ユーザーを探す</a><a href="messages.html">メッセージ</a><a href="profile.html">マイページ</a><a href="ai-study.html">AI学習相談</a><a class="heiko-footer-admin" href="admin.html"${isAdmin ? "" : " style=\"display:none\""}>管理者</a>${isLoggedIn ? "<button type=\"button\" class=\"heiko-footer-logout\" onclick=\"if (typeof logout === 'function') { logout(); } else { clearHeikoSession(); location.href='index.html'; } return false;\">ログアウト</button>" : ""}<a href="terms.html">利用規約</a><a href="privacy.html">プライバシーポリシー</a>`;
}
const HEIKO_SESSION_KEYS = ["userId", "userEmail", "userName", "profileImage", "userGrade", "userDept", "sessionToken", "adminSessionToken", "adminToken", "isImpersonating", "chatTarget"];
const HEIKO_REMEMBER_UNTIL_KEY = "heikoRememberUntil";
const HEIKO_SESSION_ONLY_KEY = "heikoSessionOnly";
const HEIKO_SESSION_ACTIVE_KEY = "heikoSessionActive";
const HEIKO_REMEMBER_DAYS = 30;

function clearHeikoSession() {
    HEIKO_SESSION_KEYS.forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(HEIKO_REMEMBER_UNTIL_KEY);
    localStorage.removeItem(HEIKO_SESSION_ONLY_KEY);
    try {
        sessionStorage.removeItem(HEIKO_SESSION_ACTIVE_KEY);
    } catch (error) {
        console.warn("一時ログイン情報を削除できませんでした。", error);
    }
}

function hasHeikoAuthCredentials() {
    return Boolean(localStorage.getItem("sessionToken") && (localStorage.getItem("userId") || localStorage.getItem("userEmail")));
}

function isHeikoAuthSessionActive() {
    if (!hasHeikoAuthCredentials()) return false;
    const rememberUntilText = localStorage.getItem(HEIKO_REMEMBER_UNTIL_KEY);
    if (rememberUntilText) {
        const rememberUntil = Number(rememberUntilText);
        if (Number.isFinite(rememberUntil) && rememberUntil > Date.now()) return true;
        clearHeikoSession();
        return false;
    }
    if (localStorage.getItem(HEIKO_SESSION_ONLY_KEY) === "1") {
        try {
            if (sessionStorage.getItem(HEIKO_SESSION_ACTIVE_KEY) === "1") return true;
        } catch (error) {
            clearHeikoSession();
            return false;
        }
        clearHeikoSession();
        return false;
    }
    return true;
}

function saveHeikoAuthSession(authResult, remember) {
    if (!authResult || !authResult.email || !authResult.sessionToken) return false;
    localStorage.setItem("userEmail", authResult.email);
    localStorage.setItem("userId", authResult.userId || authResult.email);
    localStorage.setItem("userName", authResult.name || "");
    localStorage.setItem("profileImage", authResult.profileImage || "");
    localStorage.setItem("sessionToken", authResult.sessionToken);
    if (authResult.adminToken) localStorage.setItem("adminToken", authResult.adminToken);
    else localStorage.removeItem("adminToken");
    try {
        sessionStorage.setItem(HEIKO_SESSION_ACTIVE_KEY, "1");
    } catch (error) {
        console.warn("一時ログイン状態を保存できませんでした。", error);
    }
    if (remember) {
        localStorage.setItem(HEIKO_REMEMBER_UNTIL_KEY, String(Date.now() + HEIKO_REMEMBER_DAYS * 24 * 60 * 60 * 1000));
        localStorage.removeItem(HEIKO_SESSION_ONLY_KEY);
    } else {
        localStorage.removeItem(HEIKO_REMEMBER_UNTIL_KEY);
        localStorage.setItem(HEIKO_SESSION_ONLY_KEY, "1");
    }
    return true;
}

window.saveHeikoAuthSession = saveHeikoAuthSession;
window.isHeikoAuthSessionActive = isHeikoAuthSessionActive;
isHeikoAuthSessionActive();
const isHeikoLoginPage = /\/index\.html$/.test(window.location.pathname) || /\/$/.test(window.location.pathname);
if (isHeikoLoginPage && isHeikoAuthSessionActive()) window.location.replace("main.html");
window.clearHeikoSession = clearHeikoSession;
function handleHeikoSessionResponse(result) {
    const message = result && result.status === "error" ? String(result.message || "") : "";
    if (!message.includes("ログインの有効期限")) return false;
    clearHeikoSession();
    window.location.replace("index.html");
    return true;
}
window.handleHeikoSessionResponse = handleHeikoSessionResponse;

function getHeaderActionStack() {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return null;

    let stack = document.getElementById("heiko-header-actions");
    if (stack) return stack;

    stack = document.createElement("div");
    stack.id = "heiko-header-actions";
    stack.className = "heiko-header-actions";
    const menuButton = navbar.querySelector(".hamburger-btn");
    const navigation = navbar.querySelector(".nav-links");
    navbar.insertBefore(stack, menuButton || navigation || null);
    return stack;
}

function installPageRefreshButton() {
    if (!document.body || document.body.dataset.page === "index" || document.getElementById("heiko-page-refresh")) return;

    const stack = getHeaderActionStack();
    const button = document.createElement("button");
    button.id = "heiko-page-refresh";
    button.type = "button";
    button.className = "heiko-page-refresh";
    if (!stack) button.classList.add("is-floating");
    button.setAttribute("aria-label", "ページを更新");
    button.innerHTML = "<span aria-hidden=\"true\">↻</span><span>更新</span>";
    button.addEventListener("click", () => {
        button.disabled = true;
        button.classList.add("is-loading");
        button.querySelector("span").textContent = "⟳";
        window.location.reload();
    });
    (stack || document.body).appendChild(button);
}

function installRecruitmentPostButton() {
    if (!document.body || document.getElementById("heiko-recruit-post-panel")) return;
    const navbar = document.querySelector(".navbar");
    const refreshButton = document.getElementById("heiko-page-refresh");
    if (!navbar || !refreshButton) return;

    const panel = document.createElement("section");
    panel.id = "heiko-recruit-post-panel";
    panel.className = "heiko-recruit-post-panel";
    const currentRecruitment = document.getElementById("my-post-area");
    if (currentRecruitment) {
        panel.classList.add("is-sidebar-action");
        currentRecruitment.insertAdjacentElement("afterend", panel);
    } else {
        const main = document.querySelector("main");
        if (!main) return;
        panel.classList.add("is-page-action");
        main.insertAdjacentElement("beforebegin", panel);
    }

    const copy = document.createElement("div");
    copy.className = "heiko-recruit-post-copy";
    copy.innerHTML = "<span>QUICK MATCH</span><strong>いっしょに勉強する仲間を探そう</strong><small>学年・学科はマイページの設定が使われます</small>";
    const actions = document.createElement("div");
    actions.className = "heiko-recruit-post-actions";
    const button = document.createElement("a");
    button.id = "heiko-recruit-post";
    button.className = "heiko-recruit-post";
    button.href = "main.html?tab=recruit";
    button.setAttribute("aria-label", "募集を投稿する");
    button.innerHTML = "<span class=\"heiko-recruit-post-icon\" aria-hidden=\"true\">＋</span><span>募集を投稿する</span><span class=\"heiko-recruit-post-arrow\" aria-hidden=\"true\">→</span>";
    panel.appendChild(copy);
    actions.appendChild(button);
    actions.appendChild(refreshButton);
    panel.appendChild(actions);

    const headerActions = document.getElementById("heiko-header-actions");
    if (headerActions && !headerActions.children.length) headerActions.remove();
}

function prefetchHeikoPages() {
    if (!document.body || document.body.dataset.page !== "main") return;

    const pages = [
        "messages.html",
        "chat.html",
        "profile.html",
        "ai-study.html",
        "admin.html",
        "privacy.html",
        "terms.html"
    ];

    const cacheKey = "heiko-prefetched-pages-v20260930";
    try {
        if (sessionStorage.getItem(cacheKey) === "1") return;
        sessionStorage.setItem(cacheKey, "1");
    } catch (error) {
        console.warn("ページ先読み状態を保存できませんでした。", error);
    }

    Promise.allSettled(pages.map(page => {
        return fetch(page, { cache: "force-cache", credentials: "same-origin" }).then(response => {
            if (!response.ok) throw new Error(`${page}: HTTP ${response.status}`);
            return response.text();
        });
    })).then(results => {
        const failed = results.filter(result => result.status === "rejected").length;
        if (failed > 0) console.info(`ページ先読み: ${pages.length - failed}/${pages.length}件完了`);
    });
}

function installHeikoSharedStyles() {
    if (document.getElementById("heiko-shared-ui-style")) return;

    const style = document.createElement("style");
    style.id = "heiko-shared-ui-style";
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
        .heiko-pwa-install-dialog {
            width: min(420px, calc(100vw - 32px));
            margin: auto;
            padding: 0;
            border: 1px solid var(--ui-line, rgba(28, 189, 197, .3));
            border-radius: 20px;
            color: var(--ui-ink, #243c32);
            background: var(--ui-paper, #ffffff);
            box-shadow: 0 24px 64px rgba(11, 33, 52, .28);
        }
        .heiko-pwa-install-dialog::backdrop {
            background: rgba(10, 24, 39, .52);
            backdrop-filter: blur(4px);
        }
        .heiko-pwa-install-dialog-content {
            padding: 26px;
            text-align: center;
        }
        .heiko-pwa-dialog-icon {
            display: grid;
            width: 48px;
            height: 48px;
            place-items: center;
            margin: 0 auto 12px;
            border-radius: 15px;
            color: #ffffff;
            background: linear-gradient(135deg, #1689b5, #355fca);
            font-size: 30px;
            font-weight: 900;
            box-shadow: 0 10px 20px rgba(9, 27, 70, .2);
        }
        .heiko-pwa-install-dialog h3 {
            margin: 0 0 9px;
            font-size: 19px;
        }
        .heiko-pwa-install-dialog p {
            margin: 0;
            color: var(--ui-muted, #66736a);
            font-size: 14px;
            font-weight: 650;
            line-height: 1.75;
        }
        .heiko-pwa-dialog-close {
            min-width: 140px;
            min-height: 43px;
            margin-top: 20px;
            border: 0;
            border-radius: 12px;
            color: #ffffff;
            background: linear-gradient(135deg, #1689b5, #355fca);
            font: inherit;
            font-weight: 800;
            cursor: pointer;
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
    `;
    document.head.appendChild(style);
}

(function installUsageLogging() {
    const nativeFetch = window.fetch.bind(window);
    const ignoredModes = new Set(["recordUsageLog", "recordUsageLogs", "heartbeat", "login", "register", "verifyEmail", "resendVerificationCode", "forgotPassword", "resetPassword", "verify_face_1toN", "verify_face_for_user", "firebaseCustomToken", "getMessages", "getUnreadCount", "getNotificationSummary", "getLatestIncomingMessage", "markAsRead"]);
    const usageLogQueue = [];
    let usageLogTimer = null;
    let usageLogUrl = "";

    function parsePayload(body) {
        if (typeof body !== "string") return null;
        try {
            const payload = JSON.parse(body);
            return payload && typeof payload === "object" ? payload : null;
        } catch (error) {
            return null;
        }
    }

    function getRequestUrl(input) {
        return typeof input === "string" ? input : input && input.url ? input.url : "";
    }

    function flushUsageLogs() {
        const sessionToken = localStorage.getItem("sessionToken") || "";
        const userId = localStorage.getItem("userId") || localStorage.getItem("userEmail") || "";
        if (!sessionToken || !userId || usageLogQueue.length === 0) return;
        if (usageLogTimer) clearTimeout(usageLogTimer);
        usageLogTimer = null;
        const events = usageLogQueue.splice(0, 20);
        const logPayload = {
            mode: "recordUsageLogs",
            userId: String(userId).slice(0, 64),
            events: events,
            sessionToken: sessionToken
        };
        nativeFetch(usageLogUrl || window.HEIKO_GAS_URL || "https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec", {
            method: "POST",
            body: JSON.stringify(logPayload),
            keepalive: true
        }).catch(() => {});
        if (usageLogQueue.length > 0) usageLogTimer = setTimeout(flushUsageLogs, 1500);
    }

    function queueUsageLog(url, payload, result, durationMs, errorMessage) {
        if (!payload || payload.adminToken) return;
        if (url) usageLogUrl = url;
        usageLogQueue.push({
            sourceMode: String(payload.mode || "unknown").slice(0, 80),
            result: result,
            durationMs: Math.round(durationMs),
            errorMessage: String(errorMessage || "").slice(0, 300)
        });
        if (usageLogQueue.length >= 10 || result === "error") {
            flushUsageLogs();
        } else if (!usageLogTimer) {
            usageLogTimer = setTimeout(flushUsageLogs, 20000);
        }
    }

    window.fetch = async function (input, init = {}) {
        const url = getRequestUrl(input);
        const payload = parsePayload(init.body);
        const shouldLog = Boolean(payload && payload.mode && url.includes("script.google.com/macros/") && !ignoredModes.has(payload.mode) && !payload.adminToken);
        const startedAt = performance.now();

        try {
            const response = await nativeFetch(input, init);
            if (shouldLog) {
                const copy = response.clone();
                copy.json().then(result => {
                    const status = result && result.status === "success" ? "success" : "error";
                    queueUsageLog(url, payload, status, performance.now() - startedAt, status === "error" ? result.message : "");
                }).catch(error => queueUsageLog(url, payload, "error", performance.now() - startedAt, error.message));
            }
            return response;
        } catch (error) {
            if (shouldLog) queueUsageLog(url, payload, "error", performance.now() - startedAt, error.message);
            throw error;
        }
    };

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushUsageLogs();
    });
})();

document.addEventListener("DOMContentLoaded", () => {
    if (document.body && document.body.dataset.page === "index" && isHeikoAuthSessionActive()) {
        window.location.replace("main.html");
        return;
    }
    const selector = document.getElementById("theme-preference");
    if (selector) selector.value = readThemePreference();
    installHeikoSharedStyles();
    installPageRefreshButton();
    installRecruitmentPostButton();
    installHeikoPwaSupport();
    installHeikoFooterNavigation();
    if (document.body && document.body.dataset.page === "main") {
        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(prefetchHeikoPages, { timeout: 3000 });
        } else {
            window.setTimeout(prefetchHeikoPages, 1800);
        }
    }
});

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
