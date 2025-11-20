// async function safeSendMessage(msg) {
//   return new Promise(resolve => {
//     try {
//       chrome.runtime.sendMessage(msg, (resp) => {
//         if (chrome.runtime.lastError) {
//           // ignore: extension context invalidated or receiver not available
//           resolve(null);
//           return;
//         }
//         resolve(resp);
//       });
//     } catch (e) {
//       // Extension context gone — ignore
//       resolve(null);
//     }
//   });
// }


// // ==============================================================
// // ✅ LOGIN CAPTURE LOGIC (UPDATED TO STORE loginUrl ONLY)
// // ==============================================================

// let lastLoginData = null;
// let typedUsername = false;
// let typedPassword = false;

// function watchInputs() {
//   const pass = document.querySelector('input[type="password"]');
//   if (!pass) return;

//   const form = pass.form;
//   const user = form?.querySelector(
//     'input[type="email"],' +
//     'input[name*="user"], input[id*="user"],' +
//     'input[name*="login"], input[id*="login"],' +
//     'input[name*="email"], input[id*="email"],' +
//     'input[name*="username"], input[id*="username"]'
//   );

//   function capture() {
//     lastLoginData = {
//       loginUrl: location.href,
//       username: user?.value?.trim() || "",
//       password: pass.value
//     };
//   }

//   pass.addEventListener("keydown", () => (typedPassword = true), true);
//   user?.addEventListener("keydown", () => (typedUsername = true), true);

//   pass.addEventListener("input", capture, true);
//   user?.addEventListener("input", capture, true);
// }

// function shouldSave() {
//   return lastLoginData?.password && typedPassword;
// }

// document.addEventListener(
//   "submit",
//   () => {
//     if (shouldSave()) safeSendMessage({ action: "capturedLogin", data: lastLoginData });

//     lastLoginData = null;
//     typedPassword = false;
//     typedUsername = false;
//   },
//   true
// );

// document.addEventListener(
//   "click",
//   (e) => {
//     if (!e.target.closest("button, input[type=submit]")) return;

//     setTimeout(() => {
//       if (shouldSave()) safeSendMessage({ action: "capturedLogin", data: lastLoginData });

//       lastLoginData = null;
//       typedPassword = false;
//       typedUsername = false;
//     }, 150);
//   },
//   true
// );

// new MutationObserver(watchInputs).observe(document, { childList: true, subtree: true });
// watchInputs();

// // ==============================================================
// // ✅ ✅ ONE-TIME SHARE AUTOFILL (FIXED + RETRY + CONFIRM)
// // ==============================================================

// (async function handleSharedCredential() {
//   // Retry wrapper — fixes the timing issue
//   async function getSharedCredWithRetry(totalMs = 8000, intervalMs = 300) {
//     const end = Date.now() + totalMs;

//     while (Date.now() < end) {
//       const cred = await new Promise((resolve) => {
//         chrome.runtime.sendMessage({ action: "REQUEST_SHARED_CRED" }, (resp) => {
//           if (chrome.runtime.lastError) return resolve(null);
//           resolve(resp?.cred ?? null);
//         });
//       });

//       if (cred) return cred;
//       await new Promise((r) => setTimeout(r, intervalMs));
//     }

//     return null;
//   }

//   const cred = await getSharedCredWithRetry();
//   if (!cred) return; // Background didn't provide anything

//   // ---------- Utility helpers ----------

//   const isVisible = (el) => {
//     if (!el) return false;
//     const r = el.getBoundingClientRect();
//     if (r.width === 0 || r.height === 0) return false;
//     const s = getComputedStyle(el);
//     return s.display !== "none" && s.visibility !== "hidden";
//   };

//   const findPasswordField = () => {
//     const pw = [...document.querySelectorAll('input[type="password"]')];
//     return pw.find(isVisible) || pw[0] || null;
//   };

//   const findUsernameField = (form) => {
//     const selectors = [
//       'input[autocomplete="username"]',
//       'input[type="email"]',
//       'input[name="username"]',
//       'input[name="email"]',
//       'input[id*="user"]',
//       'input[name*="user"]',
//       'input[id*="login"]',
//       'input[name*="login"]'
//     ];

//     for (const sel of selectors) {
//       const el = form.querySelector(sel);
//       if (el && isVisible(el)) return el;
//     }

//     return [...form.querySelectorAll("input")].find((i) => {
//       const t = (i.type || "").toLowerCase();
//       return ["text", "email", "tel"].includes(t) && isVisible(i);
//     });
//   };

//   const fillField = (el, value) => {
//     if (!el) return;
//     el.focus({ preventScroll: true });
//     el.value = value;
//     el.dispatchEvent(new Event("input", { bubbles: true }));
//     el.dispatchEvent(new Event("change", { bubbles: true }));
//   };

//   function attemptFill() {
//     const pass = findPasswordField();
//     if (!pass) return false;

//     const form = pass.form || pass.closest("form") || document;
//     const user = findUsernameField(form);

