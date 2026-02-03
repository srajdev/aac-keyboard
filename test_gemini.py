#!/usr/bin/env python3
"""Test Gemini API directly to debug JSON response issues."""
import os
import json
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from server.prompts import SYSTEM_PROMPT_WITH_RULES, build_prediction_prompt

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("ERROR: GOOGLE_API_KEY not found in .env")
    exit(1)

genai.configure(api_key=api_key)

# Test with simple input
partial_input = "I want"
conversation_context = ""

print("=" * 70)
print("TESTING GEMINI API")
print("=" * 70)
print(f"\nInput: '{partial_input}'")
print(f"Context: '{conversation_context}'")

# Build the same prompt we use in production
user_prompt = build_prediction_prompt(partial_input, conversation_context)
full_prompt = f"{SYSTEM_PROMPT_WITH_RULES}\n\n{user_prompt}"

print(f"\n--- FULL PROMPT (length: {len(full_prompt)} chars) ---")
print(full_prompt[:500] + "..." if len(full_prompt) > 500 else full_prompt)
print()

# Create model with same settings as production
model = genai.GenerativeModel(
    'models/gemini-2.5-flash',
    safety_settings={
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
    }
)

print("--- CALLING GEMINI ---")
try:
    response = model.generate_content(
        full_prompt,
        generation_config={
            'temperature': 0.7,
            'max_output_tokens': 1500,
        }
    )

    print("\n--- RESPONSE METADATA ---")
    print(f"Candidates: {len(response.candidates)}")
    if response.candidates:
        candidate = response.candidates[0]
        print(f"Finish reason: {candidate.finish_reason}")
        print(f"Safety ratings: {candidate.safety_ratings}")
        print(f"Parts count: {len(candidate.content.parts) if candidate.content else 0}")

    print("\n--- RAW RESPONSE TEXT ---")
    try:
        raw_text = response.text
        print(f"Length: {len(raw_text)} chars")
        print(raw_text)
    except Exception as e:
        print(f"ERROR getting response.text: {e}")
        print("Trying to access parts directly...")
        if response.candidates and response.candidates[0].content.parts:
            for i, part in enumerate(response.candidates[0].content.parts):
                print(f"Part {i}: {part.text}")

    print("\n--- ATTEMPTING JSON PARSE ---")
    try:
        # Try to parse as JSON
        import re
        text_to_parse = response.text.strip()

        # Remove markdown
        text_to_parse = re.sub(r'^```json\s*', '', text_to_parse)
        text_to_parse = re.sub(r'\s*```$', '', text_to_parse)
        text_to_parse = text_to_parse.strip()

        print(f"After markdown removal: {text_to_parse[:200]}...")

        # Try to find JSON
        json_match = re.search(r'\{[\s\S]*\}', text_to_parse)
        if json_match:
            json_str = json_match.group()
            print(f"\nExtracted JSON (length: {len(json_str)}):")
            print(json_str)

            # Try to parse
            parsed = json.loads(json_str)
            print("\n✓ JSON PARSED SUCCESSFULLY!")
            print(json.dumps(parsed, indent=2))
        else:
            print("✗ NO JSON PATTERN FOUND")
            print(f"Text to parse: {text_to_parse}")

    except json.JSONDecodeError as e:
        print(f"✗ JSON DECODE ERROR: {e}")
        print(f"Failed to parse: {json_str if 'json_str' in locals() else 'N/A'}")
    except Exception as e:
        print(f"✗ ERROR: {e}")

except Exception as e:
    print(f"\n✗ API CALL FAILED: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
