// FeatureRequestModal Component — in-app feature request chat via Claude Code

const FeatureRequestModal = {
    modal: null,
    overlay: null,
    closeBtn: null,
    messagesEl: null,
    statusEl: null,
    actionsEl: null,
    approveBtn: null,
    rejectBtn: null,
    inputEl: null,
    sendBtn: null,
    phaseBadge: null,

    ws: null,
    phase: 'gather',
    waitingForResponse: false,
    STORAGE_KEY: 'fr_messages',

    PHASE_LABELS: {
        gather:     'GATHERING',
        plan:       'PLANNING',
        implement:  'IMPLEMENTING',
        review:     'REVIEW',
        done:       'DONE',
    },

    init() {
        this.modal      = document.getElementById('feature-request-modal');
        this.overlay    = this.modal?.querySelector('.modal-overlay');
        this.closeBtn   = document.getElementById('fr-close-btn');
        this.messagesEl = document.getElementById('fr-messages');
        this.statusEl   = document.getElementById('fr-status');
        this.actionsEl  = document.getElementById('fr-actions');
        this.approveBtn = document.getElementById('fr-approve-btn');
        this.rejectBtn  = document.getElementById('fr-reject-btn');
        this.inputEl    = document.getElementById('fr-input');
        this.sendBtn    = document.getElementById('fr-send-btn');
        this.phaseBadge = document.getElementById('fr-phase-badge');

        if (this.overlay) this.overlay.addEventListener('click', () => this.close());
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());

        if (this.sendBtn) this.sendBtn.addEventListener('click', () => this._handleSend());
        if (this.inputEl) {
            this.inputEl.addEventListener('keydown', (e) => {
                // Ctrl+Enter or just Enter (not shift) sends the message
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._handleSend();
                }
            });
        }

        if (this.approveBtn) this.approveBtn.addEventListener('click', () => this._handleApprove());
        if (this.rejectBtn)  this.rejectBtn.addEventListener('click', () => this._handleReject());
    },

    open() {
        if (!this.modal) return;
        this._restoreMessages();
        this.modal.style.display = 'flex';
        this._connectWS();
        if (this.inputEl) this.inputEl.focus();
    },

    close() {
        if (!this.modal) return;
        this.modal.style.display = 'none';
        // Keep WS open — conversation persists across close/open
    },

    _connectWS() {
        // If already connected, just ask for current state
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'get_session' }));
            return;
        }

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}/ws/feature-request`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FeatureRequest] WS connected');
            this.ws.send(JSON.stringify({ type: 'get_session' }));
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this._onWSMessage(data);
            } catch (e) {
                console.error('[FeatureRequest] WS parse error:', e);
            }
        };

        this.ws.onerror = (err) => {
            console.error('[FeatureRequest] WS error:', err);
        };

        this.ws.onclose = () => {
            console.log('[FeatureRequest] WS closed');
        };
    },

    _onWSMessage(data) {
        switch (data.type) {
            case 'thinking':
                this._showThinking();
                break;

            case 'response':
                this._removeThinking();
                this._appendMessage('claude', data.text);
                if (data.phase) this._setPhase(data.phase);
                this._setSendEnabled(true);
                this.waitingForResponse = false;
                break;

            case 'phase_change':
                this._setPhase(data.phase);
                if (data.branch) {
                    this._setStatus(`Branch created: <code>${data.branch}</code>`);
                }
                break;

            case 'reload_required':
                this._setStatus(
                    `${data.message || 'Changes deployed.'} ` +
                    `<button class="fr-reload-btn" onclick="location.reload()">Refresh Now</button>`
                );
                break;

            case 'merged':
                this._appendMessage('system', 'Merged to main! Reloading in 2 seconds...');
                this._clearStorage();
                setTimeout(() => location.reload(), 2000);
                break;

            case 'reverted':
                this._appendMessage('system', 'Branch reverted. Back to main.');
                this._clearStorage();
                this._setPhase('gather');
                this._setStatus('');
                this._showActions(false);
                this._setSendEnabled(true);
                this.waitingForResponse = false;
                break;

            case 'session_state':
                if (data.has_session) {
                    this._setPhase(data.phase || 'gather');
                    if (data.branch) {
                        this._setStatus(`Active branch: <code>${data.branch}</code>`);
                    }
                    if (data.phase === 'review') {
                        this._showActions(true);
                    }
                    // Only show "Resumed" if there's no saved history to restore
                    if (this.messagesEl.children.length === 0) {
                        this._appendMessage('system', 'Resumed existing conversation.');
                    }
                } else {
                    // No active session — clear any stale history and show greeting
                    this._clearStorage();
                    this._setPhase('gather');
                    this._appendMessage('system', 'Hi! Describe a change you\'d like to see in the keyboard app.');
                }
                break;

            case 'error':
                this._removeThinking();
                this._appendMessage('error', `Error: ${data.message}`);
                this._setSendEnabled(true);
                this.waitingForResponse = false;
                break;
        }
    },

    _handleSend() {
        if (!this.inputEl || this.waitingForResponse) return;
        const text = this.inputEl.value.trim();
        if (!text) return;

        this._appendMessage('dad', text);
        this.inputEl.value = '';
        this._setSendEnabled(false);
        this.waitingForResponse = true;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'message', text }));
        } else {
            // Reconnect then send
            this._connectWS();
            this.ws.addEventListener('open', () => {
                this.ws.send(JSON.stringify({ type: 'message', text }));
            }, { once: true });
        }
    },

    _handleApprove() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._showActions(false);
            this.ws.send(JSON.stringify({ type: 'approve' }));
        }
    },

    _handleReject() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._showActions(false);
            this.ws.send(JSON.stringify({ type: 'reject' }));
        }
    },

    _appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `fr-message ${role}`;
        div.textContent = text;
        this.messagesEl.appendChild(div);
        this._scrollToBottom();
        // Only persist real conversation turns — not transient status messages
        if (role === 'dad' || role === 'claude') {
            this._saveMessage(role, text);
        }
    },

    _saveMessage(role, text) {
        try {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            stored.push({ role, text });
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
        } catch (e) { /* storage full or unavailable */ }
    },

    _restoreMessages() {
        if (!this.messagesEl) return;
        this.messagesEl.innerHTML = '';
        try {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            for (const { role, text } of stored) {
                const div = document.createElement('div');
                div.className = `fr-message ${role}`;
                div.textContent = text;
                this.messagesEl.appendChild(div);
            }
            if (stored.length > 0) this._scrollToBottom();
        } catch (e) { /* corrupted data */ }
    },

    _clearStorage() {
        try { localStorage.removeItem(this.STORAGE_KEY); } catch (e) {}
        if (this.messagesEl) this.messagesEl.innerHTML = '';
    },

    _showThinking() {
        // Remove any existing thinking indicator first
        this._removeThinking();
        const div = document.createElement('div');
        div.className = 'fr-message claude fr-thinking';
        div.innerHTML = '<div class="fr-thinking-dots"><span></span><span></span><span></span></div>';
        this.messagesEl.appendChild(div);
        this._scrollToBottom();
    },

    _removeThinking() {
        const el = this.messagesEl.querySelector('.fr-thinking');
        if (el) el.remove();
    },

    _setPhase(phase) {
        this.phase = phase;
        if (this.phaseBadge) {
            this.phaseBadge.textContent = this.PHASE_LABELS[phase] || phase.toUpperCase();
            // Remove all phase classes, add the current one
            this.phaseBadge.className = 'fr-phase-badge ' + phase;
        }
        // Show approve/reject only in review
        this._showActions(phase === 'review');
    },

    _setStatus(html) {
        if (this.statusEl) this.statusEl.innerHTML = html;
    },

    _showActions(show) {
        if (this.actionsEl) this.actionsEl.style.display = show ? 'flex' : 'none';
    },

    _setSendEnabled(enabled) {
        if (this.sendBtn) this.sendBtn.disabled = !enabled;
    },

    _scrollToBottom() {
        if (this.messagesEl) {
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        }
    },
};
