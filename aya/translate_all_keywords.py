#!/usr/bin/env python3
"""
Translate all AYA registry keywords EN->FR using Gemini 2.0 Flash.
Batches of 100 keywords, 4 seconds between batches.
Saves progress incrementally to /tmp/translations_progress.json
"""

import json
import os
import time
import sys
from google import genai
from dotenv import load_dotenv

load_dotenv('../.env.local')

# Configure Gemini
api_key = os.environ.get('GOOGLE_GENERATIVE_AI_API_KEY') or os.environ.get('GEMINI_API_KEY')
if not api_key:
    print("ERROR: No Gemini API key found")
    sys.exit(1)

client = genai.Client(api_key=api_key)

BATCH_SIZE = 100
DELAY = 4  # seconds between batches
PROGRESS_FILE = '/tmp/translations_progress.json'

def load_progress():
    """Load existing progress if any."""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {}

def save_progress(translations):
    """Save progress incrementally."""
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(translations, f, ensure_ascii=False)

def translate_batch(keywords: list[str]) -> dict[str, str]:
    """Translate a batch of keywords using Gemini."""
    prompt = f"""Translate these English business/technology keywords to French.
Rules:
- For technical terms that stay the same in French (blockchain, API, SaaS, NFT, DeFi, etc.), keep them as-is
- For proper nouns (company names, places), keep them as-is
- Use lowercase for French translations (no capitals unless proper noun)
- Return ONLY a valid JSON object mapping each English keyword to its French translation
- No markdown formatting, no code blocks, just the JSON object

Keywords to translate:
{json.dumps(keywords, ensure_ascii=False)}"""

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        text = response.text.strip()
        # Clean up potential markdown code blocks
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:])
        if text.endswith('```'):
            text = text.rsplit('```', 1)[0]
        if text.startswith('json'):
            text = text[4:].strip()
        text = text.strip()

        result = json.loads(text)
        if isinstance(result, dict):
            return result
        else:
            print(f"  WARNING: Gemini returned non-dict type: {type(result)}")
            return {}
    except json.JSONDecodeError as e:
        print(f"  WARNING: JSON parse error: {e}")
        print(f"  Response text (first 300): {text[:300]}")
        return {}
    except Exception as e:
        print(f"  ERROR: {e}")
        return {}

def main():
    # Load keywords to translate
    with open('/tmp/needs_translation.json') as f:
        all_keywords = json.load(f)

    print(f"Total keywords to translate: {len(all_keywords)}")

    # Load existing progress
    translations = load_progress()
    already_done = {k.lower() for k in translations}
    remaining = [kw for kw in all_keywords if kw.lower() not in already_done]

    print(f"Already translated: {len(translations)}")
    print(f"Remaining: {len(remaining)}")

    if not remaining:
        print("All keywords already translated!")
        return

    # Process in batches
    total_batches = (len(remaining) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(remaining), BATCH_SIZE):
        batch = remaining[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1

        print(f"Batch {batch_num}/{total_batches} ({len(batch)} keywords)...", end=" ", flush=True)

        result = translate_batch(batch)

        if result:
            translations.update(result)
            print(f"OK ({len(result)} -> total: {len(translations)})")
        else:
            print(f"FAILED - retrying in 10s...")
            time.sleep(10)
            result = translate_batch(batch)
            if result:
                translations.update(result)
                print(f"  Retry OK ({len(result)})")
            else:
                print(f"  SKIPPED batch {batch_num}")
                for kw in batch:
                    if kw not in translations:
                        translations[kw] = kw

        # Save progress every 5 batches
        if batch_num % 5 == 0:
            save_progress(translations)

        # Delay between batches
        if i + BATCH_SIZE < len(remaining):
            time.sleep(DELAY)

    save_progress(translations)
    print(f"\n=== DONE === Total translations: {len(translations)}")

if __name__ == '__main__':
    main()
