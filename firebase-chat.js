// Firebaseを使ったテキストチャットの共通処理です。
(function () {
    "use strict";

    // Firebaseを利用する画面だけがtrueを指定します。
    const ENABLED = window.HEIKO_FIREBASE_CHAT_ENABLED === true;

    // Firebaseコンソールで発行されたWebアプリの設定です。
    const firebaseConfig = {
        apiKey: "AIzaSyBj5jaygl5A5A1VMtDfmL-M_gJmqS9FI2o",
        authDomain: "heiko-matching-chat.firebaseapp.com",
        databaseURL: "https://heiko-matching-chat-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "heiko-matching-chat",
        storageBucket: "heiko-matching-chat.firebasestorage.app",
        messagingSenderId: "1043121900904",
        appId: "1:1043121900904:web:334b3a91cda49edfd69add"
    };

    // ユーザーIDをFirebaseのパスで安全に使える文字列へ変換します。
    function encodeKey(value) {
        const bytes = new TextEncoder().encode(String(value || ""));
        let binary = "";
        bytes.forEach(byte => { binary += String.fromCharCode(byte); });
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    // GAS側で発行するカスタムトークンと同じUIDを作ります。
    function getFirebaseUid(userId) {
        return "u_" + encodeKey(userId);
    }

    // 二人のユーザーで常に同じ並びの会話パスを作ります。
    function getConversationPath(firstUser, secondUser) {
        const ids = [getFirebaseUid(firstUser), getFirebaseUid(secondUser)].sort();
        return "chats/" + ids[0] + "/" + ids[1];
    }

    // Firebase SDKが読み込まれている場合だけアプリを初期化します。
    function getApp() {
        if (!ENABLED || !window.firebase || typeof window.firebase.initializeApp !== "function") return null;
        if (!window.firebase.apps.length) window.firebase.initializeApp(firebaseConfig);
        return window.firebase;
    }

    // Firebase Databaseを取得します。
    function getDatabase() {
        const app = getApp();
        return app && typeof app.database === "function" ? app.database() : null;
    }

    // Firebase Authenticationを取得します。
    function getAuth() {
        const app = getApp();
        return app && typeof app.auth === "function" ? app.auth() : null;
    }

    // GASから受け取ったカスタムトークンでFirebaseへログインします。
    async function signIn(customToken, userId) {
        const auth = getAuth();
        if (!auth || !customToken || !userId) return false;
        const expectedUid = getFirebaseUid(userId);
        if (auth.currentUser && auth.currentUser.uid === expectedUid) return true;
        await auth.signInWithCustomToken(customToken);
        return Boolean(auth.currentUser && auth.currentUser.uid === expectedUid);
    }

    // Firebase側の値を既存画面で使うメッセージ形式に整えます。
    function normalizeMessage(snapshot) {
        const value = snapshot.val() || {};
        return {
            messageId: String(value.messageId || snapshot.key || ""),
            from: String(value.from || ""),
            to: String(value.to || ""),
            fromUid: String(value.fromUid || ""),
            toUid: String(value.toUid || ""),
            text: String(value.text || ""),
            sentAt: Number(value.sentAt || 0),
            isRead: value.isRead === true,
            isUnsent: value.isUnsent === true,
            storage: "firebase",
            attachments: []
        };
    }

    // 会話のメッセージを並べ替えて通知します。
    function emitMessages(state, onChange) {
        const messages = state.messages
            .filter(message => !state.hiddenAt || !message.sentAt || message.sentAt > state.hiddenAt)
            .sort((a, b) => a.sentAt - b.sentAt);
        onChange(messages);
    }

    // Firebaseの会話をリアルタイム購読します。
    function subscribe(firstUser, secondUser, onChange, onError) {
        const database = getDatabase();
        if (!database) return () => {};

        const chatRef = database.ref(getConversationPath(firstUser, secondUser));
        const hiddenRef = database.ref("hidden/" + getFirebaseUid(firstUser) + "/" + getFirebaseUid(secondUser));
        const state = { messages: [], hiddenAt: 0 };
        const emit = () => emitMessages(state, onChange);
        const chatHandler = snapshot => {
            state.messages = [];
            snapshot.forEach(child => state.messages.push(normalizeMessage(child)));
            emit();
        };
        const hiddenHandler = snapshot => {
            state.hiddenAt = Number(snapshot.val() || 0);
            emit();
        };

        chatRef.on("value", chatHandler, onError);
        hiddenRef.on("value", hiddenHandler, onError);
        return () => {
            chatRef.off("value", chatHandler);
            hiddenRef.off("value", hiddenHandler);
        };
    }

    // Firebaseへ本文だけを保存し、一覧用の受信箱も更新します。
    async function sendText(firstUser, secondUser, messageId, text) {
        const database = getDatabase();
        const auth = getAuth();
        if (!database || !auth || !auth.currentUser || auth.currentUser.uid !== getFirebaseUid(firstUser)) {
            throw new Error("Firebase認証が完了していません");
        }

        const safeText = String(text || "").trim();
        if (!safeText) throw new Error("メッセージを入力してください");

        const fromUid = getFirebaseUid(firstUser);
        const toUid = getFirebaseUid(secondUser);
        const value = {
            messageId: String(messageId),
            from: String(firstUser),
            to: String(secondUser),
            fromUid,
            toUid,
            text: safeText,
            sentAt: window.firebase.database.ServerValue.TIMESTAMP,
            isRead: false,
            isUnsent: false
        };
        const messageKey = encodeKey(messageId);
        const chatRef = database.ref(getConversationPath(firstUser, secondUser) + "/" + messageKey);
        const senderInboxRef = database.ref("inbox/" + fromUid + "/" + messageKey);
        const recipientInboxRef = database.ref("inbox/" + toUid + "/" + messageKey);
        await Promise.all([chatRef.set(value), senderInboxRef.set(value), recipientInboxRef.set(value)]);
        return "SENT";
    }

    // Firebase側の会話を一度だけ取得します。
    async function readOnce(firstUser, secondUser) {
        const database = getDatabase();
        if (!database) return [];
        const snapshot = await database.ref(getConversationPath(firstUser, secondUser)).once("value");
        const messages = [];
        snapshot.forEach(child => messages.push(normalizeMessage(child)));
        return messages.sort((a, b) => a.sentAt - b.sentAt);
    }

    // Firebase側の受信箱を取得してメッセージ一覧を作れるようにします。
    async function readInbox(userId) {
        const database = getDatabase();
        if (!database) return [];
        const snapshot = await database.ref("inbox/" + getFirebaseUid(userId)).once("value");
        const messages = [];
        snapshot.forEach(child => messages.push(normalizeMessage(child)));
        return messages.sort((a, b) => b.sentAt - a.sentAt);
    }

    // Firebase側の未読メッセージを既読へ更新します。
    async function markAsRead(firstUser, secondUser) {
        const database = getDatabase();
        if (!database) return;
        const myUid = getFirebaseUid(firstUser);
        const snapshot = await database.ref(getConversationPath(firstUser, secondUser)).once("value");
        const updates = {};
        snapshot.forEach(child => {
            const message = child.val() || {};
            if (message.toUid === myUid && message.isRead !== true) {
                updates[getConversationPath(firstUser, secondUser) + "/" + child.key + "/isRead"] = true;
                updates["inbox/" + myUid + "/" + child.key + "/isRead"] = true;
                updates["inbox/" + String(message.fromUid || "") + "/" + child.key + "/isRead"] = true;
            }
        });
        if (Object.keys(updates).length > 0) await database.ref().update(updates);
    }

    // 送信者本人のFirebaseメッセージを取り消します。
    async function unsendMessage(firstUser, secondUser, messageId) {
        const database = getDatabase();
        if (!database) throw new Error("Firebaseが利用できません");
        const messageKey = encodeKey(messageId);
        const basePath = getConversationPath(firstUser, secondUser) + "/" + messageKey;
        const value = { text: "このメッセージは送信取り消しされました。", isUnsent: true, isRead: true };
        const updates = {};
        Object.keys(value).forEach(key => { updates[basePath + "/" + key] = value[key]; });
        [getFirebaseUid(firstUser), getFirebaseUid(secondUser)].forEach(uid => {
            updates["inbox/" + uid + "/" + messageKey + "/text"] = value.text;
            updates["inbox/" + uid + "/" + messageKey + "/isUnsent"] = true;
        });
        await database.ref().update(updates);
    }

    // 自分の画面だけ会話を非表示にします。
    async function hideConversation(firstUser, secondUser) {
        const database = getDatabase();
        if (!database) throw new Error("Firebaseが利用できません");
        await database.ref("hidden/" + getFirebaseUid(firstUser) + "/" + getFirebaseUid(secondUser)).set(Date.now());
    }

    // チャット画面から利用する公開APIです。
    window.HeikoFirebaseChat = {
        enabled: ENABLED,
        encodeKey,
        getFirebaseUid,
        getConversationPath,
        signIn,
        subscribe,
        sendText,
        readOnce,
        readInbox,
        markAsRead,
        unsendMessage,
        hideConversation
    };
})();
