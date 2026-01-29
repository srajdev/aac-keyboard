// API Service - handles communication with the backend

const ApiService = {
    baseUrl: '',

    async getPredictions(partialInput, conversationContext, signal) {
        try {
            const response = await fetch(`${this.baseUrl}/api/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    partialInput: partialInput || '',
                    conversationContext: conversationContext || '',
                }),
                signal: signal,
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();
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
};
