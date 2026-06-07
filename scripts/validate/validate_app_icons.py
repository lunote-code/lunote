#!/usr/bin/env python3
"""CI guard: committed app icon assets match icon.svg pipeline expectations.

Run: npm run validate:app-icons
Regenerate: npm run generate:app-icons (requires Chrome; icon.icns needs macOS iconutil)
"""
from __future__ import annotations

import json
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ICON_DIR = ROOT / "src-tauri" / "icons"
ICONSET_DIR = ICON_DIR / "icon.iconset"
ICON_SVG = ICON_DIR / "icon.svg"
TAURI_CONF = ROOT / "src-tauri" / "tauri.conf.json"

# Keep in sync with scripts/build/export_app_icon_pngs.mjs EXPORT_TARGETS.
EXPORT_TARGETS: tuple[tuple[str, int], ...] = (
    ("16x16.png", 16),
    ("32x32.png", 32),
    ("48x48.png", 48),
    ("64x64.png", 64),
    ("128x128.png", 128),
    ("256x256.png", 256),
    ("512x512.png", 512),
    ("1024x1024.png", 1024),
    ("ios/AppIcon-20x20@1x.png", 20),
    ("ios/AppIcon-20x20@2x.png", 40),
    ("ios/AppIcon-20x20@2x-1.png", 40),
    ("ios/AppIcon-20x20@3x.png", 60),
    ("ios/AppIcon-29x29@1x.png", 29),
    ("ios/AppIcon-29x29@2x.png", 58),
    ("ios/AppIcon-29x29@2x-1.png", 58),
    ("ios/AppIcon-29x29@3x.png", 87),
    ("ios/AppIcon-40x40@1x.png", 40),
    ("ios/AppIcon-40x40@2x.png", 80),
    ("ios/AppIcon-40x40@2x-1.png", 80),
    ("ios/AppIcon-40x40@3x.png", 120),
    ("ios/AppIcon-60x60@2x.png", 120),
    ("ios/AppIcon-60x60@3x.png", 180),
    ("ios/AppIcon-76x76@1x.png", 76),
    ("ios/AppIcon-76x76@2x.png", 152),
    ("ios/AppIcon-83.5x83.5@2x.png", 167),
    ("ios/AppIcon-512@2x.png", 1024),
    ("android/mipmap-mdpi/ic_launcher.png", 48),
    ("android/mipmap-mdpi/ic_launcher_round.png", 48),
    ("android/mipmap-mdpi/ic_launcher_foreground.png", 108),
    ("android/mipmap-hdpi/ic_launcher.png", 72),
    ("android/mipmap-hdpi/ic_launcher_round.png", 72),
    ("android/mipmap-hdpi/ic_launcher_foreground.png", 162),
    ("android/mipmap-xhdpi/ic_launcher.png", 96),
    ("android/mipmap-xhdpi/ic_launcher_round.png", 96),
    ("android/mipmap-xhdpi/ic_launcher_foreground.png", 216),
    ("android/mipmap-xxhdpi/ic_launcher.png", 144),
    ("android/mipmap-xxhdpi/ic_launcher_round.png", 144),
    ("android/mipmap-xxhdpi/ic_launcher_foreground.png", 324),
    ("android/mipmap-xxxhdpi/ic_launcher.png", 192),
    ("android/mipmap-xxxhdpi/ic_launcher_round.png", 192),
    ("android/mipmap-xxxhdpi/ic_launcher_foreground.png", 432),
)

ICONSET_FILES: tuple[str, ...] = (
    "icon_16x16.png",
    "icon_16x16@2x.png",
    "icon_32x32.png",
    "icon_32x32@2x.png",
    "icon_128x128.png",
    "icon_128x128@2x.png",
    "icon_256x256.png",
    "icon_256x256@2x.png",
    "icon_512x512.png",
    "icon_512x512@2x.png",
)

TRAY_FILES: tuple[str, ...] = (
    "trayTemplate.png",
    "trayTemplate18.png",
    "trayTemplate36.png",
)

MARGIN_CHECK_REL: tuple[str, ...] = (
    "16x16.png",
    "256x256.png",
    "512x512.png",
    "ios/AppIcon-29x29@2x.png",
)


