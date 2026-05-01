#!/usr/bin/env python3
"""
warm_question_cache.py
======================
Pre-generates natural language questions for ALL symptoms in the dataset
and saves them to data/question_cache.json.

After running this once, every assessment question is served from cache
instantly — no LLM call needed in the hot path.

Run once:
    cd swasth-ml-services
    python warm_question_cache.py

Estimated time: ~3-5 minutes for ~130 symptoms (parallel requests).
"""

import json
import os
import pickle
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv
load_dotenv()

from nlp.openai_client import call_openai

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(BASE_DIR, "data", "question_cache.json")

# ── load symptom list from models ────────────────────────────────────────────
with open(os.path.join(BASE_DIR, "models", "symptom_columns.pkl"), "rb") as f:
    ALL_SYMPTOMS = pickle.load(f)

print(f"Total symptoms to cache: {len(ALL_SYMPTOMS)}")
print(f"Cache file: {CACHE_FILE}\n")


# ── load existing cache to skip already done ─────────────────────────────────
existing: dict = {}
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE) as f:
        existing = json.load(f)
    print(f"Found {len(existing)} existing cached questions — skipping those.\n")

to_generate = [s for s in ALL_SYMPTOMS if s not in existing]
print(f"Need to generate: {len(to_generate)} questions\n")


def generate_question(symptom: str) -> tuple[str, str]:
    """Call GPT and return (symptom, question)."""
    readable = symptom.replace("_", " ")
    prompt = (
        f"Convert this medical symptom into ONE simple yes/no question (max 10 words):\n"
        f"Symptom: {readable}\n"
        f"Rules: everyday language, no jargon, answerable with Yes/No/Not sure.\n"
        f"Examples: fever→\"Do you have a fever?\" shortness_of_breath→\"Are you having trouble breathing?\"\n"
        f"Return ONLY the question."
    )
    try:
        question = call_openai(prompt, timeout=15, max_tokens=60).strip().strip('"\'')
        return symptom, question
    except Exception as e:
        print(f"  ✗ Failed {symptom}: {e}")
        return symptom, f"Are you experiencing {readable}?"


# ── parallel generation ───────────────────────────────────────────────────────
cache = dict(existing)   # start with existing entries
done  = 0
total = len(to_generate)

print("Generating questions in parallel (8 workers)...\n")
start = time.time()

with ThreadPoolExecutor(max_workers=8) as executor:
    futures = {executor.submit(generate_question, s): s for s in to_generate}

    for future in as_completed(futures):
        symptom, question = future.result()
        cache[symptom] = question
        done += 1

        # save incrementally every 10 symptoms so progress isn't lost
        if done % 10 == 0 or done == total:
            with open(CACHE_FILE, "w") as f:
                json.dump(cache, f, indent=2)
            elapsed = time.time() - start
            print(f"  [{done}/{total}] saved — {elapsed:.1f}s elapsed")
        else:
            print(f"  ✓ {symptom} → {question}")

# ── final save ────────────────────────────────────────────────────────────────
with open(CACHE_FILE, "w") as f:
    json.dump(cache, f, indent=2)

elapsed = time.time() - start
print(f"\n✅ Done! {len(cache)} questions cached in {elapsed:.1f}s")
print(f"   Saved to: {CACHE_FILE}")
print(f"\n   Every future assessment question will now be served instantly from cache.")
