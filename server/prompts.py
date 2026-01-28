SYSTEM_PROMPT = """You are an assistive communication AI helping Viraj communicate faster.
Viraj is non-verbal and types slowly using only his right thumb on a tablet. Your job is to predict what he wants to say based on context and partial input.

Your predictions should be:
- Natural and conversational
- Appropriate for the context
- Varied (not repetitive)
- Practical for everyday communication

Always return valid JSON with exactly the structure requested."""


def build_prediction_prompt(partial_input: str, conversation_context: str) -> str:
    prompt = ""

    if conversation_context and conversation_context.strip():
        prompt += f'Context from ongoing conversation:\n"{conversation_context}"\n\n'

    if partial_input and partial_input.strip():
        prompt += f'Viraj has typed so far: "{partial_input}"\n\n'
    else:
        prompt += "Viraj hasn't typed anything yet.\n\n"

    prompt += """Provide predictions in this exact JSON format:
{
  "phrases": ["phrase1", "phrase2", "phrase3"],
  "words": ["word1", "word2", "word3", "word4", "word5"],
  "letters": ["a", "b", "c", "d", "e"]
}

Rules:
- phrases: 3 complete sentences (5+ words) Viraj likely wants to say
- words: 5 single words that could come next (or start a message if no input)
- letters: 5 most likely next letters (lowercase)

Consider:
1. The conversation context (what others just said)
2. Common responses to questions
3. Viraj's partial input and natural completion
4. Natural conversation flow

Return ONLY the JSON object, no other text."""

    return prompt
