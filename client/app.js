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

    init() {
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

    async requestPredictions() {
        // Skip if predictions are disabled
        if (!this.predictionsEnabled) {
            return;
        }

        const partialInput = MessageArea.getMessage();
        const context = ListenToggle.getContext();

        // Skip if same request
        const requestKey = `${partialInput}|${context}`;
        if (requestKey === this.lastPredictionRequest) {
            return;
        }
        this.lastPredictionRequest = requestKey;

        // Cancel any in-flight prediction request
        if (this.currentPredictionController) {
            this.currentPredictionController.abort();
        }

        // Create new abort controller for this request
        this.currentPredictionController = new AbortController();
        const signal = this.currentPredictionController.signal;

        // Show loading state
        Predictions.setLoading(true);

        try {
            const predictions = await ApiService.getPredictions(partialInput, context, signal, this.selectedModel);

            // Inject current word being typed as first word prediction (if it exists)
            const currentWord = MessageArea.getCurrentWord();
            if (currentWord && currentWord.length > 0) {
                // Add current word as first prediction if not already present
                if (!predictions.words || !predictions.words.includes(currentWord)) {
                    predictions.words = predictions.words || [];
                    predictions.words.unshift(currentWord);
                    // Keep only first 6 words
                    predictions.words = predictions.words.slice(0, 6);
                }
            }

            Predictions.update(predictions);
        } catch (error) {
            // Ignore abort errors - they're expected when canceling
            if (error.name === 'AbortError') {
                return;
            }
            console.error('Failed to get predictions:', error);
        } finally {
            // Only clear loading if this request wasn't aborted
            if (!signal.aborted) {
                Predictions.setLoading(false);
            }
        }
    },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
