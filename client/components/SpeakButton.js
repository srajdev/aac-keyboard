// SpeakButton Component - handles text-to-speech functionality

const SpeakButton = {
    button: null,
    getMessage: null,

    init() {
        this.button = document.getElementById('speak-btn');

        this.button.addEventListener('click', () => {
            this.speak();
        });

        // Check if TTS is supported
        if (!SpeechService.isSynthesisSupported()) {
            this.button.disabled = true;
            this.button.textContent = 'TTS Not Supported';
        }
    },

    speak() {
        if (!this.getMessage) return;

        const message = this.getMessage();
        if (message && message.trim()) {
            // Visual feedback
            this.button.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.button.style.transform = '';
            }, 200);

            // Speak the message
            SpeechService.speak(message);

            // Save to history
            StorageService.addToHistory(message);
        }
    },
};
