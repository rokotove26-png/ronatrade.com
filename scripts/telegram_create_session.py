#!/usr/bin/env python3
"""One-time local helper to create a Telegram StringSession.

Run only on a trusted administrator workstation. The resulting session string is a
credential and must be stored directly as the GitHub Actions secret TELEGRAM_SESSION.
Do not paste phone login codes, 2FA passwords, API hash or the resulting session into
ChatGPT, tickets, email, logs or repository files.
"""

from __future__ import annotations

import getpass
import os

from telethon import TelegramClient
from telethon.sessions import StringSession


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Set {name} in the local shell environment first.")
    return value


def main() -> None:
    api_id = int(required("TELEGRAM_API_ID"))
    api_hash = required("TELEGRAM_API_HASH")
    phone = input("Telegram phone (international format): ").strip()
    if not phone:
        raise SystemExit("Phone is required")

    with TelegramClient(StringSession(), api_id, api_hash) as client:
        client.send_code_request(phone)
        code = getpass.getpass("Telegram login code (hidden): ").strip()
        try:
            client.sign_in(phone=phone, code=code)
        except Exception as exc:
            # Avoid importing a particular Telethon exception version; handle 2FA
            # only when Telegram reports password is required.
            if "password" not in str(exc).lower() and "two" not in str(exc).lower():
                raise
            password = getpass.getpass("Telegram 2FA password (hidden): ")
            client.sign_in(password=password)

        session = client.session.save()
        print("\nSESSION CREATED. Treat the following value as a secret.")
        print("Store it directly as GitHub Actions secret TELEGRAM_SESSION, then clear terminal history/screen.")
        print(session)


if __name__ == "__main__":
    main()
