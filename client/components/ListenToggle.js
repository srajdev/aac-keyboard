// ListenToggle Component - handles speech-to-text for conversation context

const ListenToggle = {
    button: null,
    contextText: null,
    contextSection: null,
    isListening: false,
    conversationContext: '',
    onContextUpdate: null,

    init() {
        this.button = document.getElementById('listen-toggle');
        this.contextText = document.getElementById('context-text');
        this.contextSection = document.getElementById('context-section');
        this.contextToggle = document.getElementById('context-toggle');

        // Toggle listening
        this.button.addEventListener('click', () => {
            this.toggle();
        });

        // Toggle context panel visibility
        this.contextToggle.addEventListener('click', () => {
            this.contextSection.classList.toggle('collapsed');
        });

        // Set up speech recognition callback
        SpeechService.onTranscript = (transcript, isFinal) => {
            this.handleTranscript(transcript, isFinal);
        };

        // Check if STT is supported
        if (!SpeechService.isRecognitionSupported()) {
            this.button.disabled = true;
            this.button.querySelector('.listen-text').textContent = 'Not Supported';
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
            this.button.classList.add('active');
            this.button.querySelector('.listen-text').textContent = 'Listen: ON';
            this.contextSection.classList.remove('collapsed');
        }
    },

    stopListening() {
        SpeechService.stopListening();
        this.isListening = false;
        this.button.classList.remove('active');
        this.button.querySelector('.listen-text').textContent = 'Listen: OFF';
    },

    handleTranscript(transcript, isFinal) {
        if (isFinal && transcript.trim()) {
            // Add to conversation context
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.conversationContext = `[${timestamp}] "${transcript}"`;
            this.contextText.textContent = this.conversationContext;

            // Notify app of context update
            if (this.onContextUpdate) {
                this.onContextUpdate(this.conversationContext);
            }
        } else if (!isFinal) {
            // Show interim results
            this.contextText.textContent = transcript + '...';
        }
    },

    getContext() {
        return this.conversationContext;
    },

    clearContext() {
        this.conversationContext = '';
        this.contextText.textContent = 'No conversation captured yet. Tap "Listen" to start.';
    },
};
