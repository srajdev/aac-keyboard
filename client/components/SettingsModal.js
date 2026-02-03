// SettingsModal Component - handles settings modal open/close

const SettingsModal = {
    modal: null,
    openBtn: null,
    closeBtn: null,
    overlay: null,
    performanceDashboard: null,
    clearCacheBtn: null,
    clearMetricsBtn: null,

    init() {
        this.modal = document.getElementById('settings-modal');
        this.openBtn = document.getElementById('settings-btn');
        this.closeBtn = document.getElementById('settings-close');
        this.overlay = this.modal?.querySelector('.modal-overlay');
        this.performanceDashboard = document.getElementById('performance-dashboard');
        this.clearCacheBtn = document.getElementById('clear-cache-btn');
        this.clearMetricsBtn = document.getElementById('clear-metrics-btn');

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

        // Clear cache button
        if (this.clearCacheBtn) {
            this.clearCacheBtn.addEventListener('click', () => {
                ApiService.clearCache();
                alert('Cache cleared!');
            });
        }

        // Clear metrics button
        if (this.clearMetricsBtn) {
            this.clearMetricsBtn.addEventListener('click', () => {
                ApiService.clearMetrics();
                this.updatePerformanceDashboard();
                alert('Metrics cleared!');
            });
        }
    },

    open() {
        if (this.modal) {
            this.modal.classList.add('active');
            this.modal.style.display = 'flex';
            // Update performance stats when opening
            this.updatePerformanceDashboard();
        }
    },

    close() {
        if (this.modal) {
            this.modal.classList.remove('active');
            this.modal.style.display = 'none';
        }
    },

    updatePerformanceDashboard() {
        if (!this.performanceDashboard) return;

        const stats = ApiService.getPerformanceStats();

        if (!stats.overall) {
            this.performanceDashboard.innerHTML = '<div class="perf-loading">Use the keyboard to see performance stats...</div>';
            return;
        }

        const claudeStats = stats.byModel.claude;
        const geminiStats = stats.byModel.gemini;

        let html = '<div class="perf-stats">';

        if (claudeStats) {
            html += `
                <div class="perf-model-section">
                    <h4>Claude Haiku</h4>
                    <div class="perf-metrics">
                        <div class="perf-metric">
                            <span class="perf-label">Avg:</span>
                            <span class="perf-value">${claudeStats.avgLatency}ms</span>
                        </div>
                        <div class="perf-metric">
                            <span class="perf-label">P95:</span>
                            <span class="perf-value">${claudeStats.p95Latency}ms</span>
                        </div>
                        <div class="perf-metric">
                            <span class="perf-label">Requests:</span>
                            <span class="perf-value">${claudeStats.count}</span>
                        </div>
                        <div class="perf-metric">
                            <span class="perf-label">Cache hit:</span>
                            <span class="perf-value">${claudeStats.cacheHitRate}%</span>
                        </div>
                    </div>
                </div>
            `;
        }

        if (geminiStats) {
            html += `
                <div class="perf-model-section">
                    <h4>Gemini Flash</h4>
                    <div class="perf-metrics">
                        <div class="perf-metric">
                            <span class="perf-label">Avg:</span>
                            <span class="perf-value">${geminiStats.avgLatency}ms</span>
                        </div>
                        <div class="perf-metric">
                            <span class="perf-label">P95:</span>
                            <span class="perf-value">${geminiStats.p95Latency}ms</span>
                        </div>
                        <div class="perf-metric">
                            <span class="perf-label">Requests:</span>
                            <span class="perf-value">${geminiStats.count}</span>
                        </div>
                        <div class="perf-metric">
                            <span class="perf-label">Cache hit:</span>
                            <span class="perf-value">${geminiStats.cacheHitRate}%</span>
                        </div>
                    </div>
                </div>
            `;
        }

        html += `
            <div class="perf-overall">
                <strong>Overall Cache Hit Rate:</strong> ${stats.overall.cacheHitRate}%
                (${stats.overall.totalRequests} requests)
            </div>
        `;

        html += '</div>';
        this.performanceDashboard.innerHTML = html;
    },
};
