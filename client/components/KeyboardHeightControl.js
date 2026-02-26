/**
 * KeyboardHeightControl.js
 * Allows dynamic adjustment of keyboard key heights for optimal comfort
 */

const KeyboardHeightControl = {
    MIN_SCALE: 0.5,   // 50% of default height
    MAX_SCALE: 1.5,   // 150% of default height
    DEFAULT_SCALE: 1.0,  // 100% (default)
    STEP: 0.1,  // 10% increments

    currentScale: 1.0,

    init() {
        // Load saved scale from localStorage
        const saved = StorageService.getKeyboardHeight();
        if (saved) {
            this.currentScale = parseFloat(saved);
        }

        // Apply the saved scale
        this.applyScale();

        // Set up event listeners
        const decreaseBtn = document.getElementById('height-decrease');
        const increaseBtn = document.getElementById('height-increase');
        const resetBtn = document.getElementById('height-reset');

        if (decreaseBtn) decreaseBtn.addEventListener('click', () => this.decrease());
        if (increaseBtn) increaseBtn.addEventListener('click', () => this.increase());
        if (resetBtn) resetBtn.addEventListener('click', () => this.reset());

        console.log('[KeyboardHeightControl] Initialized with scale:', this.currentScale);
    },

    decrease() {
        if (this.currentScale > this.MIN_SCALE) {
            this.currentScale = Math.max(this.MIN_SCALE, this.currentScale - this.STEP);
            this.currentScale = Math.round(this.currentScale * 10) / 10; // Round to 1 decimal
            this.applyScale();
            this.save();
        }
    },

    increase() {
        if (this.currentScale < this.MAX_SCALE) {
            this.currentScale = Math.min(this.MAX_SCALE, this.currentScale + this.STEP);
            this.currentScale = Math.round(this.currentScale * 10) / 10; // Round to 1 decimal
            this.applyScale();
            this.save();
        }
    },

    reset() {
        this.currentScale = this.DEFAULT_SCALE;
        this.applyScale();
        this.save();
    },

    applyScale() {
        const root = document.documentElement;
        root.style.setProperty('--keyboard-height-scale', this.currentScale);

        const displayElement = document.getElementById('height-display');
        if (displayElement) {
            const percentage = Math.round(this.currentScale * 100);
            displayElement.textContent = `${percentage}%`;
        }

        console.log('[KeyboardHeightControl] Applied scale:', this.currentScale);
    },

    save() {
        StorageService.setKeyboardHeight(this.currentScale.toString());
        console.log('[KeyboardHeightControl] Saved scale:', this.currentScale);
    }
};
