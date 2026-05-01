# recommendations_engine.py
# =============================================================================
# PERSONALIZED HEALTH RECOMMENDATIONS — PER-SECTION GENERATION
#
# Each call generates ONLY the requested section (diet | workout | precautions).
# This keeps responses fast and focused — called separately per card click.
# =============================================================================

import json
import re

from nlp.openai_client import call_openai


# =============================================================================
# INTENSITY MAP — prevents GPT recommending exercise during acute illness
# =============================================================================

_REST_REQUIRED = {
    "dengue", "typhoid", "malaria", "tuberculosis", "pneumonia",
    "covid", "influenza", "flu", "hepatitis", "jaundice",
    "heart attack", "cardiac arrest", "stroke", "pulmonary embolism",
    "appendicitis", "pancreatitis", "meningitis", "sepsis", "encephalitis",
}

_LIGHT_ONLY = {
    "hypertension", "diabetes", "anemia", "hypothyroidism", "hyperthyroidism",
    "asthma", "bronchitis", "gastritis", "gerd", "acid reflux",
    "urinary tract infection", "kidney stones", "arthritis",
}


def _get_intensity_hint(disease: str) -> str:
    d = disease.lower()
    for kw in _REST_REQUIRED:
        if kw in d:
            return "rest"
    for kw in _LIGHT_ONLY:
        if kw in d:
            return "light"
    return "moderate"


# =============================================================================
# SECTION PROMPTS — one per section, tight and focused
# =============================================================================

def _diet_prompt(disease, symptoms_str, age_str, gender_str, confidence) -> str:
    return f"""You are a certified nutritionist.
Generate a focused diet plan for this patient.

PATIENT:
  Condition : {disease} ({confidence:.0%} confidence)
  Symptoms  : {symptoms_str}
  Age       : {age_str}
  Gender    : {gender_str}

RULES:
- Personalize for age and gender (e.g., iron for women, soft foods for elderly)
- Do NOT recommend specific medications or supplements
- Keep reasons concise (under 10 words each)

Return ONLY this JSON. No text outside:

{{
  "eat": [
    {{"food": "...", "reason": "...", "emoji": "..."}}
  ],
  "avoid": [
    {{"food": "...", "reason": "...", "emoji": "..."}}
  ],
  "hydration": "one sentence about hydration",
  "meal_tip": "one practical meal timing tip",
  "timeline": {{
    "week_1": "diet focus for first week",
    "long_term": "long-term diet habit"
  }}
}}

Rules: eat = 4-5 items, avoid = 3-4 items. Each with a relevant food emoji."""


def _workout_prompt(disease, symptoms_str, age_str, gender_str, confidence, intensity) -> str:
    return f"""You are a certified fitness coach.
Generate an activity plan for this patient.

PATIENT:
  Condition : {disease} ({confidence:.0%} confidence)
  Symptoms  : {symptoms_str}
  Age       : {age_str}
  Gender    : {gender_str}

INTENSITY CONSTRAINT: "{intensity}"
  - rest     → NO exercise. Breathing or very gentle stretching ONLY.
  - light    → Light walking or yoga. No cardio.
  - moderate → Regular activity ok. Avoid high intensity.
Follow this strictly.

Return ONLY this JSON. No text outside:

{{
  "intensity": "{intensity}",
  "recommended": [
    {{"exercise": "...", "duration": "...", "frequency": "..."}}
  ],
  "avoid": ["...", "..."],
  "note": "one sentence of general advice",
  "timeline": {{
    "week_1": "activity focus for first week",
    "long_term": "long-term activity habit"
  }}
}}

Rules: recommended = 2-4 exercises appropriate for intensity, avoid = 2-3 items."""


