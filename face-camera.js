// 顔認証用カメラの起動処理（index.html と profile.html で共通）
// 映像のフレームが実際に届くまで待ち、届かなければ条件を緩めて取り直す。
(function () {
    "use strict";

    const CONSTRAINT_PROFILES = [
        {
            audio: false,
            video: {
                facingMode: { ideal: "user" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }
        },
        { audio: false, video: { facingMode: "user" } },
        { audio: false, video: true }
    ];

    // これらは条件を変えても解決しないので、すぐに諦める
    const FATAL_ERRORS = new Set(["NotAllowedError", "SecurityError", "NotFoundError", "TypeError", "UnsupportedError"]);

    function makeError(name) {
        const err = new Error(name);
        err.name = name;
        return err;
    }

    function stopStream(stream) {
        if (!stream) return;
        stream.getTracks().forEach(track => {
            try { track.stop(); } catch (err) { /* 停止済み */ }
        });
    }

    function isLive(stream) {
        return !!stream && stream.getVideoTracks().some(track => track.readyState === "live" && !track.muted);
    }

    function waitForFrames(video, timeoutMs) {
        return new Promise(resolve => {
            let finished = false;
            const events = ["loadeddata", "playing", "resize", "timeupdate"];
            const check = () => {
                if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) finish(true);
            };
            const finish = ok => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                clearInterval(poll);
                events.forEach(name => video.removeEventListener(name, check));
                resolve(ok);
            };
            const timer = setTimeout(() => finish(false), timeoutMs);
            const poll = setInterval(check, 120);
            events.forEach(name => video.addEventListener(name, check));
            check();
        });
    }

    function attach(video, stream) {
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.srcObject = stream;
        // play() は映像が来るまで解決しないことがあるので待たない
        const playing = video.play();
        if (playing && typeof playing.catch === "function") playing.catch(() => {});
    }

    function detach(video) {
        try { video.pause(); } catch (err) { /* 無視 */ }
        video.srcObject = null;
    }

    async function open(video, options = {}) {
        const isCancelled = typeof options.isCancelled === "function" ? options.isCancelled : () => false;
        const frameTimeoutMs = options.frameTimeoutMs || 5000;

        if (!window.isSecureContext || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
            throw makeError("UnsupportedError");
        }

        let lastError = null;
        for (const constraints of CONSTRAINT_PROFILES) {
            let stream = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                lastError = err;
                if (FATAL_ERRORS.has(err && err.name)) throw err;
                continue;
            }

            if (isCancelled()) {
                stopStream(stream);
                throw makeError("AbortError");
            }

            attach(video, stream);
            const ok = await waitForFrames(video, frameTimeoutMs);

            if (isCancelled()) {
                stopStream(stream);
                detach(video);
                throw makeError("AbortError");
            }
            if (ok) return stream;

            stopStream(stream);
            detach(video);
            lastError = makeError("NoFrameError");
        }
        throw lastError || makeError("NoFrameError");
    }

    function watch(stream, onStopped) {
        if (!stream) return;
        stream.getVideoTracks().forEach(track => {
            track.addEventListener("ended", onStopped, { once: true });
        });
    }

    function describeError(err) {
        const name = err && err.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
            return "カメラの使用が許可されていません。ブラウザの設定でこのサイトのカメラを許可してから、もう一度お試しください。";
        }
        if (name === "NotFoundError" || name === "OverconstrainedError") {
            return "使用できるカメラが見つかりませんでした。";
        }
        if (name === "NotReadableError" || name === "TrackStartError") {
            return "カメラを起動できませんでした。ほかのアプリやタブでカメラを使っていないか確認してください。";
        }
        if (name === "NoFrameError") {
            return "カメラの映像を取得できませんでした。ほかのアプリでカメラを使っていないか確認して、もう一度お試しください。";
        }
        if (name === "UnsupportedError" || name === "TypeError") {
            return "このブラウザではカメラを使えません。Safari や Chrome などの最新のブラウザで開いてください。";
        }
        return "カメラの起動に失敗しました。もう一度お試しください。";
    }

    window.HeikoFaceCamera = { open, stopStream, isLive, watch, detach, describeError };
})();
