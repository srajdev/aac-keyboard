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
        // Add space before word if needed
        let textToAdd = word;
        if (this.cursorPosition === null) {
            if (this.currentMessage && !this.currentMessage.endsWith(' ')) {
                textToAdd = ' ' + word;
            }
            this.currentMessage += textToAdd;
        } else {
            // Insert at cursor position
            const before = this.currentMessage.slice(0, this.cursorPosition);
            if (before && !before.endsWith(' ')) {
                textToAdd = ' ' + word;
            }
            this.currentMessage =
                before +
                textToAdd +
                this.currentMessage.slice(this.cursorPosition);
            this.cursorPosition += textToAdd.length;
        }
        this.render();
        this.notifyChange(true);
    },

    appendPhrase(phrase) {
        // Replace current message with phrase (or append if user was mid-sentence)
        this.currentMessage = phrase;
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

        // Move to end of previous word
        let newPos = pos - 1;

        // Skip spaces
        while (newPos > 0 && this.currentMessage[newPos] === ' ') {
            newPos--;
        }

        // Find start of word
        while (newPos > 0 && this.currentMessage[newPos - 1] !== ' ') {
            newPos--;
        }

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
