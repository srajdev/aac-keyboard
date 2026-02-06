// Predictions Component - handles prediction display and selection

const Predictions = {
    phraseButtons: [],
    wordButtons: [],
    onPhraseSelect: null,
    onWordSelect: null,

    init() {
        this.phraseButtons = document.querySelectorAll('.phrase-btn-new');
        this.wordButtons = document.querySelectorAll('.word-btn-new');

        // Phrase button handlers
        this.phraseButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const phrase = btn.textContent;
                if (phrase && phrase !== 'Loading...' && this.onPhraseSelect) {
                    this.onPhraseSelect(phrase);
                }
            });
        });

        // Word button handlers
        this.wordButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const word = btn.textContent;
                if (word && word !== '...' && this.onWordSelect) {
                    this.onWordSelect(word);
                }
            });
        });
    },

    update(predictions) {
        const renderStart = performance.now();

        // Update phrase predictions
        if (predictions.phrases) {
            this.phraseButtons.forEach((btn, i) => {
                if (predictions.phrases[i]) {
                    btn.textContent = predictions.phrases[i];
                    btn.disabled = false;
                } else {
                    btn.textContent = '...';
                    btn.disabled = true;
                }
            });
        }

        // Update word predictions
        if (predictions.words) {
            this.wordButtons.forEach((btn, i) => {
                if (predictions.words[i]) {
                    btn.textContent = predictions.words[i];
                    btn.disabled = false;
                } else {
                    btn.textContent = '...';
                    btn.disabled = true;
                }
            });
        }

        const renderDuration = performance.now() - renderStart;
        console.log(`[Render] Predictions updated: ${renderDuration.toFixed(2)}ms`);
    },

    setLoading(isLoading) {
        const section = document.querySelector('.predictions-section-new');
        if (isLoading) {
            section?.classList.add('loading');
            // Show loading text
            this.phraseButtons.forEach(btn => {
                btn.textContent = 'Loading...';
                btn.disabled = true;
            });
            this.wordButtons.forEach(btn => {
                btn.textContent = '...';
                btn.disabled = true;
            });
        } else {
            section?.classList.remove('loading');
        }
    },

    showDefaults() {
        // Default useful phrases for quick communication
        const defaults = {
            phrases: [
                'I need help please',
                'I am feeling good',
                'Can we talk'
            ],
            words: ['yes', 'no', 'please', 'thanks', 'help', 'okay']
        };
        this.update(defaults);
    },
};
