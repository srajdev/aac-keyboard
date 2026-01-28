// Keyboard Component - handles virtual keyboard input

const Keyboard = {
    onKeyPress: null,

    init() {
        const keyboard = document.getElementById('keyboard');

        keyboard.addEventListener('click', (e) => {
            const key = e.target.closest('.key');
            if (!key) return;

            const keyValue = key.dataset.key;

            // Visual feedback
            key.style.transform = 'scale(0.95)';
            setTimeout(() => {
                key.style.transform = '';
            }, 100);

            this.handleKeyPress(keyValue);
        });

        // Prevent double-tap zoom on keyboard
        keyboard.addEventListener('touchend', (e) => {
            e.preventDefault();
            const key = e.target.closest('.key');
            if (key) {
                key.click();
            }
        });
    },

    handleKeyPress(keyValue) {
        if (!this.onKeyPress) return;

        switch (keyValue) {
            case 'space':
                this.onKeyPress(' ', 'space');
                break;
            case 'backspace':
                this.onKeyPress(null, 'backspace');
                break;
            default:
                this.onKeyPress(keyValue, 'letter');
                break;
        }
    },
};
