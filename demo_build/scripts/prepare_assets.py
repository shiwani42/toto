#!/usr/bin/env python3
"""Validate captures, generate score + narration, copy into public/."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
RECORDINGS = ROOT / "recordings"
SCREENSHOTS = ROOT / "screenshots"

REQUIRED_VIDEO = RECORDINGS / "walkthrough.mp4"
REQUIRED_SHOTS = [
    SCREENSHOTS / "dashboard-owner.png",
    SCREENSHOTS / "dashboard-owner-scroll.png",
    SCREENSHOTS / "dashboard-platform.png",
    SCREENSHOTS / "dashboard-qr.png",
    SCREENSHOTS / "dashboard-catalog.png",
    SCREENSHOTS / "home.png",
    SCREENSHOTS / "list.png",
    SCREENSHOTS / "map.png",
    SCREENSHOTS / "scan.png",
    SCREENSHOTS / "plan.png",
    SCREENSHOTS / "plan-swipe.png",
    SCREENSHOTS / "fit.png",
    SCREENSHOTS / "fit-result.png",
    SCREENSHOTS / "repair.png",
    SCREENSHOTS / "connect.png",
    SCREENSHOTS / "connected.png",
]


def ffprobe(path: Path) -> dict[str, str]:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration,size:stream=codec_name,width,height,r_frame_rate",
        "-of",
        "default=noprint_wrappers=1",
        str(path),
    ]
    out = subprocess.check_output(cmd, text=True)
    data: dict[str, str] = {}
    for line in out.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            data[key] = value
    return data


def main() -> int:
    missing = [p for p in [REQUIRED_VIDEO, *REQUIRED_SHOTS] if not p.exists()]
    if missing:
        print("Missing required assets:", file=sys.stderr)
        for path in missing:
            print(f"  - {path.relative_to(ROOT)}", file=sys.stderr)
        print("Run: APP_URL=http://127.0.0.1:5174 npm run capture", file=sys.stderr)
        return 1

    meta = ffprobe(REQUIRED_VIDEO)
    duration = float(meta.get("duration", "0"))
    width = int(meta.get("width", "0"))
    height = int(meta.get("height", "0"))
    if duration < 40:
        raise SystemExit(f"walkthrough too short for full demo: {duration:.2f}s")
    if width < 300 or height < 500:
        raise SystemExit(f"unexpected walkthrough size: {width}x{height}")

    for shot in REQUIRED_SHOTS:
        if shot.stat().st_size < 8_000:
            raise SystemExit(f"suspect screenshot: {shot.name}")

    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copy2(REQUIRED_VIDEO, PUBLIC / "walkthrough.mp4")
    subprocess.check_call(
        [sys.executable, str(ROOT / "scripts" / "make_scan_aisle.py")]
    )
    aisle = SCREENSHOTS / "scan-aisle.png"
    if not aisle.exists() or aisle.stat().st_size < 8_000:
        raise SystemExit("scan-aisle.png missing after composite")
    for shot in [*REQUIRED_SHOTS, aisle]:
        shutil.copy2(shot, PUBLIC / shot.name)

    score = PUBLIC / "score.wav"
    subprocess.check_call(
        [
            sys.executable,
            str(ROOT / "scripts" / "generate_score.py"),
            str(score),
            "--duration",
            "100",
            "--bpm",
            "128",
        ]
    )
    subprocess.check_call(
        [sys.executable, str(ROOT / "scripts" / "generate_barks.py")]
    )
    subprocess.check_call(
        [sys.executable, str(ROOT / "scripts" / "make_demo_toto_loop.py")]
    )
    male = PUBLIC / "voice" / "m4-01-cold.wav"
    if not male.exists():
        subprocess.check_call(
            [sys.executable, str(ROOT / "scripts" / "generate_narration.py")]
        )

    print("Prepared public assets:")
    for path in sorted(PUBLIC.rglob("*")):
        if path.is_file():
            print(f"  {path.relative_to(PUBLIC)} ({path.stat().st_size // 1024} KB)")
    print(f"Walkthrough: {width}x{height}, {duration:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
