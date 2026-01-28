// API Service - handles communication with the backend

const ApiService = {
    baseUrl: '',

    async getPredictions(partialInput, conversationContext) {
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
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
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
