// Predictions Component - handles prediction display and selection

const Predictions = {
    phraseButtons: [],
    wordButtons: [],
    wordButtonsSwiftkey: [],
    layout: 'traditional',
    onPhraseSelect: null,
    onWordSelect: null,

    init() {
        this.phraseButtons = document.querySelectorAll('.phrase-btn-new');
        this.wordButtons = document.querySelectorAll('.word-btn-new');
        this.wordButtonsSwiftkey = document.querySelectorAll('.word-btn-swiftkey');

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

        // SwiftKey word button handlers
        this.wordButtonsSwiftkey.forEach((btn) => {
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

        // Update phrase predictions (BOTH layouts use this)
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
            if (this.layout === 'swiftkey') {
                // SwiftKey: 5 words (0-4)
                this.wordButtonsSwiftkey.forEach((btn, i) => {
                    if (predictions.words[i]) {
                        btn.textContent = predictions.words[i];
                        btn.disabled = false;
                    } else {
                        btn.textContent = '...';
                        btn.disabled = true;
                    }
                });
            } else {
                // Traditional: 6 words (0-5)
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
        }

        const renderDuration = performance.now() - renderStart;
        console.log(`[Render] Predictions updated (${this.layout}): ${renderDuration.toFixed(2)}ms`);
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

        if (this.layout === 'swiftkey') {
            // SwiftKey: 5 words (0-4)
            this.wordButtonsSwiftkey.forEach((btn, i) => {
                if (words[i]) {
                    btn.textContent = words[i];
                    btn.disabled = false;
                } else {
                    btn.textContent = '...';
                    btn.disabled = true;
                }
            });
        } else {
            // Traditional: 6 words (0-5)
            this.wordButtons.forEach((btn, i) => {
                if (words[i]) {
                    btn.textContent = words[i];
                    btn.disabled = false;
                } else {
                    btn.textContent = '...';
                    btn.disabled = true;
                }
            });
        }

        const renderDuration = performance.now() - renderStart;
        console.log(`[Render] Words updated: ${renderDuration.toFixed(2)}ms`);
    },

    /**
     * Update words incrementally as they stream in
     * @param {Array<string>} words - Partial list of words received so far
     */
    updateWordsIncremental(words) {
        if (this.layout === 'swiftkey') {
            // SwiftKey: 5 words (0-4)
            this.wordButtonsSwiftkey.forEach((btn, i) => {
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
        } else {
            // Traditional: 6 words (0-5)
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
        }
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
        this.wordButtonsSwiftkey.forEach(btn => btn.classList.remove('streaming'));
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

            if (this.layout === 'swiftkey') {
                this.wordButtonsSwiftkey.forEach(btn => {
                    btn.textContent = '...';
                    btn.disabled = true;
                });
            } else {
                this.wordButtons.forEach(btn => {
                    btn.textContent = '...';
                    btn.disabled = true;
                });
            }
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

    switchLayout(layout) {
        this.layout = layout;

        const traditionalWords = document.querySelector('.words-traditional');
        const predictionsSection = document.querySelector('.predictions-section-new');

        console.log('[Predictions] switchLayout called with:', layout);
        console.log('[Predictions] traditionalWords:', traditionalWords);
        console.log('[Predictions] predictionsSection:', predictionsSection);

        if (layout === 'swiftkey') {
            // Hide traditional word predictions
            // SwiftKey predictions are part of the keyboard and show/hide automatically
            if (traditionalWords) {
                traditionalWords.style.display = 'none';
                console.log('[Predictions] Set traditionalWords display to none');
            }
            // Add class to make phrases full width
            if (predictionsSection) {
                predictionsSection.classList.add('swiftkey-mode');
                console.log('[Predictions] Added swiftkey-mode class');
            }
        } else {
            // Show traditional word predictions
            if (traditionalWords) {
                traditionalWords.style.display = 'flex';
            }
            // Remove class to restore split layout
            if (predictionsSection) {
                predictionsSection.classList.remove('swiftkey-mode');
            }
        }
    }
};
