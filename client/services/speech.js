// Speech Service - handles TTS and STT using Web Speech API

const SpeechService = {
    synthesis: window.speechSynthesis,
    recognition: null,
    isListening: false,
    onTranscript: null,

    init() {
        // Initialize Speech Recognition if available
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                if (this.onTranscript) {
                    this.onTranscript(transcript, event.results[event.results.length - 1].isFinal);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    alert('Microphone access denied. Please allow microphone access to use listening feature.');
                }
            };

            this.recognition.onend = () => {
                // Restart if still supposed to be listening
                if (this.isListening) {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.log('Recognition restart failed:', e);
                    }
                }
            };
        }
    },

    // Get all available voices
    getAvailableVoices() {
        return this.synthesis.getVoices();
    },

    // Get voice by name
    getVoiceByName(name) {
        const voices = this.getAvailableVoices();
        return voices.find(v => v.name === name);
    },

    // Auto-select best male voice (fallback when no preference set)
    selectBestMaleVoice() {
        const voices = this.synthesis.getVoices();
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));

        // Priority order for male voices:
        // 1. Enhanced/Premium male voices
        // 2. Named male voices (David, Daniel, Alex, James, etc.)
        // 3. Any voice with "Male" in the name
        const maleVoice =
            englishVoices.find(v => v.name.includes('Enhanced') && v.name.includes('Male')) ||
            englishVoices.find(v => v.name.includes('Premium') && v.name.includes('Male')) ||
            englishVoices.find(v => v.name.includes('Natural') && v.name.includes('Male')) ||
            englishVoices.find(v => v.name.includes('Google') && v.name.includes('Male')) ||
            englishVoices.find(v => v.name.includes('David')) ||
            englishVoices.find(v => v.name.includes('Daniel')) ||
            englishVoices.find(v => v.name.includes('Alex')) ||
            englishVoices.find(v => v.name.includes('James')) ||
            englishVoices.find(v => v.name.includes('Male'));

        return maleVoice;
    },

    // Text-to-Speech with preferences
    speak(text, customPrefs = null) {
        if (!text) return;

        // Cancel any ongoing speech
        this.synthesis.cancel();

        // Get preferences (use custom if provided, otherwise load from storage)
        const prefs = customPrefs || (typeof StorageService !== 'undefined' ? StorageService.getPreferences() : {
            speechRate: 0.9,
            speechPitch: 1,
            voiceName: null
        });

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = prefs.speechRate || 0.9;
        utterance.pitch = prefs.speechPitch || 1;

        // Select voice based on preference
        let selectedVoice = null;
        if (prefs.voiceName) {
            selectedVoice = this.getVoiceByName(prefs.voiceName);
        }

        // Fallback to auto-selected male voice if no preference or voice not found
        if (!selectedVoice) {
            selectedVoice = this.selectBestMaleVoice();
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log('Using voice:', selectedVoice.name);
        } else {
            console.log('No voice found, using default');
        }

        this.synthesis.speak(utterance);
    },

    // Test voice with sample text
    testVoice(voiceName, rate, pitch) {
        const sampleText = "Hi, this is how I sound. I'm excited to communicate with you.";
        this.speak(sampleText, {
            voiceName: voiceName,
            speechRate: rate,
            speechPitch: pitch
        });
    },

    // Speech-to-Text
    startListening() {
        if (!this.recognition) {
            alert('Speech recognition not supported in this browser.');
            return false;
        }

        try {
            this.recognition.start();
            this.isListening = true;
            return true;
        } catch (e) {
            console.error('Failed to start recognition:', e);
            return false;
        }
    },

    stopListening() {
        if (this.recognition) {
            this.isListening = false;
            this.recognition.stop();
        }
    },

    isRecognitionSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    },

    isSynthesisSupported() {
        return !!window.speechSynthesis;
    },
};

// Initialize on load
SpeechService.init();
