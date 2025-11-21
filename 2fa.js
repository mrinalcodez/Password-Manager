// ------------------------------
// 2FA Email Submission Page
// ------------------------------

const emailInput = document.getElementById("emailInput");
const submitBtn = document.getElementById("submitEmailBtn");
const backBtn = document.getElementById("backBtn");
const msg = document.getElementById("msg");

// Your server IP / domain
const API_BASE = "http://192.168.2.247:8443";

// Validate email format
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ------------------------------
// Send Email OTP
// ------------------------------
submitBtn.onclick = async () => {
    const email = emailInput.value.trim();

    if (!isValidEmail(email)) {
        msg.textContent = "Please enter a valid email address.";
        msg.style.color = "red";
        return;
    }

    msg.textContent = "Sending verification code...";
    msg.style.color = "#444";

    try {
        const response = await fetch(`${API_BASE}/v1/request-email-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!data.ok) {
            msg.textContent = "⚠️ " + (data.error || "Failed to send code.");
            msg.style.color = "red";
            return;
        }

        // Save email for the next page
        sessionStorage.setItem("2fa_email", email);

        // Redirect to verification page
        window.location = "verifyOTP.html";

    } catch (err) {
        console.error("Email 2FA error:", err);
        msg.textContent = "Server error. Try again.";
        msg.style.color = "red";
    }
};

// ------------------------------
// Back to login
// ------------------------------
backBtn.onclick = () => {
    window.location = "login.html";
};
