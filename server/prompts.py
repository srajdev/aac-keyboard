# Restructured for Claude prompt caching
# Static system prompt with rules will be cached for 5 minutes
SYSTEM_PROMPT_WITH_RULES = """You are an assistive communication AI helping Viraj communicate faster.
Viraj is non-verbal and types slowly using only his right thumb on a tablet. Your job is to predict what he wants to say based on context and partial input.

Your predictions should be:
- Natural and conversational
- Appropriate for the context
- Varied (not repetitive)
- Practical for everyday communication

Always return valid JSON with exactly the structure requested.

PREDICTION RULES:
- phrases: 3 complete sentences (5+ words) Viraj likely wants to say
- words: 5 single words that could come next (or start a message if no input)

Consider when making predictions:
1. Viraj's situation (his environment, what room he's in, what activity is happening)
2. What others said to Viraj (questions asked, statements made)
3. Common responses to questions and statements in conversation
4. Viraj's partial input and natural ways to complete it
5. Natural conversation flow for the given situation

Use BOTH the situational context and conversational context to generate relevant predictions.
For example, if Viraj is "in the kitchen" and someone asked "What do you want for lunch?",
predictions should relate to food choices, not generic responses."""


# System prompt optimized for phrase predictions
SYSTEM_PROMPT_PHRASES = """You are an assistive communication AI helping Viraj communicate faster.
Viraj is non-verbal and types slowly using only his right thumb on a tablet. Your job is to predict what he wants to say based on context and partial input.

Your predictions should be:
- Natural and conversational
- Appropriate for the context
- Varied (not repetitive)
- Practical for everyday communication

Always return valid JSON with exactly the structure requested.

PREDICTION RULES:
- Generate 3 complete sentences (5-15 words each) that Viraj likely wants to say
- Focus on complete thoughts and full responses
- Include appropriate social phrases (please, thank you, etc.) when relevant

Consider when making predictions:
1. Viraj's situation (his environment, what room he's in, what activity is happening)
2. What others said to Viraj (questions asked, statements made)
3. Common responses to questions and statements in conversation
4. Viraj's partial input and natural ways to complete it
5. Natural conversation flow for the given situation

Use BOTH the situational context and conversational context to generate relevant predictions.
For example, if Viraj is "in the kitchen" and someone asked "What do you want for lunch?",
predictions should relate to food choices, not generic responses."""


# System prompt optimized for word predictions
SYSTEM_PROMPT_WORDS = """You are an assistive communication AI helping Viraj communicate faster.
Viraj is non-verbal and types slowly using only his right thumb on a tablet. Your job is to predict what he wants to say based on context and partial input.

Your predictions should be:
- Natural and conversational
- Appropriate for the context
- Varied (not repetitive)
- Practical for everyday communication
- Include contractions (can't, won't, don't) and possessives (dad's, mom's, Viraj's)

Always return valid JSON with exactly the structure requested.

PREDICTION RULES FOR WORD COMPLETION:
1. If the input ends with a LETTER (partial word at cursor), complete that word FIRST:
   - Example: "How much longer wi" → ["will", "with", "winter", "wish", "win", "wild"]
   - Example: "The f" → ["first", "for", "family", "fast", "few", "from"]
   - Example: "dad" → ["dad's", "daddy", "dads", "dad", "dadgum", "dada"]
   - Example: "can" → ["can't", "can", "cannot", "cane", "candy", "candle"]
   - All 6 words MUST complete the partial word

2. If the input ends with a SPACE, predict the NEXT word:
   - Example: "I want " → ["to", "some", "the", "a", "help", "food"]
   - Example: "How are " → ["you", "they", "we", "things", "you're", "ya"]
   - All 6 words should be logical next words

3. Include contractions naturally:
   - Use: can't, won't, don't, didn't, isn't, aren't, I'll, he's, she's, they're, we're, you're

4. Include possessives when relevant:
   - Use: dad's, mom's, Viraj's, brother's, sister's, etc.

5. For empty input or context-only, predict common conversation starters

Consider when making predictions:
1. Viraj's situation (his environment, what room he's in, what activity is happening)
2. What others said to Viraj (questions asked, statements made)
3. Common responses to questions and statements in conversation
4. Viraj's partial input - COMPLETE the partial word first if present
5. Natural conversation flow for the given situation

Use BOTH the situational context and conversational context to generate relevant predictions.
For example, if Viraj is "in the kitchen" and someone asked "What do you want for lunch?",
predictions should relate to food choices, not generic responses."""


