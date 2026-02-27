// Profile Modal Component - manages user profile (name, age, interests, topics)

const ProfileModal = {
    modal: null,
    overlay: null,
    elements: {
        nameInput: null,
        ageInput: null,
        interestsInput: null,
        interestsTags: null,
        topicsInput: null,
        topicsTags: null,
        saveBtn: null,
        cancelBtn: null,
    },
    currentProfile: {
        name: '',
        age: '',
        interests: [],
        topics: [],
    },
    onProfileChange: null, // Callback when profile is saved

    init() {
        // Get DOM elements
        this.modal = document.getElementById('profile-modal');
        this.overlay = this.modal.querySelector('.modal-overlay');
        this.elements.nameInput = document.getElementById('profile-name');
        this.elements.ageInput = document.getElementById('profile-age');
        this.elements.interestsInput = document.getElementById('interests-input');
        this.elements.interestsTags = document.getElementById('interests-tags');
        this.elements.topicsInput = document.getElementById('topics-input');
        this.elements.topicsTags = document.getElementById('topics-tags');
        this.elements.saveBtn = document.getElementById('profile-save');
        this.elements.cancelBtn = document.getElementById('profile-cancel');

        // Wire up event handlers
        this.overlay.addEventListener('click', () => this.close());
        this.elements.cancelBtn.addEventListener('click', () => this.close());
        this.elements.saveBtn.addEventListener('click', () => this.save());

        // Tag input handlers (Enter to add)
        this.elements.interestsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag('interests');
            }
        });

        this.elements.topicsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag('topics');
            }
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

        // Render interests tags
        this.renderTags('interests', this.currentProfile.interests || []);

        // Render topics tags
        this.renderTags('topics', this.currentProfile.topics || []);

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
                interests: this.currentProfile.interests,
                topics: this.currentProfile.topics,
            };

            // Save to storage
            const savedProfile = StorageService.saveUserProfile(profile);
            this.currentProfile = savedProfile;

            // Close modal
            this.close();

            // Trigger callback (to clear cache and refresh predictions)
            if (this.onProfileChange) {
                this.onProfileChange(savedProfile);
            }

            console.log('Profile saved:', savedProfile);
        } catch (e) {
            console.error('Failed to save profile:', e);
            alert('Failed to save profile. Please try again.');
        }
    },

    addTag(arrayName) {
        const input =
            arrayName === 'interests' ? this.elements.interestsInput : this.elements.topicsInput;
        const value = input.value.trim();

        if (!value) return;

        // Avoid duplicates
        const currentArray = this.currentProfile[arrayName];
        if (currentArray.includes(value)) {
            input.value = '';
            return;
        }

        // Limit to 20 tags
        if (currentArray.length >= 20) {
            alert(`Maximum 20 ${arrayName} allowed`);
            input.value = '';
            return;
        }

        // Add to array
        currentArray.push(value);
        input.value = '';

        // Re-render tags
        this.renderTags(arrayName, currentArray);
    },

    removeTag(arrayName, value) {
        const currentArray = this.currentProfile[arrayName];
        const index = currentArray.indexOf(value);
        if (index > -1) {
            currentArray.splice(index, 1);
        }

        // Re-render tags
        this.renderTags(arrayName, currentArray);
    },

    renderTags(arrayName, tags) {
        const container =
            arrayName === 'interests' ? this.elements.interestsTags : this.elements.topicsTags;

        container.innerHTML = '';

        tags.forEach((tag) => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip';
            chip.innerHTML = `
                <span class="tag-text">${this.escapeHtml(tag)}</span>
                <button class="tag-remove" aria-label="Remove ${tag}">×</button>
            `;

            // Wire up remove handler
            chip.querySelector('.tag-remove').addEventListener('click', () => {
                this.removeTag(arrayName, tag);
            });

            container.appendChild(chip);
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
};
