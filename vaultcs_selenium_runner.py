import sys
import json
import time
import os
import msvcrt
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# REQUIRED ON WINDOWS: use binary mode for native messaging
msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)


def read_native():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None

    message_length = int.from_bytes(raw_length, "little")
    if message_length == 0:
        return None

    message = sys.stdin.buffer.read(message_length).decode("utf-8")
    return json.loads(message)


def send_native(msg):
    encoded = json.dumps(msg).encode("utf-8")
    sys.stdout.buffer.write(len(encoded).to_bytes(4, "little"))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


# 🔥 Autofill + Auto-Login Selenium
def run_selenium(loginUrl, username, password):
    try:
        options = webdriver.ChromeOptions()

        # 100% private — no cookies or history
        options.add_argument("--guest")  
        options.add_argument("--disable-blink-features=AutomationControlled")

        driver = webdriver.Chrome(options=options)
        driver.get(loginUrl)

        time.sleep(2)  # wait for page load

        inputs = driver.find_elements(By.CSS_SELECTOR, "input")

        user_field = None
        pass_field = None

        for el in inputs:
            if not el.is_displayed() or not el.is_enabled():
                continue

            t = (el.get_attribute("type") or "").lower()
            name = (el.get_attribute("name") or "").lower()
            placeholder = (el.get_attribute("placeholder") or "").lower()

            if t == "password":
                pass_field = el

            if (
                not user_field
                and t in ["text", "email"]
                or "user" in name
                or "email" in name
                or "login" in name
                or "user" in placeholder
                or "email" in placeholder
            ):
                user_field = el

        # Fill username
        if user_field:
            user_field.click()
            user_field.send_keys(Keys.CONTROL, "a")
            user_field.send_keys(username)
            time.sleep(0.3)

        # Fill password
        if pass_field:
            pass_field.click()
            pass_field.send_keys(Keys.CONTROL, "a")
            pass_field.send_keys(password)
            time.sleep(0.3)

        # 🔥 Auto-click login button
        login_selectors = [
            "button[type='submit']",
            "input[type='submit']",
            "button[name='login']",
            "button[id*='login']",
            "button[class*='login']",
            "input[value*='Log']",
            "button",  # fallback attempt
        ]

        clicked = False
        for selector in login_selectors:
            try:
                btn = driver.find_element(By.CSS_SELECTOR, selector)
                if btn.is_displayed() and btn.is_enabled():
                    btn.click()
                    clicked = True
                    break
            except:
                continue

        if not clicked:
            try:
                # fallback: press Enter on password field
                pass_field.send_keys(Keys.ENTER)
            except:
                pass

        time.sleep(3)  # wait for login to complete

        # Browser stays open
        return True

    except Exception as e:
        return str(e)



# MAIN LOOP — persistent host
def main():
    while True:
        msg = read_native()
        if msg is None:
            time.sleep(0.05)
            continue

        loginUrl = msg.get("loginUrl")
        username = msg.get("username")
        password = msg.get("password")

        send_native({"ok": True})

        result = run_selenium(loginUrl, username, password)

        if result is not True:
            send_native({"ok": False, "error": result})


if __name__ == "__main__":
    main()
