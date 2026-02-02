// SettingsModal Component - handles settings modal open/close

const SettingsModal = {
    modal: null,
    openBtn: null,
    closeBtn: null,
    overlay: null,

    init() {
        this.modal = document.getElementById('settings-modal');
        this.openBtn = document.getElementById('settings-btn');
        this.closeBtn = document.getElementById('settings-close');
        this.overlay = this.modal?.querySelector('.modal-overlay');

        // Open modal
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => this.open());
        }

        // Close modal
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        // Close on overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.close());
        }
    },

    open() {
        if (this.modal) {
            this.modal.classList.add('active');
            this.modal.style.display = 'flex';
        }
    },

    close() {
        if (this.modal) {
            this.modal.classList.remove('active');
            this.modal.style.display = 'none';
        }
    },
};
