// API Service - handles communication with the backend

// WebSocket is default, with HTTP fallback
const USE_WEBSOCKET = true;

// LRU Cache for prediction responses
class PredictionCache {
    constructor(maxSize = 500, ttlMs = 5 * 60 * 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    makeKey(partialInput, conversationContext, profileHash = '') {
        return `${partialInput}|${conversationContext}|${profileHash}`;
    }

    // Helper to generate profile hash for cache key
    _hashProfile(profile) {
        if (!profile || Object.keys(profile).length === 0) {
            return '';
        }
        const str = JSON.stringify(profile);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }

    get(partialInput, conversationContext, profileHash = '') {
        const key = this.makeKey(partialInput, conversationContext, profileHash);
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }

        // Move to end (LRU)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.data;
    }

    set(partialInput, conversationContext, data, profileHash = '') {
        const key = this.makeKey(partialInput, conversationContext, profileHash);

        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data: data,
            timestamp: Date.now(),
        });
    }

    clear() {
        this.cache.clear();
    }

    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}

// Performance metrics tracker
class PerformanceTracker {
    constructor(maxEntries = 100) {
        this.metrics = [];
        this.maxEntries = maxEntries;
    }

    recordMetric(metric) {
        this.metrics.push(metric);

        // Keep only last maxEntries
        if (this.metrics.length > this.maxEntries) {
            this.metrics.shift();
        }

        // Save to localStorage
        try {
            localStorage.setItem('api_metrics', JSON.stringify(this.metrics));
        } catch (e) {
            console.warn('Failed to save metrics to localStorage:', e);
        }
    }

    getMetrics() {
        return this.metrics;
    }

    getStatsByModel(model) {
        const modelMetrics = this.metrics.filter(m => m.model === model);

        if (modelMetrics.length === 0) {
            return null;
        }

        const latencies = modelMetrics.map(m => m.totalDuration);
        latencies.sort((a, b) => a - b);

        return {
            count: modelMetrics.length,
            avgLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
            p95Latency: Math.round(latencies[Math.floor(latencies.length * 0.95)] || 0),
            cacheHitRate: Math.round((modelMetrics.filter(m => m.cacheHit).length / modelMetrics.length) * 100),
        };
    }

    getOverallStats() {
        if (this.metrics.length === 0) {
            return null;
        }

        return {
            totalRequests: this.metrics.length,
            cacheHitRate: Math.round((this.metrics.filter(m => m.cacheHit).length / this.metrics.length) * 100),
        };
    }

    clear() {
        this.metrics = [];
        try {
            localStorage.removeItem('api_metrics');
        } catch (e) {
            console.warn('Failed to clear metrics from localStorage:', e);
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('api_metrics');
            if (stored) {
                this.metrics = JSON.parse(stored);
                // Keep only last maxEntries
                if (this.metrics.length > this.maxEntries) {
                    this.metrics = this.metrics.slice(-this.maxEntries);
                }
            }
        } catch (e) {
            console.warn('Failed to load metrics from localStorage:', e);
        }
    }
}

