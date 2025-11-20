// import { saveEncryptedVault } from "./vault_core.js";

// // ✅ Load decrypted vault from chrome.session storage
// async function getVault() {
//   const { vaultCache } = await chrome.storage.session.get("vaultCache");
//   if (!vaultCache) return null;
//   return JSON.parse(vaultCache);
// }

// async function getDerivedKey() {
//   const session = await chrome.storage.session.get("vaultKey");
//   if (!session.vaultKey) return null;

//   const raw = new Uint8Array(session.vaultKey);
//   return crypto.subtle.importKey(
//     "raw",
//     raw,
//     { name: "AES-GCM", length: 256 },
//     false,
//     ["encrypt", "decrypt"]
//   );
// }

// // ✅ Save vault back to storage
// async function saveVault(vault) {
//   await chrome.storage.session.set({ vaultCache: JSON.stringify(vault) });
//   await saveEncryptedVault(vault);
//   chrome.runtime.sendMessage({ action: "rebuildMenus" });
// }

// // ==============================================================
// // ✅ UI FUNCTIONS
// // ==============================================================

// function extractDisplayHost(loginUrl) {
//   try {
//     const url = new URL(loginUrl);
//     return url.hostname + url.pathname;
//   } catch {
//     return loginUrl;
//   }
// }

// function renderFolders(vault) {
//   const div = document.getElementById("folders");
//   div.innerHTML = "";

//   vault.folders ??= {};

//   Object.keys(vault.folders).forEach(folder => {
//     const btn = document.createElement("button");
//     btn.textContent = folder;
//     btn.onclick = () => renderPasswords(folder, vault);
//     div.appendChild(btn);
//   });
// }

// function renderPasswords(folder, vault) {
//   const list = document.getElementById("passwordList");
//   const entries = vault.folders?.[folder] ?? [];

//   list.innerHTML = `<h3>${folder}</h3>`;

//   entries.forEach((entry, i) => {
//     const row = document.createElement("div");
//     row.style.display = "flex";
//     row.style.justifyContent = "space-between";
//     row.style.alignItems = "center";
//     row.style.margin = "5px 0";

//     const masked = "•".repeat((entry.password ?? "").length);

//     const displayText = extractDisplayHost(entry.loginUrl || "");

//     const text = document.createElement("span");
//     text.textContent = `${displayText} — ${masked}`;
//     row.appendChild(text);

//     const btn = document.createElement("button");
//     btn.textContent = "Share";
//     btn.style.marginLeft = "12px";
//     btn.onclick = async () => {
//       await createShareToken(entry);
//     };
//     row.appendChild(btn);

//     list.appendChild(row);
//   });
// }

// // ==============================================================
// // ✅ BUTTON HANDLERS + STARTUP
// // ==============================================================

// document.getElementById("newFolderBtn").onclick = async () => {
//   const name = prompt("Folder Name");
//   if (!name) return;

//   const vault = await getVault();
//   vault.folders ??= {};
//   vault.folders[name] = [];

//   await saveVault(vault);
//   renderFolders(vault);
// };

// document.getElementById("logout").onclick = async () => {
//   await chrome.storage.session.remove("vaultCache");
//   await chrome.storage.session.remove("vaultKey");

//   chrome.runtime.sendMessage({ action: "rebuildMenus" });
//   window.location = "login.html";
// };

// document.addEventListener("DOMContentLoaded", async () => {
//   const key = await getDerivedKey();
//   if (!key) {
//     window.location = "login.html";
//     return;
//   }

//   const vault = await getVault();
//   if (!vault) {
//     window.location = "login.html";
//     return;
//   }

//   renderFolders(vault);
// });

// // ==============================================================
// // ✅ UPDATED SHARE TOKEN (loginUrl ONLY + ONE-TIME TOKEN ID)
// // ==============================================================

// // async function createShareToken(entry, ttlSeconds = 300) {
// //   // ✅ Unique one-time token identifier
// //   const tokenId = crypto.getRandomValues(new Uint8Array(8))
// //     .reduce((a, b) => a + b.toString(16).padStart(2, "0"), "");

// //   const keyBytes = crypto.getRandomValues(new Uint8Array(32));
// //   const iv = crypto.getRandomValues(new Uint8Array(12));

// //   const cryptoKey = await crypto.subtle.importKey(
// //     "raw",
// //     keyBytes,
// //     "AES-GCM",
// //     false,
// //     ["encrypt"]
// //   );

// //   const loginUrl = entry.loginUrl || "";

// //   const payload = JSON.stringify({
// //     loginUrl,
// //     username: entry.username,
// //     password: entry.password,
// //     created: Date.now(),
// //     expires: Date.now() + ttlSeconds * 1000
// //   });

// //   const encoded = new TextEncoder().encode(payload);

// //   const ciphertext = await crypto.subtle.encrypt(
// //     { name: "AES-GCM", iv },
// //     cryptoKey,
// //     encoded
// //   );

// //   const b64 = arr => btoa(String.fromCharCode(...new Uint8Array(arr)));

// //   const url =
// //     `chrome-extension://${chrome.runtime.id}/share.html` +
// //     `?token=${tokenId}` +                             // ✅ tokenId
// //     `&data=${encodeURIComponent(b64(ciphertext))}` +
// //     `&iv=${encodeURIComponent(b64(iv))}` +
// //     `&key=${encodeURIComponent(b64(keyBytes))}`;

// //   try {
// //     await navigator.clipboard.writeText(url);
// //     alert("✅ One-time login link copied!\n(Expires in 5 minutes)");
// //   } catch {
// //     prompt("Copy your one-time login link:", url);
// //   }

// //   return url;
// // }

