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

        // Initialize 123 button state based on number row visibility
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
            this.syncNumberRowState();
            // Also sync key display (letter case) on init
            this.updateKeyDisplay();
        }, 0);
    },

    syncNumberRowState() {
        // Check if number row is visible and sync button state
        let numberRow;
        let numButton;

        if (this.state.layout === 'swiftkey') {
            numberRow = document.querySelector('#keyboard-swiftkey .keyboard-row-new:nth-child(3)');
            numButton = document.querySelector('#keyboard-swiftkey [data-key="123"]');
        } else {
            numberRow = document.getElementById('number-row');
            numButton = this.numKey;
        }

        console.log('[Keyboard] syncNumberRowState - layout:', this.state.layout);
        console.log('[Keyboard] numberRow:', numberRow);
        console.log('[Keyboard] numButton:', numButton);

        if (numberRow && numButton) {
            // Check computed style, not just inline style
            const computedDisplay = window.getComputedStyle(numberRow).display;
            const isVisible = computedDisplay !== 'none';

            console.log('[Keyboard] computedDisplay:', computedDisplay, 'isVisible:', isVisible);

            // Force the button and row to match expected state
            if (isVisible) {
                numButton.classList.add('active');
                this.state.mode = 'numbers';
                console.log('[Keyboard] Set button to active (numbers visible)');
            } else {
                numButton.classList.remove('active');
                this.state.mode = 'letters';
                console.log('[Keyboard] Set button to inactive (numbers hidden)');
            }
        } else {
            console.warn('[Keyboard] Could not find number row or button for sync');
        }
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
                console.log('[Keyboard] 123 button pressed, toggling number row');
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

            // Punctuation with auto-space (comma, period, question mark on Row 5)
            case ',':
                this.onKeyPress(',', 'letter', this.state);
                this.onKeyPress(' ', 'space', this.state);
                break;
            case '.':
                this.onKeyPress('.', 'letter', this.state);
                this.onKeyPress(' ', 'space', this.state);
                break;
            case '?':
                this.onKeyPress('?', 'letter', this.state);
                this.onKeyPress(' ', 'space', this.state);
                break;

            // Enter key - placeholder (disabled for now)
            case 'enter':
                // TODO: Implement enter key functionality
                // For now, do nothing
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

            // SHIFT now works like CAPS LOCK - stays on until manually toggled off
            // No auto-reset after letter press
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
        console.log('[Keyboard] switchToNumbers called, layout:', this.state.layout);

        // Toggle number row visibility - works for both layouts
        let numberRow;
        if (this.state.layout === 'swiftkey') {
            // SwiftKey has number row as Row 3
            numberRow = document.querySelector('#keyboard-swiftkey .keyboard-row-new:nth-child(3)');
        } else {
            // Traditional has dedicated number-row element
            numberRow = document.getElementById('number-row');
        }
        console.log('[Keyboard] number-row element:', numberRow);

        if (numberRow) {
            const isHidden = numberRow.style.display === 'none' || !numberRow.style.display;
            console.log('[Keyboard] isHidden:', isHidden, 'current display:', numberRow.style.display);

            if (isHidden) {
                // Show number row
                numberRow.style.display = 'flex';
                this.state.mode = 'numbers';
                console.log('[Keyboard] Showing number row');
                // Add active class to show it's "on" - find the 123 button
                const numButton = this.state.layout === 'swiftkey'
                    ? document.querySelector('#keyboard-swiftkey [data-key="123"]')
                    : this.numKey;
                if (numButton) {
                    numButton.classList.add('active');
                }
            } else {
                // Hide number row
                numberRow.style.display = 'none';
                this.state.mode = 'letters';
                console.log('[Keyboard] Hiding number row');
                // Remove active class to show it's "off"
                const numButton = this.state.layout === 'swiftkey'
                    ? document.querySelector('#keyboard-swiftkey [data-key="123"]')
                    : this.numKey;
                if (numButton) {
                    numButton.classList.remove('active');
                }
            }
        } else {
            console.error('[Keyboard] number-row element not found!');
        }
    },

    switchToLetters() {
        // Hide number row when switching back to letters
        this.state.mode = 'letters';
        const numberRow = document.getElementById('number-row');
        if (numberRow) {
            numberRow.style.display = 'none';
        }
        if (this.numKey) {
            this.numKey.classList.remove('active');
        }
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

        // Check if auto-capitalization will happen (first letter or after punctuation)
        const willAutoCapitalize = window.MessageArea ? window.MessageArea.shouldCapitalize() : false;
        const shouldShowUppercase = this.state.shift || willAutoCapitalize;

        // Letter keys toggle between uppercase and lowercase based on shift state or auto-cap
        this.letterKeys.forEach(key => {
            const keyValue = key.dataset.key;
            if (/^[a-z]$/.test(keyValue)) {
                // Show uppercase when shift is active OR auto-capitalization will happen
                key.textContent = shouldShowUppercase ? keyValue.toUpperCase() : keyValue.toLowerCase();
            }
        });

        // Update SwiftKey letter keys
        const swiftkeyLetterKeys = document.querySelectorAll('.key-letter-swiftkey');
        swiftkeyLetterKeys.forEach(key => {
            const keyValue = key.dataset.key;
            if (/^[a-z]$/.test(keyValue)) {
                // Show uppercase when shift is active OR auto-capitalization will happen
                key.textContent = shouldShowUppercase ? keyValue.toUpperCase() : keyValue.toLowerCase();
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
