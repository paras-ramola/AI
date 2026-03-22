# nlp/gemini_client.py

import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = "gemini-2.0-flash"

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

genai.configure(api_key=GEMINI_API_KEY)

_model = genai.GenerativeModel(GEMINI_MODEL)


def call_gemini(prompt: str, timeout: int = 30) -> str:
    response = _model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            temperature=0.1,
            max_output_tokens=500
        )
    )
    return response.text.strip()