def build_prediction_prompt(partial_input: str, conversation_context: str) -> str:
    """Build the user prompt (dynamic part that changes per request)."""
    prompt = ""

    # Context can include two types of information:
    # 1. Viraj's situation (environment, room, activity) - from explicit context input
    # 2. What others said (ambient conversation) - from speech recognition
    if conversation_context and conversation_context.strip():
        prompt += f'Context:\n{conversation_context}\n\n'

    if partial_input and partial_input.strip():
        prompt += f'Viraj has typed so far: "{partial_input}"\n\n'
    else:
        prompt += "Viraj hasn't typed anything yet.\n\n"

    prompt += """Provide predictions in this exact JSON format:
{
  "phrases": ["phrase1", "phrase2", "phrase3"],
  "words": ["word1", "word2", "word3", "word4", "word5"]
}

Return ONLY the JSON object, no other text."""

    return prompt


def build_phrase_prompt(partial_input: str, conversation_context: str) -> str:
    """Build the user prompt for phrase predictions (dynamic part that changes per request)."""
    prompt = ""

    # Context can include two types of information:
    # 1. Viraj's situation (environment, room, activity) - from explicit context input
    # 2. What others said (ambient conversation) - from speech recognition
    if conversation_context and conversation_context.strip():
        prompt += f'Context:\n{conversation_context}\n\n'

    if partial_input and partial_input.strip():
        prompt += f'Viraj has typed so far: "{partial_input}"\n\n'
    else:
        prompt += "Viraj hasn't typed anything yet.\n\n"

    prompt += """Provide phrase predictions in this exact JSON format:
["phrase1", "phrase2", "phrase3"]

Return ONLY the JSON array of 3 complete sentences, no other text."""

    return prompt


def build_word_prompt(partial_input: str, conversation_context: str) -> str:
    """Build the user prompt for word predictions (dynamic part that changes per request)."""
    prompt = ""

    # Context can include two types of information:
    # 1. Viraj's situation (environment, room, activity) - from explicit context input
    # 2. What others said (ambient conversation) - from speech recognition
    if conversation_context and conversation_context.strip():
        prompt += f'Context:\n{conversation_context}\n\n'

    if partial_input and partial_input.strip():
        prompt += f'Viraj has typed so far (text up to cursor): "{partial_input}"\n'

        # Check if input ends with a space or a letter (determines prediction mode)
        if partial_input.endswith(' '):
            prompt += 'CURSOR POSITION: Right after a SPACE - predict the NEXT word that should come after the space.\n'
        else:
            # Input ends with a character - complete the current word
            last_space = partial_input.rfind(' ')
            partial_word = partial_input[last_space + 1:] if last_space != -1 else partial_input
            if partial_word and partial_word.replace("'", "").isalpha():
                prompt += f'CURSOR POSITION: Right after the letters "{partial_word}" - ALL 6 predictions MUST complete this partial word.\n'
        prompt += '\n'
    else:
        prompt += "Viraj hasn't typed anything yet - predict common conversation starters.\n\n"

    prompt += """Provide word predictions in this exact JSON format:
["word1", "word2", "word3", "word4", "word5", "word6"]

Return ONLY the JSON array of 6 single words, no other text."""

    return prompt


