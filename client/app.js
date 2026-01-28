// Main App - ties all components together

const App = {
    predictionTimeout: null,
    lastPredictionRequest: '',

    init() {
        // Initialize all components
        MessageArea.init();
        Keyboard.init();
        Predictions.init();
        SpeakButton.init();
        ListenToggle.init();

        // Wire up component callbacks
        this.setupCallbacks();

        // Load initial predictions
        this.requestPredictions();
    },

    setupCallbacks() {
        // Keyboard input
        Keyboard.onKeyPress = (char, type) => {
            if (type === 'backspace') {
                MessageArea.backspace();
            } else {
                MessageArea.appendText(char);
            }
        };

        // Message changes trigger prediction updates
        MessageArea.onMessageChange = (message) => {
            this.debouncedPredictions(message);
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
    },

    debouncedPredictions(message) {
        // Debounce prediction requests (500ms delay)
        clearTimeout(this.predictionTimeout);
        this.predictionTimeout = setTimeout(() => {
            this.requestPredictions();
        }, 500);
    },

    async requestPredictions() {
        const partialInput = MessageArea.getMessage();
        const context = ListenToggle.getContext();

        // Skip if same request
        const requestKey = `${partialInput}|${context}`;
        if (requestKey === this.lastPredictionRequest) {
            return;
        }
        this.lastPredictionRequest = requestKey;

        // Show loading state
        Predictions.setLoading(true);

        try {
            const predictions = await ApiService.getPredictions(partialInput, context);
            Predictions.update(predictions);
        } catch (error) {
            console.error('Failed to get predictions:', error);
        } finally {
            Predictions.setLoading(false);
        }
    },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