// async function createShareToken(entry) {
//   chrome.runtime.sendMessage(
//     {
//       action: "CREATE_SHARE_LINK",
//       entryId: entry.id   // YOU MUST ensure each vault entry has a unique ID
//     },
//     async (resp) => {
//       if (!resp || !resp.ok) {
//         alert("❌ Failed to create share link:\n" + (resp?.error || "Unknown error"));
//         return;
//       }

//       const url = resp.shareUrl;

//       try {
//         await navigator.clipboard.writeText(url);
//         alert("✅ One-time login link copied!");
//       } catch {
//         prompt("Copy your one-time login link:", url);
//       }
//     }
//   );
// }


import { saveEncryptedVault } from "./vault_core.js";

// ==========================================================
// VAULT HELPERS
// ==========================================================

async function getVault() {
  const { vaultCache } = await chrome.storage.session.get("vaultCache");
  return vaultCache ? JSON.parse(vaultCache) : null;
}

async function getDerivedKey() {
  const { vaultKey } = await chrome.storage.session.get("vaultKey");
  if (!vaultKey) return null;

  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(vaultKey),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

async function saveVault(vault) {
  await chrome.storage.session.set({ vaultCache: JSON.stringify(vault) });
  await saveEncryptedVault(vault);
  chrome.runtime.sendMessage({ action: "rebuildMenus" });
}

// ==========================================================
// UI RENDERING
// ==========================================================

function extractDisplayHost(loginUrl) {
  try {
    const url = new URL(loginUrl);
    return url.hostname + url.pathname;
  } catch {
    return loginUrl;
  }
}


function renderFolders(vault) {
  const div = document.getElementById("folders");
  div.innerHTML = "";

  Object.keys(vault.folders ?? {}).forEach(folder => {
    const btn = document.createElement("button");
    btn.textContent = folder;
    btn.onclick = () => renderPasswords(folder, vault);
    div.appendChild(btn);
  });
}

function renderPasswords(folder, vault) {
  const list = document.getElementById("passwordList");
  const entries = vault.folders?.[folder] ?? [];

  list.innerHTML = `<h3>${folder}</h3>`;

  entries.forEach((entry, i) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";

    const masked = "•".repeat(entry.password.length);
    const display = extractDisplayHost(entry.loginUrl);

    const passwordSpan = document.createElement("span");
    passwordSpan.textContent = `${display} — ${masked}`;
    passwordSpan.style.flex = "1"; 
    row.appendChild(passwordSpan);

    // 👁 Toggle icon (using PNG)
    const eyeBtn = document.createElement("img");
    eyeBtn.src = "unhide.png";   // default icon (means: click to reveal)
    eyeBtn.style.width = "20px";
    eyeBtn.style.height = "20px";
    eyeBtn.style.cursor = "pointer";
    eyeBtn.style.marginLeft = "10px";

    // Toggle state
    let showing = false;

    eyeBtn.onclick = () => {
      showing = !showing;

      if (showing) {
        passwordSpan.textContent = `${display} — ${entry.password}`;
        eyeBtn.src = "unhide.png";   // hide icon
      } else {
        passwordSpan.textContent = `${display} — ${masked}`;
        eyeBtn.src = "hide.png"; // show icon
      }
    };

    row.appendChild(eyeBtn);


    // -----------------------
    // Share button
    // -----------------------
    const shareBtn = document.createElement("button");
    shareBtn.textContent = "Share";
    shareBtn.style.marginLeft = "12px";
    shareBtn.onclick = () => createShareLink(entry);
    row.appendChild(shareBtn);

    // -----------------------
    // ❌ Delete button (inline)
    // -----------------------
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.marginLeft = "6px";
    deleteBtn.style.background = "#d32f2f";   // Red
    deleteBtn.style.color = "white";

    deleteBtn.onclick = async () => {
      if (!confirm("Delete this password?")) return;

      // Remove entry
      vault.folders[folder].splice(i, 1);

      // Save changes
      await saveVault(vault);

      // Refresh UI
      renderPasswords(folder, vault);
      renderFolders(vault);
    };

    row.appendChild(deleteBtn);

    list.appendChild(row);
  });
}


// ==========================================================
// FOLDER + LOGOUT
// ==========================================================

document.getElementById("newFolderBtn").onclick = async () => {
  const name = prompt("Folder Name");
  if (!name) return;

  const vault = await getVault();
  vault.folders[name] = [];
  await saveVault(vault);
  renderFolders(vault);
};

document.getElementById("logout").onclick = async () => {
  await chrome.storage.session.remove("vaultKey");
  await chrome.storage.session.remove("vaultCache");

  chrome.runtime.sendMessage({ action: "rebuildMenus" });
  window.location = "login.html";
};

// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", async () => {
  const key = await getDerivedKey();
  if (!key) return (window.location = "login.html");

  const vault = await getVault();
  if (!vault) return (window.location = "login.html");

  renderFolders(vault);
});

document.getElementById("addPasswordBtn").onclick = () => {
  window.location = "add_password.html";
};

document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ action: "VAULT_OPENED" });
});

window.addEventListener("unload", () => {
  chrome.runtime.sendMessage({ action: "VAULT_CLOSED" });
});



// ==========================================================
// ✅ SERVER SHARE CREATION
// ==========================================================

async function createShareLink(entry) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      {
        action: "CREATE_SHARE_LINK",
        entry: {
          loginUrl: entry.loginUrl,
          username: entry.username,
          password: entry.password
        }
      },
      (resp) => {
        if (!resp?.ok) {
          alert("❌ Failed to create one-time link\n" + (resp?.error || ""));
          resolve(null);
          return;
        }

        const url = resp.shareUrl;

        navigator.clipboard.writeText(url)
          .then(() => alert("✅ One-time login link copied!"))
          .catch(() => prompt("Copy your one-time login link:", url));

        resolve(url);
      }
    );
  });
}




