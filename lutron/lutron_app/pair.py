"""One-time pairing with the RA3 processor.

LEAP authenticates with client certificates, not a password. Pairing proves
physical access: you press the button on the processor while this runs, and it
hands back a key/cert/CA triple that is stored locally and reused forever.
"""

from __future__ import annotations

import asyncio

from .config import Settings, save_settings


async def pair(settings: Settings, host: str) -> None:
    from pylutron_caseta.pairing import async_pair

    print(f"Pairing with the processor at {host}...")

    def ready() -> None:
        print("\n  >> Press the small black button on the RA3 processor now.")
        print("     You have about 30 seconds.\n")

    data = await async_pair(host, ready)

    settings.cert_dir.mkdir(parents=True, exist_ok=True)
    settings.keyfile.write_text(data["key"])
    settings.certfile.write_text(data["cert"])
    settings.ca_certs.write_text(data["ca"])
    # The private key is a credential; keep it owner-readable only.
    settings.keyfile.chmod(0o600)

    settings.host = host
    save_settings(settings)

    print(f"Paired successfully with {host} (LEAP version {data.get('version', '?')}).")
    print(f"Certificates written to {settings.cert_dir}")
    print("Run the server with:  python -m lutron_app serve")


def main(settings: Settings, host: str) -> None:
    asyncio.run(pair(settings, host))
