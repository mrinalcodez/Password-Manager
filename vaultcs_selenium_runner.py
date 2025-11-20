import sys
import json
import time
import os
import msvcrt
from selenium import webdriver
from selenium.webdriver.common.by import By

# REQUIRED ON WINDOWS: binary mode for Chrome Native Messaging
msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

def read_native():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    
    message_length = int.from_bytes(raw_length, byteorder='little')
    message = sys.stdin.buffer.read(message_length).decode("utf-8")
    return json.loads(message)

def send_native(msg):
    encoded = json.dumps(msg).encode("utf-8")
    sys.stdout.buffer.write(len(encoded).to_bytes(4, "little"))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def main():
    msg = read_native()
    if not msg:
        send_native({"ok": False, "error": "No message received"})
        return

    loginUrl = msg.get("loginUrl")
    username = msg.get("username")
    password = msg.get("password")

    driver = webdriver.Chrome()
    driver.get(loginUrl)

    inputs = driver.find_elements(By.TAG_NAME, "input")
    user_field = None
    pass_field = None

    for el in inputs:
        t = (el.get_attribute("type") or "").lower()
        n = (el.get_attribute("name") or "").lower()
        p = (el.get_attribute("placeholder") or "").lower()

        if t == "password":
            pass_field = el

        if not user_field and (
            t in ["text", "email"]
            or "user" in n
            or "email" in n
            or "login" in n
            or "email" in p
            or "username" in p
        ):
            user_field = el

    if user_field:
        user_field.send_keys(username)
    if pass_field:
        pass_field.send_keys(password)

    send_native({"ok": True})

    time.sleep(10)

if __name__ == "__main__":
    main()
