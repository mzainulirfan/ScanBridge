# Desktop design review — 0.1.5

## Findings

- The 420 px window placed connection health and scan results below the QR card. Users could not tell whether the app was ready without scrolling.
- Internal event names and terminal-style messages did not explain what users should do next. Connection loss, waiting for a phone, and an unavailable server needed distinct instructions.
- The header displayed `v0.1` regardless of the installed version. The update banner's `display: flex` overrode the browser's default `[hidden]` style, showing an install action even without an available update.
- The summary did not restore the most recent saved scan or show its result and time. History lacked search and result filters, and its capacity label was fixed at 100.
- Output settings did not distinguish unsaved changes from the applied configuration. The keyboard test ran immediately after its own button received focus, leaving no time to select the destination application.
- Resetting pairing had no confirmation even though it disconnects the current phone and invalidates the code.

## Implemented layout

The default window is 1024 × 800 with a 760 × 620 minimum. A persistent sidebar separates Ringkasan, Pengaturan, and Riwayat. Smaller layouts stack the cards and keep content scrollable.

Ringkasan leads with a state-dependent title and next step. The QR and copyable pairing code share the screen with the latest scan and its outcome, history counts, server/phone/output states, the last phone contact, and the current keyboard mode. The counters explicitly represent bounded local history, not lifetime or daily totals. Phone IDs are shown only as a short suffix; the UI does not invent a device model or an active target application.

Pengaturan previews the draft prefix, barcode, suffix, and final key. Unsaved edits are marked, and the summary continues to show the saved configuration. The typing test gives the user three seconds to focus the destination and explicitly uses the saved settings.

Riwayat supports case-insensitive search across barcode, format, and error message, with success/failure filters. Barcode and message content is escaped before table rendering. Empty history and an empty search result have separate guidance. Clearing history also clears the summary's displayed scan.

Pairing resets and history deletion require confirmation. Tabs support arrow keys, Home, and End. Hidden elements remain hidden regardless of component layout styles. An unavailable update service is reported in the footer without presenting a false install action.

## Verification

TypeScript and the existing disconnect regression suite remain part of validation. Browser checks use the real frontend with mocked native commands and isolated realtime callbacks, covering waiting, connected, disconnected, server retry, settings persistence, delayed typing, history filtering/deletion, escaped content, update failure, and keyboard navigation at 1024 × 800, 760 × 620, and 420 × 720.

The existing behavior of hiding the window in the tray after successful pairing is retained. Reopening it from the tray displays the current dashboard. Actual barcode input is still controlled by the native application.
