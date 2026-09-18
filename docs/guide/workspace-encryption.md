# Workspace encryption

Optional **AES-256-GCM** encryption for a single workspace. Enable it in **File → Preferences → Security**. There is no account, recovery email, or cloud key — the password stays in memory for the session and is never written to disk.

If you lose the password, encrypted Markdown cannot be recovered.

## What is encrypted

| Content | Default | Notes |
|---------|---------|--------|
| Markdown note bodies (`.md` / `.markdown`) | Encrypted when workspace encryption is on | Plaintext is purged from memory after lock |
| Image attachments (PNG, JPEG, WebP, GIF, HEIC, SVG, …) | **Plaintext** | Turn on **Encrypt images** on the same preferences panel to encrypt them at rest |
| Other files (PDF, code, etc.) | Not encrypted | Keep them out of a sensitive vault, or encrypt the disk with the OS |

Older builds encrypted some images automatically. Current Lunote migrates those files back to plaintext unless you opt in again with **Encrypt images**.

## Unlock, lock, auto-lock

1. Open an encrypted workspace and enter the password.
2. The password stays in memory until you close the workspace, quit the app, or auto-lock.
3. **Auto-lock after inactivity** (same panel): default **5 minutes**. Choices are Never, 1, 2, 5, 10, 15, 30 minutes, or 1 hour.
4. Before locking, Lunote saves unsaved notes. If anything is still dirty after that save, auto-lock is **skipped** so you do not lose work.
5. After lock, enter the password again to continue.

Change or remove encryption from **Preferences → Security** (re-encrypts or decrypts notes on disk). You can remove encryption even while the workspace is locked.

## Tips

- Use a password manager. There is no reset flow.
- Sync (Git, iCloud, Syncthing) copies whatever is on disk — encrypted notes stay encrypted in the remote copy.
- Other Markdown apps can still open the **folder**, but they cannot read encrypted note bodies without Lunote and the password.

Related: [Platform differences](platform-differences.md) · [Templates](../Templates/README.md)
