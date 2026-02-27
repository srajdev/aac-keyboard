// Storage Service - handles local storage for preferences and history

const StorageService = {
    KEYS: {
        MESSAGE_HISTORY: 'viraj_message_history',
        PREFERENCES: 'viraj_preferences',
        FREQUENT_PHRASES: 'viraj_frequent_phrases',
        USER_PROFILE: 'viraj_user_profile',
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
            // Default preferences
            const defaults = {
                speechRate: 0.9,
                speechPitch: 1,
                ttsMode: 'manual', // 'sentence', 'word', or 'manual'
                voiceName: null, // null = auto-select best male voice
                elevenLabsEnabled: true, // Auto-enable since we have the key configured
                elevenLabsApiKey: '',
                elevenLabsVoiceId: 'CwhRBWXzGAHq8TQ4Fs17',
            };

            const saved = localStorage.getItem(this.KEYS.PREFERENCES);
            if (!saved) {
                // No saved prefs - use defaults with config values
                return {
                    ...defaults,
                    elevenLabsApiKey: window.CONFIG?.ELEVENLABS_API_KEY || '',
                    elevenLabsVoiceId: window.CONFIG?.ELEVENLABS_VOICE_ID || 'CwhRBWXzGAHq8TQ4Fs17',
                };
            }

            // Merge saved preferences with defaults to ensure all fields exist
            const savedPrefs = JSON.parse(saved);
            const merged = { ...defaults, ...savedPrefs };

            // IMPORTANT: Always override with config values if they exist
            // This ensures config.js takes priority over localStorage
            if (window.CONFIG?.ELEVENLABS_API_KEY) {
                merged.elevenLabsApiKey = window.CONFIG.ELEVENLABS_API_KEY;
            }
            if (window.CONFIG?.ELEVENLABS_VOICE_ID) {
                merged.elevenLabsVoiceId = window.CONFIG.ELEVENLABS_VOICE_ID;
            }

            return merged;
        } catch (e) {
            return {
                speechRate: 0.9,
                speechPitch: 1,
                ttsMode: 'manual',
                voiceName: null,
                elevenLabsEnabled: true,
                elevenLabsApiKey: window.CONFIG?.ELEVENLABS_API_KEY || '',
                elevenLabsVoiceId: window.CONFIG?.ELEVENLABS_VOICE_ID || 'CwhRBWXzGAHq8TQ4Fs17',
            };
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

    // User Profile
    getUserProfile() {
        try {
            const profile = localStorage.getItem(this.KEYS.USER_PROFILE);
            const result = profile
                ? JSON.parse(profile)
                : {
                      name: '',
                      age: '',
                      details: [],
                      lastUpdated: null,
                  };
            console.log('[Storage] getUserProfile called, returning:', result);
            return result;
        } catch (e) {
            console.error('Failed to load user profile:', e);
            return {
                name: '',
                age: '',
                details: [],
                lastUpdated: null,
            };
        }
    },

    saveUserProfile(profile) {
        try {
            console.log('[Storage] saveUserProfile called with:', profile);
            // Validate profile structure
            const validProfile = {
                name: (profile.name || '').trim().slice(0, 100),
                age: (profile.age || '').trim().slice(0, 20),
                details: Array.isArray(profile.details)
                    ? profile.details.map((d) => d.trim()).filter(Boolean).slice(0, 30)
                    : [],
                lastUpdated: Date.now(),
            };
            console.log('[Storage] Validated profile:', validProfile);
            localStorage.setItem(this.KEYS.USER_PROFILE, JSON.stringify(validProfile));
            console.log('[Storage] Profile saved to localStorage successfully');
            return validProfile;
        } catch (e) {
            console.error('Failed to save user profile:', e);
            throw e;
        }
    },
};

// Global alias for convenience
const Storage = StorageService;
