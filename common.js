const cursorStyle = `
    html, body, body *,
    button, a, input, select, textarea, label, [onclick], .nav-item {
        cursor: none !important;
    }
    .custom-cursor-dot {
        position: fixed;
        top: 0;
        left: 0;
        width: 12px;
        height: 12px;
        background-color: #FF4FD8;
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%) scale(1);
        transition: transform 0.15s ease-out, background-color 0.15s ease-out, opacity 0.2s ease;
        opacity: 0;
        will-change: transform, left, top;
    }
    .custom-cursor-dot.is-active {
        opacity: 1;
    }
    .custom-cursor-dot.is-hover {
        transform: translate(-50%, -50%) scale(2.2);
        background-color: #1cbdc5;
        opacity: 0.8;
    }
`;

const styleTag = document.createElement("style");
styleTag.textContent = cursorStyle;
document.head.appendChild(styleTag);

window.addEventListener("DOMContentLoaded", () => {
    let cursor = document.querySelector(".custom-cursor-dot");
    if (!cursor) {
        cursor = document.createElement("div");
        cursor.className = "custom-cursor-dot";
        document.body.appendChild(cursor);
    }

    window.addEventListener("pointermove", (e) => {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
        cursor.classList.add("is-active");

        const target = e.target;
        const isHoverable = target.closest("button, a, input, select, textarea, label, .btn-logout, .nav-item, [onclick]");

        if (isHoverable) {
            cursor.classList.add("is-hover");
        } else {
            cursor.classList.remove("is-hover");
        }
    });

    document.addEventListener("pointerleave", () => {
        cursor.classList.remove("is-active");
    });
});