//     // ✅ Host match using loginUrl
//     try {
//       const targetHost = new URL(cred.loginUrl).hostname.toLowerCase();
//       const currentHost = location.hostname.toLowerCase();
//       if (!currentHost.includes(targetHost)) return false;
//     } catch (e) {}

//     if (user) fillField(user, cred.username || "");
//     fillField(pass, cred.password || "");

//     return true;
//   }

//   // ---------- Poll for fields first ----------
//   const MAX_WAIT = 12000;
//   const POLL_INTERVAL = 300;
//   const start = Date.now();

//   let filled = false;

//   while (Date.now() - start < MAX_WAIT) {
//     if (attemptFill()) {
//       filled = true;
//       break;
//     }
//     await new Promise((r) => setTimeout(r, POLL_INTERVAL));
//   }

//   // ---------- MutationObserver fallback ----------
//   if (!filled) {
//     await new Promise((resolve) => {
//       const obs = new MutationObserver(() => {
//         if (attemptFill()) {
//           obs.disconnect();
//           resolve();
//         }
//       });

//       obs.observe(document, { childList: true, subtree: true });

//       setTimeout(() => {
//         obs.disconnect();
//         resolve();
//       }, 8000);
//     });
//   }

//   // ✅ Tell background: “I used the one-time credential, wipe it”
//   chrome.runtime.sendMessage({ action: "SHARE_CRED_USED" }, () => {});
// })();


// ============================================================
// ✅ Debug helper
// ============================================================
const DEBUG = true;
const log = (...args) => DEBUG && console.log("[VaultCS]", ...args);


// ============================================================
// ✅ 0) LANDING PAGE DETECTION → Rewrite only if NOT expired
// ============================================================
(function detectLandingPageAndOverwrite() {
  let url;
  try { url = new URL(location.href); } catch { return; }

  if (url.pathname !== "/s") return;  // Only modify landing page

  const token = url.searchParams.get("token");
  if (!token) return;

  function ready(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb);
    } else cb();
  }

  ready(() => {
    const box = document.getElementById("vault-status");
    if (!box) return;

    const currentText = box.innerText.trim().toLowerCase();

    // 🚫 DO NOT MODIFY IF THE SERVER SAYS EXPIRED
    if (currentText.includes("expired")) {
      console.log("[VaultCS] Token expired → leaving page untouched.");
      return;
    }

    // Otherwise → safe to overwrite
    box.innerText = "Redirecting...";

    chrome.runtime.sendMessage({ action: "REDEEM_SHARE", token }, (resp) => {
      if (!resp || !resp.ok) {
        // Server says expired or invalid AFTER redeem attempt
        box.innerText = "❌ This link has expired or was already used.";
        return;
      }

      // Normal success
      box.innerText = "Redirecting...";
    });
  });
})();


// ============================================================
// ✅ 1) Utility: safe runtime message
// ============================================================
async function safeSendMessage(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          log("safeSendMessage lastError:", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(resp);
      });
    } catch (e) {
      log("safeSendMessage error:", e);
      resolve(null);
    }
  });
}


// ============================================================
// ✅ 2) LOGIN CAPTURE LOGIC
// ============================================================
let lastLoginData = null;
let typedUsername = false;
let typedPassword = false;

function watchInputs() {
  const pass = document.querySelector('input[type="password"]');
  if (!pass) return;

  // FIX 1: GitHub-safe username detection (document-wide, not just form)
  const user = document.querySelector(
    '#login_field,' +                    // GitHub username field
    'input[name="login"],' +             // GitHub name="login"
    'input[type="email"],' +
    'input[name*="user"], input[id*="user"],' +
    'input[name*="login"], input[id*="login"],' +
    'input[name*="email"], input[id*="email"],' +
    'input[name*="username"], input[id*="username"],' +
    'input[type="text"]'                 // Fallback for generic username fields
  );

  function capture() {
    lastLoginData = {
      loginUrl: location.href,
      username: user?.value?.trim() || "",
      password: pass.value,
    };
  }

  // ORIGINAL (kept): detect typing via keydown
  pass.addEventListener("keydown", () => (typedPassword = true), true);
  user?.addEventListener("keydown", () => (typedUsername = true), true);

  // FIX 2: detect typing/paste/autofill/mobile keyboard via input event
  pass.addEventListener("input", () => {
    typedPassword = true;
    capture();
  }, true);

  user?.addEventListener("input", () => {
    typedUsername = true;
    capture();
  }, true);

  // ORIGINAL (kept): capture on input
  pass.addEventListener("input", capture, true);
  user?.addEventListener("input", capture, true);
}


function shouldSave() {
  return lastLoginData?.password && typedPassword;
}

