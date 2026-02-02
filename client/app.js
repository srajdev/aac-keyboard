// Main App - ties all components together

const App = {
    predictionTimeout: null,
    lastPredictionRequest: '',
    predictionsEnabled: true, // Default to ON for new layout
    currentPredictionController: null,

    init() {
        // Initialize all components
        MessageArea.init();
        Keyboard.init();
        Predictions.init();
        SpeakButton.init();
        ListenToggle.init();
        ExplicitContext.init();

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
                    break;
                case 'phrase':
                    MessageArea.appendPhrase(char);
                    break;
                case 'speak':
                    SpeakButton.speak();
                    break;
                case 'arrow-up':
                    MessageArea.moveCursorToStart();
                    break;
                case 'arrow-down':
                    MessageArea.moveCursorToEnd();
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

        Predictions.onLetterSelect = (letter) => {
            MessageArea.appendLetter(letter);
        };

        // Speak button gets message
        SpeakButton.getMessage = () => MessageArea.getMessage();

        // Context updates trigger predictions
        ListenToggle.onContextUpdate = (context) => {
            this.requestPredictions();
        };

        // Explicit context save triggers predictions
        ExplicitContext.onContextSave = (context) => {
            ListenToggle.setExplicitContext(context);
            this.requestPredictions();
        };

        // Wire "WHAT I HEARD" button to toggle listening
        const whatIHeardBtn = document.getElementById('what-i-heard-btn');
        if (whatIHeardBtn) {
            whatIHeardBtn.addEventListener('click', () => {
                ListenToggle.toggle();
            });
        }
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
            const predictions = await ApiService.getPredictions(partialInput, context, signal);
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
