// Keyboard Component - handles custom keyboard with 6-row layout

const Keyboard = {
    state: {
        mode: 'letters',  // 'letters' or 'numbers'
        capsLock: false,
        shift: false,
        ctrl: false,
        predictedLetters: []
    },

    // Element references
    letterKeyboard: null,
    numberKeyboard: null,
    punctuationModal: null,
    capsKey: null,
    shiftKey: null,
    ctrlKey: null,
    numKey: null,
    letterKeys: [],

    // Callback
    onKeyPress: null,

    init() {
        this.letterKeyboard = document.getElementById('keyboard');
        this.numberKeyboard = document.getElementById('number-keyboard');
        this.punctuationModal = document.getElementById('punctuation-modal');

        this.capsKey = document.getElementById('caps-key');
        this.shiftKey = document.getElementById('shift-key');
        this.ctrlKey = document.getElementById('ctrl-key');
        this.numKey = document.getElementById('num-key');

        // Get all letter keys for visual updates
        this.letterKeys = document.querySelectorAll('.key-letter');

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
                    this.onKeyPress(char, 'letter', this.state);
                }
            });
        });

        // Close modal on overlay click
        const overlay = this.punctuationModal.querySelector('.modal-overlay');
        overlay.addEventListener('click', () => {
            this.hidePunctuationModal();
        });

        // Prevent double-tap zoom on keyboards
        [this.letterKeyboard, this.numberKeyboard].forEach(keyboard => {
            keyboard.addEventListener('touchend', (e) => {
                e.preventDefault();
                const key = e.target.closest('.key-new');
                if (key) {
                    key.click();
                }
            });
        });
    },

    processKey(keyValue) {
        if (!this.onKeyPress) return;

        // Handle different key types
        switch (keyValue) {
            // Modifiers
            case 'caps':
                this.toggleCaps();
                break;
            case 'shift':
                this.toggleShift();
                break;
            case 'ctrl':
                this.toggleCtrl();
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
            case 'enter':
                this.onKeyPress('\n', 'enter', this.state);
                break;
            case 'tab':
                this.onKeyPress('\t', 'tab', this.state);
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
            if (this.state.capsLock || this.state.shift) {
                char = char.toUpperCase();
            }

            // Reset shift after letter press
            if (this.state.shift) {
                this.resetShift();
            }
        }

        this.onKeyPress(char, 'letter', this.state);
    },

    toggleCaps() {
        this.state.capsLock = !this.state.capsLock;
        this.updateKeyDisplay();
    },

    toggleShift() {
        this.state.shift = !this.state.shift;
        this.updateKeyDisplay();
    },

    resetShift() {
        this.state.shift = false;
        this.updateKeyDisplay();
    },

    toggleCtrl() {
        this.state.ctrl = !this.state.ctrl;
        this.updateKeyDisplay();
    },

    switchToNumbers() {
        this.state.mode = 'numbers';
        this.letterKeyboard.style.display = 'none';
        this.numberKeyboard.style.display = 'flex';
        this.clearPredictionHighlights();
        this.updatePredictionHighlights();
    },

    switchToLetters() {
        this.state.mode = 'letters';
        this.numberKeyboard.style.display = 'none';
        this.letterKeyboard.style.display = 'flex';
        this.clearPredictionHighlights();
        this.updatePredictionHighlights();
    },

    showPunctuationModal() {
        this.punctuationModal.classList.add('active');
    },

    hidePunctuationModal() {
        this.punctuationModal.classList.remove('active');
    },

    setPredictions(letters) {
        this.clearPredictionHighlights();
        this.state.predictedLetters = letters || [];
        this.updatePredictionHighlights();
    },

    clearPredictionHighlights() {
        const allKeys = document.querySelectorAll('.key-predicted');
        allKeys.forEach(key => key.classList.remove('key-predicted'));
    },

    updatePredictionHighlights() {
        if (!this.state.predictedLetters || this.state.predictedLetters.length === 0) {
            return;
        }

        const targetKeyboard = this.state.mode === 'letters' ? this.letterKeyboard : this.numberKeyboard;
        if (!targetKeyboard) return;

        this.state.predictedLetters.forEach(letter => {
            if (!letter) return;
            const normalizedLetter = letter.toLowerCase();
            const key = targetKeyboard.querySelector(`[data-key="${normalizedLetter}"]`);
            if (key && key.classList.contains('key-letter')) {
                key.classList.add('key-predicted');
            }
        });
    },

    updateKeyDisplay() {
        // Update CAPS key visual state
        if (this.capsKey) {
            if (this.state.capsLock) {
                this.capsKey.classList.add('active');
            } else {
                this.capsKey.classList.remove('active');
            }
        }

        // Update SHIFT key visual state
        if (this.shiftKey) {
            if (this.state.shift) {
                this.shiftKey.classList.add('active');
            } else {
                this.shiftKey.classList.remove('active');
            }
        }

        // Update CTRL key visual state
        if (this.ctrlKey) {
            if (this.state.ctrl) {
                this.ctrlKey.classList.add('active');
            } else {
                this.ctrlKey.classList.remove('active');
            }
        }

        // Update letter key display (uppercase/lowercase)
        this.letterKeys.forEach(key => {
            const keyValue = key.dataset.key;
            if (/^[a-z]$/.test(keyValue)) {
                if (this.state.capsLock || this.state.shift) {
                    key.textContent = keyValue.toUpperCase();
                } else {
                    key.textContent = keyValue.toUpperCase(); // Always display uppercase in UI
                }
            }
        });
    },
};
