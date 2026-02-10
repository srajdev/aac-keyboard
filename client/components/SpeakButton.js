// SpeakButton Component - handles text-to-speech functionality

// Global debounce flag (avoids 'this' binding issues with inline onclick)
let _speakDebounce = false;

const SpeakButton = {
    button: null,
    floatingButton: null,
    getMessage: null,
    ttsMode: 'manual', // 'sentence', 'word', or 'manual'

    init() {
        this.button = document.getElementById('speak-btn');
        this.floatingButton = document.getElementById('floating-speak-btn');

        // Load TTS mode from preferences
        const prefs = StorageService.getPreferences();
        this.ttsMode = prefs.ttsMode || 'sentence';

        // Check if TTS is supported
        if (!SpeechService.isSynthesisSupported()) {
            this.button.disabled = true;
            this.button.textContent = 'TTS Not Supported';
            if (this.floatingButton) {
                this.floatingButton.disabled = true;
            }
        }
    },

    setTtsMode(mode) {
        this.ttsMode = mode;
    },

    getTtsMode() {
        return this.ttsMode;
    },

    speak() {
        // Prevent double-firing on iOS (touch + click)
        if (_speakDebounce) return;
        _speakDebounce = true;
        setTimeout(() => { _speakDebounce = false; }, 500);

        if (!this.getMessage) return;

        const message = this.getMessage();
        if (message && message.trim()) {
            // Visual feedback
            if (this.button) {
                this.button.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.button.style.transform = '';
                }, 200);
            }

            // Speak the message
            SpeechService.speak(message);

            // Save to history
            StorageService.addToHistory(message);

            // Clear message after speaking
            MessageArea.clear();
        }
    },

    speakWord(text) {
        // Speak a word/phrase without clearing the message
        // Used for word-by-word TTS mode
        if (text && text.trim()) {
            SpeechService.speak(text.trim());
        }
    },
};
