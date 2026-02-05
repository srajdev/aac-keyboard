# Viraj Keyboard - Project Context

## General rules of behaviour
1. Before writing any code, describe your approach and wait for approval. Always ask clarifying questions before writing any code if requirements are ambiguous.
2. If a task requires changes to more than 3 files, stop and break it into smaller tasks first.
3. After writing code, list what could break and suggest tests to cover it.
4. When there’s a bug, start by writing a test that reproduces it, then fix it until the test passes.
5. Every time I correct you, add a new rule to the CLAUDE .md file so it never happens again.
6. Everytime you start a new feature, create a new branch so we can track and revert if required

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
  index.html        # Main UI layout with custom keyboard
  styles/main.css   # Tablet-optimized CSS (65px+ touch targets)
  app.js            # Main app logic, wires components together
  components/
    Keyboard.js     # Custom 6-row keyboard with modifiers
    Predictions.js  # 3-tier prediction display (phrases/words/letters)
    MessageArea.js  # Message composition with cursor navigation
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

## Custom Keyboard Layout

### UI Structure
```
┌─────────────────────────────────────────────────────┐
│ [AI: ON] [Listen: OFF] [Context input__________]   │ Header
├─────────────────────────────────────────────────────┤
│ Message text | [CLEAR]                              │ Message Area
├─────────────────────────────────────────────────────┤
│ [Phrase 1] [Phrase 2] [Phrase 3] │ [Word Grid 2x3] │ Predictions
├─────────────────────────────────────────────────────┤
│ [Letter predictions - 5 buttons]                    │
├─────────────────────────────────────────────────────┤
│ Custom 6-Row Keyboard (see layout below)            │
├─────────────────────────────────────────────────────┤
│ 👂 What I heard: (tap to expand)                   │ Context Panel
└─────────────────────────────────────────────────────┘
```

### 6-Row Keyboard Layout
```
Row 1: Q  W  E  R  T  [DEL WORD]  [BKSP]
Row 2: [TAB] [↑] [↓] Y  U  O  I  P
Row 3: [CAPS] A  S  D  F  [SPEAK]  [ENTER]
Row 4: [CTRL] !  ?  [123] G  H  K  L
Row 5: [SHIFT] Z  X  C  V  B  N  M
Row 6: [SORRY, I GOOFED UP!] [•] [←] [SPACE] [→] [•]
```

### Key Functions

**Navigation Keys:**
- `↑` - Move cursor to start of text
- `↓` - Move cursor to end of text
- `←` - Move cursor to end of previous word
- `→` - Move cursor to start of next word

**Modifier Keys:**
- `CAPS` - Toggle uppercase (stays on until pressed again, visual feedback)
- `SHIFT` - Single uppercase (auto-resets after next letter, visual feedback)
- `TAB` - Insert tab character
- `CTRL` - Toggle ctrl state (for future shortcuts, visual feedback)

**Action Keys:**
- `DEL WORD` - Delete entire last word at cursor position
- `BKSP` - Delete one character (backspace)
- `ENTER` - Insert newline
- `SPEAK` - Trigger text-to-speech for current message
- `123` - Toggle to number keyboard (0-9 only)

**Quick Actions:**
- `SORRY, I GOOFED UP!` - Insert that exact phrase
- Left `•` - Open punctuation modal (.,!?;:'"-()/)
- Right `•` - Insert period

### Number Keyboard Mode
When `123` is pressed, keyboard switches to:
```
Row 1: 1  2  3  4  5
Row 2: 6  7  8  9  0
Row 3: [ABC]
```
Press `ABC` to return to letter keyboard.

### Punctuation Modal
Grid of 12 punctuation marks (4 columns × 3 rows):
```
,  .  !  ?
;  :  '  "
-  (  )  /
```
Large 80×80px touch targets for easy selection.

### Color Coding
Keys are color-coded for easy identification:
- **Blue gradient**: Letter keys (Q-Z, 0-9)
- **Orange gradient**: Modifiers (CAPS, SHIFT, TAB, CTRL, 123)
- **Purple/Pink gradient**: Actions (BKSP, DEL WORD, ENTER, SPEAK)
- **Cyan gradient**: Arrows (↑↓←→)
- **Green gradient**: Space bar
- **Blue (smaller font)**: Quick phrase button

### Cursor Behavior
**Zero-Ambiguity Line Cursor:**
- Thin 3px vertical line (not a block character)
- Pulse animation with glow effect for visibility
- Sits precisely between characters at insertion point
- Expands to 4px when message area is focused
- No padding/margin to eliminate spacing confusion
- Height matches text line-height (1.4em)

**Cursor Navigation:**
- Arrow keys move by word boundaries (not by character)
- Left arrow: end of previous word
- Right arrow: start of next word
- Up arrow: start of entire message
- Down arrow: end of entire message
- Cursor position clearly visible with no ambiguity about spaces

### Header Controls
- **AI Toggle**: Enable/disable AI predictions (saved to localStorage)
  - ON: Fetch predictions from Claude API
  - OFF: Show default predictions (yes/no/please/thanks/help/okay)
- **Listen Toggle**: Enable/disable speech-to-text
  - Shows pulse animation when actively listening
  - Captures ambient conversation for context
  - Transcriptions displayed in collapsible context panel with timestamps
- **Context Input**: Text box for explicit context
  - Debounced (500ms) to avoid excessive API calls
  - Combined with conversation context in predictions
  - Example: "I'm talking about weekend plans"

### Context Panel
Collapsible section showing speech transcriptions:
- Header: "👂 What I heard: (tap to expand)"
- Displays real-time transcriptions with timestamps
- Shows interim results while listening
- Auto-expands when listening starts
- Format: `[12:34] "captured speech text"`

### Touch Optimization
- All keys: 65px+ minimum height
- Space bar: 3× wider than standard keys (`flex: 3`)
- Quick phrase: 1.5× wider with smaller font
- Punctuation modal: 80×80px buttons
- No double-tap zoom on keyboard
- Visual feedback on key press (scale animation)

## Key Design Decisions
- **Large touch targets**: Min 65px buttons for thumb accessibility
- **3-tier predictions**: Phrases (5+ words), words (6 total), letters - user picks most efficient
- **Custom keyboard layout**: 6-row optimized layout with modifiers, navigation, and quick actions
- **Conversation context**: STT captures ambient speech to improve prediction relevance
- **Explicit context input**: Header text box for manual context to enhance predictions
- **Zero-ambiguity cursor**: Thin 3px line cursor with precise insertion point indicator
- **No build step**: Vanilla JS for simplicity and easy debugging
- **Dark theme**: Reduces eye strain on tablet

## Environment Variables
- `ANTHROPIC_API_KEY` - Required for Claude API predictions

## User Considerations
- Input: Right thumb only on tablet
- Needs: Fast predictions, large buttons, minimal precise movements
- Context: Often responding to questions from family/caregivers
