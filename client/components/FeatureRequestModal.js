// FeatureRequestModal Component — in-app feature request chat via Claude Code

const FeatureRequestModal = {
    modal: null,
    overlay: null,
    closeBtn: null,
    messagesEl: null,
    historyEl: null,
    statusEl: null,
    actionsEl: null,
    approveBtn: null,
    rejectBtn: null,
    inputEl: null,
    inputRowEl: null,
    sendBtn: null,
    phaseBadge: null,
    tabChat: null,
    tabHistory: null,
    newBtn: null,

    ws: null,
    phase: 'gather',
    waitingForResponse: false,
    activeTab: 'chat',

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
        this.historyEl  = document.getElementById('fr-history');
        this.statusEl   = document.getElementById('fr-status');
        this.actionsEl  = document.getElementById('fr-actions');
        this.approveBtn = document.getElementById('fr-approve-btn');
        this.rejectBtn  = document.getElementById('fr-reject-btn');
        this.inputEl    = document.getElementById('fr-input');
        this.inputRowEl = document.getElementById('fr-input-row');
        this.sendBtn    = document.getElementById('fr-send-btn');
        this.phaseBadge = document.getElementById('fr-phase-badge');
        this.tabChat    = document.getElementById('fr-tab-chat');
        this.tabHistory = document.getElementById('fr-tab-history');
        this.newBtn     = document.getElementById('fr-new-btn');

        if (this.overlay)  this.overlay.addEventListener('click', () => this.close());
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.sendBtn)  this.sendBtn.addEventListener('click', () => this._handleSend());
        if (this.approveBtn) this.approveBtn.addEventListener('click', () => this._handleApprove());
        if (this.rejectBtn)  this.rejectBtn.addEventListener('click', () => this._handleReject());
        if (this.newBtn)     this.newBtn.addEventListener('click', () => this._handleNew());
        if (this.tabChat)    this.tabChat.addEventListener('click', () => this._switchTab('chat'));
        if (this.tabHistory) this.tabHistory.addEventListener('click', () => this._switchTab('history'));

        if (this.inputEl) {
            this.inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._handleSend();
                }
            });
        }
    },

    open() {
        if (!this.modal) return;
        this._restoreMessages();
        this.modal.style.display = 'flex';
        this._switchTab('chat');
        this._connectWS();
        if (this.inputEl) this.inputEl.focus();
    },

    close() {
        if (!this.modal) return;
        this.modal.style.display = 'none';
    },

    // ── Tab switching ────────────────────────────────────────────────────────

    _switchTab(tab) {
        this.activeTab = tab;

        const isChat = tab === 'chat';
        if (this.messagesEl) this.messagesEl.style.display = isChat ? 'flex' : 'none';
        if (this.historyEl)  this.historyEl.style.display  = isChat ? 'none' : 'flex';
        if (this.inputRowEl) this.inputRowEl.style.display = isChat ? 'flex' : 'none';
        if (this.actionsEl && this.phase !== 'review') {
            // keep actions visible only in review, regardless of tab
        }

        if (this.tabChat)    this.tabChat.classList.toggle('active',    isChat);
        if (this.tabHistory) this.tabHistory.classList.toggle('active', !isChat);

        if (!isChat) {
            this._loadHistory();
        }
    },

    // ── WebSocket ────────────────────────────────────────────────────────────

    _connectWS() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'get_session' }));
            return;
        }

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${location.host}/ws/feature-request`);

        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({ type: 'get_session' }));
        };

        this.ws.onmessage = (event) => {
            try { this._onWSMessage(JSON.parse(event.data)); }
            catch (e) { console.error('[FeatureRequest] WS parse error:', e); }
        };

        this.ws.onerror = (err) => console.error('[FeatureRequest] WS error:', err);
        this.ws.onclose = () => console.log('[FeatureRequest] WS closed');
    },

    _wsSend(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            this._connectWS();
            this.ws.addEventListener('open', () => this.ws.send(JSON.stringify(data)), { once: true });
        }
    },

    // ── WS message handler ───────────────────────────────────────────────────

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
                if (data.branch) this._setStatus(`Branch created: <code>${data.branch}</code>`);
                break;

            case 'reload_required':
                this._setStatus(
                    `${data.message || 'Changes deployed.'} ` +
                    `<button class="fr-reload-btn" onclick="location.reload()">Refresh Now</button>`
                );
                break;

            case 'merged':
                this._appendMessage('system', 'Merged! Reloading in 2 seconds...');
                this._clearStorage();
                if (data.entry) this._prependHistoryEntry(data.entry);
                setTimeout(() => location.reload(), 2000);
                break;

            case 'reverted':
                this._appendMessage('system', 'Branch reverted. Back to base branch.');
                this._clearStorage();
                if (data.entry) this._prependHistoryEntry(data.entry);
                this._setPhase('gather');
                this._setStatus('');
                this._showActions(false);
                this._setSendEnabled(true);
                this.waitingForResponse = false;
                break;

            case 'session_reset':
                this._clearStorage();
                this._setPhase('gather');
                this._setStatus('');
                this._showActions(false);
                this._setSendEnabled(true);
                this.waitingForResponse = false;
                this._appendMessage('system', 'Ready for a new request.');
                break;

            case 'session_state':
                if (data.has_session) {
                    this._setPhase(data.phase || 'gather');
                    if (data.branch) this._setStatus(`Active branch: <code>${data.branch}</code>`);
                    if (data.phase === 'review') this._showActions(true);
                    if (this.messagesEl.children.length === 0) {
                        this._appendMessage('system', 'Resumed existing conversation.');
                    }
                } else {
                    this._clearStorage();
                    this._setPhase('gather');
                    this._appendMessage('system', 'Hi! Describe a change you\'d like to see in the keyboard app.');
                }
                break;

            case 'history':
                this._renderHistory(data.entries || []);
                break;

            case 'error':
                this._removeThinking();
                this._appendMessage('error', `Error: ${data.message}`);
                this._setSendEnabled(true);
                this.waitingForResponse = false;
                break;
        }
    },

    // ── Actions ──────────────────────────────────────────────────────────────

    _handleSend() {
        if (!this.inputEl || this.waitingForResponse) return;
        const text = this.inputEl.value.trim();
        if (!text) return;

        this._appendMessage('dad', text);
        this.inputEl.value = '';
        this._setSendEnabled(false);
        this.waitingForResponse = true;
        this._wsSend({ type: 'message', text });
    },

    _handleApprove() {
        this._showActions(false);
        this._wsSend({ type: 'approve' });
    },

    _handleReject() {
        this._showActions(false);
        this._wsSend({ type: 'reject' });
    },

    _handleNew() {
        if (this.phase === 'review' || this.phase === 'implement') {
            // Branch exists — confirm before discarding
            this._showConfirm(
                'This will discard the current branch and any uncommitted changes. Start fresh?',
                () => this._wsSend({ type: 'new_request' }),
            );
        } else if (this.phase !== 'gather' || this.messagesEl?.children.length > 1) {
            // Conversation in progress but no branch yet
            this._showConfirm(
                'Start a new request? The current conversation will be cleared.',
                () => this._wsSend({ type: 'new_request' }),
            );
        } else {
            // Nothing meaningful started — just reset quietly
            this._wsSend({ type: 'new_request' });
        }
    },

    // ── History ──────────────────────────────────────────────────────────────

    _loadHistory() {
        if (this.historyEl) this.historyEl.innerHTML = '<div class="fr-history-empty">Loading...</div>';
        this._wsSend({ type: 'get_history' });
    },

    _renderHistory(entries) {
        if (!this.historyEl) return;
        if (!entries.length) {
            this.historyEl.innerHTML = '<div class="fr-history-empty">No requests yet.</div>';
            return;
        }
        this.historyEl.innerHTML = '';
        for (const e of entries) {
            this.historyEl.appendChild(this._buildHistoryEntry(e));
        }
    },

    _prependHistoryEntry(entry) {
        if (!this.historyEl) return;
        const empty = this.historyEl.querySelector('.fr-history-empty');
        if (empty) empty.remove();
        this.historyEl.prepend(this._buildHistoryEntry(entry));
    },

    _buildHistoryEntry(e) {
        const div = document.createElement('div');
        div.className = `fr-history-entry ${e.status}`;

        const date = e.timestamp ? new Date(e.timestamp).toLocaleString([], {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '';

        div.innerHTML = `
            <span class="fr-history-status">${e.status}</span>
            <div class="fr-history-body">
                <div class="fr-history-title">${this._escape(e.title)}</div>
                <div class="fr-history-meta">${e.branch ? this._escape(e.branch) + ' · ' : ''}${date}</div>
            </div>`;
        return div;
    },

    // ── Confirm overlay ──────────────────────────────────────────────────────

    _showConfirm(message, onYes) {
        const panel = this.modal?.querySelector('.feature-request-panel');
        if (!panel) return;

        const overlay = document.createElement('div');
        overlay.className = 'fr-confirm';
        overlay.innerHTML = `
            <p>${this._escape(message)}</p>
            <div class="fr-confirm-btns">
                <button class="fr-confirm-yes">Yes, start fresh</button>
                <button class="fr-confirm-no">Cancel</button>
            </div>`;

        overlay.querySelector('.fr-confirm-yes').addEventListener('click', () => {
            overlay.remove();
            onYes();
        });
        overlay.querySelector('.fr-confirm-no').addEventListener('click', () => overlay.remove());

        panel.appendChild(overlay);
    },

    // ── Message helpers ──────────────────────────────────────────────────────

    _appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `fr-message ${role}`;
        div.textContent = text;
        this.messagesEl.appendChild(div);
        this._scrollToBottom();
        if (role === 'dad' || role === 'claude') {
            this._saveMessage(role, text);
        }
    },

    _showThinking() {
        this._removeThinking();
        const div = document.createElement('div');
        div.className = 'fr-message claude fr-thinking';
        div.innerHTML = '<div class="fr-thinking-dots"><span></span><span></span><span></span></div>';
        this.messagesEl.appendChild(div);
        this._scrollToBottom();
    },

    _removeThinking() {
        const el = this.messagesEl?.querySelector('.fr-thinking');
        if (el) el.remove();
    },

    // ── localStorage ────────────────────────────────────────────────────────

    _saveMessage(role, text) {
        try {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            stored.push({ role, text });
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
        } catch (e) {}
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
        } catch (e) {}
    },

    _clearStorage() {
        try { localStorage.removeItem(this.STORAGE_KEY); } catch (e) {}
        if (this.messagesEl) this.messagesEl.innerHTML = '';
    },

    // ── UI state helpers ─────────────────────────────────────────────────────

    _setPhase(phase) {
        this.phase = phase;
        if (this.phaseBadge) {
            this.phaseBadge.textContent = this.PHASE_LABELS[phase] || phase.toUpperCase();
            this.phaseBadge.className = 'fr-phase-badge ' + phase;
        }
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
        if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    },

    _escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },
};
