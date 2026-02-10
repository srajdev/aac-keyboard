// Main App - ties all components together

const App = {
    predictionTimeout: null,
    contextInputTimeout: null,
    lastPredictionRequest: '',
    predictionsEnabled: true, // Default to ON
    selectedModel: 'claude', // Default to Claude
    predictionsToggleBtn: null,
    modelSelector: null,
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
        PredictionWidthControl.init();
        SettingsModal.init();

        // Get UI elements
        this.predictionsToggleBtn = document.getElementById('predictions-toggle');
        this.modelSelector = document.getElementById('model-selector');

        // Load saved preferences
        const saved = StorageService.getPreferences();
        if (saved.predictionsEnabled !== undefined) {
            this.predictionsEnabled = saved.predictionsEnabled;
        }
        if (saved.selectedModel !== undefined) {
            this.selectedModel = saved.selectedModel;
        }
        this.updatePredictionsToggleUI();
        this.updateModelSelectorUI();

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
                case 'space':
                case 'enter':
                case 'tab':
                    MessageArea.appendText(char);
                    // Auto-speak on sentence delimiters (. or ?)
                    if (char === '.' || char === '?') {
                        SpeakButton.speak();
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
            }
        };

        // Prediction selections
        Predictions.onPhraseSelect = (phrase) => {
            MessageArea.appendPhrase(phrase);
        };

        Predictions.onWordSelect = (word) => {
            MessageArea.appendWord(word);
        };

        // Speak button gets message
        SpeakButton.getMessage = () => MessageArea.getMessage();

        // Context updates trigger predictions
        ListenToggle.onContextUpdate = (context) => {
            this.requestPredictions();
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

        const partialInput = MessageArea.getMessage();
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
        return crypto.randomUUID();
    },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
