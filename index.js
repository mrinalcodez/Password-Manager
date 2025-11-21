import "dotenv/config";
import express from "express";
import helmet from "helmet";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import http from "http";
import sgMail from "@sendgrid/mail";

const app = express();
app.use(express.json());
app.use(helmet());

// -------------------------------
// Allow Extension Access
// -------------------------------
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// -------------------------------
// DB Setup
// -------------------------------
const db = new Database("share.db");

db.exec(`
CREATE TABLE IF NOT EXISTS share_tokens (
  token TEXT PRIMARY KEY,
  loginUrl TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  expires INTEGER NOT NULL,
  created INTEGER NOT NULL
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS twofa_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires INTEGER NOT NULL
);
`);

const PORT = process.env.PORT || 8443;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// -------------------------------
// SendGrid Setup
// -------------------------------
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// -------------------------------
// CREATE SHARE
// -------------------------------
app.post("/v1/createShare", (req, res) => {
  const { loginUrl, username, password } = req.body || {};

  if (!loginUrl || !username || !password) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  const token = nanoid(32);
  const expires = Date.now() + 5 * 60 * 1000; // 5 min

  db.prepare(`
    INSERT INTO share_tokens (token, loginUrl, username, password, expires, created)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, loginUrl, username, password, expires, Date.now());

  res.json({ ok: true, shareUrl: `${BASE_URL}/s?token=${token}` });
});

// -------------------------------
// REDEEM SHARE TOKEN
// -------------------------------
app.get("/v1/redeem/:token", (req, res) => {
  const row = db.prepare("SELECT * FROM share_tokens WHERE token = ?")
    .get(req.params.token);

  if (!row) return res.status(410).json({ ok: false, error: "Expired or used" });

  if (Date.now() > row.expires) {
    db.prepare("DELETE FROM share_tokens WHERE token = ?").run(req.params.token);
    return res.status(410).json({ ok: false, error: "Expired" });
  }

  db.prepare("DELETE FROM share_tokens WHERE token = ?")
    .run(req.params.token);

  res.json({
    ok: true,
    loginUrl: row.loginUrl,
    username: row.username,
    password: row.password
  });
});

// -------------------------------
// Landing Page
// -------------------------------
app.get("/s", (req, res) => {
  const token = req.query.token ?? "";

  let statusMessage = "<b>Please install the browser extension first.</b>";

  if (token) {
    const row = db.prepare("SELECT expires FROM share_tokens WHERE token = ?").get(token);

    if (!row || Date.now() > row.expires) {
      statusMessage = "<b>This link has expired.</b>";
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Secure Login Link</title>
  <style>
    body { font-family: system-ui; padding: 40px; background:#fafafa; }
    #vault-status {
      max-width: 420px; padding:25px 30px; margin:auto;
      background:white; border-radius:12px;
      box-shadow:0 3px 10px #0002;
      text-align:center; font-size:18px; line-height:1.5;
    }
  </style>
</head>
<body>
  <div id="vault-status">${statusMessage}</div>
</body>
</html>`);
});

// -------------------------------
// Auto-clean expired share tokens
// -------------------------------
setInterval(() => {
  const deleted = db.prepare(
    "DELETE FROM share_tokens WHERE expires < ?"
  ).run(Date.now());

  if (deleted.changes > 0) {
    console.log(`🧹 Cleaned ${deleted.changes} expired token(s)`);
  }
}, 60 * 1000);

// -------------------------------
// REQUEST EMAIL OTP (SendGrid)
// -------------------------------
app.post("/v1/request-email-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({ ok: false, error: "Missing email" });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 5 * 60 * 1000;

  db.prepare(`
    INSERT INTO twofa_codes (email, code, expires)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires = excluded.expires
  `).run(email, code, expires);

  try {
    await sgMail.send({
      to: email,
      from: process.env.MAIL_FROM,  // MUST be a verified sender
      subject: "Your VaultCS OTP Code",
      html: `
        <p>Your verification code is:</p>
        <h2>${code}</h2>
        <p>This code expires in 5 minutes.</p>
      `
    });

    res.json({ ok: true, message: "OTP sent" });

  } catch (err) {
    console.log("SendGrid Error:", err.response?.body || err);
    res.json({ ok: false, error: "Email send failed" });
  }
});

// -------------------------------
// VERIFY EMAIL OTP
// -------------------------------
app.post("/v1/verify-email-otp", (req, res) => {
  const { email, code } = req.body;

  const row = db.prepare(
    "SELECT code, expires FROM twofa_codes WHERE email = ?"
  ).get(email);

  if (!row) return res.json({ ok: false, error: "No OTP found" });

  if (Date.now() > row.expires) {
    db.prepare("DELETE FROM twofa_codes WHERE email=?").run(email);
    return res.json({ ok: false, error: "OTP expired" });
  }

  if (row.code !== code) {
    return res.json({ ok: false, error: "Invalid code" });
  }

  db.prepare("DELETE FROM twofa_codes WHERE email=?").run(email);
  res.json({ ok: true, message: "Verified" });
});

// -------------------------------
// START SERVER
// -------------------------------
http.createServer(app).listen(PORT, () => {
  console.log("✅ Server running:", BASE_URL);
});
