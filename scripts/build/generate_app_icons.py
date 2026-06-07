#!/usr/bin/env python3
"""Generate Tauri app icons from src-tauri/icons/icon.svg (single visual source).

PNG rasterization: scripts/build/export_app_icon_pngs.mjs (macOS/Windows/Linux/ios/android).
This script assembles icon.ico, icon.icns, tray templates, and validates dock inset margins.
"""
from __future__ import annotations

import struct
import subprocess
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ICON_DIR = ROOT / "src-tauri" / "icons"
ICONSET_DIR = ICON_DIR / "icon.iconset"
ICON_SVG = ICON_DIR / "icon.svg"
EXPORT_SCRIPT = ROOT / "scripts/build/export_app_icon_pngs.mjs"

# Must match icon.svg transforms (832/1024 artwork inset, N scale 0.72).
ICON_SIZE = 512
ICON_CENTER = (256.0, 256.0)
ICON_ARTWORK_SCALE = 832 / 1024
N_GLYPH_SCALE = 0.72
N_GLYPH_CENTER = (256.0, 256.0)


def write_png(path: Path, width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixels[y * width + x])

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def point_in_quad(px: float, py: float, ax: float, ay: float, bx: float, by: float, cx: float, cy: float, dx: float, dy: float) -> bool:
    def cross(ox: float, oy: float, x1: float, y1: float, x2: float, y2: float) -> float:
        return (x1 - ox) * (y2 - oy) - (y1 - oy) * (x2 - ox)

    signs = [
        cross(px, py, ax, ay, bx, by) >= 0,
        cross(px, py, bx, by, cx, cy) >= 0,
        cross(px, py, cx, cy, dx, dy) >= 0,
        cross(px, py, dx, dy, ax, ay) >= 0,
    ]
    return all(signs) or not any(signs)


def n_glyph_alpha_base(ux: float, uy: float) -> float:
    if 162 <= ux <= 218 and 138 <= uy <= 374:
        return 1.0
    if 294 <= ux <= 350 and 138 <= uy <= 374:
        return 1.0
    if point_in_quad(ux, uy, 218, 138, 274, 138, 346, 374, 290, 374):
        return 1.0
    return 0.0


def artwork_point(x: float, y: float) -> tuple[float, float]:
    cx, cy = ICON_CENTER
    s = ICON_ARTWORK_SCALE
    return ((x - cx) / s + cx, (y - cy) / s + cy)


def n_glyph_alpha(ux: float, uy: float) -> float:
    ax, ay = artwork_point(ux, uy)
    cx, cy = N_GLYPH_CENTER
    gx = (ax - cx) / N_GLYPH_SCALE + cx
    gy = (ay - cy) / N_GLYPH_SCALE + cy
    return n_glyph_alpha_base(gx, gy)


def scaled_n_glyph_bbox() -> tuple[float, float, float, float]:
    left, top, right, bottom = 162.0, 138.0, 350.0, 374.0
    cx, cy = N_GLYPH_CENTER
    return (
        cx + (left - cx) * N_GLYPH_SCALE,
        cy + (top - cy) * N_GLYPH_SCALE,
        cx + (right - cx) * N_GLYPH_SCALE,
        cy + (bottom - cy) * N_GLYPH_SCALE,
    )


N_GLYPH_BBOX = scaled_n_glyph_bbox()


def render_tray_template(size: int) -> list[tuple[int, int, int, int]]:
    """macOS menu bar template: black glyph on transparent background, optically sized."""
    left, top, right, bottom = N_GLYPH_BBOX
    content_w = right - left
    content_h = bottom - top
    fill = size * 0.78
    scale = min(fill / content_w, fill / content_h)
    drawn_w = content_w * scale
    drawn_h = content_h * scale
    offset_x = (size - drawn_w) / 2
    offset_y = (size - drawn_h) / 2

    aa = 4
    ink = (0, 0, 0, 255)
    clear = (0, 0, 0, 0)
    pixels: list[tuple[int, int, int, int]] = []
    for y in range(size):
        for x in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(aa):
                for sx in range(aa):
                    px_f = x + (sx + 0.5) / aa
                    py_f = y + (sy + 0.5) / aa
                    ux = left + (px_f - offset_x) / scale
                    uy = top + (py_f - offset_y) / scale
                    px = ink if n_glyph_alpha(ux, uy) > 0 else clear
                    for i in range(4):
                        acc[i] += px[i]
            pixels.append(tuple(int(round(v / (aa * aa))) for v in acc))  # type: ignore[arg-type]
    return pixels


