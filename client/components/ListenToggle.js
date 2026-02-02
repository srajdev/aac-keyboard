// ListenToggle Component - handles speech-to-text for conversation context

const ListenToggle = {
    isListening: false,
    conversationContext: '',
    explicitContext: '',
    onContextUpdate: null,

    init() {
        // Set up speech recognition callback
        SpeechService.onTranscript = (transcript, isFinal) => {
            this.handleTranscript(transcript, isFinal);
        };

        // Check if STT is supported
        if (!SpeechService.isRecognitionSupported()) {
            console.warn('Speech recognition not supported in this browser');
        }
    },

    toggle() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    },

    startListening() {
        if (SpeechService.startListening()) {
            this.isListening = true;
            console.log('Started listening for conversation context');
        }
    },

    stopListening() {
        SpeechService.stopListening();
        this.isListening = false;
        console.log('Stopped listening');
    },

    handleTranscript(transcript, isFinal) {
        if (isFinal && transcript.trim()) {
            // Add to conversation context
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.conversationContext = `[${timestamp}] "${transcript}"`;

            console.log('Captured context:', this.conversationContext);

            // Notify app of context update
            if (this.onContextUpdate) {
                this.onContextUpdate(this.conversationContext);
            }
        } else if (!isFinal) {
            // Show interim results in console
            console.log('Interim transcript:', transcript);
        }
    },

    getContext() {
        // Combine conversation context and explicit context
        const parts = [];
        if (this.conversationContext) {
            parts.push(this.conversationContext);
        }
        if (this.explicitContext) {
            parts.push(`Context: ${this.explicitContext}`);
        }
        return parts.join(' | ');
    },

    setExplicitContext(context) {
        this.explicitContext = context;
    },

    clearContext() {
        this.conversationContext = '';
        this.explicitContext = '';
    },
};
