// Main App - ties all components together

const App = {
    predictionTimeout: null,
    contextInputTimeout: null,
    lastPredictionRequest: '',
    predictionsEnabled: true, // Default to ON
    selectedModel: 'claude', // Default to Claude
    ttsMode: 'manual', // Default to manual mode
    predictionsToggleBtn: null,
    modelSelector: null,
    ttsModeSelector: null,
    currentPredictionController: null,
    currentRequestIds: [], // For WebSocket request cancellation

    async init() {
        console.log('Initializing Viraj Keyboard...');

        // Initialize WebSocket first
        // Listen for connection state changes BEFORE connecting
        WebSocketService.onConnectionChange((state) => {
            this.handleConnectionChange(state);
        });

        try {
            console.log('Connecting to WebSocket...');
            await WebSocketService.connect();
            console.log('WebSocket connected successfully');
            // Manually trigger indicator update in case callback didn't fire
            this.updateConnectionIndicator('connected');
        } catch (error) {
            console.warn('WebSocket connection failed, will use HTTP fallback:', error);
            this.updateConnectionIndicator('disconnected');
        }

        // Initialize all components
        MessageArea.init();
        Keyboard.init();
        Predictions.init();
        SpeakButton.init();
        ListenToggle.init();
        KeyboardWidthControl.init();
        KeyboardHeightControl.init();
        PredictionWidthControl.init();
        SettingsModal.init();
        ProfileModal.init();
        FeatureRequestModal.init();

        // Get UI elements
        this.predictionsToggleBtn = document.getElementById('predictions-toggle');
        this.modelSelector = document.getElementById('model-selector');
        this.ttsModeSelector = document.getElementById('tts-mode-selector');

        // Load saved preferences
        const saved = StorageService.getPreferences();
        if (saved.predictionsEnabled !== undefined) {
            this.predictionsEnabled = saved.predictionsEnabled;
        }
        if (saved.selectedModel !== undefined) {
            this.selectedModel = saved.selectedModel;
        }
        if (saved.ttsMode !== undefined) {
            this.ttsMode = saved.ttsMode;
        }
        this.updatePredictionsToggleUI();
        this.updateModelSelectorUI();
        this.updateTtsModeUI();

        // Apply saved keyboard layout
        if (saved.keyboardLayout === 'swiftkey') {
            Keyboard.switchToSwiftKey();
        }

        // Update layout selector UI
        const layoutSelector = document.getElementById('layout-selector');
        if (layoutSelector) {
            layoutSelector.value = saved.keyboardLayout || 'traditional';
        }

        // Wire up component callbacks
        this.setupCallbacks();

        // Load initial predictions
        if (this.predictionsEnabled) {
            this.requestPredictions();
        } else {
            Predictions.showDefaults();
        }
    },

    handleConnectionChange(state) {
        console.log('Connection state changed:', state);
        this.updateConnectionIndicator(state);

        // If disconnected, predictions will automatically fall back to HTTP
        if (state === 'error') {
            console.warn('WebSocket permanently failed, using HTTP for this session');
        }
    },

    updateConnectionIndicator(state) {
        const indicator = document.getElementById('ws-status');
        if (!indicator) return;

        const stateConfig = {
            connected: { text: 'WS', color: '#4ade80', title: 'WebSocket connected' },
            connecting: { text: '...', color: '#fbbf24', title: 'WebSocket connecting...' },
            disconnected: { text: '!', color: '#f87171', title: 'WebSocket disconnected, using HTTP' },
            error: { text: 'HTTP', color: '#f87171', title: 'WebSocket failed, using HTTP' }
        };

        const config = stateConfig[state] || stateConfig.disconnected;
        indicator.textContent = config.text;
        indicator.style.color = config.color;
        indicator.title = config.title;
    },

    setupCallbacks() {
        // AI Toggle
        if (this.predictionsToggleBtn) {
            this.predictionsToggleBtn.addEventListener('click', () => {
                this.togglePredictions();
            });
        }

        // Model Selector
        if (this.modelSelector) {
            this.modelSelector.addEventListener('change', (e) => {
                this.selectedModel = e.target.value;
                // Save preference
                const prefs = StorageService.getPreferences();
                prefs.selectedModel = this.selectedModel;
                StorageService.savePreferences(prefs);
                // Request new predictions with selected model
                this.requestPredictions();
            });
        }

        // TTS Mode Selector
        if (this.ttsModeSelector) {
            this.ttsModeSelector.addEventListener('change', (e) => {
                this.ttsMode = e.target.value;
                SpeakButton.setTtsMode(this.ttsMode);
                // Save preference
                const prefs = StorageService.getPreferences();
                prefs.ttsMode = this.ttsMode;
                StorageService.savePreferences(prefs);
            });
        }

        // Voice Selector
        const voiceSelector = document.getElementById('voice-selector');
        if (voiceSelector) {
            // Populate voices (need to wait for voices to load)
            const populateVoices = () => {
                const voices = SpeechService.getAvailableVoices();
                if (voices.length === 0) {
                    // Voices not loaded yet, try again
                    setTimeout(populateVoices, 100);
                    return;
                }

                // Clear existing options (except first "Auto" option)
                while (voiceSelector.options.length > 1) {
                    voiceSelector.remove(1);
                }

                // Group voices by language
                const englishVoices = voices.filter(v => v.lang.startsWith('en'));
                const otherVoices = voices.filter(v => !v.lang.startsWith('en'));

                // Add English voices first
                if (englishVoices.length > 0) {
                    const englishGroup = document.createElement('optgroup');
                    englishGroup.label = 'English Voices';
                    englishVoices.forEach(voice => {
                        const option = document.createElement('option');
                        option.value = voice.name;
                        option.textContent = `${voice.name} (${voice.lang})`;
                        englishGroup.appendChild(option);
                    });
                    voiceSelector.appendChild(englishGroup);
                }

                // Add other languages
                //if (otherVoices.length > 0) {
                //    const otherGroup = document.createElement('optgroup');
                //    otherGroup.label = 'Other Languages';
                //    otherVoices.forEach(voice => {
                //        const option = document.createElement('option');
                //        option.value = voice.name;
                //        option.textContent = `${voice.name} (${voice.lang})`;
                //        otherGroup.appendChild(option);
                //    });
                //    voiceSelector.appendChild(otherGroup);
                //}

                // Load saved preference
                const prefs = StorageService.getPreferences();
                if (prefs.voiceName) {
                    voiceSelector.value = prefs.voiceName;
                }
            };

            // Start populating voices
            populateVoices();

            // Also listen for voiceschanged event (some browsers load voices async)
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = populateVoices;
            }

            // Handle voice selection change
            voiceSelector.addEventListener('change', (e) => {
                const prefs = StorageService.getPreferences();
                prefs.voiceName = e.target.value || null;
                StorageService.savePreferences(prefs);
            });
        }

        // Speech Rate Slider
        const rateSlider = document.getElementById('speech-rate-slider');
        const rateValue = document.getElementById('speech-rate-value');
        if (rateSlider && rateValue) {
            // Load saved value
            const prefs = StorageService.getPreferences();
            rateSlider.value = prefs.speechRate || 0.9;
            rateValue.textContent = `${rateSlider.value}x`;

            // Handle changes
            rateSlider.addEventListener('input', (e) => {
                rateValue.textContent = `${e.target.value}x`;
            });

            rateSlider.addEventListener('change', (e) => {
                const prefs = StorageService.getPreferences();
                prefs.speechRate = parseFloat(e.target.value);
                StorageService.savePreferences(prefs);
            });
        }

        // Speech Pitch Slider
        const pitchSlider = document.getElementById('speech-pitch-slider');
        const pitchValue = document.getElementById('speech-pitch-value');
        if (pitchSlider && pitchValue) {
            // Load saved value
            const prefs = StorageService.getPreferences();
            pitchSlider.value = prefs.speechPitch || 1.0;
            pitchValue.textContent = `${pitchSlider.value}x`;

            // Handle changes
            pitchSlider.addEventListener('input', (e) => {
                pitchValue.textContent = `${e.target.value}x`;
            });

            pitchSlider.addEventListener('change', (e) => {
                const prefs = StorageService.getPreferences();
                prefs.speechPitch = parseFloat(e.target.value);
                StorageService.savePreferences(prefs);
            });
        }

        // Test Voice Button
        const testVoiceBtn = document.getElementById('test-voice-btn');
        if (testVoiceBtn) {
            testVoiceBtn.addEventListener('click', () => {
                const voiceSelector = document.getElementById('voice-selector');
                const rateSlider = document.getElementById('speech-rate-slider');
                const pitchSlider = document.getElementById('speech-pitch-slider');

                const voiceName = voiceSelector.value || null;
                const rate = parseFloat(rateSlider.value);
                const pitch = parseFloat(pitchSlider.value);

                SpeechService.testVoice(voiceName, rate, pitch);
            });
        }

        // Feature Request Toggle
        const featureRequestToggle = document.getElementById('feature-request-toggle');
        if (featureRequestToggle) {
            const prefs = StorageService.getPreferences();
            this.updateFeatureRequestToggleUI(featureRequestToggle, prefs.featureRequestEnabled);

            featureRequestToggle.addEventListener('click', () => {
                const prefs = StorageService.getPreferences();
                prefs.featureRequestEnabled = !prefs.featureRequestEnabled;
                StorageService.savePreferences(prefs);
                this.updateFeatureRequestToggleUI(featureRequestToggle, prefs.featureRequestEnabled);
            });
        }

        // ElevenLabs Toggle
        const elevenLabsToggle = document.getElementById('elevenlabs-toggle');
        if (elevenLabsToggle) {
            // Load saved state
            const prefs = StorageService.getPreferences();
            this.updateElevenLabsToggleUI(elevenLabsToggle, prefs.elevenLabsEnabled);

            // Handle toggle
            elevenLabsToggle.addEventListener('click', () => {
                const prefs = StorageService.getPreferences();
                prefs.elevenLabsEnabled = !prefs.elevenLabsEnabled;
                StorageService.savePreferences(prefs);
                this.updateElevenLabsToggleUI(elevenLabsToggle, prefs.elevenLabsEnabled);
            });
        }

        // Layout selector (in Settings Modal)
        const layoutSelector = document.getElementById('layout-selector');
        if (layoutSelector) {
            layoutSelector.addEventListener('change', (e) => {
                const layout = e.target.value;

                // Switch keyboard layout
                if (layout === 'swiftkey') {
                    Keyboard.switchToSwiftKey();
                } else {
                    Keyboard.switchToTraditional();
                }

                // Save preference
                const prefs = StorageService.getPreferences();
                prefs.keyboardLayout = layout;
                StorageService.savePreferences(prefs);
            });
        }

        // SwiftKey Delete button
        const swiftkeyDeleteBtn = document.getElementById('swiftkey-delete');
        if (swiftkeyDeleteBtn) {
            swiftkeyDeleteBtn.addEventListener('click', () => {
                MessageArea.clear();
            });
        }

        // SwiftKey Speak button
        const swiftkeySpeakBtn = document.getElementById('swiftkey-speak');
        if (swiftkeySpeakBtn) {
            swiftkeySpeakBtn.addEventListener('click', () => {
                SpeakButton.speak();
            });
        }

        // Explicit context input
        const contextInput = document.getElementById('explicit-context-input');
        if (contextInput) {
            contextInput.addEventListener('input', (e) => {
                const context = e.target.value;

                // Debounce context updates
                clearTimeout(this.contextInputTimeout);
                this.contextInputTimeout = setTimeout(() => {
                    ListenToggle.setExplicitContext(context);
                    this.requestPredictions();
                }, 500);
            });
        }

        // Keyboard input - handle all key types
        Keyboard.onKeyPress = (char, type, state) => {
            switch (type) {
                case 'backspace':
                    MessageArea.backspace();
                    break;
                case 'del-word':
                    MessageArea.deleteWord();
                    break;
                case 'letter':
                case 'enter':
                case 'tab':
                    MessageArea.appendText(char);
                    // Auto-speak on sentence delimiters in sentence mode
                    if (this.ttsMode === 'sentence' && (char === '.' || char === '?')) {
                        SpeakButton.speak();
                    }
                    break;
                case 'space':
                    MessageArea.appendText(char);
                    // Auto-speak on sentence delimiters in sentence mode
                    if (this.ttsMode === 'sentence' && (char === '.' || char === '?')) {
                        SpeakButton.speak();
                    }
                    // In word mode, speak the completed word when spacebar is pressed
                    else if (this.ttsMode === 'word') {
                        const completedWord = this.getLastCompletedWord();
                        if (completedWord) {
                            SpeakButton.speakWord(completedWord);
                        }
                    }
                    break;
                case 'phrase':
                    MessageArea.appendPhrase(char);
                    break;
                case 'speak':
                    SpeakButton.speak();
                    break;
                case 'arrow-up':
                    MessageArea.moveCursorToEnd();
                    break;
                case 'arrow-down':
                    MessageArea.moveCursorToStart();
                    break;
                case 'arrow-left':
                    MessageArea.moveCursorToPrevWord();
                    break;
                case 'arrow-right':
                    MessageArea.moveCursorToNextWord();
                    break;
            }
        };

        // Message changes trigger prediction updates (only on text changes, not cursor moves)
        MessageArea.onMessageChange = (message, textChanged) => {
            if (textChanged) {
                this.debouncedPredictions(message);
                // Update keyboard display to reflect auto-capitalization state
                Keyboard.updateKeyDisplay();
            }
        };

        // Prediction selections
        Predictions.onPhraseSelect = (phrase) => {
            MessageArea.appendPhrase(phrase);
            // In word mode, speak the phrase
            if (this.ttsMode === 'word') {
                SpeakButton.speakWord(phrase);
            }
        };

        Predictions.onWordSelect = (word) => {
            MessageArea.appendWord(word);
            // In word mode, speak the word
            if (this.ttsMode === 'word') {
                SpeakButton.speakWord(word);
            }
        };

        // Speak button gets message
        SpeakButton.getMessage = () => MessageArea.getMessage();

        // Context updates trigger predictions
        ListenToggle.onContextUpdate = (context) => {
            this.requestPredictions();
        };

        // Profile button
        const profileBtn = document.getElementById('profile-btn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                ProfileModal.open();
            });
        }

        // Feature Request button
        const featureRequestBtn = document.getElementById('feature-request-btn');
        if (featureRequestBtn) {
            featureRequestBtn.addEventListener('click', () => {
                FeatureRequestModal.open();
            });
        }

        // Profile changes trigger cache clear and new predictions
        ProfileModal.onProfileChange = (profile) => {
            console.log('Profile updated, clearing cache and refreshing predictions');
            // Clear the last request key to force new predictions
            this.lastPredictionRequest = '';
            // Request new predictions
            if (this.predictionsEnabled) {
                this.requestPredictions();
            }
        };
    },

    togglePredictions() {
        this.predictionsEnabled = !this.predictionsEnabled;
        this.updatePredictionsToggleUI();

        // Save preference
        const prefs = StorageService.getPreferences();
        prefs.predictionsEnabled = this.predictionsEnabled;
        StorageService.savePreferences(prefs);

        // Request predictions if just enabled
        if (this.predictionsEnabled) {
            this.requestPredictions();
        } else {
            Predictions.showDefaults();
        }
    },

    updatePredictionsToggleUI() {
        if (!this.predictionsToggleBtn) return;

        if (this.predictionsEnabled) {
            this.predictionsToggleBtn.classList.add('active');
            this.predictionsToggleBtn.querySelector('.toggle-text').textContent = 'AI: ON';
        } else {
            this.predictionsToggleBtn.classList.remove('active');
            this.predictionsToggleBtn.querySelector('.toggle-text').textContent = 'AI: OFF';
        }
    },

    updateModelSelectorUI() {
        if (!this.modelSelector) return;
        this.modelSelector.value = this.selectedModel;
    },

    updateTtsModeUI() {
        if (!this.ttsModeSelector) return;
        this.ttsModeSelector.value = this.ttsMode;
    },

    updateElevenLabsToggleUI(toggleBtn, enabled) {
        if (!toggleBtn) return;

        if (enabled) {
            toggleBtn.classList.add('active');
            toggleBtn.querySelector('.toggle-text').textContent = 'ElevenLabs: ON';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.querySelector('.toggle-text').textContent = 'ElevenLabs: OFF';
        }
    },

    updateFeatureRequestToggleUI(toggleBtn, enabled) {
        if (!toggleBtn) return;
        const btn = document.getElementById('feature-request-btn');

        if (enabled) {
            toggleBtn.classList.add('active');
            toggleBtn.querySelector('.toggle-text').textContent = 'Request Changes: ON';
            if (btn) btn.style.display = '';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.querySelector('.toggle-text').textContent = 'Request Changes: OFF';
            if (btn) btn.style.display = 'none';
        }
    },

    getLastCompletedWord() {
        // Get the word that was just completed (before the space that was just typed)
        const message = MessageArea.getMessage();
        if (!message || message.length === 0) return '';

        // Remove trailing space(s) and get the last word
        const trimmed = message.trimEnd();
        if (trimmed.length === 0) return '';

        const words = trimmed.split(/\s+/);
        return words[words.length - 1] || '';
    },

    debouncedPredictions(message) {
        // Debounce prediction requests (500ms delay)
        clearTimeout(this.predictionTimeout);
        this.predictionTimeout = setTimeout(() => {
            this.requestPredictions();
        }, 500);
    },

    countWords(text) {
        if (!text || !text.trim()) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    },

    shouldRequestPhrases(partialInput, context) {
        const hasContext = context && context.trim().length > 0;
        const wordCount = this.countWords(partialInput);
        return hasContext || wordCount >= 3;
    },

    async requestPredictions() {
        // Skip if predictions are disabled
        if (!this.predictionsEnabled) {
            return;
        }

        const partialInput = MessageArea.getTextBeforeCursor();
        const context = ListenToggle.getContext();

        // Check if we should request phrases
        const shouldRequestPhrases = this.shouldRequestPhrases(partialInput, context);
        const wordCount = this.countWords(partialInput);

        // Skip if same request (include phrase gating state in key)
        const requestKey = `${partialInput}|${context}|${shouldRequestPhrases}`;
        if (requestKey === this.lastPredictionRequest) {
            return;
        }
        this.lastPredictionRequest = requestKey;

        // Cancel previous requests
        if (WebSocketService.isConnected()) {
            // Cancel via WebSocket
            if (this.currentRequestIds && this.currentRequestIds.length > 0) {
                WebSocketService.cancelRequests(this.currentRequestIds);
                this.currentRequestIds = [];
            }
        } else {
            // Cancel via AbortController (HTTP fallback)
            if (this.currentPredictionController) {
                this.currentPredictionController.abort();
            }
        }

        // Generate new request IDs for WebSocket tracking
        const wordsRequestId = this._generateRequestId();
        const phrasesRequestId = this._generateRequestId();
        this.currentRequestIds = [wordsRequestId, phrasesRequestId];

        // Create new AbortController for HTTP fallback
        this.currentPredictionController = new AbortController();
        const signal = this.currentPredictionController.signal;

        // Show loading state
        Predictions.setLoading(true);

        // Set up streaming callbacks for incremental updates
        ApiService.onWordsUpdate = (words) => {
            if (!signal.aborted) {
                Predictions.updateWordsIncremental(words);
            }
        };

        ApiService.onPhrasesUpdate = (phrases) => {
            if (!signal.aborted) {
                Predictions.updatePhrasesIncremental(phrases);
            }
        };

        try {
            // Make parallel requests for words and phrases (words requested first for priority)
            const wordsPromise = ApiService.getWords(partialInput, context, signal, this.selectedModel);

            // Gate phrase requests based on context availability and word count
            let phrasesPromise;
            if (shouldRequestPhrases) {
                phrasesPromise = ApiService.getPhrases(partialInput, context, signal, this.selectedModel);
            } else {
                // Show placeholder immediately
                const hasContext = context && context.trim().length > 0;
                Predictions.showPhrasePlaceholder(wordCount, hasContext);
                // Return resolved promise with empty array
                phrasesPromise = Promise.resolve([]);
            }

            // Track completion for loading state
            let phrasesComplete = false;
            let wordsComplete = false;

            const checkComplete = () => {
                if (phrasesComplete && wordsComplete && !signal.aborted) {
                    Predictions.setLoading(false);
                    // Finalize streaming animations
                    Predictions.finalizeStreaming();
                }
            };

            // Update phrases as soon as they arrive
            phrasesPromise
                .then(phrases => {
                    if (!signal.aborted) {
                        // Only update if we actually requested phrases
                        if (shouldRequestPhrases) {
                            Predictions.updatePhrases(phrases);
                        }
                        phrasesComplete = true;
                        checkComplete();
                    }
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('Failed to get phrase predictions:', error);
                    }
                    phrasesComplete = true;
                    checkComplete();
                });

            // Update words as soon as they arrive
            wordsPromise
                .then(words => {
                    if (!signal.aborted) {
                        // Inject current word being typed as first word prediction (if it exists)
                        const currentWord = MessageArea.getCurrentWord();
                        if (currentWord && currentWord.length > 0) {
                            // Add current word as first prediction if not already present
                            if (!words.includes(currentWord)) {
                                words.unshift(currentWord);
                                // Keep only first 6 words
                                words = words.slice(0, 6);
                            }
                        }

                        Predictions.updateWords(words);
                        wordsComplete = true;
                        checkComplete();
                    }
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('Failed to get word predictions:', error);
                    }
                    wordsComplete = true;
                    checkComplete();
                });

            // Wait for both to complete (for error handling)
            await Promise.all([phrasesPromise, wordsPromise]);

        } catch (error) {
            // Ignore abort errors - they're expected when canceling
            if (error.name === 'AbortError') {
                return;
            }
            console.error('Failed to get predictions:', error);
            // Clear loading state on error
            if (!signal.aborted) {
                Predictions.setLoading(false);
            }
        }
    },

    _generateRequestId() {
        // Fallback UUID generator for browsers that don't support crypto.randomUUID
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback: generate a simple unique ID
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
