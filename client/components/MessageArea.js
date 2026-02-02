// MessageArea Component - handles message composition and display with cursor tracking

const MessageArea = {
    currentMessage: '',
    cursorPosition: null, // null = end of text, number = position
    beforeElement: null,
    afterElement: null,
    clearBtn: null,
    onMessageChange: null,

    init() {
        this.beforeElement = document.getElementById('message-before');
        this.afterElement = document.getElementById('message-after');
        this.clearBtn = document.getElementById('clear-btn');

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clear());
        }

        this.render();
    },

    appendText(text) {
        if (this.cursorPosition === null) {
            // Append at end
            this.currentMessage += text;
        } else {
            // Insert at cursor position
            this.currentMessage =
                this.currentMessage.slice(0, this.cursorPosition) +
                text +
                this.currentMessage.slice(this.cursorPosition);
            this.cursorPosition += text.length;
        }
        this.render();
        this.notifyChange(true); // true = text changed
    },

    appendWord(word) {
        // Check if cursor is in the middle of a word (partial word exists before cursor)
        const pos = this.cursorPosition === null ? this.currentMessage.length : this.cursorPosition;
        const before = this.currentMessage.slice(0, pos);
        const after = this.currentMessage.slice(pos);

        // Check if there's a partial word to replace (non-space immediately before cursor)
        const hasPartialWord = before.length > 0 && !before.endsWith(' ');

        if (hasPartialWord) {
            // Find start of the partial word
            let wordStart = before.length - 1;
            while (wordStart > 0 && before[wordStart - 1] !== ' ') {
                wordStart--;
            }

            // Replace the partial word with the predicted word + automatic space
            this.currentMessage = before.slice(0, wordStart) + word + ' ' + after;
            this.cursorPosition = wordStart + word.length + 1; // +1 for the space
        } else {
            // No partial word - just add the word (with space before if needed, and space after)
            let textToAdd = word;
            if (before.length > 0 && !before.endsWith(' ')) {
                textToAdd = ' ' + word;
            }
            textToAdd += ' '; // Add space after the word

            this.currentMessage = before + textToAdd + after;

            if (this.cursorPosition !== null) {
                this.cursorPosition = (before + textToAdd).length;
            }
        }

        this.render();
        this.notifyChange(true);
    },

    appendPhrase(phrase) {
        // Replace current message with phrase + automatic space
        this.currentMessage = phrase + ' ';
        this.cursorPosition = null; // Reset cursor to end
        this.render();
        this.notifyChange(true);
    },

    appendLetter(letter) {
        this.appendText(letter);
    },

    backspace() {
        if (this.cursorPosition === null) {
            // Delete from end
            if (this.currentMessage.length > 0) {
                this.currentMessage = this.currentMessage.slice(0, -1);
                this.render();
                this.notifyChange(true);
            }
        } else if (this.cursorPosition > 0) {
            // Delete before cursor
            this.currentMessage =
                this.currentMessage.slice(0, this.cursorPosition - 1) +
                this.currentMessage.slice(this.cursorPosition);
            this.cursorPosition--;
            this.render();
            this.notifyChange(true);
        }
    },

    deleteWord() {
        if (this.cursorPosition === null) {
            // Delete last word from end
            const trimmed = this.currentMessage.trimEnd();
            const lastSpace = trimmed.lastIndexOf(' ');
            if (lastSpace === -1) {
                this.currentMessage = '';
            } else {
                this.currentMessage = trimmed.slice(0, lastSpace + 1);
            }
        } else {
            // Delete word before cursor
            const before = this.currentMessage.slice(0, this.cursorPosition);
            const after = this.currentMessage.slice(this.cursorPosition);
            const trimmed = before.trimEnd();
            const lastSpace = trimmed.lastIndexOf(' ');

            if (lastSpace === -1) {
                this.currentMessage = after;
                this.cursorPosition = 0;
            } else {
                this.currentMessage = trimmed.slice(0, lastSpace + 1) + after;
                this.cursorPosition = lastSpace + 1;
            }
        }
        this.render();
        this.notifyChange(true);
    },

    moveCursorToStart() {
        this.cursorPosition = 0;
        this.render();
        this.notifyChange(false); // false = cursor moved, text didn't change
    },

    moveCursorToEnd() {
        this.cursorPosition = null;
        this.render();
        this.notifyChange(false);
    },

    moveCursorToPrevWord() {
        if (this.currentMessage.length === 0) return;

        const pos = this.cursorPosition === null ? this.currentMessage.length : this.cursorPosition;

        if (pos === 0) return; // Already at start

        let newPos = pos - 1;

        // Skip backward through current word (non-spaces)
        while (newPos > 0 && this.currentMessage[newPos] !== ' ') {
            newPos--;
        }

        // Skip backward through spaces
        while (newPos > 0 && this.currentMessage[newPos] === ' ') {
            newPos--;
        }

        // Now newPos is at the last letter of the previous word
        // Position cursor after this letter (end of previous word)
        newPos++;

        this.cursorPosition = newPos;
        this.render();
        this.notifyChange(false);
    },

    moveCursorToNextWord() {
        if (this.currentMessage.length === 0) return;

        const pos = this.cursorPosition === null ? this.currentMessage.length : this.cursorPosition;

        // Move to start of next word
        let newPos = pos;

        // Skip current word
        while (newPos < this.currentMessage.length && this.currentMessage[newPos] !== ' ') {
            newPos++;
        }

        // Skip spaces
        while (newPos < this.currentMessage.length && this.currentMessage[newPos] === ' ') {
            newPos++;
        }

        if (newPos >= this.currentMessage.length) {
            this.cursorPosition = null; // At end
        } else {
            this.cursorPosition = newPos;
        }

        this.render();
        this.notifyChange(false);
    },

    clear() {
        this.currentMessage = '';
        this.cursorPosition = null;
        this.render();
        this.notifyChange(true);
    },

    getMessage() {
        return this.currentMessage;
    },

    getCurrentWord() {
        // Get the word currently being typed at/before cursor position
        const pos = this.cursorPosition === null ? this.currentMessage.length : this.cursorPosition;
        const before = this.currentMessage.slice(0, pos);

        // Check if there's a word being typed (non-space immediately before cursor)
        if (before.length === 0 || before.endsWith(' ')) {
            return ''; // No current word
        }

        // Find the start of the current word
        let wordStart = before.length - 1;
        while (wordStart > 0 && before[wordStart - 1] !== ' ') {
            wordStart--;
        }

        return before.slice(wordStart);
    },

    render() {
        if (!this.beforeElement || !this.afterElement) return;

        if (this.cursorPosition === null || this.cursorPosition === this.currentMessage.length) {
            // Cursor at end
            this.beforeElement.textContent = this.currentMessage;
            this.afterElement.textContent = '';
        } else {
            // Cursor in middle - split text at cursor position
            this.beforeElement.textContent = this.currentMessage.slice(0, this.cursorPosition);
            this.afterElement.textContent = this.currentMessage.slice(this.cursorPosition);
        }
    },

    notifyChange(textChanged) {
        if (this.onMessageChange) {
            this.onMessageChange(this.currentMessage, textChanged);
        }
    },
};
