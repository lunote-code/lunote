# Platform differences (Windows, Linux, macOS)

Lunote targets **macOS**, **Windows**, and **Linux** with the same feature set. A few behaviors depend on the host OS or installed tools. This page helps you tell **expected differences** from bugs.

## Reveal in file manager

**Menu:** right-click a note or use **File → Reveal in Explorer** (wording may say “Explorer” on all platforms).

| Platform | Behavior |
|----------|----------|
| **macOS** | Opens Finder and **selects** the file (`open -R`). |
| **Windows** | Opens File Explorer and **selects** the file (`explorer /select,…`). |
| **Linux** | Tries file managers that support **select file** (Nautilus, Dolphin, Nemo, PCManFM), then D-Bus `FileManager1.ShowItems`, then opens the **parent folder** only (`xdg-open`). |

On minimal Linux setups without a supported file manager, only the parent directory opens. That is the final fallback, not a crash.

## Export to PDF

PDF export uses **headless Chrome/Chromium/Edge** on all desktop platforms. Lunote scans common install locations (including Flatpak exports on Linux).

If export fails:

1. Install Google Chrome, Chromium, Microsoft Edge, or Brave.
2. Or set **`CHROME_PATH`** (or **`PUPPETEER_EXECUTABLE_PATH`**) to the browser executable.
3. Restart Lunote after changing environment variables.

The in-app exporter and the maintainer CLI script (`scripts/lib/render-html-pdf-core.mjs`) share the same candidate list (`scripts/chrome-executable-candidates.json`).

## Print (File → Print)

Printing opens a **secondary webview** and the **system print dialog** via the OS web engine (WebKit on macOS/Linux, WebView2 on Windows).

- Requires a configured system printer.
- On macOS, export/print CSS avoids SF Pro internal font names that break iframe printing.
- If nothing happens, check that pop-up windows are allowed and that the app was built with print capabilities (official release builds include them).

## Keyboard shortcuts

Shortcuts follow **Typora-style** platform defaults:

- **macOS:** `Cmd` as primary modifier; redo often `Cmd+Shift+Z`.
- **Windows:** `Ctrl`; redo often `Ctrl+Y`; quit often `Alt+F4`.
- **Linux:** similar to Windows for many keys; quit often `Ctrl+Q`.

On the desktop app, Lunote reads the host OS via **`@tauri-apps/plugin-os`** (not browser user-agent) when choosing default shortcuts and **Cmd vs Ctrl** hint text. Browser-only dev builds still fall back to `navigator` detection.

## Clipboard and images

- Pasting images uses the OS clipboard (PNG/JPEG/GIF/WebP, etc.).
- **HEIC/HEIF** paths are recognized but decoding depends on system libraries; on Linux, HEIC paste may fail unless the file is converted.
- Copying a **file** from Finder may put both a file list and a filename on the clipboard; Lunote suppresses duplicate filename text when a real image path is available (macOS-oriented heuristic; other file managers may differ).

## File watching

External changes to workspace files are watched via the OS (`notify`: FSEvents, inotify, etc.). Network drives and some virtual filesystems may sync less reliably on any platform.

## Path and case rules

- Windows paths are compared **case-insensitively** inside a workspace.
- macOS (default APFS case-insensitive) and Linux (usually case-sensitive) may disagree if the same folder is shared across OSes—use consistent file naming.

## Quick capture (system tray)

Desktop builds include a **system tray icon** and **global shortcut** (default `Cmd+Shift+D` / `Ctrl+Shift+D`) to open **today's daily note**—even when the main window is in the background.

| Platform | Notes |
|----------|-------|
| **macOS** | Menu bar extra; template tray icon adapts to light/dark menu bar |
| **Windows** | Notification area icon |
| **Linux** | Depends on desktop environment (status notifier); some minimal setups may not show a tray |

Right-click the tray for **Today's daily note**, **Show main window**, and **Quit**. Customize the shortcut in **File → Preferences → Shortcuts**. Details: [Shortcuts & quick menus](shortcuts-and-menus.md#quick-capture-desktop-tray).

## Features not tied to one OS

These are **missing or limited on all desktop builds**, not just one OS:

- Native OS notifications for updates
- **OS drag-and-drop:** drop onto the **editor** to insert images or attach files into the open note; drop onto the **sidebar** (folder or file list) to **copy** files/folders into the vault (desktop app uses native paths; in-app tree drag-and-drop for moving notes is separate).
- In-app silent auto-update (updates open the GitHub Releases page)

## Official install packages

| Platform | CI release artifact |
|----------|---------------------|
| macOS | `.dmg` |
| Windows | `.msi` (x64 and arm64) |
| Linux | `.deb` (Ubuntu/Debian); RPM is buildable locally but not published in CI |

## Reporting a platform bug

When filing an issue, include:

- OS and version (e.g. Ubuntu 24.04, Windows 11, macOS 15)
- Lunote version
- Steps to reproduce
- Whether the workspace is on a local disk or network share

For PDF/reveal problems, note whether **Chrome/Chromium is installed** and if **`CHROME_PATH`** is set.
