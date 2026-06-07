#!/usr/bin/env python3
"""Sync TRC20 USDT sponsor address from maintenance data into all README files.

Edit `scripts/maintenance/data/sponsor.json`, then run:

  python3 scripts/sync_sponsor_to_readmes.py

Append sponsor blocks first (once):

  python3 scripts/append_sponsor_to_readmes.py
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parent.parent / "maintenance" / "sync_sponsor_to_readmes.py"

if __name__ == "__main__":
    sys.argv[0] = str(TARGET)
    runpy.run_path(str(TARGET), run_name="__main__")
