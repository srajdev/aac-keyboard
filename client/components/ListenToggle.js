// ListenToggle Component - handles speech-to-text for conversation context

const ListenToggle = {
    button: null,
    contextText: null,
    contextSection: null,
    contextToggle: null,
    isListening: false,
    conversationContext: '',
    explicitContext: '',
    onContextUpdate: null,

    init() {
        this.button = document.getElementById('listen-toggle');
        this.contextText = document.getElementById('context-text');
        this.contextSection = document.getElementById('context-section');
        this.contextToggle = document.getElementById('context-toggle');

        // Toggle listening
        if (this.button) {
            this.button.addEventListener('click', () => {
                this.toggle();
            });
        }

        // Toggle context panel visibility
        if (this.contextToggle) {
            this.contextToggle.addEventListener('click', () => {
                this.contextSection.classList.toggle('collapsed');
            });
        }

        // Set up speech recognition callback
        SpeechService.onTranscript = (transcript, isFinal) => {
            this.handleTranscript(transcript, isFinal);
        };

        // Check if STT is supported
        if (!SpeechService.isRecognitionSupported()) {
            console.warn('Speech recognition not supported in this browser');
            if (this.button) {
                this.button.disabled = true;
                this.button.querySelector('.toggle-text').textContent = 'Not Supported';
            }
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
            if (this.button) {
                this.button.classList.add('active', 'listening');
                this.button.querySelector('.toggle-text').textContent = 'Listen: ON';
            }
            // Expand context panel
            if (this.contextSection) {
                this.contextSection.classList.remove('collapsed');
            }
        }
    },

    stopListening() {
        SpeechService.stopListening();
        this.isListening = false;
        if (this.button) {
            this.button.classList.remove('active', 'listening');
            this.button.querySelector('.toggle-text').textContent = 'Listen: OFF';
        }
    },

    handleTranscript(transcript, isFinal) {
        if (isFinal && transcript.trim()) {
            // Add to conversation context
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.conversationContext = `[${timestamp}] "${transcript}"`;

            // Update UI
            if (this.contextText) {
                this.contextText.textContent = this.conversationContext;
            }

            // Notify app of context update
            if (this.onContextUpdate) {
                this.onContextUpdate(this.conversationContext);
            }
        } else if (!isFinal && this.contextText) {
            // Show interim results
            this.contextText.textContent = transcript + '...';
        }
    },

    getContext() {
        // Combine conversation context and explicit context
        const parts = [];
        if (this.conversationContext) {
            // Clean the conversation context: remove timestamp [HH:MM] and quotes
            const cleaned = this.cleanContextText(this.conversationContext);
            if (cleaned) {
                parts.push(cleaned);
            }
        }
        if (this.explicitContext) {
            parts.push(this.explicitContext);
        }
        return parts.join(' | ');
    },

    cleanContextText(text) {
        // Remove timestamps like [12:34] and surrounding quotes
        // Example: '[12:34] "hello there"' -> 'hello there'
        return text
            .replace(/\[\d{1,2}:\d{2}\]\s*/g, '') // Remove [HH:MM] timestamps
            .replace(/^["'\s]+|["'\s]+$/g, '')     // Remove leading/trailing quotes and spaces
            .trim();
    },

    setExplicitContext(context) {
        this.explicitContext = context;
    },

    clearContext() {
        this.conversationContext = '';
        this.explicitContext = '';
        if (this.contextText) {
            this.contextText.textContent = 'No conversation captured yet. Tap "Listen" to start.';
        }
    },
};
