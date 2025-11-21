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


// ======================================================================
// VaultCS Content Script - FINAL CORRECTED VERSION
// ======================================================================

const DEBUG = true;
const log = (...args) => DEBUG && console.log("[VaultCS]", ...args);


// ======================================================================
// 0) LANDING PAGE CHECK — MUST RUN BEFORE ANY OTHER CODE
// ======================================================================
(function landingPageGuard() {
  let url;
  try { url = new URL(location.href); } catch { return; }

  // Only for /s pages
  if (url.pathname !== "/s") return;

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

    const text = box.innerText.trim().toLowerCase();

    // ❌ STOP if link is already marked expired by the server
    if (text.includes("expired")) {
      console.log("[VaultCS] Server says expired → stopping.");
      window.__VAULT_STOP_EXEC = true;
      return;
    }

    // Checking link
    box.innerText = "Checking link...";

    // Ask background to redeem
    chrome.runtime.sendMessage({ action: "REDEEM_SHARE", token }, (resp) => {
      if (chrome.runtime.lastError) {
        box.innerText = "❌ Extension communication failed.";
        window.__VAULT_STOP_EXEC = true;
        return;
      }

      // ❌ Expired or invalid
      if (!resp || !resp.ok) {
        box.innerText = "❌ This link has expired.";
        window.__VAULT_STOP_EXEC = true;
        return;
      }

      // Valid link
      box.innerText = "Preparing secure login...";
      console.log("[VaultCS] Share token valid.");
    });
  });
})();


// ======================================================================
// STOP SCRIPT IF LINK INVALID
// ======================================================================
if (window.__VAULT_STOP_EXEC) {
  console.log("[VaultCS] Script execution halted (expired link).");
  throw "";   // Hard stop — content script cannot use return at top level
}



// ======================================================================
// MAIN SCRIPT — runs only when link is valid or on normal pages
// ======================================================================
(function main() {

  // ======================================================================
  // 1) Safe message wrapper
  // ======================================================================
  function safeSendMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) {
            log("safeSendMessage error:", chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          resolve(resp);
        });
      } catch (e) {
        log("safeSendMessage exception:", e);
        resolve(null);
      }
    });
  }



  // ======================================================================
  // 2) LOGIN CAPTURE ENGINE
  // ======================================================================

  let lastLoginData = null;
  let typedUsername = false;
  let typedPassword = false;

  function watchInputs() {
    const pass = document.querySelector('input[type="password"]');
    if (!pass) return;

    const user = document.querySelector(
      '#login_field,' +
      'input[name="login"],' +
      'input[type="email"],' +
      'input[name*="user"], input[id*="user"],' +
      'input[name*="login"], input[id*="login"],' +
      'input[name*="email"], input[id*="email"],' +
      'input[name*="username"], input[id*="username"],' +
      'input[type="text"]'
    );

    function capture() {
      lastLoginData = {
        loginUrl: location.href,
        username: user?.value?.trim() || "",
        password: pass.value,
      };
    }

    pass.addEventListener("keydown", () => (typedPassword = true), true);
    user?.addEventListener("keydown", () => (typedUsername = true), true);

    pass.addEventListener("input", () => { typedPassword = true; capture(); }, true);
    user?.addEventListener("input", () => { typedUsername = true; capture(); }, true);

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
    const btn = e.target.closest("button, input[type=submit]");
    if (!btn) return;

    setTimeout(() => {
      if (shouldSave()) {
        safeSendMessage({ action: "capturedLogin", data: lastLoginData });
      }
      lastLoginData = null;
      typedPassword = false;
      typedUsername = false;
    }, 150);
  }, true);

  new MutationObserver(watchInputs).observe(document, { childList: true, subtree: true });
  watchInputs();



  // ======================================================================
  // 3) SHARED CREDENTIAL HANDLER (launch Selenium)
  // ======================================================================
  (async function handleSharedCredential() {

    async function getSharedCredWithRetry(totalMs = 8000, intervalMs = 300) {
      const end = Date.now() + totalMs;

      while (Date.now() < end) {
        const cred = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "REQUEST_SHARED_CRED" }, (resp) => {
            if (chrome.runtime.lastError) return resolve(null);
            resolve(resp?.cred ?? null);
          });
        });

        if (cred) return cred;
        await new Promise(r => setTimeout(r, intervalMs));
      }
      return null;
    }

    const cred = await getSharedCredWithRetry();
    if (!cred) {
      log("[VaultCS] No shared credential available.");
      return;
    }

    log("[VaultCS] Launching Selenium for:", cred.loginUrl);

    // 🚀 Fire Selenium launcher (background → Python)
    chrome.runtime.sendMessage({
      action: "LAUNCH_SELENIUM",
      loginUrl: cred.loginUrl,
      username: cred.username,
      password: cred.password
    });

    // Continue with built-in autofill
    startAutofill(cred);
  })();



  // ======================================================================
  // 4) Autofill Engine
  // ======================================================================
  function startAutofill(cred) {

    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    };

    const hostMatches = () => {
      try {
        const t = new URL(cred.loginUrl).hostname.replace(/^www\./, "");
        const c = location.hostname.replace(/^www\./, "");
        return c === t || c.endsWith("." + t);
      } catch { return true; }
    };

    if (!hostMatches()) return;

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

        if (likelyUser && !username) username = el;
      }

      return { username, password };
    }

    function fillField(el, value) {
      try {
        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
        setter.call(el, value);

        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      } catch { return false; }
    }

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

    function attemptFill() {
      const { username, password } = detectLoginFields();
      if (!password) return false;

      let did = false;

      if (username && !userTyped.has(username)) {
        if (fillField(username, cred.username)) did = true;
        attachTypingGuard(username);
      }

      if (!userTyped.has(password)) {
        if (fillField(password, cred.password)) did = true;
        attachTypingGuard(password);
      }

      if (did && !window.__VAULT_SHARED_CRED_USED) {
        window.__VAULT_SHARED_CRED_USED = true;
        chrome.runtime.sendMessage({ action: "SHARE_CRED_USED" });
      }

      return did;
    }

    const observer = new MutationObserver(() => attemptFill());
    observer.observe(document, { childList: true, subtree: true });

    const interval = setInterval(attemptFill, 400);

    attemptFill();

    window.addEventListener("pagehide", () => {
      observer.disconnect();
      clearInterval(interval);
    }, { once: true });
  }

})();





