// ==========================================
// 🎨 1. 共通CSS（テンプレートリテラルで記述）
// ==========================================
const commonStyles = `
    /* カラー変数や基本スタイル */
    :root {
        --ink: currentColor;
        --ink-2: #FF4FD8;
        --ink-3: #4FF8FF;
    }

    /* 未読バッジなど共通デザイン */
    .unread-badge {
        position: absolute;
        top: 2px;
        right: 4px;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 10px;
        line-height: 1;
        box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
        min-width: 14px;
        text-align: center;
    }

    /* カスタムカーソルのスタイル */
    .cur {
        --c: var(--ink-2);
        position: relative;
        cursor: none;
        touch-action: none;
    }

    .cursor {
        position: absolute;
        left: var(--x);
        top: var(--y);
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--c);
        transform: translate(-50%, -50%);
        transition: left 0.07s, top 0.07s;
        pointer-events: none;
    }
`;

// 💡 作成したCSSをHTMLの<head>に自動挿入する処理
const styleTag = document.createElement("style");
styleTag.textContent = commonStyles;
document.head.appendChild(styleTag);


// ==========================================
// ⚡ 2. 共通JavaScript（全画面で動かす処理）
// ==========================================

// カーソルのマウス追従処理
function bindCursor(box) {
    let lx = 0, ly = 0, has = false, idle;
    const set = (p, v) => box.style.setProperty(p, v);
    
    box.addEventListener('pointermove', (e) => {
        const r = box.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        set('--x', x.toFixed(1) + 'px');
        set('--y', y.toFixed(1) + 'px');
        box.classList.add('is-active');
    });
    
    box.addEventListener('pointerleave', () => {
        box.classList.remove('is-active');
    });
}

// 画面の読み込みが終わったら共通処理を実行
window.addEventListener("DOMContentLoaded", () => {
    // カスタムカーソルの初期化
    document.querySelectorAll('.cur').forEach(bindCursor);
});