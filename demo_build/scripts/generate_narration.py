#!/usr/bin/env python3
"""Toto's aisle voice: close, warm, spoken. Not a newsreader."""

from __future__ import annotations

import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "voice"
# Male aisle voice. Same v14 lines. Andrew is conversation, not a newsreader.
VOICE = "en-US-AndrewNeural"

LINES = [
    (
        "m4-01-cold",
        "You know the mountain. You just don't want to look lost in front of the wall.",
    ),
    (
        "m4-02-meet",
        "Hey. I'm Toto. Stick with me.",
    ),
    (
        "m4-03-trip",
        "Tell me the trip. I'll ask the questions, then shrink two hundred jackets to the two that fit Saturday.",
    ),
    (
        "m4-04-floor",
        "Then I walk you there. Green when you're right. Quiet when you're not.",
    ),
    (
        "m4-05-fit",
        "Snap a photo. I'll guess your sizes, so the wall stops being a guessing game.",
    ),
    (
        "m4-06-repair",
        "Already own the jacket? I'll tell you if it's worth fixing, or time to replace.",
    ),
    (
        "m4-07-twin",
        "Shopping with someone? Share a code. You both see the list. Nobody plays telephone.",
    ),
    (
        "m4-08-owner",
        "And if you own the shop: those silent visits were demand you couldn't hear. Until now.",
    ),
    (
        "m4-08b-ops",
        "What they planned for. What they wanted. The door QR. Your catalog.",
    ),
    (
        "m4-09-close",
        "You leave sure. They finally hear you. That's Toto.",
    ),
]


async def synth(name: str, text: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mp3 = OUT_DIR / f"{name}.mp3"
    wav = OUT_DIR / f"{name}.wav"

    last_err: Exception | None = None
    for attempt in range(5):
        try:
            communicate = edge_tts.Communicate(
                text,
                VOICE,
                rate="-6%",
                pitch="-1Hz",
            )
            await communicate.save(str(mp3))
            if mp3.stat().st_size < 1000:
                raise RuntimeError("empty mp3")
            break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            await asyncio.sleep(1.5 * (attempt + 1))
    else:
        raise SystemExit(f"narration failed for {name}: {last_err}")

    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp3),
            "-ac",
            "2",
            "-ar",
            "44100",
            "-af",
            "highpass=f=80,equalizer=f=220:t=q:w=1.1:g=1.5,equalizer=f=5200:t=q:w=1.3:g=-2.5,acompressor=threshold=-18dB:ratio=2:attack=20:release=180:makeup=1.5,loudnorm=I=-16:TP=-1.5:LRA=11",
            str(wav),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return wav


async def main() -> int:
    manifest = []
    for name, text in LINES:
        if "—" in text or "–" in text:
            raise SystemExit(f"banned dash in narration: {name}")
        path = await synth(name, text)
        probe = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nw=1:nk=1",
                str(path),
            ],
            text=True,
        ).strip()
        duration = float(probe)
        manifest.append(
            {
                "id": name,
                "file": f"voice/{name}.wav",
                "duration": duration,
                "text": text,
            }
        )
        print(f"  {name}: {duration:.2f}s")
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Wrote {len(manifest)} narration clips to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
