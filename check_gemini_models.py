#!/usr/bin/env python3
"""Check available Gemini models."""
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("ERROR: GOOGLE_API_KEY not found in .env")
    exit(1)

print(f"Using API key: {api_key[:10]}...")
genai.configure(api_key=api_key)

print("\nAvailable models:")
print("=" * 60)

try:
    for model in genai.list_models():
        if 'generateContent' in model.supported_generation_methods:
            print(f"\n✓ {model.name}")
            print(f"  Display name: {model.display_name}")
            print(f"  Description: {model.description[:100] if model.description else 'N/A'}...")
            print(f"  Methods: {', '.join(model.supported_generation_methods)}")
except Exception as e:
    print(f"\nERROR listing models: {e}")
    print("\nTrying alternative approach...")

    # Try the REST API directly
    import requests
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        print("\nModels from REST API:")
        for model in data.get('models', []):
            if 'generateContent' in model.get('supportedGenerationMethods', []):
                print(f"\n✓ {model['name']}")
                print(f"  Display: {model.get('displayName', 'N/A')}")
    else:
        print(f"REST API error: {response.status_code}")
        print(response.text)

print("\n" + "=" * 60)