const ApiService = {
    baseUrl: '',
    cache: new PredictionCache(),
    performanceTracker: new PerformanceTracker(),
    // Streaming callbacks - set by the app for incremental updates
    onWordsUpdate: null,
    onPhrasesUpdate: null,

    init() {
        this.performanceTracker.loadFromStorage();
    },

    async getPredictions(partialInput, conversationContext, signal, model = 'claude') {
        const requestStart = performance.now();
        let cacheHit = false;

        try {
            // Check cache first
            const cached = this.cache.get(partialInput, conversationContext);
            if (cached) {
                cacheHit = true;
                const totalDuration = performance.now() - requestStart;

                // Record metrics for cache hit
                this.performanceTracker.recordMetric({
                    timestamp: Date.now(),
                    model: model,
                    cacheHit: true,
                    totalDuration: totalDuration,
                    networkDuration: 0,
                    parseDuration: 0,
                });

                console.log(`[Cache HIT] ${totalDuration.toFixed(0)}ms | ${model}`);
                return cached;
            }

            // Cache miss - make API call
            const networkStart = performance.now();
            const response = await fetch(`${this.baseUrl}/api/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    partialInput: partialInput || '',
                    conversationContext: conversationContext || '',
                    model: model,
                }),
                signal: signal,
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const networkEnd = performance.now();
            const parseStart = performance.now();
            const data = await response.json();
            const parseEnd = performance.now();
            const totalDuration = parseEnd - requestStart;

            // Store in cache
            this.cache.set(partialInput, conversationContext, data);

            // Record metrics
            this.performanceTracker.recordMetric({
                timestamp: Date.now(),
                model: model,
                cacheHit: false,
                totalDuration: totalDuration,
                networkDuration: networkEnd - networkStart,
                parseDuration: parseEnd - parseStart,
            });

            console.log(`[Cache MISS] ${totalDuration.toFixed(0)}ms (network: ${(networkEnd - networkStart).toFixed(0)}ms) | ${model}`);

            return data;
        } catch (error) {
            // Re-throw abort errors so caller can handle them
            if (error.name === 'AbortError') {
                throw error;
            }
            console.error('Prediction API error:', error);

            // Return fallback predictions
            return {
                phrases: [
                    'I would like some help please',
                    'Can you please wait a moment',
                    'I want to say something',
                ],
                words: ['yes', 'no', 'please', 'thanks', 'help'],
                letters: ['i', 'y', 'n', 't', 'w'],
            };
        }
    },

    clearCache() {
        this.cache.clear();
        console.log('[Cache] Cleared');
    },

    getCacheStats() {
        return this.cache.getStats();
    },

    getPerformanceStats() {
        return {
            byModel: {
                claude: this.performanceTracker.getStatsByModel('claude'),
                gemini: this.performanceTracker.getStatsByModel('gemini'),
            },
            overall: this.performanceTracker.getOverallStats(),
        };
    },

    clearMetrics() {
        this.performanceTracker.clear();
        console.log('[Metrics] Cleared');
    },

    async getPhrases(partialInput, conversationContext, signal, model = 'claude') {
        const requestStart = performance.now();

        try {
            // Get user profile
            const userProfile = StorageService.getUserProfile();
            const profileHash = this.cache._hashProfile(userProfile);

            // Check cache first (using phrase-specific key with profile hash)
            const cacheKey = `phrases|${partialInput}|${conversationContext}`;
            const cached = this.cache.get(cacheKey, '', profileHash);
            if (cached && cached.phrases) {
                const totalDuration = performance.now() - requestStart;

                this.performanceTracker.recordMetric({
                    timestamp: Date.now(),
                    model: `${model}-phrases`,
                    cacheHit: true,
                    totalDuration: totalDuration,
                    networkDuration: 0,
                    parseDuration: 0,
                });

                console.log(`[Cache HIT - Phrases] ${totalDuration.toFixed(0)}ms | ${model}`);
                return cached.phrases;
            }

            // Route based on mode
            if (USE_WEBSOCKET && window.WebSocketService && window.WebSocketService.isConnected()) {
                try {
                    const startTime = performance.now();
                    let firstChunkTime = null;

                    // Use streaming WebSocket request
                    const phrases = await window.WebSocketService.sendRequestWithStreaming(
                        'phrases',
                        partialInput,
                        conversationContext,
                        (partialPhrases) => {
                            // Record time to first prediction
                            if (!firstChunkTime && partialPhrases.length > 0) {
                                firstChunkTime = performance.now() - startTime;
                                console.log(`[WebSocket - Phrases] First prediction at ${firstChunkTime.toFixed(0)}ms`);
                            }

                            // Call streaming update callback if set
                            if (this.onPhrasesUpdate) {
                                try {
                                    this.onPhrasesUpdate(partialPhrases);
                                } catch (error) {
                                    console.error('Error in onPhrasesUpdate callback:', error);
                                }
                            }
                        },
                        model,
                        userProfile
                    );
                    const duration = performance.now() - startTime;

                    // Cache and track performance
                    this.cache.set(cacheKey, '', { phrases }, profileHash);
                    this.performanceTracker.recordMetric({
                        timestamp: Date.now(),
                        model: `${model}-phrases`,
                        cacheHit: false,
                        totalDuration: duration,
                        firstChunkTime: firstChunkTime,
                        networkDuration: duration,
                        parseDuration: 0,
                        source: 'websocket-stream',
                    });

                    console.log(`[WebSocket - Phrases] Complete at ${duration.toFixed(0)}ms (first: ${firstChunkTime?.toFixed(0) || 'N/A'}ms) | ${model}`);
                    return phrases;
                } catch (error) {
                    console.warn('WebSocket request failed, falling back to HTTP:', error);
                    // Fall through to HTTP
                }
            }

            // HTTP fallback
            return await this._fetchPhrasesHTTP(partialInput, conversationContext, signal, model, cacheKey, requestStart, userProfile, profileHash);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            console.error('Phrase prediction API error:', error);

            // Return fallback phrases
            return [
                'I would like some help please',
                'Can you please wait a moment',
                'I want to say something',
            ];
        }
    },

    async _fetchPhrasesHTTP(partialInput, conversationContext, signal, model, cacheKey, requestStart, userProfile = {}, profileHash = '') {
        // Cache miss - make HTTP API call
        const networkStart = performance.now();
        const response = await fetch(`${this.baseUrl}/api/predict/phrases`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                partialInput: partialInput || '',
                conversationContext: conversationContext || '',
                model: model,
                userProfile: userProfile,
            }),
            signal: signal,
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const networkEnd = performance.now();
        const parseStart = performance.now();
        const data = await response.json();
        const parseEnd = performance.now();
        const totalDuration = parseEnd - requestStart;

        // Store in cache
        this.cache.set(cacheKey, '', { phrases: data.phrases }, profileHash);

        // Record metrics
        this.performanceTracker.recordMetric({
            timestamp: Date.now(),
            model: `${model}-phrases`,
            cacheHit: false,
            totalDuration: totalDuration,
            networkDuration: networkEnd - networkStart,
            parseDuration: parseEnd - parseStart,
            source: 'http',
        });

        console.log(`[HTTP - Phrases] ${totalDuration.toFixed(0)}ms (network: ${(networkEnd - networkStart).toFixed(0)}ms) | ${model}`);

        return data.phrases;
    },

    async getWords(partialInput, conversationContext, signal, model = 'claude') {
        const requestStart = performance.now();

        try {
            // Get user profile
            const userProfile = StorageService.getUserProfile();
            const profileHash = this.cache._hashProfile(userProfile);

            // Check cache first (using word-specific key with profile hash)
            const cacheKey = `words|${partialInput}|${conversationContext}`;
            const cached = this.cache.get(cacheKey, '', profileHash);
            if (cached && cached.words) {
                const totalDuration = performance.now() - requestStart;

                this.performanceTracker.recordMetric({
                    timestamp: Date.now(),
                    model: `${model}-words`,
                    cacheHit: true,
                    totalDuration: totalDuration,
                    networkDuration: 0,
                    parseDuration: 0,
                });

                console.log(`[Cache HIT - Words] ${totalDuration.toFixed(0)}ms | ${model}`);
                return cached.words;
            }

            // Route based on mode
            if (USE_WEBSOCKET && window.WebSocketService && window.WebSocketService.isConnected()) {
                try {
                    const startTime = performance.now();
                    let firstChunkTime = null;

                    // Use streaming WebSocket request
                    const words = await window.WebSocketService.sendRequestWithStreaming(
                        'words',
                        partialInput,
                        conversationContext,
                        (partialWords) => {
                            // Record time to first prediction
                            if (!firstChunkTime && partialWords.length > 0) {
                                firstChunkTime = performance.now() - startTime;
                                console.log(`[WebSocket - Words] First prediction at ${firstChunkTime.toFixed(0)}ms`);
                            }

                            // Call streaming update callback if set
                            if (this.onWordsUpdate) {
                                try {
                                    this.onWordsUpdate(partialWords);
                                } catch (error) {
                                    console.error('Error in onWordsUpdate callback:', error);
                                }
                            }
                        },
                        model,
                        userProfile
                    );
                    const duration = performance.now() - startTime;

                    // Cache and track performance
                    this.cache.set(cacheKey, '', { words }, profileHash);
                    this.performanceTracker.recordMetric({
                        timestamp: Date.now(),
                        model: `${model}-words`,
                        cacheHit: false,
                        totalDuration: duration,
                        firstChunkTime: firstChunkTime,
                        networkDuration: duration,
                        parseDuration: 0,
                        source: 'websocket-stream',
                    });

                    console.log(`[WebSocket - Words] Complete at ${duration.toFixed(0)}ms (first: ${firstChunkTime?.toFixed(0) || 'N/A'}ms) | ${model}`);
                    return words;
                } catch (error) {
                    console.warn('WebSocket request failed, falling back to HTTP:', error);
                    // Fall through to HTTP
                }
            }

            // HTTP fallback
            return await this._fetchWordsHTTP(partialInput, conversationContext, signal, model, cacheKey, requestStart, userProfile, profileHash);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            console.error('Word prediction API error:', error);

            // Return fallback words
            return ['yes', 'no', 'please', 'thanks', 'help'];
        }
    },

    async _fetchWordsHTTP(partialInput, conversationContext, signal, model, cacheKey, requestStart, userProfile = {}, profileHash = '') {
        // Cache miss - make HTTP API call
        const networkStart = performance.now();
        const response = await fetch(`${this.baseUrl}/api/predict/words`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                partialInput: partialInput || '',
                conversationContext: conversationContext || '',
                model: model,
                userProfile: userProfile,
            }),
            signal: signal,
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const networkEnd = performance.now();
        const parseStart = performance.now();
        const data = await response.json();
        const parseEnd = performance.now();
        const totalDuration = parseEnd - requestStart;

        // Store in cache
        this.cache.set(cacheKey, '', { words: data.words }, profileHash);

        // Record metrics
        this.performanceTracker.recordMetric({
            timestamp: Date.now(),
            model: `${model}-words`,
            cacheHit: false,
            totalDuration: totalDuration,
            networkDuration: networkEnd - networkStart,
            parseDuration: parseEnd - parseStart,
            source: 'http',
        });

        console.log(`[HTTP - Words] ${totalDuration.toFixed(0)}ms (network: ${(networkEnd - networkStart).toFixed(0)}ms) | ${model}`);

        return data.words;
    },
};

// Initialize on load
ApiService.init();
