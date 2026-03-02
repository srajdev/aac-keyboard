// Profile Modal Component - manages user profile (name, age, interests, topics)

const ProfileModal = {
    modal: null,
    overlay: null,
    elements: {
        nameInput: null,
        ageInput: null,
        detailsTextarea: null,
        charCount: null,
        saveBtn: null,
        cancelBtn: null,
    },
    currentProfile: {
        name: '',
        age: '',
        details: '',
    },
    onProfileChange: null, // Callback when profile is saved

    init() {
        // Get DOM elements
        this.modal = document.getElementById('profile-modal');
        this.overlay = this.modal.querySelector('.modal-overlay');
        this.elements.nameInput = document.getElementById('profile-name');
        this.elements.ageInput = document.getElementById('profile-age');
        this.elements.detailsTextarea = document.getElementById('details-textarea');
        this.elements.charCount = document.getElementById('details-char-count');
        this.elements.saveBtn = document.getElementById('profile-save');
        this.elements.cancelBtn = document.getElementById('profile-cancel');

        // Wire up event handlers
        this.overlay.addEventListener('click', () => this.close());
        this.elements.cancelBtn.addEventListener('click', () => this.close());
        this.elements.saveBtn.addEventListener('click', () => this.save());

        // Character counter for textarea
        this.elements.detailsTextarea.addEventListener('input', () => {
            this.updateCharCount();
        });

        // Load profile from storage
        this.loadProfile();
    },

    loadProfile() {
        this.currentProfile = StorageService.getUserProfile();
    },

    open() {
        // Load latest profile
        this.loadProfile();

        // Populate form
        this.elements.nameInput.value = this.currentProfile.name || '';
        this.elements.ageInput.value = this.currentProfile.age || '';
        this.elements.detailsTextarea.value = this.currentProfile.details || '';

        // Update character count
        this.updateCharCount();

        // Show modal
        this.modal.style.display = 'flex';
    },

    close() {
        this.modal.style.display = 'none';
    },

    save() {
        try {
            // Collect form data
            const profile = {
                name: this.elements.nameInput.value.trim(),
                age: this.elements.ageInput.value.trim(),
                details: this.elements.detailsTextarea.value.trim(),
            };

            console.log('[ProfileModal] Saving profile:', profile);

            // Save to storage
            const savedProfile = StorageService.saveUserProfile(profile);
            this.currentProfile = savedProfile;

            console.log('[ProfileModal] Profile saved to localStorage:', savedProfile);

            // Verify it was saved
            const verifyProfile = StorageService.getUserProfile();
            console.log('[ProfileModal] Verification - profile loaded from storage:', verifyProfile);

            // Close modal
            this.close();

            // Trigger callback (to clear cache and refresh predictions)
            if (this.onProfileChange) {
                this.onProfileChange(savedProfile);
            }
        } catch (e) {
            console.error('Failed to save profile:', e);
            alert('Failed to save profile. Please try again.');
        }
    },

    updateCharCount() {
        const currentLength = this.elements.detailsTextarea.value.length;
        const maxLength = 1000;

        this.elements.charCount.textContent = currentLength;

        // Update styling based on character count
        const counter = this.elements.charCount.parentElement;
        counter.classList.remove('warning', 'limit');

        if (currentLength >= maxLength) {
            counter.classList.add('limit');
        } else if (currentLength >= maxLength * 0.9) {
            counter.classList.add('warning');
        }
    },
};
