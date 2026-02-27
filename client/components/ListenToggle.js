// ListenToggle Component - handles speech-to-text for conversation context

const ListenToggle = {
    button: null,
    quickButton: null,
    contextText: null,
    contextSection: null,
    isListening: false,
    conversationContext: '',
    explicitContext: '',
    onContextUpdate: null,

    init() {
        this.button = document.getElementById('listen-toggle');
        this.quickButton = document.getElementById('quick-listen-toggle');
        this.contextText = document.getElementById('context-text');
        this.contextSection = document.getElementById('context-section');

        // Toggle listening (settings button)
        if (this.button) {
            this.button.addEventListener('click', () => {
                this.toggle();
            });
        }

        // Toggle listening (quick access button)
        if (this.quickButton) {
            this.quickButton.addEventListener('click', () => {
                this.toggle();
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
            if (this.quickButton) {
                this.quickButton.disabled = true;
                this.quickButton.querySelector('.settings-text').textContent = 'Not Supported';
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
            // Update settings button
            if (this.button) {
                this.button.classList.add('active', 'listening');
                this.button.querySelector('.toggle-text').textContent = 'Listen: ON';
            }
            // Update quick access button
            if (this.quickButton) {
                this.quickButton.classList.add('active', 'listening');
                this.quickButton.querySelector('.settings-text').textContent = 'Listen: ON';
            }
        }
    },

    stopListening() {
        SpeechService.stopListening();
        this.isListening = false;

        // Clear conversation context when turning off
        this.conversationContext = '';
        if (this.contextText) {
            this.contextText.textContent = 'No conversation captured yet. Tap "Listen" to start.';
        }

        // Update settings button
        if (this.button) {
            this.button.classList.remove('active', 'listening');
            this.button.querySelector('.toggle-text').textContent = 'Listen: OFF';
        }
        // Update quick access button
        if (this.quickButton) {
            this.quickButton.classList.remove('active', 'listening');
            this.quickButton.querySelector('.settings-text').textContent = 'Listen: OFF';
        }

        // Notify app that context changed (now empty)
        if (this.onContextUpdate) {
            this.onContextUpdate('');
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
        // Combine conversation context and explicit context with clear labels
        const parts = [];

        if (this.explicitContext && this.explicitContext.trim()) {
            // Explicit context describes Viraj's environment/situation
            parts.push(`Viraj's situation: ${this.explicitContext.trim()}`);
        }

        // Only include conversation context if listening is currently ON
        if (this.isListening && this.conversationContext) {
            // Clean the conversation context: remove timestamp [HH:MM] and quotes
            const cleaned = this.cleanContextText(this.conversationContext);
            if (cleaned) {
                // Conversation context is what others are saying around Viraj
                parts.push(`What others said: "${cleaned}"`);
            }
        }

        return parts.join('\n');
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
