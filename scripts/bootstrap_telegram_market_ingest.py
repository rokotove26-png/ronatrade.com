#!/usr/bin/env python3
"""One-time local bootstrap for the RONA Telegram market ingest.

This script intentionally keeps Telegram credentials, login codes, 2FA passwords,
and the generated MTProto StringSession out of stdout and out of the repository.
It writes only these GitHub Actions secrets through an already-authenticated `gh` CLI:
  TELEGRAM_API_ID
  TELEGRAM_API_HASH
  TELEGRAM_SESSION

The script does not join channels, send messages, or mutate Telegram state. It only
verifies read access to the configured market-source usernames, provisions the
repository secrets, and dispatches the existing read-only ingest workflow.
"""

from __future__ import annotations

import asyncio
import getpass
import shutil
import subprocess
import sys
from typing import Dict

try:
    from telethon import TelegramClient
    from telethon.errors import SessionPasswordNeededError
    from telethon.sessions import StringSession
except ImportError as exc:
    raise SystemExit(
        "BLOCKED: Telethon is not installed. Run: python -m pip install telethon==1.42.0"
    ) from exc


REPO = "rokotove26-png/ronatrade.com"
WORKFLOW = "telegram-market-ingest.yml"
CHANNELS = ("platts_digits", "Samantahlil")
SECRET_NAMES = ("TELEGRAM_API_ID", "TELEGRAM_API_HASH", "TELEGRAM_SESSION")


def fail(message: str, code: int = 1) -> None:
    print(f"BLOCKED: {message}", file=sys.stderr)
    raise SystemExit(code)


def require_gh() -> None:
    if not shutil.which("gh"):
        fail("GitHub CLI `gh` is not installed. Install it and authenticate with `gh auth login`.")
    result = subprocess.run(
        ["gh", "auth", "status"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode != 0:
        fail("GitHub CLI is not authenticated. Run `gh auth login` locally and retry.")


def set_github_secret(name: str, value: str) -> None:
    result = subprocess.run(
        ["gh", "secret", "set", name, "--repo", REPO],
        input=value,
        text=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        fail(f"Could not write GitHub Actions secret {name}. Check repository Actions-secret permission.")


def verify_secret_names() -> None:
    result = subprocess.run(
        ["gh", "secret", "list", "--repo", REPO],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode != 0:
        fail("Secrets were submitted but their names could not be verified with GitHub CLI.")
    present = {line.split("\t", 1)[0].strip() for line in result.stdout.splitlines() if line.strip()}
    missing = [name for name in SECRET_NAMES if name not in present]
    if missing:
        fail("GitHub did not report all required secret names: " + ", ".join(missing))


def dispatch_ingest() -> None:
    result = subprocess.run(
        ["gh", "workflow", "run", WORKFLOW, "--repo", REPO, "--ref", "main"],
        text=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode != 0:
        fail("Secrets are provisioned, but the Telegram ingest workflow could not be dispatched. Check GitHub Actions permission and retry the workflow from the GitHub UI.")


async def authorize(api_id: int, api_hash: str, phone: str) -> tuple[str, Dict[str, str]]:
    client = TelegramClient(StringSession(), api_id, api_hash)
    access: Dict[str, str] = {}
    await client.connect()
    try:
        if not await client.is_user_authorized():
            await client.send_code_request(phone)
            code = getpass.getpass("Telegram login code (hidden): ").strip()
            if not code:
                fail("Telegram login code was empty.")
            try:
                await client.sign_in(phone=phone, code=code)
            except SessionPasswordNeededError:
                password = getpass.getpass("Telegram 2FA password (hidden): ")
                if not password:
                    fail("Telegram 2FA password is required for this account.")
                await client.sign_in(password=password)

        me = await client.get_me()
        if not me:
            fail("Telegram authorization completed without a readable account identity.")

        for username in CHANNELS:
            try:
                entity = await client.get_entity(username)
                access[username] = "READABLE" if entity is not None else "UNRESOLVED"
            except Exception:
                access[username] = "NOT_READABLE"

        session = client.session.save()
        if not isinstance(session, str) or len(session) < 20:
            fail("Telegram StringSession generation failed.")
        return session, access
    finally:
        await client.disconnect()


async def main() -> None:
    require_gh()

    raw_api_id = input("Telegram API ID: ").strip()
    if not raw_api_id.isdigit() or int(raw_api_id) <= 0:
        fail("Telegram API ID must be a positive integer.")
    api_id = int(raw_api_id)

    api_hash = getpass.getpass("Telegram API hash (hidden): ").strip()
    if len(api_hash) < 16:
        fail("Telegram API hash is missing or invalid.")

    phone = input("Telegram account phone in international format (for local login only): ").strip()
    if not phone.startswith("+") or len(phone) < 8:
        fail("Use an international phone number beginning with +.")

    session, access = await authorize(api_id, api_hash, phone)
    if not any(access.get(username) == "READABLE" for username in CHANNELS):
        fail(
            "Telegram authorization is valid, but neither @platts_digits nor @Samantahlil is readable. "
            "Grant this account legitimate access to at least one configured source and retry."
        )

    set_github_secret("TELEGRAM_API_ID", str(api_id))
    set_github_secret("TELEGRAM_API_HASH", api_hash)
    set_github_secret("TELEGRAM_SESSION", session)
    verify_secret_names()
    dispatch_ingest()

    print("PASS: required GitHub Actions secret names are provisioned and the ingest workflow was dispatched.")
    for username in CHANNELS:
        print(f"CHANNEL @{username}: {access.get(username, 'UNKNOWN')}")
    print("No Telegram code, 2FA password, API hash, or session token was printed or stored locally by this script.")


if __name__ == "__main__":
    asyncio.run(main())
