import { loadRules, canRead, tryUpdate } from "./rules_sim.js";

// firebase-chat.js と同じ鍵の作り方
const enc = v => btoa(String.fromCharCode(...new TextEncoder().encode(String(v)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const uid = id => "u_" + enc(id);
const conv = (a, b) => { const ids = [uid(a), uid(b)].sort(); return `chats/${ids[0]}/${ids[1]}`; };
const authOf = id => ({ uid: uid(id), token: { userId: id } });
const A = "taro01", B = "hanako02", C = "evil03";
const TS = { ".sv": "timestamp" };

function msg(from, to, id, text) {
  return { messageId: id, from, to, fromUid: uid(from), toUid: uid(to), text, sentAt: TS, isRead: false, isUnsent: false };
}
// アプリの sendText と同じ3か所一括書き込み
function sendUpdates(from, to, id, text, override = {}) {
  const value = { ...msg(from, to, id, text), ...override };
  const key = enc(id);
  return {
    [`${conv(from, to)}/${key}`]: value,
    [`inbox/${uid(from)}/${key}`]: value,
    [`inbox/${uid(to)}/${key}`]: value
  };
}

// 既存データ: A→B のメッセージ1件
function seed() {
  const r = tryUpdate(null, authOf(A), sendUpdates(A, B, "m1", "こんにちは"));
  if (!r.ok) throw new Error("seed failed under these rules: " + r.reason);
  return r.next;
}

const cases = [];
const t = (id, title, expect, fn) => cases.push({ id, title, expect, fn });
const key1 = enc("m1");

// T1 未ログイン
t("T1", "未ログインで会話を読む", false, db => canRead(db, null, conv(A, B)));
t("T1", "未ログインで受信箱を読む", false, db => canRead(db, null, `inbox/${uid(B)}`));
t("T1", "未ログインでルート全体を読む", false, db => canRead(db, null, ""));
t("T1", "未ログインでメッセージを書き込む", false, db => tryUpdate(db, null, sendUpdates(A, B, "x1", "spam")).ok);

// T2 第三者による閲覧
t("T2", "当事者Aが会話を読む", true, db => canRead(db, authOf(A), conv(A, B)));
t("T2", "当事者Bが会話を読む", true, db => canRead(db, authOf(B), conv(A, B)));
t("T2", "第三者Cが他人の会話を読む", false, db => canRead(db, authOf(C), conv(A, B)));
t("T2", "第三者CがBの受信箱を読む", false, db => canRead(db, authOf(C), `inbox/${uid(B)}`));
t("T2", "第三者CがBの非表示リストを読む", false, db => canRead(db, authOf(C), `hidden/${uid(B)}`));

// T3 送信
t("T3", "AがBへ送信（アプリと同じ3か所一括）", true, db => tryUpdate(db, authOf(A), sendUpdates(A, B, "m2", "明日やろう")).ok);
t("T3", "BがAへ返信", true, db => tryUpdate(db, authOf(B), sendUpdates(B, A, "m3", "いいよ")).ok);
t("T3", "CがAになりすまして送信（fromUid偽装）", false, db => tryUpdate(db, authOf(C), sendUpdates(A, B, "x2", "なりすまし")).ok);
t("T3", "CがAとBの会話に自分名義で書き込む", false, db => tryUpdate(db, authOf(C), { [`${conv(A, B)}/${enc("x3")}`]: msg(C, B, "x3", "割り込み") }).ok);
t("T3", "2001文字以上の本文", false, db => tryUpdate(db, authOf(A), sendUpdates(A, B, "x4", "あ".repeat(2001))).ok);
t("T3", "必須項目が欠けたメッセージ", false, db => { const u = sendUpdates(A, B, "x5", "欠け"); for (const k of Object.keys(u)) { u[k] = { ...u[k] }; delete u[k].sentAt; } return tryUpdate(db, authOf(A), u).ok; });
t("T3", "CがBの受信箱に無関係なメッセージを差し込む", false, db => tryUpdate(db, authOf(C), { [`inbox/${uid(B)}/${enc("x6")}`]: msg(C, A, "x6", "無関係") }).ok);
t("T3", "表示名(from)だけ他人に偽装して送信", false, db => tryUpdate(db, authOf(A), sendUpdates(A, B, "x7", "偽名", { from: "teacher" })).ok);

// T4 既読と改ざん
t("T4", "受信者Bが既読にする（アプリの markAsRead と同じ更新）", true, db => tryUpdate(db, authOf(B), {
  [`${conv(A, B)}/${key1}/isRead`]: true, [`inbox/${uid(B)}/${key1}/isRead`]: true, [`inbox/${uid(A)}/${key1}/isRead`]: true
}).ok);
t("T4", "受信者Bが相手の本文を書き換える", false, db => tryUpdate(db, authOf(B), { [`${conv(A, B)}/${key1}/text`]: "改ざん" }).ok);
t("T4", "受信者Bが相手のメッセージを取り消し済みにする", false, db => tryUpdate(db, authOf(B), { [`${conv(A, B)}/${key1}/isUnsent`]: true }).ok);
t("T4", "第三者Cが既読にする", false, db => tryUpdate(db, authOf(C), { [`${conv(A, B)}/${key1}/isRead`]: true }).ok);

// T5 送信取り消し
t("T5", "送信者Aが取り消す（アプリの unsendMessage と同じ更新）", true, db => tryUpdate(db, authOf(A), {
  [`${conv(A, B)}/${key1}/text`]: "このメッセージは送信取り消しされました。", [`${conv(A, B)}/${key1}/isUnsent`]: true, [`${conv(A, B)}/${key1}/isRead`]: true,
  [`inbox/${uid(A)}/${key1}/text`]: "このメッセージは送信取り消しされました。", [`inbox/${uid(A)}/${key1}/isUnsent`]: true,
  [`inbox/${uid(B)}/${key1}/text`]: "このメッセージは送信取り消しされました。", [`inbox/${uid(B)}/${key1}/isUnsent`]: true
}).ok);
t("T5", "第三者Cが取り消す", false, db => tryUpdate(db, authOf(C), { [`${conv(A, B)}/${key1}/isUnsent`]: true }).ok);
t("T5", "送信者Aが宛先(toUid)を書き換える", false, db => tryUpdate(db, authOf(A), { [`${conv(A, B)}/${key1}/toUid`]: uid(C) }).ok);

// T6 削除・非表示リスト
t("T6", "本人Bが会話を非表示にする（hidden に時刻を保存）", true, db => tryUpdate(db, authOf(B), { [`hidden/${uid(B)}/${uid(A)}`]: Date.now() }).ok);
t("T6", "CがBの非表示リストを書き換える", false, db => tryUpdate(db, authOf(C), { [`hidden/${uid(B)}/${uid(A)}`]: Date.now() }).ok);
t("T6", "非表示リストに数値以外を保存", false, db => tryUpdate(db, authOf(B), { [`hidden/${uid(B)}/${uid(A)}`]: "abc" }).ok);
t("T6", "当事者Aが会話のメッセージを削除（null）", false, db => tryUpdate(db, authOf(A), { [`${conv(A, B)}/${key1}`]: null }).ok);
t("T6", "当事者Aが会話全体を削除", false, db => tryUpdate(db, authOf(A), { [conv(A, B)]: null }).ok);
t("T6", "CがBの受信箱を丸ごと削除", false, db => tryUpdate(db, authOf(C), { [`inbox/${uid(B)}`]: null }).ok);

for (const file of Deno.args) {
  loadRules(file);
  let db;
  try { db = seed(); } catch (e) { console.log(`\n### ${file}\n${e.message}`); continue; }
  console.log(`\n### ${file}`);
  let fails = 0;
  for (const c of cases) {
    const got = c.fn(db);
    const pass = got === c.expect;
    if (!pass) fails++;
    console.log(`${pass ? "OK  " : "NG  "} ${c.id} ${c.title} → ${got ? "許可" : "拒否"}（期待: ${c.expect ? "許可" : "拒否"}）`);
  }
  console.log(`=> ${cases.length - fails}/${cases.length} 合格`);
}
