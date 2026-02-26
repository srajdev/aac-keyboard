// Keyboard Component - handles custom keyboard with 6-row layout

const Keyboard = {
    state: {
        mode: 'letters',  // 'letters' or 'numbers'
        shift: false,
        layout: 'traditional'  // 'traditional' or 'swiftkey'
    },

    // Element references
    letterKeyboard: null,
    numberKeyboard: null,
    swiftkeyKeyboard: null,
    punctuationModal: null,
    shiftKey: null,
    numKey: null,
    letterKeys: [],

    // Callback
    onKeyPress: null,

    init() {
        this.letterKeyboard = document.getElementById('keyboard');
        this.numberKeyboard = document.getElementById('number-keyboard');
        this.swiftkeyKeyboard = document.getElementById('keyboard-swiftkey');
        this.punctuationModal = document.getElementById('punctuation-modal');

        this.shiftKey = document.getElementById('shift-key');
        this.numKey = document.getElementById('num-key');

        // Get all letter keys for visual updates
        this.letterKeys = document.querySelectorAll('.key-letter');

        // Load saved layout
        const prefs = StorageService.getPreferences();
        this.state.layout = prefs.keyboardLayout || 'traditional';

        // Set up letter keyboard click handlers
        this.letterKeyboard.addEventListener('click', (e) => {
            const key = e.target.closest('.key-new');
            if (!key) return;

            const keyValue = key.dataset.key;
            this.processKey(keyValue);
        });

        // Set up number keyboard click handlers
        this.numberKeyboard.addEventListener('click', (e) => {
            const key = e.target.closest('.key-new');
            if (!key) return;

            const keyValue = key.dataset.key;
            this.processKey(keyValue);
        });

        // Set up punctuation modal handlers
        const punctBtns = this.punctuationModal.querySelectorAll('.punct-btn');
        punctBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const char = btn.dataset.char;
                this.hidePunctuationModal();
                if (this.onKeyPress) {
                    // Insert the punctuation character
                    this.onKeyPress(char, 'letter', this.state);
                    // Automatically add a space after punctuation
                    this.onKeyPress(' ', 'space', this.state);
                }
            });
        });

        // Close modal on overlay click
        const overlay = this.punctuationModal.querySelector('.modal-overlay');
        overlay.addEventListener('click', () => {
            this.hidePunctuationModal();
        });

        // SwiftKey keyboard click handlers
        if (this.swiftkeyKeyboard) {
            this.swiftkeyKeyboard.addEventListener('click', (e) => {
                const key = e.target.closest('.key-new');
                if (!key) return;

                const keyValue = key.dataset.key;
                this.processKey(keyValue);
            });
        }

        // Prevent double-tap zoom on keyboards
        [this.letterKeyboard, this.numberKeyboard, this.swiftkeyKeyboard].forEach(keyboard => {
            if (keyboard) {
                keyboard.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    const key = e.target.closest('.key-new');
                    if (key) {
                        key.click();
                    }
                });
            }
        });
    },

    processKey(keyValue) {
        if (!this.onKeyPress) return;

        // Handle different key types
        switch (keyValue) {
            // Modifiers
            case 'shift':
                this.toggleShift();
                break;
            case '123':
                this.switchToNumbers();
                break;
            case 'abc':
                this.switchToLetters();
                break;

            // Actions
            case 'backspace':
                this.onKeyPress(null, 'backspace', this.state);
                break;
            case 'del-word':
                this.onKeyPress(null, 'del-word', this.state);
                break;
            case 'space':
                this.onKeyPress(' ', 'space', this.state);
                break;
            case 'speak':
                this.onKeyPress(null, 'speak', this.state);
                break;

            // Arrows
            case 'arrow-up':
                this.onKeyPress(null, 'arrow-up', this.state);
                break;
            case 'arrow-down':
                this.onKeyPress(null, 'arrow-down', this.state);
                break;
            case 'arrow-left':
                this.onKeyPress(null, 'arrow-left', this.state);
                break;
            case 'arrow-right':
                this.onKeyPress(null, 'arrow-right', this.state);
                break;

            // Quick phrase
            case 'phrase-goof':
                this.onKeyPress('SORRY, I GOOFED UP!', 'phrase', this.state);
                break;

            // Punctuation
            case 'punct-menu':
                this.showPunctuationModal();
                break;
            case 'period':
                this.onKeyPress('.', 'letter', this.state);
                break;

            // Letters and numbers
            default:
                this.handleLetterOrNumber(keyValue);
                break;
        }
    },

    handleLetterOrNumber(keyValue) {
        let char = keyValue;

        // Apply case transformation for letters
        if (this.state.mode === 'letters' && /^[a-z]$/.test(char)) {
            if (this.state.shift) {
                char = char.toUpperCase();
            }

            // Reset shift after letter press
            if (this.state.shift) {
                this.resetShift();
            }
        }

        this.onKeyPress(char, 'letter', this.state);
    },

    toggleShift() {
        this.state.shift = !this.state.shift;
        this.updateKeyDisplay();
    },

    resetShift() {
        this.state.shift = false;
        this.updateKeyDisplay();
    },

    switchToNumbers() {
        this.state.mode = 'numbers';

        if (this.state.layout === 'swiftkey') {
            // SwiftKey already has numbers on row 1, no-op
            return;
        }

        this.letterKeyboard.style.display = 'none';
        this.numberKeyboard.style.display = 'flex';
    },

    switchToLetters() {
        this.state.mode = 'letters';
        this.numberKeyboard.style.display = 'none';
        this.letterKeyboard.style.display = 'flex';
    },

    showPunctuationModal() {
        this.punctuationModal.classList.add('active');
    },

    hidePunctuationModal() {
        this.punctuationModal.classList.remove('active');
    },

    updateKeyDisplay() {
        // Update SHIFT key visual state (traditional)
        if (this.shiftKey) {
            if (this.state.shift) {
                this.shiftKey.classList.add('active');
            } else {
                this.shiftKey.classList.remove('active');
            }
        }

        // Update SHIFT key visual state (SwiftKey)
        const shiftKeySwiftkey = document.getElementById('shift-key-swiftkey');
        if (shiftKeySwiftkey) {
            if (this.state.shift) {
                shiftKeySwiftkey.classList.add('active');
            } else {
                shiftKeySwiftkey.classList.remove('active');
            }
        }

        // Letter keys always display as uppercase in UI
        this.letterKeys.forEach(key => {
            const keyValue = key.dataset.key;
            if (/^[a-z]$/.test(keyValue)) {
                key.textContent = keyValue.toUpperCase();
            }
        });

        // Update SwiftKey letter keys
        const swiftkeyLetterKeys = document.querySelectorAll('.key-letter-swiftkey');
        swiftkeyLetterKeys.forEach(key => {
            const keyValue = key.dataset.key;
            if (/^[a-z]$/.test(keyValue)) {
                key.textContent = keyValue.toUpperCase();
            }
        });
    },

    switchToSwiftKey() {
        console.log('[Keyboard] switchToSwiftKey called');
        this.state.layout = 'swiftkey';
        this.letterKeyboard.style.display = 'none';
        this.numberKeyboard.style.display = 'none';
        this.swiftkeyKeyboard.style.display = 'flex';

        // Update predictions layout
        console.log('[Keyboard] Calling Predictions.switchLayout');
        Predictions.switchLayout('swiftkey');
    },

    switchToTraditional() {
        this.state.layout = 'traditional';
        this.swiftkeyKeyboard.style.display = 'none';
        this.letterKeyboard.style.display = 'flex';

        // Update predictions layout
        Predictions.switchLayout('traditional');
    }
};
