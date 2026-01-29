// Simple password protection

const Auth = {
    // Hardcoded password
    PASSWORD: 'speak2024',

    init() {
        // Check if already authenticated
        if (localStorage.getItem('vk_authenticated') === 'true') {
            this.showApp();
            return;
        }

        // Show password gate
        document.getElementById('password-gate').style.display = 'flex';

        // Allow Enter key to submit
        document.getElementById('password-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkPassword();
            }
        });
    },

    checkPassword() {
        const input = document.getElementById('password-input');
        const error = document.getElementById('password-error');

        if (input.value === this.PASSWORD) {
            localStorage.setItem('vk_authenticated', 'true');
            this.showApp();
        } else {
            error.textContent = 'Incorrect password';
            input.value = '';
            input.focus();
        }
    },

    showApp() {
        document.getElementById('password-gate').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
    }
};

// Initialize auth check on page load
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