document.addEventListener("submit", () => {
  if (shouldSave()) {
    log("Form submit → capturedLogin");
    safeSendMessage({ action: "capturedLogin", data: lastLoginData });
  }
  lastLoginData = null;
  typedPassword = false;
  typedUsername = false;
}, true);

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button, input[type=submit], [type=submit]");
  if (!btn) return;
  setTimeout(() => {
    if (shouldSave()) {
      log("Click submit → capturedLogin");
      safeSendMessage({ action: "capturedLogin", data: lastLoginData });
    }
    lastLoginData = null;
    typedPassword = false;
    typedUsername = false;
  }, 150);
}, true);

new MutationObserver(watchInputs).observe(document, { childList: true, subtree: true });
watchInputs();


(async function handleSharedCredential() {
  // --- 1) Wait for shared credentials from background ---
  async function getSharedCredWithRetry(totalMs = 8000, intervalMs = 300) {
    const end = Date.now() + totalMs;

    while (Date.now() < end) {
      const cred = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ action: "REQUEST_SHARED_CRED" }, (r) => {
            if (chrome.runtime.lastError) return resolve(null);
            resolve(r?.cred ?? null);
          });
        } catch {
          resolve(null);
        }
      });

      if (cred) return cred;
      await new Promise(r => setTimeout(r, intervalMs));
    }

    return null;
  }

  const cred = await getSharedCredWithRetry();
  if (!cred) {
    log("[VaultCS] No shared credential for this tab.");
    return;
  }

  log("[VaultCS] Autofill credential received:", cred.loginUrl);

  // ------------------------------------------------------------
  // 🚀 Launch Selenium (via background messaging)
  // ------------------------------------------------------------
  chrome.runtime.sendMessage({
    action: "LAUNCH_SELENIUM",
    loginUrl: cred.loginUrl,
    username: cred.username,
    password: cred.password
  });

  // --- 2) Now start the autofill engine ---
  startAutofill(cred);

})();


function startAutofill(cred) {

  // ---------- Visibility check ----------
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  };

  // ---------- Host check ----------
  const hostMatches = () => {
    try {
      const t = new URL(cred.loginUrl).hostname.replace(/^www\./, "").toLowerCase();
      const c = location.hostname.replace(/^www\./, "").toLowerCase();
      const ok = c === t || c.endsWith("." + t);
      if (!ok) log("[VaultCS] Host mismatch:", c, "!=", t);
      return ok;
    } catch {
      return true;
    }
  };

  if (!hostMatches()) return;

  // ---------- Universal Field Detection ----------
  function detectLoginFields() {
    const inputs = [...document.querySelectorAll("input")];
    let username = null;
    let password = null;

    for (const el of inputs) {
      if (!el || !isVisible(el) || el.disabled) continue;

      const type = (el.type || "").toLowerCase();
      const name = (el.name || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      const placeholder = (el.placeholder || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();

      if (type === "password") {
        password = el;
        continue;
      }

      const likelyUser =
        type === "text" ||
        type === "email" ||
        name.includes("user") ||
        name.includes("email") ||
        name.includes("login") ||
        id.includes("user") ||
        id.includes("email") ||
        placeholder.includes("email") ||
        placeholder.includes("username") ||
        aria.includes("email") ||
        aria.includes("username");

      if (likelyUser && !username) {
        username = el;
      }
    }

    return { username, password };
  }

  // ---------- React-safe fill ----------
  function fillField(el, value) {
    if (!el || value == null) return false;

    try {
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;

      setter.call(el, value);

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));

      return true;
    } catch (e) {
      log("[VaultCS] fillField error:", e);
      return false;
    }
  }

  // ---------- Prevent overwriting when user types ----------
  const userTyped = new WeakSet();

  function attachTypingGuard(el) {
    if (!el || userTyped.has(el)) return;
    const handler = () => {
      userTyped.add(el);
      el.removeEventListener("keydown", handler, true);
      el.removeEventListener("input", handler, true);
    };
    el.addEventListener("keydown", handler, true);
    el.addEventListener("input", handler, true);
  }

  // ---------- Autofill Attempt ----------
  function attemptFill() {
    const { username, password } = detectLoginFields();

    if (!password) return false;

    let didSomething = false;

    if (username && !userTyped.has(username)) {
      if (fillField(username, cred.username)) didSomething = true;
      attachTypingGuard(username);
    }

    if (!userTyped.has(password)) {
      if (fillField(password, cred.password)) didSomething = true;
      attachTypingGuard(password);
    }

    if (didSomething && !window.__VAULT_SHARED_CRED_USED) {
      window.__VAULT_SHARED_CRED_USED = true;
      chrome.runtime.sendMessage({ action: "SHARE_CRED_USED" });
      log("[VaultCS] Autofill applied.");
    }

    return didSomething;
  }

  // ---------- Start autofill engine ----------
  const observer = new MutationObserver(() => attemptFill());
  observer.observe(document, { childList: true, subtree: true });

  const interval = setInterval(attemptFill, 400);

  attemptFill();

  window.addEventListener("pagehide", () => {
    observer.disconnect();
    clearInterval(interval);
  }, { once: true });

}