def fail(message: str) -> None:
    print(f"validate_app_icons: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        fail(f"{path.relative_to(ROOT)}: not a PNG")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def read_png_pixels(path: Path) -> tuple[int, int, list[tuple[int, int, int, int]]]:
    data = path.read_bytes()
    width, height = struct.unpack(">II", data[16:24])
    pos = 8
    raw = b""
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        if kind == b"IDAT":
            raw += chunk
        pos += 12 + length
    inflated = zlib.decompress(raw)
    stride = width * 4 + 1
    pixels: list[tuple[int, int, int, int]] = []
    for y in range(height):
        row = inflated[y * stride + 1 : y * stride + 1 + width * 4]
        for x in range(width):
            i = x * 4
            pixels.append((row[i], row[i + 1], row[i + 2], row[i + 3]))
    return width, height, pixels


def validate_margin(path: Path) -> None:
    width, height, pixels = read_png_pixels(path)
    opaque = [(x, y) for y in range(height) for x in range(width) if pixels[y * width + x][3] > 0]
    if not opaque:
        fail(f"{path.relative_to(ROOT)}: no opaque pixels")
    min_x = min(x for x, _ in opaque)
    max_x = max(x for x, _ in opaque)
    min_y = min(y for _, y in opaque)
    max_y = max(y for _, y in opaque)
    margin_l = min_x / width
    margin_r = (width - 1 - max_x) / width
    margin_t = min_y / height
    margin_b = (height - 1 - max_y) / height
    margin_x = min(margin_l, margin_r)
    margin_y = min(margin_t, margin_b)
    if margin_x < 0.06 or margin_y < 0.06:
        fail(
            f"{path.relative_to(ROOT)}: dock inset too small "
            f"(margins {margin_x:.1%}, {margin_y:.1%}); expected >= 6%",
        )
    # Small taskbar icons must stay optically centered (avoid 16px Windows clipping).
    rel = path.relative_to(ICON_DIR).as_posix()
    if rel == "16x16.png":
        if abs(margin_l - margin_r) > 0.031 or abs(margin_t - margin_b) > 0.031:
            fail(
                f"{rel}: optical centering skewed "
                f"(L/R {margin_l:.1%}/{margin_r:.1%}, T/B {margin_t:.1%}/{margin_b:.1%})",
            )


def validate_ico(path: Path) -> None:
    data = path.read_bytes()
    if len(data) < 6:
        fail(f"{path.relative_to(ROOT)}: truncated ICO header")
    reserved, icon_type, count = struct.unpack("<HHH", data[:6])
    if reserved != 0 or icon_type != 1:
        fail(f"{path.relative_to(ROOT)}: invalid ICO header")
    if count != 4:
        fail(f"{path.relative_to(ROOT)}: expected 4 ICO layers, got {count}")
    for i in range(count):
        off = 6 + i * 16
        w, h, _, _, _, _, size, offset = struct.unpack("<BBBBHHII", data[off : off + 16])
        layer_w = 256 if w == 0 else w
        layer_h = 256 if h == 0 else h
        if layer_w not in (16, 32, 48, 256):
            fail(f"{path.relative_to(ROOT)}: unexpected layer size {layer_w}x{layer_h}")
        payload = data[offset : offset + size]
        if not payload.startswith(b"\x89PNG"):
            fail(f"{path.relative_to(ROOT)}: layer {layer_w} is not PNG-encoded")


def validate_tauri_bundle_icons() -> None:
    conf = json.loads(TAURI_CONF.read_text(encoding="utf-8"))
    icons = conf.get("bundle", {}).get("icon", [])
    if not icons:
        fail("tauri.conf.json: bundle.icon is empty")
    for rel in icons:
        rel_path = rel.removeprefix("icons/")
        path = ICON_DIR / rel_path
        if not path.is_file():
            fail(f"missing Tauri bundle icon: {rel} (expected {path.relative_to(ROOT)})")
        if path.suffix.lower() == ".png":
            w, h = read_png_size(path)
            if w != h:
                fail(f"{rel}: expected square PNG, got {w}x{h}")


def validate_export_targets() -> None:
    for rel, expected in EXPORT_TARGETS:
        path = ICON_DIR / rel
        if not path.is_file():
            fail(f"missing exported PNG: icons/{rel} (run npm run generate:app-icons)")
        w, h = read_png_size(path)
        if w != expected or h != expected:
            fail(f"icons/{rel}: expected {expected}x{expected}, got {w}x{h}")


def validate_derivatives() -> None:
    svg = ICON_SVG.read_bytes()
    for rel in ("src-tauri/app-icon.svg", "public/favicon.svg"):
        path = ROOT / rel
        if not path.is_file():
            fail(f"missing SVG derivative: {rel}")
        if path.read_bytes() != svg:
            fail(f"{rel} out of sync with src-tauri/icons/icon.svg (run npm run generate:app-icons)")

    pairs = (
        ("128x128@2x.png", "256x256.png"),
        ("icon.png", "512x512.png"),
        ("trayTemplate.png", "trayTemplate36.png"),
    )
    for target, source in pairs:
        t = ICON_DIR / target
        s = ICON_DIR / source
        if not t.is_file() or not s.is_file():
            fail(f"missing derivative PNG: icons/{target} or icons/{source}")
        if t.read_bytes() != s.read_bytes():
            fail(f"icons/{target} must match icons/{source}")


def validate_iconset_and_tray() -> None:
    for name in ICONSET_FILES:
        path = ICONSET_DIR / name
        if not path.is_file():
            fail(f"missing icon.iconset/{name} (run npm run generate:app-icons on macOS)")
    icns = ICON_DIR / "icon.icns"
    if not icns.is_file() or icns.stat().st_size < 1024:
        fail("missing or empty icons/icon.icns (run npm run generate:app-icons on macOS)")
    for name in TRAY_FILES:
        path = ICON_DIR / name
        if not path.is_file():
            fail(f"missing tray icon: icons/{name}")


def main() -> int:
    if not ICON_SVG.is_file():
        fail("missing src-tauri/icons/icon.svg")

    validate_tauri_bundle_icons()
    validate_export_targets()
    validate_derivatives()
    validate_iconset_and_tray()

    ico = ICON_DIR / "icon.ico"
    if not ico.is_file():
        fail("missing icons/icon.ico")
    validate_ico(ico)

    for rel in MARGIN_CHECK_REL:
        validate_margin(ICON_DIR / rel)

    print(
        "validate_app_icons: OK — "
        f"{len(EXPORT_TARGETS)} PNGs, bundle icons, ICO/ICNS, tray templates, dock margins",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
