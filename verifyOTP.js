// verifyOTP.js (runs inside verifyOTP.html)

const API = "http://192.168.2.247:8443";

const otpInput = document.getElementById("otpInput");
const verifyBtn = document.getElementById("verifyBtn");
const resendBtn = document.getElementById("resendBtn");
const backBtn   = document.getElementById("backBtn");
const msg = document.getElementById("msg");

// ------------------------------
// Load stored email
// ------------------------------
let email = sessionStorage.getItem("2fa_email");

if (!email) {
    msg.innerText = "❌ No email found. Please restart.";
    verifyBtn.disabled = true;
}


// ===========================================================
// VERIFY OTP CODE
// ===========================================================
verifyBtn.onclick = async () => {
    const code = otpInput.value.trim();

    if (!code || code.length !== 6) {
        msg.innerText = "⚠ Please enter a 6-digit code.";
        msg.style.color = "red";
        return;
    }

    msg.innerText = "🔍 Verifying...";
    msg.style.color = "#444";

    try {
        const resp = await fetch(`${API}/v1/verify-email-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });

        const data = await resp.json();

        if (!data.ok) {
            msg.innerText = "❌ " + data.error;
            msg.style.color = "red";
            return;
        }

        msg.innerText = "✅ Verified!";
        msg.style.color = "green";

        // Inform background script that 2FA is complete
        chrome.runtime.sendMessage({ action: "OTP_VERIFIED" });

        // 🔥 Redirect user to login after success
        setTimeout(() => {
            window.location = "login.html";
        }, 800);

    } catch (err) {
        console.error(err);
        msg.innerText = "❌ Network error.";
        msg.style.color = "red";
    }
};


// ===========================================================
// RESEND OTP
// ===========================================================
resendBtn.onclick = async () => {
    if (!email) return;

    msg.innerText = "📨 Sending new code...";
    msg.style.color = "#444";

    try {
        const resp = await fetch(`${API}/v1/request-email-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await resp.json();

        if (!data.ok) {
            msg.innerText = "❌ " + data.error;
            msg.style.color = "red";
            return;
        }

        msg.innerText = "✅ A new code has been sent!";
        msg.style.color = "green";

    } catch (err) {
        console.error(err);
        msg.innerText = "❌ Network error.";
        msg.style.color = "red";
    }
};


// ===========================================================
// BACK BUTTON
// ===========================================================
backBtn.onclick = () => {
    window.location = "2fa.html";
};
