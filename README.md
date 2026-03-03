# Viraj's AAC Keyboard

An AI-powered Augmentative and Alternative Communication (AAC) keyboard built for Viraj, a non-verbal user with limited fine motor skills who types with his right thumb on a tablet. The goal is to increase typing speed from ~8 WPM to 30 WPM using real-time AI predictions.

**Live at:** https://vdk.srajdev.com

---

## Features

- **AI-powered predictions** – 3-tier prediction system (phrases, words, letters) powered by Claude API
- **Custom keyboard layout** – 6-row layout optimized for single-thumb tablet use with large 65px+ touch targets
- **Speech-to-text context** – Captures ambient conversation to improve prediction relevance
- **Text-to-speech** – Speaks composed messages aloud
- **Conversation context** – Manual context input to guide predictions
- **Dark theme** – Reduces eye strain on tablet
- **Zero-ambiguity cursor** – Thin 3px blinking line cursor with word-boundary navigation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python + FastAPI |
| Frontend | Vanilla JS + HTML/CSS (no build step) |
| AI | Claude API (Anthropic) |
| Speech | Web Speech API (browser-native TTS/STT) |
| Hosting | Ubuntu server + Caddy reverse proxy |

---

## Project Structure

```
server/
  main.py             # FastAPI app, routes, static file serving
  claude_service.py   # Claude API integration for predictions
  prompts.py          # System/user prompts for prediction generation

client/
  index.html          # Main UI layout
  app.js              # Main app logic, wires all components together
  config.js           # Client-side config (API keys) — not committed
  config.js.example   # Template for config.js
  components/
    Keyboard.js           # Custom 6-row keyboard with modifiers
    Predictions.js         # 3-tier prediction display
    MessageArea.js         # Message composition with cursor navigation
    SpeakButton.js         # Text-to-speech trigger
    ListenToggle.js        # Speech-to-text toggle
    ProfileModal.js        # User profile settings
    SettingsModal.js       # App settings
    ExplicitContext.js     # Manual context input
    KeyboardHeightControl.js
    KeyboardWidthControl.js
    PredictionWidthControl.js
  services/
    api.js            # Backend API calls
    speech.js         # Web Speech API wrapper (TTS + STT)
    storage.js        # LocalStorage for history/preferences
    auth.js           # Authentication
    websocket.js      # WebSocket support for streaming predictions
  styles/
    main.css          # Tablet-optimized CSS
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd aac-keyboard

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set your API key
export ANTHROPIC_API_KEY=your_key_here
```

### Run Locally

```bash
./run.sh
```

Or manually:

```bash
source venv/bin/activate
uvicorn server.main:app --host 0.0.0.0 --port 3000 --reload
```

Then open `http://localhost:3000` in your browser.

---

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/predict` | POST | Get AI predictions |

**Request:**
```json
{
  "partialInput": "I want to",
  "conversationContext": "talking about weekend plans"
}
```

**Response:**
```json
{
  "phrases": ["I want to go to the park", ...],
  "words": ["go", "eat", "rest", ...],
  "letters": ["g", "e", "r", ...]
}
```

---

## Keyboard Layout

```
Row 1: Q  W  E  R  T  [DEL WORD]  [BKSP]
Row 2: [TAB] [↑] [↓] Y  U  O  I  P
Row 3: [CAPS] A  S  D  F  [SPEAK]  [ENTER]
Row 4: [CTRL] !  ?  [123] G  H  K  L
Row 5: [SHIFT] Z  X  C  V  B  N  M
Row 6: [SORRY, I GOOFED UP!] [•] [←] [SPACE] [→] [•]
```

Key colors match function type: blue (letters), orange (modifiers), purple (actions), cyan (navigation), green (space).

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full server setup, systemd service configuration, and Caddy reverse proxy instructions.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for predictions |

---

## User Context

Viraj is non-verbal and types with his right thumb on a tablet. Every design decision prioritises:
- Large touch targets (65px+ minimum)
- Minimal precise movements
- Fast, relevant predictions
- Ambient conversation awareness for contextual suggestions
