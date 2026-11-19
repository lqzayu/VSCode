// 学校行事の読み込みと表示用の共通処理（events.html と main.html で使う）
(function () {
    const GAS_URL = window.HEIKO_GAS_URL || "https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec";
    const CACHE_KEY = "heiko-school-events-v1";
    const CACHE_MS = 60 * 1000;
    const TYPE_LABELS = { event: "行事", exam: "考査", license: "検定・試験", holiday: "休日", closed: "閉庁日" };
    const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
    let pending = null;

    function readCache() {
        try {
            const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
            if (saved && Array.isArray(saved.events)) return saved;
        } catch (error) { /* 壊れたキャッシュは使わない */ }
        return null;
    }

    function writeCache(events) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events })); } catch (error) { /* 保存できなくても表示は続ける */ }
    }

    // まずキャッシュをすぐ返し（onUpdate）、裏で必ず取り直す。
    // 取り直しを省くのは「1分以内に取得済みで、行事が1件以上ある」ときだけ。
    // 空の結果を長く使い回すと、管理者が保存した直後でも何も表示されない状態が続いてしまう
    async function load({ force = false, onUpdate } = {}) {
        const cached = readCache();
        if (cached && typeof onUpdate === "function") onUpdate(cached.events, { fromCache: true });
        if (!force && cached && cached.events.length > 0 && Date.now() - cached.savedAt < CACHE_MS) return cached.events;
        if (pending) return pending;
        pending = (async () => {
            const userId = localStorage.getItem("userId") || localStorage.getItem("userEmail") || "";
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                const res = await fetch(GAS_URL, {
                    method: "POST",
                    body: JSON.stringify({ mode: "getSchoolEvents", userId, sessionToken: localStorage.getItem("sessionToken") || "" }),
                    signal: controller.signal
                });
                const result = await res.json();
                // 学校行事はおまけの表示なので、読み込めなくてもログアウトさせない。
                // GASが古いバージョンのままだと getSchoolEvents を知らず「ログインの有効期限」エラーが返るため、ここで判定するとログイン直後に追い出されてしまう
                if (!result || result.status !== "success" || !Array.isArray(result.message)) throw new Error((result && result.message) || "学校行事を読み込めませんでした");
                writeCache(result.message);
                if (typeof onUpdate === "function") onUpdate(result.message, { fromCache: false });
                return result.message;
            } catch (error) {
                if (cached) return cached.events;
                throw error;
            } finally {
                clearTimeout(timer);
                pending = null;
            }
        })();
        return pending;
    }

    function toKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function parseKey(key) {
        const [y, m, d] = String(key).split("-").map(Number);
        return new Date(y, m - 1, d);
    }

    function addDays(key, days) {
        const date = parseKey(key);
        date.setDate(date.getDate() + days);
        return toKey(date);
    }

    function todayKey() { return toKey(new Date()); }

    function occursOn(event, key) {
        return event.date <= key && key <= (event.endDate || event.date);
    }

    // 今日から days 日以内に始まる・続いている行事（休日と閉庁日は除く）
    function upcoming(events, days = 30) {
        const from = todayKey();
        const to = addDays(from, days);
        return events
            .filter(event => (event.endDate || event.date) >= from && event.date <= to && event.type !== "closed")
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }

    function formatDay(key, { withYear = false } = {}) {
        const date = parseKey(key);
        return `${withYear ? date.getFullYear() + "年" : ""}${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
    }

    function formatShort(key) {
        const date = parseKey(key);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    function formatRange(event) {
        if (!event.endDate) return formatDay(event.date);
        return `${formatDay(event.date)}〜${formatDay(event.endDate)}`;
    }

    function daysUntil(key) {
        const diff = Math.round((parseKey(key) - parseKey(todayKey())) / 86400000);
        return diff;
    }

    function relativeLabel(event) {
        const today = todayKey();
        if (occursOn(event, today)) return event.endDate ? "開催中" : "今日";
        const diff = daysUntil(event.date);
        if (diff === 1) return "明日";
        return `${diff}日後`;
    }

    window.HeikoSchoolEvents = { load, upcoming, occursOn, toKey, parseKey, addDays, todayKey, formatDay, formatShort, formatRange, relativeLabel, daysUntil, TYPE_LABELS, WEEKDAYS };
})();
