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

    updatePhrases(phrases) {
        const renderStart = performance.now();

        this.phraseButtons.forEach((btn, i) => {
            btn.classList.remove('placeholder');
            if (phrases[i]) {
                btn.textContent = phrases[i];
                btn.disabled = false;
            } else {
                btn.textContent = '...';
                btn.disabled = true;
            }
        });

        const renderDuration = performance.now() - renderStart;
        console.log(`[Render] Phrases updated: ${renderDuration.toFixed(2)}ms`);
    },

    showPhrasePlaceholder(wordCount, hasContext) {
        let placeholderText;

        if (wordCount === 0 && !hasContext) {
            placeholderText = 'Type to get phrases';
        } else if (wordCount < 3 && !hasContext) {
            const wordsNeeded = 3 - wordCount;
            placeholderText = `Type ${wordsNeeded} more word${wordsNeeded > 1 ? 's' : ''}...`;
        } else {
            placeholderText = '...';
        }

        this.phraseButtons.forEach(btn => {
            btn.textContent = placeholderText;
            btn.disabled = true;
            btn.classList.add('placeholder');
        });
    },

    updateWords(words) {
        const renderStart = performance.now();

        this.wordButtons.forEach((btn, i) => {
            if (words[i]) {
                btn.textContent = words[i];
                btn.disabled = false;
            } else {
                btn.textContent = '...';
                btn.disabled = true;
            }
        });

        const renderDuration = performance.now() - renderStart;
        console.log(`[Render] Words updated: ${renderDuration.toFixed(2)}ms`);
    },

    /**
     * Update words incrementally as they stream in
     * @param {Array<string>} words - Partial list of words received so far
     */
    updateWordsIncremental(words) {
        // Update only the word buttons we have so far
        this.wordButtons.forEach((btn, i) => {
            if (i < words.length) {
                btn.textContent = words[i];
                btn.disabled = false;
                btn.classList.add('streaming');
            } else {
                btn.textContent = '...';
                btn.disabled = true;
                btn.classList.remove('streaming');
            }
        });
    },

    /**
     * Update phrases incrementally as they stream in
     * @param {Array<string>} phrases - Partial list of phrases received so far
     */
    updatePhrasesIncremental(phrases) {
        // Update only the phrase buttons we have so far
        this.phraseButtons.forEach((btn, i) => {
            if (i < phrases.length) {
                btn.textContent = phrases[i];
                btn.disabled = false;
                btn.classList.add('streaming');
                btn.classList.remove('placeholder');
            } else {
                btn.textContent = '...';
                btn.disabled = true;
                btn.classList.remove('streaming');
            }
        });
    },

    /**
     * Finalize streaming - remove animations when complete
     */
    finalizeStreaming() {
        // Remove streaming animations
        this.phraseButtons.forEach(btn => btn.classList.remove('streaming'));
        this.wordButtons.forEach(btn => btn.classList.remove('streaming'));
    },

    setLoading(isLoading) {
        const section = document.querySelector('.predictions-section-new');
        if (isLoading) {
            section?.classList.add('loading');
            // Show loading text
            this.phraseButtons.forEach(btn => {
                btn.textContent = 'Loading...';
                btn.disabled = true;
                btn.classList.remove('placeholder');
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
