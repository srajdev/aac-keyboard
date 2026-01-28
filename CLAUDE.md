# Viraj Keyboard - Project Context

## Overview
Assistive communication app for Viraj, a non-verbal user with limited fine motor skills who types with his right thumb on a tablet. Goal: increase typing speed from 8 WPM to 30 WPM using AI-powered predictions.

## Tech Stack
- **Backend**: Python FastAPI (`server/`)
- **Frontend**: Vanilla JS + HTML/CSS (`client/`)
- **AI**: Claude API (Anthropic) for predictions
- **Speech**: Web Speech API (browser-native TTS/STT)

## Running the App
```bash
# Activate venv and start server
./run.sh

# Or manually:
source venv/bin/activate
uvicorn server.main:app --host 0.0.0.0 --port 3000 --reload
```
Access at `http://localhost:3000`

## Project Structure
```
server/
  main.py           # FastAPI app, routes, static file serving
  claude_service.py # Claude API integration for predictions
  prompts.py        # System/user prompts for prediction generation

client/
  index.html        # Main UI layout
  styles/main.css   # Tablet-optimized CSS (60px+ touch targets)
  app.js            # Main app logic, wires components together
  components/
    Keyboard.js     # Virtual QWERTY keyboard
    Predictions.js  # 3-tier prediction display (phrases/words/letters)
    MessageArea.js  # Message composition area
    SpeakButton.js  # Text-to-speech trigger
    ListenToggle.js # Speech-to-text for conversation context
  services/
    api.js          # Backend API calls
    speech.js       # Web Speech API wrapper (TTS + STT)
    storage.js      # LocalStorage for history/preferences
```

## API Endpoints
- `POST /api/predict` - Get AI predictions
  - Request: `{ partialInput: string, conversationContext: string }`
  - Response: `{ phrases: string[], words: string[], letters: string[] }`

## Key Design Decisions
- **Large touch targets**: Min 60x60px buttons for thumb accessibility
- **3-tier predictions**: Phrases (5+ words), words, letters - user picks most efficient
- **Conversation context**: STT captures ambient speech to improve prediction relevance
- **No build step**: Vanilla JS for simplicity and easy debugging
- **Dark theme**: Reduces eye strain on tablet

## Environment Variables
- `ANTHROPIC_API_KEY` - Required for Claude API predictions

## User Considerations
- Input: Right thumb only on tablet
- Needs: Fast predictions, large buttons, minimal precise movements
- Context: Often responding to questions from family/caregivers
