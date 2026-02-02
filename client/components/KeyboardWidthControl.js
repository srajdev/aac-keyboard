/**
 * KeyboardWidthControl.js
 * Allows dynamic adjustment of keyboard width for optimal thumb reach
 */

const KeyboardWidthControl = {
    MIN_WIDTH: 10,  // 10cm minimum
    MAX_WIDTH: 25,  // 25cm maximum (or "full")
    DEFAULT_WIDTH: 14,  // 14cm default
    STEP: 1,  // 1cm increments

    currentWidth: 14,

    init() {
        // Load saved width from localStorage
        const saved = Storage.getKeyboardWidth();
        if (saved) {
            if (saved === 'full') {
                this.currentWidth = 'full';
            } else {
                this.currentWidth = parseInt(saved);
            }
        }

        // Apply the saved width
        this.applyWidth();

        // Set up event listeners
        document.getElementById('width-decrease').addEventListener('click', () => this.decrease());
        document.getElementById('width-increase').addEventListener('click', () => this.increase());
        document.getElementById('width-reset').addEventListener('click', () => this.reset());

        console.log('[KeyboardWidthControl] Initialized with width:', this.currentWidth);
    },

    decrease() {
        if (this.currentWidth === 'full') {
            this.currentWidth = this.MAX_WIDTH;
        } else if (this.currentWidth > this.MIN_WIDTH) {
            this.currentWidth -= this.STEP;
        }
        this.applyWidth();
        this.save();
    },

    increase() {
        if (this.currentWidth === 'full') {
            return; // Already at maximum
        } else if (this.currentWidth >= this.MAX_WIDTH) {
            this.currentWidth = 'full';
        } else {
            this.currentWidth += this.STEP;
        }
        this.applyWidth();
        this.save();
    },

    reset() {
        this.currentWidth = this.DEFAULT_WIDTH;
        this.applyWidth();
        this.save();
    },

    applyWidth() {
        const root = document.documentElement;

        if (this.currentWidth === 'full') {
            // Remove max-width constraint
            root.style.setProperty('--keyboard-max-width', '100%');
            document.getElementById('width-display').textContent = 'Full';
        } else {
            // Set width in cm
            root.style.setProperty('--keyboard-max-width', `${this.currentWidth}cm`);
            document.getElementById('width-display').textContent = `${this.currentWidth}cm`;
        }

        console.log('[KeyboardWidthControl] Applied width:', this.currentWidth);
    },

    save() {
        const valueToSave = this.currentWidth === 'full' ? 'full' : this.currentWidth.toString();
        Storage.setKeyboardWidth(valueToSave);
        console.log('[KeyboardWidthControl] Saved width:', valueToSave);
    }
};
