"""Host the Robbe Wulgaert website prototype on this computer.

Run from this project folder with:

    python demo_website.py

Press Ctrl+C in the terminal to stop the demo server.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit


PROJECT_ROOT = Path(__file__).resolve().parent
DIST_DIR = PROJECT_ROOT / "dist"
PROJECT_BASE_PATH = "/aiindeklas"


def find_node() -> Path:
    """Find a supported Node.js on PATH or in the Codex bundled runtime."""

    candidates: list[Path] = []
    if configured := os.environ.get("NODE_BINARY"):
        candidates.append(Path(configured).expanduser())

    if path_node := shutil.which("node"):
        candidates.append(Path(path_node))

    runtime_root = Path.home() / ".cache" / "codex-runtimes"
    if runtime_root.is_dir():
        executable = "node.exe" if os.name == "nt" else "node"
        candidates.extend(sorted(runtime_root.glob(f"*/dependencies/node/bin/{executable}"), reverse=True))

    for candidate in candidates:
        if not candidate.is_file():
            continue
        try:
            version_result = subprocess.run(
                [str(candidate), "--version"],
                capture_output=True,
                check=True,
                text=True,
                timeout=5,
            )
            version = tuple(int(part) for part in version_result.stdout.strip().lstrip("v").split(".")[:2])
        except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError):
            continue
        if version >= (22, 12):
            return candidate.resolve()

    raise FileNotFoundError(
        "Node.js was not found. Install Node.js 22.13 or newer, or set "
        "NODE_BINARY to the Node executable."
    )


def build_site() -> None:
    """Create and validate the safe local/root build in ``dist``."""

    node = find_node()
    build_script = PROJECT_ROOT / "scripts" / "build-profile.mjs"
    print("Building the local website …", flush=True)
    subprocess.run(
        [str(node), str(build_script), "root"],
        cwd=PROJECT_ROOT,
        check=True,
    )


class DemoRequestHandler(SimpleHTTPRequestHandler):
    """Serve Astro's file-format output with extensionless routes."""

    server_version = "RobbeWulgaertDemo/1.0"

    def _built_file_for_request(self) -> Path | None:
        parsed = urlsplit(self.path)
        decoded = unquote(parsed.path)
        if "\\" in decoded:
            return None

        # The checked-in prototype may be the project-profile build, whose
        # links start with /aiindeklas/. Serve that build at localhost root as
        # well, so reviewers can navigate it without GitHub Pages hosting.
        if decoded == PROJECT_BASE_PATH:
            decoded = "/"
        elif decoded.startswith(f"{PROJECT_BASE_PATH}/"):
            decoded = decoded[len(PROJECT_BASE_PATH):] or "/"

        relative = Path(decoded.lstrip("/"))
        if relative.is_absolute() or relative.drive or ".." in relative.parts:
            return None

        dist_root = DIST_DIR.resolve()
        requested = (dist_root / relative).resolve()
        try:
            requested.relative_to(dist_root)
        except ValueError:
            return None
        candidates = [requested]
        if decoded.endswith("/"):
            candidates.insert(0, requested / "index.html")
        elif not requested.suffix:
            candidates.insert(0, requested.with_suffix(".html"))

        for candidate in candidates:
            if candidate.is_file():
                return candidate
        return None

    def _rewrite_to_built_file(self, built_file: Path) -> None:
        parsed = urlsplit(self.path)
        relative_url = quote(built_file.relative_to(DIST_DIR).as_posix())
        self.path = urlunsplit(("", "", f"/{relative_url}", parsed.query, ""))

    def _serve_not_found(self, *, include_body: bool) -> None:
        not_found = DIST_DIR / "404.html"
        body = not_found.read_bytes() if not_found.is_file() else b"Not found\n"
        content_type = "text/html; charset=utf-8" if not_found.is_file() else "text/plain; charset=utf-8"
        self.send_response(404)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if include_body:
            self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - inherited HTTP method name
        if built_file := self._built_file_for_request():
            self._rewrite_to_built_file(built_file)
            super().do_GET()
            return
        self._serve_not_found(include_body=True)

    def do_HEAD(self) -> None:  # noqa: N802 - inherited HTTP method name
        if built_file := self._built_file_for_request():
            self._rewrite_to_built_file(built_file)
            super().do_HEAD()
            return
        self._serve_not_found(include_body=False)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Host and open the local Robbe Wulgaert website prototype."
    )
    parser.add_argument("--host", default="127.0.0.1", help="Address to bind (default: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=4321, help="Port to use (default: 4321).")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Rebuild the prototype before serving (requires installed Node dependencies).",
    )
    parser.add_argument(
        "--no-build",
        action="store_true",
        help="Deprecated alias for the default prototype mode.",
    )
    parser.add_argument("--no-browser", action="store_true", help="Do not open the demo in the default browser.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if args.rebuild and args.no_build:
            raise ValueError("Use either --rebuild or --no-build, not both.")

        if args.rebuild:
            build_site()
        elif not (DIST_DIR / "index.html").is_file():
            build_site()
        else:
            print("Using the existing prototype build in dist/ …", flush=True)

        handler = partial(DemoRequestHandler, directory=str(DIST_DIR))
        server = ThreadingHTTPServer((args.host, args.port), handler)
    except (FileNotFoundError, OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Could not start the demo: {error}", file=sys.stderr)
        return 1

    browser_host = "127.0.0.1" if args.host in {"0.0.0.0", "::"} else args.host
    url = f"http://{browser_host}:{server.server_port}/"
    print(f"Demo website: {url}")
    print("Press Ctrl+C to stop it.", flush=True)

    if not args.no_browser:
        browser_timer = threading.Timer(0.25, webbrowser.open, args=(url,))
        browser_timer.daemon = True
        browser_timer.start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping the demo website.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
