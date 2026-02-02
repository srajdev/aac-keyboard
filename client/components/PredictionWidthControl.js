/**
 * PredictionWidthControl.js
 * Allows dynamic adjustment of prediction area width
 */

const PredictionWidthControl = {
    SIZES: ['compact', 'medium', 'wide'],
    DEFAULT_SIZE: 'medium',

    currentSize: 'medium',

    init() {
        // Load saved size from localStorage
        const saved = Storage.getPredictionWidth();
        if (saved && this.SIZES.includes(saved)) {
            this.currentSize = saved;
        }

        // Apply the saved size
        this.applySize();

        // Set up event listeners
        document.getElementById('pred-width-decrease')?.addEventListener('click', () => this.decrease());
        document.getElementById('pred-width-increase')?.addEventListener('click', () => this.increase());
        document.getElementById('pred-width-reset')?.addEventListener('click', () => this.reset());

        console.log('[PredictionWidthControl] Initialized with size:', this.currentSize);
    },

    decrease() {
        const currentIndex = this.SIZES.indexOf(this.currentSize);
        if (currentIndex > 0) {
            this.currentSize = this.SIZES[currentIndex - 1];
            this.applySize();
            this.save();
        }
    },

    increase() {
        const currentIndex = this.SIZES.indexOf(this.currentSize);
        if (currentIndex < this.SIZES.length - 1) {
            this.currentSize = this.SIZES[currentIndex + 1];
            this.applySize();
            this.save();
        }
    },

    reset() {
        this.currentSize = this.DEFAULT_SIZE;
        this.applySize();
        this.save();
    },

    applySize() {
        const predictionsSection = document.querySelector('.predictions-section-new');
        if (!predictionsSection) return;

        // Remove all size classes
        this.SIZES.forEach(size => {
            predictionsSection.classList.remove(`pred-width-${size}`);
        });

        // Add current size class
        predictionsSection.classList.add(`pred-width-${this.currentSize}`);

        // Update display
        const displayElement = document.getElementById('pred-width-display');
        if (displayElement) {
            displayElement.textContent = this.currentSize.charAt(0).toUpperCase() + this.currentSize.slice(1);
        }

        console.log('[PredictionWidthControl] Applied size:', this.currentSize);
    },

    save() {
        Storage.setPredictionWidth(this.currentSize);
        console.log('[PredictionWidthControl] Saved size:', this.currentSize);
    }
};
