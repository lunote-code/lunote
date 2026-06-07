#!/usr/bin/env python3
"""Append TRC20 USDT sponsor section to README files (one-time / when missing).

Run: python3 scripts/append_sponsor_to_readmes.py

Then set the address in scripts/maintenance/data/sponsor.json and run:

  python3 scripts/sync_sponsor_to_readmes.py
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parent.parent / "maintenance" / "append_sponsor_to_readmes.py"

if __name__ == "__main__":
    sys.argv[0] = str(TARGET)
    runpy.run_path(str(TARGET), run_name="__main__")
