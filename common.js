(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const styleTag = document.createElement("style");
    styleTag.textContent = `
        html, body, body *, button, a, input, select, textarea, label, [onclick], .nav-item {
            cursor: none !important;
        }
        .custom-cursor-dot {
            position: fixed;
            top: 0;
            left: 0;
            width: 12px;
            height: 12px;
            background-color: #ff4fd8;
            border-radius: 50%;
            pointer-events: none;
            z-index: 999999;
            transform: translate(-50%, -50%);
            transition: transform .15s ease-out, background-color .15s ease-out, opacity .2s ease;
            opacity: 0;
            will-change: transform, left, top;
        }
        .custom-cursor-dot.is-active { opacity: 1; }
        .custom-cursor-dot.is-hover {
            transform: translate(-50%, -50%) scale(2.2);
            background-color: #1cbdc5;
            opacity: .8;
        }
    `;
    document.head.appendChild(styleTag);

    window.addEventListener("DOMContentLoaded", () => {
        const cursor = document.createElement("div");
        cursor.className = "custom-cursor-dot";
        document.body.appendChild(cursor);

        window.addEventListener("pointermove", event => {
            cursor.style.left = event.clientX + "px";
            cursor.style.top = event.clientY + "px";
            cursor.classList.add("is-active");
            const hoverable = event.target.closest("button, a, input, select, textarea, label, .btn-logout, .nav-item, [onclick]");
            cursor.classList.toggle("is-hover", Boolean(hoverable));
        }, { passive: true });

        document.addEventListener("pointerleave", () => cursor.classList.remove("is-active"));
    }, { once: true });
})();
