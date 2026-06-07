"""
Map shell `menu` field names in `src-tauri/i18n/en.json` to
Flat `menu.*` keys for `src/i18n/locales/en.json` (used to sync shell copy from UI locale).

Unmapped keys return None in `infer_shell_to_ui_key`, and `SHELL_UI_KEY_OVERRIDES` needs to be filled in manually.
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


def _snake_to_camel_part(s: str) -> str:
    parts = s.split("_")
    if not parts:
        return s
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:] if p)


def _tokens_to_menu_path(prefix: str, tokens: list[str]) -> str | None:
    if not tokens:
        return None
    if tokens == ["bar"]:
        return None
    if tokens[-1] == "bar":
        body = tokens[:-1]
        if not body:
            return None
        tail = ".".join(_snake_to_camel_part("_".join(g)) for g in _split_groups(body))
        return f"{prefix}.{tail}" if tail else prefix
    tail = ".".join(_snake_to_camel_part("_".join(g)) for g in _split_groups(tokens))
    return f"{prefix}.{tail}" if tail else prefix


def _split_groups(tokens: list[str]) -> list[list[str]]:
    """Map ['export', 'html', 'plain'] -> nested groups (not flat [['export'], ['html', 'plain']]).

    Adopt: merge consecutive tokens into camel segments; split one sub-key level only after export.
    """
    if not tokens:
        return []
    #Simplification: Convert the entire token segment into a camel segment (such as html_plain -> htmlPlain)
    return [tokens]


def infer_shell_to_ui_key(shell_key: str, ui_keys: set[str]) -> str | None:
    if shell_key == "paragraph":
        return "menu.paragraph"
    if shell_key == "format_menu":
        return "menu.format"
    if shell_key == "window_menu":
        return "menu.window"
    if shell_key.startswith("file_export_"):
        rest = shell_key[len("file_export_") :]
        if rest == "bar":
            hit = "menu.file.export"
            return hit if hit in ui_keys else None
        camel = _snake_to_camel_part(rest)
        hit = f"menu.file.export.{camel}"
        return hit if hit in ui_keys else None
    if shell_key.startswith("file_history_"):
        rest = shell_key[len("file_history_") :]
        if rest == "bar":
            hit = "menu.file.history"
            return hit if hit in ui_keys else None
    if shell_key.startswith("fmt_image_zoom_"):
        n = shell_key[len("fmt_image_zoom_") :]
        hit = f"menu.fmt.image.zoom.{n}"
        return hit if hit in ui_keys else None
    if shell_key.startswith("native_"):
        tail = shell_key[len("native_") :]
        mapping = {
            "app_hide": "menu.native.app.hide",
            "app_hide_others": "menu.native.app.hideOthers",
            "app_show_all": "menu.native.app.showAll",
            "app_quit": "menu.native.app.quit",
            "win_close": "menu.native.win.close",
            "help_bar": "menu.native.help",
            "help_about": "menu.native.help.about",
            "help_feedback": "menu.native.help.feedback",
            "help_privacy": "menu.native.help.privacy",
            "help_website": "menu.native.help.website",
            "recent_empty": "menu.native.recentEmpty",
            "theme": "menu.native.theme",
            "theme_open_folder": "menu.native.themeOpenFolder",
            "theme_refresh_css": "menu.native.themeRefreshCss",
        }
        k = mapping.get(tail)
        if k and k in ui_keys:
            return k
        return None

    for cat, react_seg in (
        ("file_", "menu.file"),
        ("edit_", "menu.edit"),
        ("view_", "menu.view"),
        ("fmt_", "menu.fmt"),
        ("para_", "menu.para"),
        ("win_", "menu.win"),
    ):
        if shell_key.startswith(cat):
            rest = shell_key[len(cat) :]
            tokens = rest.split("_") if rest else []
            if rest == "bar":
                hit = react_seg
                return hit if hit in ui_keys else None
            path = _tokens_to_menu_path(react_seg, tokens)
            if path and path in ui_keys:
                return path
            #Common: edit_find_* is hung under menu.edit.find
            if cat == "edit_" and rest.startswith("find_"):
                sub = rest[len("find_") :]
                if sub == "bar":
                    p = "menu.edit.find"
                    return p if p in ui_keys else None
                camel = _snake_to_camel_part(sub)
                p = f"menu.edit.find.{camel}"
                if p in ui_keys:
                    return p
            if cat == "fmt_" and rest.startswith("image_"):
                sub = rest[len("image_") :]
                camel = _snake_to_camel_part(sub)
                p = f"menu.fmt.image.{camel}"
                if p in ui_keys:
                    return p
            if cat == "para_" and rest.startswith("callout_"):
                sub = rest[len("callout_") :]
                camel = _snake_to_camel_part(sub)
                p = f"menu.para.callout.{camel}"
                if p in ui_keys:
                    return p
            if cat == "para_" and rest.startswith("code_tools_"):
                sub = rest[len("code_tools_") :]
                camel = _snake_to_camel_part(sub)
                p = f"menu.para.codeTools.{camel}"
                if p in ui_keys:
                    return p
            if cat == "para_" and rest.startswith("list_indent_"):
                sub = rest[len("list_indent_") :]
                camel = _snake_to_camel_part(sub)
                p = f"menu.para.listIndent.{camel}"
                if p in ui_keys:
                    return p
            if cat == "para_" and rest.startswith("table_"):
                sub = rest[len("table_") :]
                camel = _snake_to_camel_part(sub)
                p = f"menu.para.table.{camel}"
                if p in ui_keys:
                    return p
            if cat == "para_" and rest.startswith("task_"):
                sub = rest[len("task_") :]
                camel = _snake_to_camel_part(sub)
                p = f"menu.para.task.{camel}"
                if p in ui_keys:
                    return p
            if cat == "win_" and rest.startswith("half_"):
                sub = rest[len("half_") :]
                camel = _snake_to_camel_part(sub)
                p = f"menu.win.half.{camel}"
                if p in ui_keys:
                    return p
            return None

    return None


SHELL_UI_KEY_OVERRIDES: dict[str, str] = {
    "fmt_image_conv_html": "menu.fmt.image.conv.html",
    "fmt_image_conv_md": "menu.fmt.image.conv.md",
    "fmt_image_on_insert_copy": "menu.fmt.image.onInsert.copy",
    "fmt_image_on_insert_upload": "menu.fmt.image.onInsert.upload",
    #Complement here when infer fails (consistent with en.json UI key)
    "edit_bar": "menu.edit",
    "file_bar": "menu.file",
    "view_bar": "menu.view",
    "fmt_image_bar": "menu.fmt.image",
    "fmt_image_conv_bar": "menu.fmt.image.conv",
    "fmt_image_on_insert_bar": "menu.fmt.image.onInsert",
    "para_callout_bar": "menu.para.callout",
    "para_code_tools_bar": "menu.para.codeTools",
    "para_list_indent_bar": "menu.para.listIndent",
    "para_table_bar": "menu.para.table",
    "win_half_bar": "menu.win.half",
}


def build_map() -> dict[str, str]:
    shell = json.loads((ROOT / "src-tauri/i18n/en.json").read_text(encoding="utf-8"))["menu"]
    ui = json.loads((ROOT / "src/i18n/locales/en.json").read_text(encoding="utf-8"))
    ui_keys = set(ui.keys())
    out: dict[str, str] = {}
    missing: list[str] = []
    for sk in shell.keys():
        ui_key = SHELL_UI_KEY_OVERRIDES.get(sk) or infer_shell_to_ui_key(sk, ui_keys)
        if not ui_key or ui_key not in ui_keys:
            missing.append(sk)
            continue
        out[sk] = ui_key
    if missing:
        print("Unmapped shell menu keys:", ", ".join(missing), file=sys.stderr)
        raise SystemExit(1)
    return out


if __name__ == "__main__":
    m = build_map()
    print(json.dumps(m, ensure_ascii=False, indent=2))
