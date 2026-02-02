// ExplicitContext Component - handles manual context input modal

const ExplicitContext = {
    modal: null,
    textarea: null,
    saveBtn: null,
    cancelBtn: null,
    openBtn: null,
    onContextSave: null,

    init() {
        this.modal = document.getElementById('explicit-context-modal');
        this.textarea = document.getElementById('explicit-context-textarea');
        this.saveBtn = document.getElementById('explicit-context-save');
        this.cancelBtn = document.getElementById('explicit-context-cancel');
        this.openBtn = document.getElementById('explicit-context-btn');

        // Open modal button
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => {
                this.show();
            });
        }

        // Save button
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => {
                this.save();
            });
        }

        // Cancel button
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => {
                this.hide();
            });
        }

        // Close on overlay click
        const overlay = this.modal?.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.hide();
            });
        }
    },

    show() {
        if (this.modal) {
            this.modal.classList.add('active');
            // Focus textarea for immediate input
            if (this.textarea) {
                setTimeout(() => this.textarea.focus(), 100);
            }
        }
    },

    hide() {
        if (this.modal) {
            this.modal.classList.remove('active');
        }
    },

    save() {
        const context = this.textarea?.value || '';

        // Notify callback with new context
        if (this.onContextSave) {
            this.onContextSave(context);
        }

        this.hide();
    },

    getContext() {
        return this.textarea?.value || '';
    },

    clearContext() {
        if (this.textarea) {
            this.textarea.value = '';
        }
    },
};