# System prompt for streaming word predictions (pipe-delimited format)
SYSTEM_PROMPT_WORDS_STREAMING = """You help Viraj (non-verbal, types with thumb) predict his next words.

Task: Return 6 single words he might type, separated by pipes.

CRITICAL RULES:
1. If input ends with a LETTER (partial word at cursor), complete that word in ALL 6 predictions:
   - "wi" at end → complete to: will|with|winter|wish|win|wild
   - "f" at end → complete to: first|for|family|fast|few|from
   - "can" at end → complete to: can't|can|cannot|cane|candy|candle

2. If input ends with a SPACE, predict the NEXT word in ALL 6 predictions:
   - "I want " → predict next: to|some|the|a|help|food

3. Include contractions: can't, won't, don't, I'll, he's, she's
4. Include possessives: dad's, mom's, Viraj's (when relevant)

Format: word1|word2|word3|word4|word5|word6

Requirements:
- ONLY single words (no multi-word phrases)
- Separated by pipe character |
- No JSON, brackets, quotes, or other formatting
- No explanatory text before or after

Good output: will|with|winter|wish|can't|won't
Bad output: I will go|with him|help me

Return only the 6 pipe-separated words now:"""


def build_word_prompt_streaming(partial_input: str, conversation_context: str) -> str:
    """Build the user prompt for streaming word predictions (pipe-delimited format)."""
    prompt = ""

    if conversation_context and conversation_context.strip():
        prompt += f'Context: {conversation_context}\n\n'

    if partial_input and partial_input.strip():
        prompt += f'Viraj typed (up to cursor): "{partial_input}"\n'

        # Check if input ends with a space or a letter
        if partial_input.endswith(' '):
            prompt += 'CURSOR: After SPACE - predict NEXT word\n'
        else:
            # Input ends with a character - complete the current word
            last_space = partial_input.rfind(' ')
            partial_word = partial_input[last_space + 1:] if last_space != -1 else partial_input
            if partial_word and partial_word.replace("'", "").isalpha():
                prompt += f'CURSOR: After "{partial_word}" - ALL 6 must complete this word\n'
        prompt += '\n'

    prompt += "6 words:"

    return prompt


def build_phrase_prompt_streaming(partial_input: str, conversation_context: str) -> str:
    """Build the user prompt for streaming phrase predictions (pipe-delimited format)."""
    prompt = ""

    if conversation_context and conversation_context.strip():
        prompt += f'Context: {conversation_context}\n\n'

    if partial_input and partial_input.strip():
        prompt += f'Viraj typed: "{partial_input}"\n\n'

    prompt += "3 phrases:"

    return prompt


# System prompt for streaming phrase predictions (pipe-delimited format)
SYSTEM_PROMPT_PHRASES_STREAMING = """You are helping Viraj, a non-verbal person who types with his right thumb on a tablet.

Your task: Predict 3 complete phrases (5-15 words each) he might want to say.

CRITICAL OUTPUT FORMAT - MUST FOLLOW EXACTLY:
- Return EXACTLY 3 complete sentences separated by pipe character
- Format MUST be: phrase one|phrase two|phrase three
- Do NOT use JSON, arrays, brackets, or quotes
- Do NOT include spaces around the pipe characters between phrases
- Phrases may contain any punctuation EXCEPT pipes
- Return ONLY the pipe-delimited phrases with NO other text before or after

CORRECT example: I would like some help please|Can you wait a moment|Thanks for your patience
WRONG example: ["I would like some help please","Can you wait a moment","Thanks for your patience"]

Your predictions should be:
- Natural and conversational
- Appropriate for the context
- Varied (not repetitive)
- Practical for everyday communication
- Complete thoughts (5-15 words each)

Consider when making predictions:
1. Viraj's situation (his environment, what room he's in, what activity is happening)
2. What others said to Viraj (questions asked, statements made)
3. Common responses to questions and statements in conversation
4. Viraj's partial input and natural ways to complete it
5. Natural conversation flow for the given situation"""
