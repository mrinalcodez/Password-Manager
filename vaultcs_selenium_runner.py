import sys
import json
import time
import os
import msvcrt
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

# Windows - required for native messaging
msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)


# ----------------------------------------------------
# Native messaging helpers
# ----------------------------------------------------
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


# ----------------------------------------------------
# Click the correct login button
# ----------------------------------------------------
def force_enable(btn, driver):
    try:
        driver.execute_script("""
            arguments[0].removeAttribute('disabled');
            arguments[0].classList.remove('disabled');
            arguments[0].removeAttribute('aria-disabled');
            arguments[0].disabled = false;
        """, btn)
    except:
        pass


def click_login_button(driver, loginUrl):
    # ------------------------------------------
    # SPECIAL HANDLING: GitHub Login
    # ------------------------------------------
    if "github.com/login" in loginUrl:
        try:
            btn = driver.find_element(By.CSS_SELECTOR, "input[name='commit']")
            force_enable(btn, driver)
            btn.click()
            return True
        except:
            pass

    # ------------------------------------------
    # Generic login submit buttons
    # ------------------------------------------
    selectors = [
        "input[type='submit']",
        "button[type='submit']",
        "button[role='button']",

        # Common labels
        "button[id*='login']",
        "button[class*='login']",
        "button[name*='login']",

        "button[id*='sign']",
        "button[class*='sign']",
        "button[name*='sign']",

        "input[value*='Sign']",
        "input[value*='Log']",
        "button[value*='Sign']",
        "button[value*='Log']",
    ]

    for selector in selectors:
        try:
            buttons = driver.find_elements(By.CSS_SELECTOR, selector)
            for btn in buttons:
                if not btn.is_displayed():
                    continue

                # REMOVES disabled states forcefully 👇
                force_enable(btn, driver)

                # Try clicking
                try:
                    btn.click()
                    return True
                except:
                    pass
        except:
            continue

    # ------------------------------------------
    # HARD FALLBACK — FORCE CLICK VIA JS
    # ------------------------------------------
    try:
        pw = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        driver.execute_script("arguments[0].dispatchEvent(new KeyboardEvent('keydown', {'key':'Enter'}));", pw)
        driver.execute_script("arguments[0].dispatchEvent(new KeyboardEvent('keyup', {'key':'Enter'}));", pw)
        pw.send_keys(Keys.ENTER)
        return True
    except:
        pass

    return False


# ----------------------------------------------------
# Autofill Login with Selenium
# ----------------------------------------------------
def run_selenium(loginUrl, username, password):
    try:
        options = webdriver.ChromeOptions()
        options.add_argument("--guest")
        options.add_argument("--disable-blink-features=AutomationControlled")

        driver = webdriver.Chrome(options=options)
        driver.get(loginUrl)
        time.sleep(2)

        # -------------------------------------------------------------------
        # Detect fields
        # -------------------------------------------------------------------
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
                continue

            # username heuristics
            if (
                not user_field
                and t in ["text", "email"]
            ) or (
                "user" in name
                or "email" in name
                or "login" in name
                or "user" in placeholder
                or "email" in placeholder
            ):
                user_field = el

        # -------------------------------------------------------------------
        # Autofill username
        # -------------------------------------------------------------------
        if user_field:
            user_field.click()
            user_field.send_keys(Keys.CONTROL, "a")
            user_field.send_keys(username)
            time.sleep(0.2)

        # Autofill password
        if pass_field:
            pass_field.click()
            pass_field.send_keys(Keys.CONTROL, "a")
            pass_field.send_keys(password)
            time.sleep(0.2)

        # -------------------------------------------------------------------
        # Click the correct login button
        # -------------------------------------------------------------------
        click_login_button(driver, loginUrl)

        # Wait for login to process
        time.sleep(3)

        return True

    except Exception as e:
        return str(e)


# ----------------------------------------------------
# MAIN LOOP — Native messaging persistent host
# ----------------------------------------------------
def main():
    while True:
        msg = read_native()
        if msg is None:
            time.sleep(0.05)
            continue

        loginUrl = msg.get("loginUrl")
        username = msg.get("username")
        password = msg.get("password")

        # Acknowledge receipt immediately
        send_native({"ok": True})

        result = run_selenium(loginUrl, username, password)

        if result is not True:
            send_native({"ok": False, "error": result})


if __name__ == "__main__":
    main()
