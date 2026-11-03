# ScanBridge

Turn Your Smartphone into a Barcode Scanner.

## Status

Initial scaffold for the mobile PWA and desktop helper.

## Structure

- `mobile/` React + Vite + TypeScript + ZXing + PWA
- `desktop/` Tauri + Rust + Tokio + Enigo
- `shared/` event contracts and schemas

## Next steps

1. Install dependencies per package.
2. Configure Supabase project and env vars.
3. Run mobile PWA and desktop helper together.
4. Deploy `mobile/` to Vercel as the public PWA.

## Connection behavior

- Enable **Allow anonymous sign-ins** in the Supabase project's Authentication settings.
- Both apps track peer presence and connection errors. A silent peer is marked disconnected after 12 seconds without a heartbeat, checked every 2 seconds.
- The desktop opens its window with a disconnect message. Its native heartbeat checks continue while the window is hidden in the system tray.
- Backgrounding the mobile app pauses its connection. Reopening it resumes the saved pairing; a temporary network loss also preserves pairing.
- Closing the desktop window keeps ScanBridge running in the tray. Use the tray's **Exit** menu to stop it.
- The disconnect/reset buttons intentionally clear pairing. Scans require an active desktop connection and an acknowledgement from the desktop.

Run `npm run test:session`, `npm run test:realtime`, and `npm run test:contracts` for session and transport regression checks. Run `cargo test --locked` inside `desktop/src-tauri` for native checks.
