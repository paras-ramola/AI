# nlp/openai_client.py
# =============================================================================
# OpenAI GPT-4o-mini client
# Single entry point for all LLM calls in the project.
# =============================================================================

from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment variables")

_client = OpenAI(api_key=OPENAI_API_KEY)

MODEL = "gpt-4o-mini"


def call_openai(prompt: str, timeout: int = 30) -> str:
    """
    Send a prompt to GPT-4o-mini and return the text response.

    Args:
        prompt:  The full prompt string to send.
        timeout: Request timeout in seconds (default 30).

    Returns:
        Stripped text response from the model.
    """
    response = _client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        max_tokens=500,
        timeout=timeout
    )
    return response.choices[0].message.content.strip()
