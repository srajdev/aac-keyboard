/**
 * PredictionWidthControl.js
 * Allows dynamic adjustment of prediction area width (10-25cm or full)
 */

const PredictionWidthControl = {
    MIN_WIDTH: 10,  // 10cm minimum
    MAX_WIDTH: 25,  // 25cm maximum (or "full")
    DEFAULT_WIDTH: 18,  // 18cm default
    STEP: 1,  // 1cm increments

    currentWidth: 18,

    init() {
        // Load saved width from localStorage
        const saved = Storage.getPredictionWidth();
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
        document.getElementById('pred-width-decrease')?.addEventListener('click', () => this.decrease());
        document.getElementById('pred-width-increase')?.addEventListener('click', () => this.increase());
        document.getElementById('pred-width-reset')?.addEventListener('click', () => this.reset());

        console.log('[PredictionWidthControl] Initialized with width:', this.currentWidth);
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
            root.style.setProperty('--prediction-max-width', '100%');
            document.getElementById('pred-width-display').textContent = 'Full';
        } else {
            // Set width in cm
            root.style.setProperty('--prediction-max-width', `${this.currentWidth}cm`);
            document.getElementById('pred-width-display').textContent = `${this.currentWidth}cm`;
        }

        console.log('[PredictionWidthControl] Applied width:', this.currentWidth);
    },

    save() {
        const valueToSave = this.currentWidth === 'full' ? 'full' : this.currentWidth.toString();
        Storage.setPredictionWidth(valueToSave);
        console.log('[PredictionWidthControl] Saved width:', valueToSave);
    }
};
