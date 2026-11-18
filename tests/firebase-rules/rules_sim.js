// Firebase Realtime Database ルールの簡易シミュレータ（このプロジェクトのルールで使う機能だけを実装）
// 使い方: deno run --allow-read rules_sim.js <rules.json>
// 仕様（公式ドキュメントの挙動に合わせる）:
//  - .read / .write は根元から対象までのどこかで true になれば許可（下の階層で取り消せない）
//  - 書き込みは対象パスより上（対象含む）の .write だけを見る
//  - .validate は書き込み後に値が残るノードで、対象パスの祖先・対象・子孫すべてで評価（null のノードは評価しない）
//  - 名前付きの子ルールがない子キーは $変数ルールに当てはめる
//  - 式の評価中のエラーは false 扱い
//  - 複数パスの update は全パスが通ったときだけ成功（newData は全更新をまとめて適用した後の状態）

let rules = null;
function loadRules(path) { rules = JSON.parse(Deno.readTextFileSync(path)).rules; }

const clone = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const split = p => String(p).split("/").filter(Boolean);
function getAt(tree, path) {
  let cur = tree;
  for (const k of split(path)) {
    if (cur === null || typeof cur !== "object" || !(k in cur)) return null;
    cur = cur[k];
  }
  return cur === undefined ? null : cur;
}
function prune(v) {
  if (v === null || typeof v !== "object") return v;
  const out = {};
  for (const [k, c] of Object.entries(v)) {
    const p = prune(c);
    if (p !== null) out[k] = p;
  }
  return Object.keys(out).length ? out : null;
}
function setAt(tree, path, value) {
  const keys = split(path);
  if (!keys.length) return prune(clone(value));
  const root = tree && typeof tree === "object" ? clone(tree) : {};
  let cur = root;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = clone(value);
  return prune(root);
}

class Snap {
  constructor(tree, path) { this.tree = tree; this.path = split(path); }
  _v() { return getAt(this.tree, this.path.join("/")); }
  val() { const v = this._v(); return v === null || typeof v !== "object" ? v : clone(v); }
  exists() { return this._v() !== null; }
  child(p) { return new Snap(this.tree, [...this.path, ...split(p)].join("/")); }
  parent() { return new Snap(this.tree, this.path.slice(0, -1).join("/")); }
  hasChild(p) { return this.child(p).exists(); }
  hasChildren(list) {
    const v = this._v();
    if (v === null || typeof v !== "object") return false;
    if (!list) return true;
    return list.every(k => this.child(k).exists());
  }
  isString() { return typeof this._v() === "string"; }
  isNumber() { return typeof this._v() === "number"; }
  isBoolean() { return typeof this._v() === "boolean"; }
}

function evalRule(expr, ctx) {
  if (expr === true || expr === false) return expr;
  const names = Object.keys(ctx);
  try {
    // Firebase の文字列メソッド（matches）を JS で再現
    const prepared = String(expr).replace(/\.matches\(/g, ".__matches(");
    // eslint-disable-next-line no-new-func
    const fn = new Function(...names, `return (${prepared});`);
    return fn(...names.map(n => ctx[n])) === true;
  } catch (e) {
    return false;
  }
}
Object.defineProperty(String.prototype, "__matches", { value: function (re) { return re.test(this); }, configurable: true });

// パスに沿ってルールノードと $変数をたどる
function walk(path) {
  const keys = split(path);
  const nodes = [{ node: rules, vars: {}, path: "" }];
  let node = rules, vars = {};
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    let next = node && node[k];
    let nv = vars;
    if (!next && node) {
      const wild = Object.keys(node).find(n => n.startsWith("$"));
      if (wild) { next = node[wild]; nv = { ...vars, [wild]: k }; }
    }
    node = next || null; vars = nv;
    nodes.push({ node, vars, path: keys.slice(0, i + 1).join("/") });
    if (!node) break;
  }
  return nodes;
}

function canRead(db, auth, path) {
  for (const { node, vars, path: p } of walk(path)) {
    if (!node) break;
    if (".read" in node && evalRule(node[".read"], { auth, data: new Snap(db, p), root: new Snap(db, ""), ...vars })) return true;
  }
  return false;
}

function validateTree(db, next, auth, ruleNode, vars, path) {
  // 書き込み後に値があるノードだけ評価
  const newVal = getAt(next, path);
  if (newVal === null) return { ok: true };
  if (ruleNode && ".validate" in ruleNode) {
    const ok = evalRule(ruleNode[".validate"], { auth, data: new Snap(db, path), newData: new Snap(next, path), root: new Snap(db, ""), ...vars });
    if (!ok) return { ok: false, at: path };
  }
  if (newVal && typeof newVal === "object") {
    for (const k of Object.keys(newVal)) {
      let child = ruleNode && ruleNode[k];
      let cv = vars;
      if (!child && ruleNode) {
        const wild = Object.keys(ruleNode).find(n => n.startsWith("$"));
        if (wild) { child = ruleNode[wild]; cv = { ...vars, [wild]: k }; }
      }
      // 変更のない兄弟ノードまで再検証しないよう、値が変わった子だけ見る
      if (JSON.stringify(getAt(db, path + "/" + k)) === JSON.stringify(newVal[k])) continue;
      const r = validateTree(db, next, auth, child || null, cv, path ? path + "/" + k : k);
      if (!r.ok) return r;
    }
  }
  return { ok: true };
}

function resolveServerValues(v, now) {
  if (v && typeof v === "object") {
    if (v[".sv"] === "timestamp") return now;
    const out = {};
    for (const [k, c] of Object.entries(v)) out[k] = resolveServerValues(c, now);
    return out;
  }
  return v;
}

// update(): { "path": value, ... } を一括で書き込む
function tryUpdate(db, auth, updates) {
  const now = 1763400000000;
  let next = db;
  for (const [p, v] of Object.entries(updates)) next = setAt(next, p, resolveServerValues(v, now));
  for (const p of Object.keys(updates)) {
    const chain = walk(p);
    let allowed = false;
    for (const { node, vars, path: rp } of chain) {
      if (!node) break;
      if (".write" in node && evalRule(node[".write"], { auth, data: new Snap(db, rp), newData: new Snap(next, rp), root: new Snap(db, ""), ...vars })) { allowed = true; break; }
    }
    if (!allowed) return { ok: false, reason: "write denied: " + p };
    // 祖先〜対象の .validate（値が残るノードのみ）
    for (const { node, vars, path: rp } of chain) {
      if (!node) break;
      if (rp === split(p).join("/")) {
        const r = validateTree(db, next, auth, node, vars, rp);
        if (!r.ok) return { ok: false, reason: "validate failed: " + r.at };
      } else if (".validate" in node && getAt(next, rp) !== null) {
        const ok = evalRule(node[".validate"], { auth, data: new Snap(db, rp), newData: new Snap(next, rp), root: new Snap(db, ""), ...vars });
        if (!ok) return { ok: false, reason: "validate failed: " + rp };
      }
    }
  }
  return { ok: true, next };
}

export { loadRules, canRead, tryUpdate, setAt, getAt };
