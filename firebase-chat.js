(function () {
    "use strict";

    const ENABLED = window.HEIKO_FIREBASE_CHAT_ENABLED === true;

    const firebaseConfig = {
        apiKey: "AIzaSyBj5jaygl5A5A1VMtDfmL-M_gJmqS9FI2o",
        authDomain: "heiko-matching-chat.firebaseapp.com",
        databaseURL: "https://heiko-matching-chat-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "heiko-matching-chat",
        storageBucket: "heiko-matching-chat.firebasestorage.app",
        messagingSenderId: "1043121900904",
        appId: "1:1043121900904:web:334b3a91cda49edfd69add"
    };

    function encodeKey(value) {
        const bytes = new TextEncoder().encode(String(value || ""));
        let binary = "";
        bytes.forEach(byte => { binary += String.fromCharCode(byte); });
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    function getFirebaseUid(userId) {
        return "u_" + encodeKey(userId);
    }

    function getConversationPath(firstUser, secondUser) {
        const ids = [getFirebaseUid(firstUser), getFirebaseUid(secondUser)].sort();
        return "chats/" + ids[0] + "/" + ids[1];
    }

    function getApp() {
        if (!ENABLED || !window.firebase || typeof window.firebase.initializeApp !== "function") return null;
        if (!window.firebase.apps.length) window.firebase.initializeApp(firebaseConfig);
        return window.firebase;
    }

    function getDatabase() {
        const app = getApp();
        return app && typeof app.database === "function" ? app.database() : null;
    }

    function getAuth() {
        const app = getApp();
        return app && typeof app.auth === "function" ? app.auth() : null;
    }

    async function isSignedInAs(userId, timeoutMs = 1500) {
        const auth = getAuth();
        if (!auth || !userId) return false;
        const expectedUid = getFirebaseUid(userId);
        if (auth.currentUser && auth.currentUser.uid === expectedUid) return true;
        return new Promise(resolve => {
            let finished = false;
            let unsubscribe = () => {};
            let timerId = null;
            const finish = result => {
                if (finished) return;
                finished = true;
                clearTimeout(timerId);
                unsubscribe();
                resolve(result);
            };
            timerId = setTimeout(() => finish(false), timeoutMs);
            unsubscribe = auth.onAuthStateChanged(user => finish(Boolean(user && user.uid === expectedUid)), () => finish(false));
        });
    }

    async function signIn(customToken, userId) {
        const auth = getAuth();
        if (!auth || !customToken || !userId) return false;
        const expectedUid = getFirebaseUid(userId);
        if (auth.currentUser && auth.currentUser.uid === expectedUid) return true;
        await auth.signInWithCustomToken(customToken);
        return Boolean(auth.currentUser && auth.currentUser.uid === expectedUid);
    }

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

    function createCollisionMessageId(messageId) {
        const randomPart = Math.random().toString(36).slice(2, 10);
        return `${String(messageId)}-copy-${Date.now().toString(36)}-${randomPart}`.slice(0, 100);
    }

    function emitMessages(state, onChange) {
        const messages = state.messages
            .filter(message => !state.hiddenAt || !message.sentAt || message.sentAt > state.hiddenAt)
            .sort((a, b) => a.sentAt - b.sentAt);
        onChange(messages);
    }

    function subscribe(firstUser, secondUser, onChange, onError) {
        const database = getDatabase();
        if (!database) return () => {};

        const chatRef = database.ref(getConversationPath(firstUser, secondUser));
        const hiddenRef = database.ref("hidden/" + getFirebaseUid(firstUser) + "/" + getFirebaseUid(secondUser));
        const state = { messages: [], hiddenAt: 0 };
        const emit = () => emitMessages(state, onChange);
        const chatHandler = snapshot => {
            state.messages = [];
            snapshot.forEach(child => { state.messages.push(normalizeMessage(child)); });
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

    async function sendText(firstUser, secondUser, messageId, text) {
        const database = getDatabase();
        const auth = getAuth();
        if (!database || !auth || !auth.currentUser || auth.currentUser.uid !== getFirebaseUid(firstUser)) {
            throw new Error("Firebase認証が完了していません");
        }

        const safeText = String(text || "").trim();
        if (!safeText) throw new Error("メッセージを入力してください");

        const requestedMessageId = String(messageId || "").trim();
        if (!requestedMessageId) throw new Error("送信IDを作成できませんでした");

        const fromUid = getFirebaseUid(firstUser);
        const toUid = getFirebaseUid(secondUser);
        const conversationRef = database.ref(getConversationPath(firstUser, secondUser));
        let storedMessageId = requestedMessageId;
        let messageKey = encodeKey(storedMessageId);
        const existingSnapshot = await conversationRef.child(messageKey).once("value");

        if (existingSnapshot.exists()) {
            const existing = existingSnapshot.val() || {};
            const isSameRetry = String(existing.messageId || "") === requestedMessageId &&
                String(existing.fromUid || "") === fromUid &&
                String(existing.toUid || "") === toUid &&
                String(existing.text || "") === safeText;
            if (isSameRetry) return requestedMessageId;
            storedMessageId = createCollisionMessageId(requestedMessageId);
            messageKey = encodeKey(storedMessageId);
        }

        const value = {
            messageId: storedMessageId,
            from: String(firstUser),
            to: String(secondUser),
            fromUid,
            toUid,
            text: safeText,
            sentAt: window.firebase.database.ServerValue.TIMESTAMP,
            isRead: false,
            isUnsent: false
        };
        const updates = {}; // 一括保存する更新内容を用意します。
        updates[getConversationPath(firstUser, secondUser) + "/" + messageKey] = value; // 会話本体を更新対象へ追加します。
        updates["inbox/" + fromUid + "/" + messageKey] = value; // 送信者の一覧を更新対象へ追加します。
        updates["inbox/" + toUid + "/" + messageKey] = value; // 受信者の一覧を更新対象へ追加します。
        await database.ref().update(updates); // 三か所を一度の処理で保存します。
        return storedMessageId;
    }

    async function readOnce(firstUser, secondUser) {
        const database = getDatabase();
        if (!database) return [];
        const snapshot = await database.ref(getConversationPath(firstUser, secondUser)).once("value");
        const messages = [];
        snapshot.forEach(child => { messages.push(normalizeMessage(child)); });
        return messages.sort((a, b) => a.sentAt - b.sentAt);
    }

    async function readInbox(userId) {
        const database = getDatabase();
        if (!database) return [];
        const snapshot = await database.ref("inbox/" + getFirebaseUid(userId)).once("value");
        const messages = [];
        snapshot.forEach(child => { messages.push(normalizeMessage(child)); });
        return messages.sort((a, b) => b.sentAt - a.sentAt);
    }

    function subscribeInbox(userId, onChange, onError) {
        const database = getDatabase();
        if (!database) return () => {};
        const inboxRef = database.ref("inbox/" + getFirebaseUid(userId));
        const handler = snapshot => {
            const messages = [];
            snapshot.forEach(child => { messages.push(normalizeMessage(child)); });
            onChange(messages.sort((a, b) => b.sentAt - a.sentAt));
        };
        inboxRef.on("value", handler, onError);
        return () => inboxRef.off("value", handler);
    }

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

    async function unsendMessage(firstUser, secondUser, messageId) {
        const database = getDatabase();
        if (!database) throw new Error("Firebaseが利用できません");
        const snapshot = await database.ref(getConversationPath(firstUser, secondUser)).once("value");
        let messageKey = null;
        snapshot.forEach(child => {
            const message = child.val() || {};
            if (String(message.messageId || child.key) === String(messageId) && message.fromUid === getFirebaseUid(firstUser)) messageKey = child.key;
        });
        if (!messageKey) throw new Error("取り消せるメッセージが見つかりません");
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

    async function hideConversation(firstUser, secondUser) {
        const database = getDatabase();
        if (!database) throw new Error("Firebaseが利用できません");
        await database.ref("hidden/" + getFirebaseUid(firstUser) + "/" + getFirebaseUid(secondUser)).set(Date.now());
    }

    window.HeikoFirebaseChat = {
        enabled: ENABLED,
        encodeKey,
        getFirebaseUid,
        getConversationPath,
        isSignedInAs,
        signIn,
        subscribe,
        sendText,
        readOnce,
        readInbox,
        subscribeInbox,
        markAsRead,
        unsendMessage,
        hideConversation
    };
})();
