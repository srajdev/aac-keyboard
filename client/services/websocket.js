/**
 * WebSocket Service for Real-Time Predictions
 *
 * Manages persistent WebSocket connection with:
 * - Automatic reconnection with exponential backoff
 * - Request-response matching via requestId
 * - Connection state tracking
 * - Heartbeat to keep connection alive
 * - Graceful degradation to HTTP fallback
 */

const ConnectionState = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

const WebSocketService = {
    ws: null,
    connectionState: ConnectionState.DISCONNECTED,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000, // Start at 1s
    maxReconnectDelay: 30000, // Cap at 30s
    reconnectTimeout: null,

    pendingRequests: new Map(), // requestId -> { resolve, reject, timeout }
    streamCallbacks: new Map(), // requestId -> callback function for streaming updates
    connectionChangeCallbacks: [],
    heartbeatInterval: null,
    heartbeatTimeout: null,
    heartbeatIntervalMs: 30000, // 30 seconds
    heartbeatTimeoutMs: 5000, // 5 seconds to wait for pong

    /**
     * Connect to WebSocket server
     * @returns {Promise<void>}
     */
    async connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            console.log('[WebSocket] Already connected or connecting');
            return;
        }

        this._setConnectionState(ConnectionState.CONNECTING);

        return new Promise((resolve, reject) => {
            try {
                // Construct WebSocket URL based on current location
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.host;
                const wsUrl = `${protocol}//${host}/ws/predictions`;

                console.log(`[WebSocket] Connecting to ${wsUrl}...`);
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('[WebSocket] Connected successfully');
                    this.reconnectAttempts = 0;
                    this.reconnectDelay = 1000;
                    this._setConnectionState(ConnectionState.CONNECTED);
                    this._startHeartbeat();
                    resolve();
                };

                this.ws.onerror = (error) => {
                    console.error('[WebSocket] Connection error:', error);
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    this._handleClose(event);
                };

                this.ws.onmessage = (event) => {
                    this._handleMessage(event);
                };

            } catch (error) {
                console.error('[WebSocket] Failed to create connection:', error);
                this._setConnectionState(ConnectionState.ERROR);
                reject(error);
            }
        });
    },

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        console.log('[WebSocket] Disconnecting...');
        this._stopHeartbeat();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Reject all pending requests
        this.pendingRequests.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error('WebSocket disconnected'));
        });
        this.pendingRequests.clear();

        this._setConnectionState(ConnectionState.DISCONNECTED);
    },

    /**
     * Send a prediction request over WebSocket
     * @param {string} type - "words" or "phrases"
     * @param {string} partialInput - Current text
     * @param {string} conversationContext - Conversation context
     * @param {string} model - Model to use (claude/gemini/gpt)
     * @returns {Promise<Array>} - Prediction results
     */
    async sendRequest(type, partialInput, conversationContext, model = 'claude') {
        if (!this.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        const requestId = this._generateRequestId();

        return new Promise((resolve, reject) => {
            // Set timeout for request (10 seconds)
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Request timeout'));
            }, 10000);

            // Store promise handlers
            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            // Send request
            try {
                const message = {
                    type,
                    requestId,
                    partialInput,
                    conversationContext,
                    model
                };

                this.ws.send(JSON.stringify(message));
                console.log(`[WebSocket] Sent ${type} request:`, requestId);
            } catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        });
    },

    /**
     * Send a prediction request with streaming support
     * @param {string} type - "words" or "phrases"
     * @param {string} partialInput - Current text
     * @param {string} conversationContext - Conversation context
     * @param {Function} onChunk - Callback for streaming chunks (receives array of predictions)
     * @param {string} model - Model to use (claude/gemini/gpt)
     * @returns {Promise<Array>} - Final prediction results
     */
    async sendRequestWithStreaming(type, partialInput, conversationContext, onChunk, model = 'claude') {
        if (!this.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        const requestId = this._generateRequestId();

        return new Promise((resolve, reject) => {
            // Set up streaming callback
            this.streamCallbacks.set(requestId, onChunk);

            // Set timeout for request (10 seconds)
            const timeout = setTimeout(() => {
                this.streamCallbacks.delete(requestId);
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${requestId}`));
            }, 10000);

            // Store promise handlers
            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            // Send request
            try {
                const message = {
                    type,
                    requestId,
                    partialInput,
                    conversationContext,
                    model
                };

                this.ws.send(JSON.stringify(message));
                console.log(`[WebSocket] Sent ${type} streaming request:`, requestId);
            } catch (error) {
                clearTimeout(timeout);
                this.streamCallbacks.delete(requestId);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        });
    },

    /**
     * Cancel pending requests
     * @param {Array<string>} requestIds - Request IDs to cancel
     */
    cancelRequests(requestIds) {
        if (!this.isConnected() || !requestIds || requestIds.length === 0) {
            return;
        }

        try {
            // Send cancel message
            this.ws.send(JSON.stringify({
                type: 'cancel',
                requestIds
            }));

            console.log(`[WebSocket] Sent cancel message for ${requestIds.length} requests`);

            // Clean up pending requests
            requestIds.forEach(requestId => {
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    pending.reject(new Error('Request cancelled'));
                    this.pendingRequests.delete(requestId);
                }
            });
        } catch (error) {
            console.error('[WebSocket] Failed to cancel requests:', error);
        }
    },

    /**
     * Register callback for connection state changes
     * @param {Function} callback - Called with new state
     */
    onConnectionChange(callback) {
        this.connectionChangeCallbacks.push(callback);
    },

    /**
     * Check if WebSocket is connected
     * @returns {boolean}
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN && this.connectionState === ConnectionState.CONNECTED;
    },

    /**
     * Get current connection state
     * @returns {string}
     */
    getConnectionState() {
        return this.connectionState;
    },

    // Internal methods

    _setConnectionState(state) {
        if (this.connectionState !== state) {
            console.log(`[WebSocket] State change: ${this.connectionState} -> ${state}`);
            this.connectionState = state;
            this.connectionChangeCallbacks.forEach(callback => {
                try {
                    callback(state);
                } catch (error) {
                    console.error('[WebSocket] Error in connection change callback:', error);
                }
            });
        }
    },

    _handleMessage(event) {
        try {
            const message = JSON.parse(event.data);

            if (message.type === 'pong') {
                // Heartbeat response
                this._clearHeartbeatTimeout();
                return;
            }

            // Handle streaming messages
            if (message.type === 'stream_chunk') {
                // Streaming chunk - call callback but don't resolve promise yet
                const callback = this.streamCallbacks.get(message.requestId);
                if (callback) {
                    try {
                        callback(message.predictions);
                    } catch (error) {
                        console.error('[WebSocket] Error in stream callback:', error);
                    }
                }
                return;
            }

            if (message.type === 'stream_complete') {
                // Stream finished successfully
                const pending = this.pendingRequests.get(message.requestId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingRequests.delete(message.requestId);
                    this.streamCallbacks.delete(message.requestId);
                    console.log(`[WebSocket] Stream complete (${message.predictionType}):`, message.requestId);
                    pending.resolve(message.predictions);
                }
                return;
            }

            if (message.type === 'stream_error') {
                // Stream error - resolve with partial results if available
                const pending = this.pendingRequests.get(message.requestId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingRequests.delete(message.requestId);
                    this.streamCallbacks.delete(message.requestId);

                    console.error(`[WebSocket] Stream error (${message.predictionType}):`, message.message);

                    // If we have partial predictions, resolve with those
                    if (message.predictions && message.predictions.length > 0) {
                        console.log('[WebSocket] Resolving with partial predictions:', message.predictions);
                        pending.resolve(message.predictions);
                    } else {
                        pending.reject(new Error(message.message));
                    }
                }
                return;
            }

            // Handle legacy non-streaming messages (for backward compatibility)
            const requestId = message.requestId;
            const pending = this.pendingRequests.get(requestId);

            if (!pending) {
                console.warn(`[WebSocket] Received response for unknown request: ${requestId}`);
                return;
            }

            // Clear timeout
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);

            if (message.type === 'error') {
                console.error(`[WebSocket] Request error:`, message.message);
                pending.reject(new Error(message.message));
            } else if (message.success && message.data) {
                console.log(`[WebSocket] Received ${message.type} response:`, requestId);
                pending.resolve(message.data);
            } else {
                pending.reject(new Error('Invalid response format'));
            }

        } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
        }
    },

    _handleClose(event) {
        console.log(`[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason})`);
        this._stopHeartbeat();

        // Reject all pending requests
        this.pendingRequests.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error('WebSocket closed'));
        });
        this.pendingRequests.clear();

        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this._reconnect();
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnection attempts reached, giving up');
            this._setConnectionState(ConnectionState.ERROR);
        } else {
            this._setConnectionState(ConnectionState.DISCONNECTED);
        }
    },

    _reconnect() {
        if (this.reconnectTimeout) {
            return; // Already scheduled
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay, this.maxReconnectDelay);

        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this._setConnectionState(ConnectionState.CONNECTING);

        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectTimeout = null;

            try {
                await this.connect();
                console.log('[WebSocket] Reconnection successful');
            } catch (error) {
                console.error('[WebSocket] Reconnection failed:', error);
                // Exponential backoff
                this.reconnectDelay *= 2;
            }
        }, delay);
    },

    _startHeartbeat() {
        this._stopHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                try {
                    this.ws.send(JSON.stringify({ type: 'ping' }));

                    // Set timeout to wait for pong
                    this.heartbeatTimeout = setTimeout(() => {
                        console.warn('[WebSocket] Heartbeat timeout, closing connection');
                        this.ws.close();
                    }, this.heartbeatTimeoutMs);

                } catch (error) {
                    console.error('[WebSocket] Failed to send heartbeat:', error);
                }
            }
        }, this.heartbeatIntervalMs);
    },

    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this._clearHeartbeatTimeout();
    },

    _clearHeartbeatTimeout() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    },

    _generateRequestId() {
        // Fallback UUID generator for browsers that don't support crypto.randomUUID
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback: generate a simple unique ID
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

// Make available globally
window.WebSocketService = WebSocketService;
