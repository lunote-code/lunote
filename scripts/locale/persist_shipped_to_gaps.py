#!/usr/bin/env python3
"""
Copy translated keys from shipped src/i18n/locales/*.json into corpus gaps
so `build_ui_locales.py` (CI bare build) reproduces the full sparse files.

Run after rebuild_shipped_locales.mjs:
  python3 scripts/locale/persist_shipped_to_gaps.py
"""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
EN_PATH = ROOT / "src/i18n/locales/en.json"
LOCALES_DIR = ROOT / "src/i18n/locales"
GAPS_DIR = ROOT / "scripts/locale_corpus/gaps"

# Keep in sync with scripts/locale/build_ui_locales.py
ALWAYS_MATERIALIZE_KEYS = frozenset({
    "app.tabs.countLabel",
    "editor.format.textColor.hexPlaceholder",
    "knowledge.graph.resetZoomShort",
    "settings.ai.baseUrl.placeholder",
    "settings.ai.model.placeholder",
    "settings.ai.provider.anthropic",
    "settings.ai.provider.deepseek",
    "settings.ai.provider.google",
    "settings.ai.provider.lmstudio",
    "settings.ai.provider.local",
    "settings.ai.provider.ollama",
    "settings.ai.provider.openai",
    "settings.ai.provider.openrouter",
    "settings.assets.absolutePath.placeholder",
    "settings.editor.autosaveIntervalSec.placeholder",
    "settings.editor.fontFamily.group.github",
    "settings.plugins.incompatible",
    "settings.plugins.platform.desktop",
    "settings.plugins.screenshotCounter",
    "settings.plugins.sizeBytes",
    "settings.plugins.sizeKilobytes",
    "settings.plugins.sizeMegabytes",
    "settings.theme.github",
})


def main() -> None:
    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    total = 0
    for path in sorted(LOCALES_DIR.glob("*.json")):
        if path.stem == "en":
            continue
        locale = path.stem
        shipped = json.loads(path.read_text(encoding="utf-8"))
        gap_path = GAPS_DIR / f"{locale}.json"
        gaps = json.loads(gap_path.read_text(encoding="utf-8")) if gap_path.is_file() else {}
        added = 0
        for key, value in shipped.items():
            if key.startswith("meta."):
                continue
            if key not in en:
                continue
            if value != en[key] or key in ALWAYS_MATERIALIZE_KEYS:
                if gaps.get(key) != value:
                    gaps[key] = value
                    added += 1
        ordered = dict(sorted(gaps.items()))
        gap_path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{locale}: persisted {added} keys → gaps ({len(ordered)} total)")
        total += added
    print(f"persist_shipped_to_gaps: {total} key updates")


if __name__ == "__main__":
    main()