def write_tray_template_files() -> None:
    write_png(ICON_DIR / "trayTemplate18.png", 18, 18, render_tray_template(18))
    write_png(ICON_DIR / "trayTemplate36.png", 36, 36, render_tray_template(36))
    (ICON_DIR / "trayTemplate.png").write_bytes((ICON_DIR / "trayTemplate36.png").read_bytes())


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


def validate_icon_png(path: Path) -> None:
    width, height, pixels = read_png_pixels(path)
    opaque = [(x, y) for y in range(height) for x in range(width) if pixels[y * width + x][3] > 0]
    if not opaque:
        raise RuntimeError(f"{path.name}: icon has no opaque pixels")
    min_x = min(x for x, _ in opaque)
    max_x = max(x for x, _ in opaque)
    min_y = min(y for _, y in opaque)
    max_y = max(y for _, y in opaque)
    margin_x = min(min_x, width - 1 - max_x) / width
    margin_y = min(min_y, height - 1 - max_y) / height
    if margin_x < 0.06 or margin_y < 0.06:
        raise RuntimeError(
            f"{path.name}: dock inset too small (margins {margin_x:.1%}, {margin_y:.1%}); expected >= 6%",
        )


def export_pngs_from_svg() -> None:
    if not ICON_SVG.is_file():
        raise FileNotFoundError(f"missing icon source: {ICON_SVG}")
    result = subprocess.run(
        ["node", str(EXPORT_SCRIPT)],
        cwd=str(ROOT),
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise RuntimeError("export_app_icon_pngs.mjs failed")
    if result.stdout.strip():
        print(result.stdout.strip())


def sync_svg_derivatives() -> None:
    svg = ICON_SVG.read_bytes()
    (ROOT / "src-tauri/app-icon.svg").write_bytes(svg)
    (ROOT / "public/favicon.svg").write_bytes(svg)


def write_icon_files() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    ICONSET_DIR.mkdir(parents=True, exist_ok=True)

    sync_svg_derivatives()
    export_pngs_from_svg()

    (ICON_DIR / "128x128@2x.png").write_bytes((ICON_DIR / "256x256.png").read_bytes())
    (ICON_DIR / "icon.png").write_bytes((ICON_DIR / "512x512.png").read_bytes())
    write_tray_template_files()

    png_by_size = {
        16: (ICON_DIR / "16x16.png").read_bytes(),
        32: (ICON_DIR / "32x32.png").read_bytes(),
        48: (ICON_DIR / "48x48.png").read_bytes(),
        256: (ICON_DIR / "256x256.png").read_bytes(),
    }

    ico_sizes = [16, 32, 48, 256]
    header = struct.pack("<HHH", 0, 1, len(ico_sizes))
    offset = 6 + 16 * len(ico_sizes)
    directory = bytearray()
    payload = bytearray()
    for size in ico_sizes:
        data = png_by_size[size]
        directory.extend(
            struct.pack(
                "<BBBBHHII",
                0 if size == 256 else size,
                0 if size == 256 else size,
                0,
                0,
                1,
                32,
                len(data),
                offset,
            )
        )
        payload.extend(data)
        offset += len(data)
    (ICON_DIR / "icon.ico").write_bytes(header + bytes(directory) + bytes(payload))

    mapping = {
        "icon_16x16.png": "16x16.png",
        "icon_16x16@2x.png": "32x32.png",
        "icon_32x32.png": "32x32.png",
        "icon_32x32@2x.png": "64x64.png",
        "icon_128x128.png": "128x128.png",
        "icon_128x128@2x.png": "256x256.png",
        "icon_256x256.png": "256x256.png",
        "icon_256x256@2x.png": "512x512.png",
        "icon_512x512.png": "512x512.png",
        "icon_512x512@2x.png": "1024x1024.png",
    }
    for target, source in mapping.items():
        (ICONSET_DIR / target).write_bytes((ICON_DIR / source).read_bytes())

    iconutil = subprocess.run(
        ["/usr/bin/iconutil", "-c", "icns", str(ICONSET_DIR), "-o", str(ICON_DIR / "icon.icns")],
        check=False,
    )
    if iconutil.returncode != 0:
        print("warning: iconutil failed; PNG and ICO assets were generated")

    validate_icon_png(ICON_DIR / "256x256.png")
    validate_icon_png(ICON_DIR / "512x512.png")
    validate_icon_png(ICON_DIR / "ios/AppIcon-29x29@2x.png")
    print(
        "icon assets ok:",
        f"source={ICON_SVG.relative_to(ROOT)}",
        f"artwork_scale={ICON_ARTWORK_SCALE:.4f}",
        f"n_scale={N_GLYPH_SCALE:.2f}",
    )


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--tray-only":
        write_tray_template_files()
    else:
        write_icon_files()
