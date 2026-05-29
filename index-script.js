// GASのURLをここに貼り付け
const GAS_URL = "https://script.google.com/macros/s/AKfycbz6psDpbuHyxG-8bAIkCKOb6g930qiJUSYJzKKyYPsCPPzMcKIp-MTeK6sh58hViEXA/exec";

function toggleMode(mode) {
    const title = document.getElementById("form-title");
    const confirmPass = document.getElementById("confirm-password");
    const loginSec = document.getElementById("login-section");
    const registerSec = document.getElementById("register-section");
    const msg = document.getElementById("message");

    msg.innerText = "";
    if (mode === 'register') {
        title.innerText = "新規登録";
        confirmPass.style.display = "block";
        loginSec.style.display = "none";
        registerSec.style.display = "block";
    } else {
        title.innerText = "ログイン";
        confirmPass.style.display = "none";
        loginSec.style.display = "block";
        registerSec.style.display = "none";
    }
}

async function handleLogin() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    if (!email || !password) return updateMsg("入力してください", "error");

    try {
        updateMsg("照合中...", "");
        const res = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ mode: "login", email, password })
        });
        const result = await res.json();
        if (result.status === "success") {
            // ログイン情報を保存
            localStorage.setItem("userEmail", email);
            updateMsg("成功！移動します...", "success");
            setTimeout(() => { window.location.href = "home.html"; }, 1000);
        } else {
            updateMsg(result.message, "error");
        }
    } catch (e) { updateMsg("通信エラー", "error"); }
}

function togglePasswordVisibility(){
    // HTMLからパスワード入力欄とボタンの要素を取得
    const passwordInput = document.getElementById('password');
    const toggleButton = document.getElementById('toggle-password');

    // 現在のタイプが「password」なら「text」に、そうじゃなければ「password」に戻す
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.textContent = '非表示'; // ボタンの文字を変える
    } else {
        passwordInput.type = 'password';
        toggleButton.textContent = '表示'; // ボタンの文字を戻す
    }
}

async function handleRegister() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirm = document.getElementById("confirm-password").value.trim();
    if (password !== confirm) return updateMsg("パスワード不一致", "error");

    try {
        updateMsg("登録中...", "");
        const res = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ mode: "register", email, password })
        });
        const result = await res.json();
        if (result.status === "success") {
            updateMsg("登録完了！", "success");
            setTimeout(() => toggleMode('login'), 2000);
        } else { updateMsg(result.message, "error"); }
    } catch (e) { updateMsg("通信エラー", "error"); }
}

function updateMsg(txt, type) {
    const el = document.getElementById("message");
    el.innerText = txt;
    el.className = "message " + type;
}

/*function handleKeyPress(event) {  /*Enterでログインできるようにしたい
    if (event.key === "Enter") {
        handleLogin();
    }
}*/

localStorage.setItem("userName", name);
