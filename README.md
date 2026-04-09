# EMS Trauma AI Assistant

A real-time AI-powered clinical assistant for EMS (Emergency Medical Services) in Arkansas. Features voice-to-PCR (Pre-Hospital Care Report) generation, pediatric dose calculations, and text-to-speech clinical guidance.

## Features

- 🎙️ **Voice Input** — Speak field observations, automatically transcribed
- 📋 **AI PCR Generation** — Synthesizes verbal reports into structured Pre-Hospital Care Reports
- 💊 **Pediatric Dose Calculator** — Weight-based drug dosing for common EMS medications
- 🔊 **Text-to-Speech** — AI reads back clinical recommendations
- 🌐 **Bilingual** — English / Spanish toggle
- 🌗 **Light / Dark Mode**

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ (or [Bun](https://bun.sh/))
- A Google Gemini API key — get one free at [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add your API key**

   Open `src/lib/constants.ts` and replace the `SERVICE_TOKEN` value with your own Gemini API key:
   ```ts
   export const SERVICE_TOKEN = "YOUR_GEMINI_API_KEY_HERE";
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:8080`.

5. **Build for production**
   ```bash
   npm run build
   ```
   Output goes to `dist/` — deploy to any static host (Vercel, Netlify, GitHub Pages, etc.).

## Tech Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS + shadcn/ui
- Google Gemini API (text + TTS)

## Notes

- Voice input uses the Web Speech API — works best in Chrome
- The API key is client-side; for production, consider proxying through a backend