def _precautions_prompt(disease, symptoms_str, age_str, gender_str, confidence) -> str:
    return f"""You are a medical wellness advisor.
Generate a precautions plan for this patient.

PATIENT:
  Condition : {disease} ({confidence:.0%} confidence)
  Symptoms  : {symptoms_str}
  Age       : {age_str}
  Gender    : {gender_str}

RULES:
- warning_signs must be SPECIFIC to this condition (not generic)
- when_to_seek must give clear thresholds (e.g. "fever above 103°F for 2 days")
- Do NOT recommend specific drug names

Return ONLY this JSON. No text outside:

{{
  "daily": ["...", "...", "..."],
  "warning_signs": ["...", "...", "..."],
  "when_to_seek": "specific threshold for going to doctor",
  "do": ["...", "..."],
  "dont": ["...", "..."],
  "timeline": {{
    "week_1": "precaution focus for first week",
    "long_term": "long-term habit to build"
  }}
}}

Rules: daily = 3-5 habits, warning_signs = 3-4 red flags, do/dont = 2-3 each."""


# =============================================================================
# MAIN FUNCTION
# =============================================================================

def generate_recommendations(
    disease:    str,
    symptoms:   list,
    confidence: float,
    age:        int | None,
    gender:     str | None,
    section:    str = "diet"           # "diet" | "workout" | "precautions"
) -> dict:
    """
    Generates a recommendation for ONE section only.
    Called separately per card click — fast and focused.
    """

    symptoms_str = ", ".join(s.replace("_", " ") for s in symptoms) if symptoms else "not specified"
    age_str      = str(age)  if age    else "not specified"
    gender_str   = gender    if gender else "not specified"
    intensity    = _get_intensity_hint(disease)

    # pick the right prompt
    if section == "diet":
        prompt = _diet_prompt(disease, symptoms_str, age_str, gender_str, confidence)
    elif section == "workout":
        prompt = _workout_prompt(disease, symptoms_str, age_str, gender_str, confidence, intensity)
    elif section == "precautions":
        prompt = _precautions_prompt(disease, symptoms_str, age_str, gender_str, confidence)
    else:
        return _safe_default(section)

    print(f"[recommendations] section={section} | disease={disease} | age={age_str} | gender={gender_str}")

    try:
        raw = call_openai(prompt, timeout=45)
        return _parse_response(raw, section)
    except Exception as e:
        print(f"recommendations_engine error [{section}]: {e}")
        return _safe_default(section)


# =============================================================================
# PARSER
# =============================================================================

def _parse_response(raw: str, section: str) -> dict:
    raw   = re.sub(r"```json|```", "", raw).strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)

    if not match:
        print(f"WARNING: No JSON in recommendations response [{section}]")
        return _safe_default(section)

    try:
        return json.loads(match.group())
    except json.JSONDecodeError as e:
        print(f"WARNING: JSON parse error [{section}]: {e}")
        return _safe_default(section)


# =============================================================================
# SAFE DEFAULTS — returned if GPT fails
# =============================================================================

def _safe_default(section: str) -> dict:
    defaults = {
        "diet": {
            "eat":       [{"food": "Fresh fruits and vegetables", "reason": "Support recovery", "emoji": "🥦"}],
            "avoid":     [{"food": "Processed food", "reason": "Weakens immunity", "emoji": "🍟"}],
            "hydration": "Drink 2-3 litres of water daily.",
            "meal_tip":  "Eat small, balanced meals throughout the day.",
            "timeline":  {"week_1": "Focus on light, nutritious foods.", "long_term": "Maintain a balanced diet."}
        },
        "workout": {
            "intensity":   "light",
            "recommended": [{"exercise": "Light walking", "duration": "15 min", "frequency": "Daily"}],
            "avoid":       ["High-intensity cardio", "Heavy lifting"],
            "note":        "Listen to your body and rest when needed.",
            "timeline":    {"week_1": "Rest and light movement only.", "long_term": "Build a regular exercise routine."}
        },
        "precautions": {
            "daily":         ["Get 7-9 hours of sleep", "Stay hydrated", "Avoid stress"],
            "warning_signs": ["Worsening symptoms", "High fever", "Difficulty breathing"],
            "when_to_seek":  "If symptoms worsen or persist beyond 3 days, consult a doctor.",
            "do":            ["Follow doctor's advice", "Rest adequately"],
            "dont":          ["Self-medicate", "Ignore worsening symptoms"],
            "timeline":      {"week_1": "Focus on rest and monitoring symptoms.", "long_term": "Build healthy daily habits."}
        }
    }
    return defaults.get(section, defaults["diet"])
