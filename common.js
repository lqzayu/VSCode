// ==========================================
// 🎨 共通カスタムカーソル CSS (チカチカ完全防止版)
// ==========================================
const cursorStyle = `
    /* 画面上の全要素でデフォルトカーソルを完全に消去 */
    html, body, body *, 
    button, a, input, select, textarea, label, [onclick], .nav-item {
        cursor: none !important;
    }

    /* カスタムカーソル本体（ピンクの丸） */
    .custom-cursor-dot {
        position: fixed;
        top: 0;
        left: 0;
        width: 12px;
        height: 12px;
        background-color: #FF4FD8;
        border-radius: 50%;
        pointer-events: none; /* マウスイベントを透過してクリックを妨げない */
        z-index: 999999;
        transform: translate(-50%, -50%) scale(1);
        transition: transform 0.15s ease-out, background-color 0.15s ease-out, opacity 0.2s ease;
        opacity: 0; /* 最初は非表示 */
        will-change: transform, left, top;
    }

    /* マウスが動いたら表示 */
    .custom-cursor-dot.is-active {
        opacity: 1;
    }

    /* ボタンやリンクに重なった時の拡大アニメーション */
    .custom-cursor-dot.is-hover {
        transform: translate(-50%, -50%) scale(2.2);
        background-color: #1cbdc5; /* ホバー時にテーマカラーへ変化 */
        opacity: 0.8;
    }
`;

// スタイルを head に追加
const styleTag = document.createElement("style");
styleTag.textContent = cursorStyle;
document.head.appendChild(styleTag);

// ==========================================
// ⚡ マウス追従 ＆ ホバー判定処理
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    // カーソル要素を作成して body に追加
    let cursor = document.querySelector(".custom-cursor-dot");
    if (!cursor) {
        cursor = document.createElement("div");
        cursor.className = "custom-cursor-dot";
        document.body.appendChild(cursor);
    }

    // マウス移動時の位置更新＆ホバー検知
    window.addEventListener("pointermove", (e) => {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
        cursor.classList.add("is-active");

        // ホバー対象（ボタン、リンク、入力欄など）の上にいるか判定
        const target = e.target;
        const isHoverable = target.closest("button, a, input, select, textarea, label, .btn-logout, .nav-item, [onclick]");

        if (isHoverable) {
            cursor.classList.add("is-hover");
        } else {
            cursor.classList.remove("is-hover");
        }
    });

    // マウスが画面外に出た時
    document.addEventListener("pointerleave", () => {
        cursor.classList.remove("is-active");
    });
});