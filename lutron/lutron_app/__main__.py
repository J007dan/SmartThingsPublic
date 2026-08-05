"""Command line entry point: ``python -m lutron_app <command>``."""

from __future__ import annotations

import argparse
import logging
import sys

from .config import load_settings, save_settings


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="lutron_app", description=__doc__)
    parser.add_argument("--verbose", "-v", action="store_true", help="debug logging")
    sub = parser.add_subparsers(dest="command", required=True)

    p_pair = sub.add_parser("pair", help="pair with an RA3 processor (one time)")
    p_pair.add_argument("host", help="hostname or IP address of the processor")

    p_serve = sub.add_parser("serve", help="run the web server")
    p_serve.add_argument("--host", dest="bind_host", default=None)
    p_serve.add_argument("--port", dest="bind_port", type=int, default=None)
    p_serve.add_argument(
        "--demo",
        action="store_true",
        help="use the simulated house even if a processor is configured",
    )

    p_config = sub.add_parser("config", help="show or set configuration")
    p_config.add_argument("--latitude", type=float)
    p_config.add_argument("--longitude", type=float)
    p_config.add_argument("--timezone")
    p_config.add_argument("--host")

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    settings = load_settings()

    if args.command == "pair":
        from .pair import main as pair_main

        pair_main(settings, args.host)
        return 0

    if args.command == "config":
        changed = False
        for field in ("latitude", "longitude", "timezone", "host"):
            value = getattr(args, field, None)
            if value is not None:
                setattr(settings, field, value)
                changed = True
        if changed:
            save_settings(settings)
            print(f"Saved to {settings.data_dir / 'config.json'}")
        print(f"host       {settings.host or '(none - demo mode)'}")
        print(f"paired     {settings.paired}")
        print(f"location   {settings.latitude}, {settings.longitude}")
        print(f"timezone   {settings.timezone}")
        print(f"data dir   {settings.data_dir}")
        return 0

    if args.command == "serve":
        import uvicorn

        from .api import create_app

        if args.bind_host:
            settings.bind_host = args.bind_host
        if args.bind_port:
            settings.bind_port = args.bind_port
        if args.demo:
            settings.demo = True

        if settings.use_demo_backend:
            print("No paired processor - running the simulated house.")
            print("Pair with:  python -m lutron_app pair <processor-ip>")

        print(f"Serving on http://{settings.bind_host}:{settings.bind_port}")
        uvicorn.run(
            create_app(settings),
            host=settings.bind_host,
            port=settings.bind_port,
            log_level="debug" if args.verbose else "info",
        )
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
