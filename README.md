# SIOL - Say It Out Loud

SIOL is a minimal, non-obstructive dictation polisher designed to clean up your voice-to-text input instantly and privately.

## 🚀 Features

*   **Hybrid AI Architecture ("Local-First, Cloud-Fallback")**: Uses local browser-based transcription (Transformers.js) and local grammar correction (Chrome's built-in `window.ai`), falling back to Gemini 3 Flash API only when necessary.
*   **Document Picture-in-Picture (PiP)**: Keep a small, floating recording bubble always on top while you work in other apps.
*   **Auto-Copy**: Finalized text is instantly copied to your clipboard.
*   **Correction History & Vocabulary**: Teach the AI your specific jargon by providing feedback on its corrections.

## 🛠️ Setup

1. Clone the repository.
2. Run `npm install`.
3. Run `npm run dev` to start the development server.

## 🧪 Testing

SIOL includes end-to-end testing using Playwright to ensure the UI functionality remains intact across updates.

To run the tests:
1. Ensure the development server is running (`npm run dev`).
2. Run the test command:
   ```bash
   npm run test:e2e
   ```
This will spin up a headless browser and verify core user flows like the UI loading, the settings panel toggling, and switching to the history tab. You can add more comprehensive transcription-related tests inside the `tests/` directory as needed.

## 🌉 Cross-Platform Auto-Paste Bridges

Since a web application cannot force a paste action into another application due to security restrictions, you can set up these small "helper" scripts on your OS to instantly paste the copied text from SIOL.

### macOS (AppleScript Bridge)

1. Open the **Shortcuts** app on your Mac.
2. Create a new Shortcut.
3. Add a "Run AppleScript" action.
4. Paste the following code:
   ```applescript
   tell application "System Events"
       keystroke "v" using command down
   end tell
   ```
5. Assign a global keyboard shortcut to this Shortcut (e.g., `Cmd + Shift + V`).
6. Now, after SIOL auto-copies your text, just hit your shortcut to paste it anywhere!

### Linux / Android (ydotool Bridge)

If you are using a Wayland compositor on Linux, you can use `ydotool` and `wl-clipboard`:

1. Install dependencies: `sudo apt install ydotool wl-clipboard` (or equivalent for your distro).
2. Start the ydotool daemon: `ydotoold &`.
3. Map a global keyboard shortcut in your Desktop Environment to run:
   ```bash
   ydotool type "$(wl-paste)"
   ```

## 🧠 AI Feedback Loop

Whenever text is fixed, SIOL will show a "Was it perfect?" toast. If you click 👎, you can type a correction. SIOL saves this to its `local_vocabulary` and will inject it into future prompts, making the AI smarter over time.