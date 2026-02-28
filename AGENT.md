# SIOL Coding Standards

## 🛠 Tech Stack
- Frontend: Next.js + Tailwind CSS.
- Persistence: localStorage for API keys, local_vocabulary, and Prompt history.
- Voice-to-Text: Transformers.js (Distil-Whisper) for local browser-based transcription.
- Browser APIs: Document PiP API, Navigator Clipboard.

## 🤖 AI Guidelines
- Architecture: "Local-First, Cloud-Fallback" Hybrid logic.
- Target Model: Gemini 3 Flash.
- Local Fallback: window.ai (Gemini Nano).
- Prompting: Use a "Reflective" loop. Always include context from 'local_vocabulary' in the system prompt.

## 🏗 Architecture
- Single Page Application (SPA) / PWA.
- Floating Window: Must be triggered via a user gesture (PiP requirement).

## 📝 Repository Hygiene
- No hardcoded keys. Use an input field for the Gemini API Key.
- Log feedback events to a local 'correction_history' JSON object for later optimization.
- Include helper scripts for auto-paste in README.md.