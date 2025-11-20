# share_cookie_server.py
from flask import Flask, request, jsonify, abort
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from urllib.parse import urlparse
import uuid, time, threading

app = Flask(__name__)

# ===================================================================
# CONFIG
# ===================================================================
TOKEN_TTL = 300  # 5 minutes
STORE = {}       # token -> { cookies, target_origin, expires }
LOCK = threading.Lock()

# ===================================================================
# CLEANUP THREAD
# ===================================================================
def cleanup_tokens():
    while True:
        time.sleep(60)
        now = time.time()
        with LOCK:
            for t in list(STORE.keys()):
                if STORE[t]["expires"] < now:
                    del STORE[t]

threading.Thread(target=cleanup_tokens, daemon=True).start()

# ===================================================================
# SELENIUM LOGIN (YOU MUST CUSTOMIZE SELECTORS)
# ===================================================================

def selenium_login(login_url, username, password):
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=opts)

    try:
        driver.get(login_url)
        time.sleep(1)

        # --------- ADAPT FOR YOUR SITE ------------------
        user_el = driver.find_element(By.NAME, "username")
        pass_el = driver.find_element(By.NAME, "password")

        user_el.send_keys(username)
        pass_el.send_keys(password)
        pass_el.submit()
        # -------------------------------------------------

        time.sleep(6)

        cookies = driver.get_cookies()

        p = urlparse(driver.current_url)
        origin = f"{p.scheme}://{p.netloc}"

        return cookies, origin

    finally:
        driver.quit()

# ===================================================================
# API → CREATE SHARE (CALLED BY YOUR EXTENSION)
# ===================================================================

@app.route("/v1/createShare", methods=["POST"])
def create_share():
    try:
        data = request.get_json(force=True)
    except:
        return jsonify({"ok": False, "error": "Invalid JSON"}), 400

    login_url = data.get("loginUrl")
    username = data.get("username")
    password = data.get("password")

    if not all([login_url, username, password]):
        return jsonify({"ok": False, "error": "Missing fields"}), 400

    try:
        cookies, origin = selenium_login(login_url, username, password)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Selenium login failed: {str(e)}"}), 500

    token = uuid.uuid4().hex

    with LOCK:
        STORE[token] = {
            "cookies": cookies,
            "target_origin": origin,
            "expires": time.time() + TOKEN_TTL
        }

    host = request.host_url.rstrip("/")
    share_url = f"{host}/v1/share/{token}"

    return jsonify({
        "ok": True,
        "shareUrl": share_url
    })

# ===================================================================
# API → REDEEM SHARE (EXTENSION FETCHES COOKIES HERE)
# ===================================================================

@app.route("/v1/share/<token>", methods=["GET"])
def redeem(token):

    with LOCK:
        info = STORE.get(token)
        if not info:
            return jsonify({"ok": False, "error": "Invalid or expired token"}), 404

        # ONE-TIME USE → DELETE IMMEDIATELY
        del STORE[token]

    return jsonify({
        "ok": True,
        "cookies": info["cookies"],
        "target_origin": info["target_origin"]
    })

# ===================================================================
# RUN SERVER
# ===================================================================

if __name__ == "__main__":
    print("Server running on http://0.0.0.0:8443")
    app.run(host="0.0.0.0", port=8443)
