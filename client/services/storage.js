// Storage Service - handles local storage for preferences and history

const StorageService = {
    KEYS: {
        MESSAGE_HISTORY: 'viraj_message_history',
        PREFERENCES: 'viraj_preferences',
        FREQUENT_PHRASES: 'viraj_frequent_phrases',
    },

    // Message History
    getMessageHistory() {
        try {
            const history = localStorage.getItem(this.KEYS.MESSAGE_HISTORY);
            return history ? JSON.parse(history) : [];
        } catch (e) {
            return [];
        }
    },

    addToHistory(message) {
        if (!message || !message.trim()) return;

        const history = this.getMessageHistory();
        // Add to beginning, keep last 50 messages
        history.unshift({
            text: message,
            timestamp: Date.now(),
        });
        if (history.length > 50) {
            history.pop();
        }
        localStorage.setItem(this.KEYS.MESSAGE_HISTORY, JSON.stringify(history));

        // Also track frequent phrases
        this.trackPhrase(message);
    },

    // Frequent Phrases
    trackPhrase(phrase) {
        try {
            const phrases = this.getFrequentPhrases();
            const existing = phrases.find((p) => p.text.toLowerCase() === phrase.toLowerCase());
            if (existing) {
                existing.count++;
            } else {
                phrases.push({ text: phrase, count: 1 });
            }
            // Sort by count and keep top 20
            phrases.sort((a, b) => b.count - a.count);
            if (phrases.length > 20) {
                phrases.length = 20;
            }
            localStorage.setItem(this.KEYS.FREQUENT_PHRASES, JSON.stringify(phrases));
        } catch (e) {
            console.error('Failed to track phrase:', e);
        }
    },

    getFrequentPhrases() {
        try {
            const phrases = localStorage.getItem(this.KEYS.FREQUENT_PHRASES);
            return phrases ? JSON.parse(phrases) : [];
        } catch (e) {
            return [];
        }
    },

    // Preferences
    getPreferences() {
        try {
            const prefs = localStorage.getItem(this.KEYS.PREFERENCES);
            return prefs
                ? JSON.parse(prefs)
                : {
                      speechRate: 0.9,
                      speechPitch: 1,
                      ttsMode: 'manual', // 'sentence', 'word', or 'manual'
                      voiceName: null, // null = auto-select best male voice
                  };
        } catch (e) {
            return { speechRate: 0.9, speechPitch: 1, ttsMode: 'manual', voiceName: null };
        }
    },

    savePreferences(prefs) {
        localStorage.setItem(this.KEYS.PREFERENCES, JSON.stringify(prefs));
    },

    // Keyboard Width
    getKeyboardWidth() {
        try {
            return localStorage.getItem('viraj_keyboard_width') || '14';
        } catch (e) {
            return '14';
        }
    },

    setKeyboardWidth(width) {
        try {
            localStorage.setItem('viraj_keyboard_width', width);
        } catch (e) {
            console.error('Failed to save keyboard width:', e);
        }
    },

    // Prediction Width
    getPredictionWidth() {
        try {
            return localStorage.getItem('viraj_prediction_width') || 'full';
        } catch (e) {
            return 'full';
        }
    },

    setPredictionWidth(width) {
        try {
            localStorage.setItem('viraj_prediction_width', width);
        } catch (e) {
            console.error('Failed to save prediction width:', e);
        }
    },

    // Keyboard Height
    getKeyboardHeight() {
        try {
            return localStorage.getItem('viraj_keyboard_height') || '1.0';
        } catch (e) {
            return '1.0';
        }
    },

    setKeyboardHeight(scale) {
        try {
            localStorage.setItem('viraj_keyboard_height', scale);
        } catch (e) {
            console.error('Failed to save keyboard height:', e);
        }
    },
};

// Global alias for convenience
const Storage = StorageService;
