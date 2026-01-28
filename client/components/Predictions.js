// Predictions Component - handles prediction display and selection

const Predictions = {
    phraseButtons: [],
    wordButtons: [],
    letterButtons: [],
    onPhraseSelect: null,
    onWordSelect: null,
    onLetterSelect: null,

    init() {
        this.phraseButtons = document.querySelectorAll('.phrase-btn');
        this.wordButtons = document.querySelectorAll('.word-btn');
        this.letterButtons = document.querySelectorAll('.letter-btn');

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

        // Letter button handlers
        this.letterButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const letter = btn.textContent;
                if (letter && letter !== '...' && this.onLetterSelect) {
                    this.onLetterSelect(letter);
                }
            });
        });
    },

    update(predictions) {
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

        // Update letter predictions
        if (predictions.letters) {
            this.letterButtons.forEach((btn, i) => {
                if (predictions.letters[i]) {
                    btn.textContent = predictions.letters[i];
                    btn.disabled = false;
                } else {
                    btn.textContent = '...';
                    btn.disabled = true;
                }
            });
        }
    },

    setLoading(isLoading) {
        const section = document.querySelector('.predictions-section');
        if (isLoading) {
            section.classList.add('loading');
        } else {
            section.classList.remove('loading');
        }
    },
};
