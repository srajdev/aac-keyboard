// MessageArea Component - handles message composition and display

const MessageArea = {
    currentMessage: '',
    element: null,
    onMessageChange: null,

    init() {
        this.element = document.getElementById('message-text');
        this.deleteWordBtn = document.getElementById('delete-word-btn');
        this.clearBtn = document.getElementById('clear-btn');

        this.deleteWordBtn.addEventListener('click', () => this.deleteLastWord());
        this.clearBtn.addEventListener('click', () => this.clear());

        this.render();
    },

    appendText(text) {
        this.currentMessage += text;
        this.render();
        this.notifyChange();
    },

    appendWord(word) {
        // Add space before word if needed
        if (this.currentMessage && !this.currentMessage.endsWith(' ')) {
            this.currentMessage += ' ';
        }
        this.currentMessage += word;
        this.render();
        this.notifyChange();
    },

    appendPhrase(phrase) {
        // Replace current message with phrase (or append if user was mid-sentence)
        this.currentMessage = phrase;
        this.render();
        this.notifyChange();
    },

    appendLetter(letter) {
        this.currentMessage += letter;
        this.render();
        this.notifyChange();
    },

    backspace() {
        if (this.currentMessage.length > 0) {
            this.currentMessage = this.currentMessage.slice(0, -1);
            this.render();
            this.notifyChange();
        }
    },

    deleteLastWord() {
        const trimmed = this.currentMessage.trimEnd();
        const lastSpace = trimmed.lastIndexOf(' ');
        if (lastSpace === -1) {
            this.currentMessage = '';
        } else {
            this.currentMessage = trimmed.slice(0, lastSpace + 1);
        }
        this.render();
        this.notifyChange();
    },

    clear() {
        this.currentMessage = '';
        this.render();
        this.notifyChange();
    },

    getMessage() {
        return this.currentMessage;
    },

    render() {
        if (this.element) {
            this.element.textContent = this.currentMessage;
        }
    },

    notifyChange() {
        if (this.onMessageChange) {
            this.onMessageChange(this.currentMessage);
        }
    },
};
