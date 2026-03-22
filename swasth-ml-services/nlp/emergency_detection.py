# emergency_detection.py
# =============================================================================
# TWO-STAGE EMERGENCY DETECTION AGENT
#
# Stage 1 — System Classifier
#   Fast LLM call that reads raw text and identifies the body system
#   Loads only the relevant rules from the knowledge base
#
# Stage 2 — Emergency Agent
#   Focused LLM call with system-specific knowledge
#   Receives BOTH raw extracted symptoms AND normalized symptoms
#   Raw = for context/severity understanding
#   Normalized = for rule matching against dataset
# =============================================================================

import requests
import json
import re
import os

# OLLAMA_URL = "http://localhost:11434/api/generate"
# MODEL      = "llama3.2:3b"
from nlp.gemini_client import call_gemini
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# =============================================================================
# LOAD KNOWLEDGE BASE — organized by body system
# =============================================================================

def _load_knowledge_base() -> dict:
    kb_path = os.path.join(BASE_DIR, "data", "emergency_knowledge_base.json")
    with open(kb_path, "r") as f:
        raw = json.load(f)

    # organize by body system for targeted retrieval
    by_system = {}

    all_categories = (
        raw.get("life_threatening", []) +
        raw.get("critical", []) +
        raw.get("pediatric_specific", []) +
        raw.get("mental_health_emergencies", [])
    )

    for entry in all_categories:
        system = entry.get("system", "general").split("/")[0].strip()
        if system not in by_system:
            by_system[system] = []
        by_system[system].append({
            "condition":         entry.get("condition", ""),
            "symptoms":          entry.get("symptoms", []),
            "immediate_actions": entry.get("immediate_actions", []),
            "esi_level":         entry.get("esi_level", 2),
            "time_critical":     entry.get("time_critical", False),
        })

    # also keep flat ESI lists for fallback
    flat = {"esi_1": [], "esi_2": []}
    for entry in all_categories:
        esi = entry.get("esi_level", 2)
        key = "esi_1" if esi == 1 else "esi_2"
        flat[key].append(entry)

    return {"by_system": by_system, "flat": flat}


def _load_red_flags() -> dict:
    """
    Loads red_flags.json.
    Converts lists to sets for fast lookup in fallback checker.
    """
    rf_path = os.path.join(BASE_DIR, "data", "red_flags.json") 

    with open(rf_path, "r") as f:
        raw = json.load(f)

    return {
        "level_1":   set(raw["level_1"]),
        "level_2":   set(raw["level_2"]),
        "level_3":   set(raw["level_3"]),
        "by_system": {k: set(v) for k, v in raw["by_system"].items()},
        "all":       set(raw["level_1"]) | set(raw["level_2"]) | set(raw["level_3"])
    }


# load once at import
KB        = _load_knowledge_base()
RED_FLAGS = _load_red_flags()

# all known body systems in the knowledge base
KNOWN_SYSTEMS = list(KB["by_system"].keys()) + ["none"]


# =============================================================================
# STAGE 1 — SYSTEM CLASSIFIER AGENT
# Fast call: identifies which body system is involved
# This lets Stage 2 load only relevant rules
# =============================================================================

def _classify_body_system(user_text: str, raw_symptoms: list) -> str:
    """
    Stage 1 agent.
    Reads raw user text and extracted symptoms.
    Returns the most relevant body system string.

    Why raw symptoms here:
        At this stage we want natural language like "crushing chest pain"
        not the normalized "chest_pain" — richer signal for classification.
    """

    systems_list = ", ".join(KNOWN_SYSTEMS)
    symptoms_str = ", ".join(raw_symptoms) if raw_symptoms else "not extracted"

    prompt = f"""You are a medical triage classifier.

Identify the PRIMARY body system involved based on the patient's description.

Patient message: "{user_text}"
Extracted symptoms: {symptoms_str}

Choose EXACTLY ONE from this list:
{systems_list}

Rules:
- Choose "cardiac" for chest pain, heart issues, palpitations
- Choose "respiratory" for breathing problems, cough, asthma
- Choose "neurology" for headache, seizures, stroke symptoms, confusion
- Choose "trauma" for injuries, falls, accidents, bleeding
- Choose "allergy" for allergic reactions, rashes after exposure
- Choose "infectious" for fever with rash, meningitis signs
- Choose "obstetrics" for pregnancy related symptoms
- Choose "pediatric" for symptoms in infants or children
- Choose "psychiatry" for mental health, suicidal ideation
- Choose "endocrine" for diabetic symptoms, fruity breath
- Choose "vascular" for tearing pain, leg swelling
- Choose "none" if no clear system or minor symptoms

Return ONLY the system name. Nothing else.
"""

    try:
        # response = requests.post(
        #     OLLAMA_URL,
        #     json={"model": MODEL, "prompt": prompt, "stream": False},
        #     timeout=15
        # )
        # system = response.json()["response"].strip().lower()
        system = call_gemini(prompt, timeout=15).strip().lower()


        # validate — must be a known system
        if system not in KNOWN_SYSTEMS:
            # try partial match
            for known in KNOWN_SYSTEMS:
                if known in system:
                    system = known
                    break
            else:
                system = "none"

        print(f"\nStage 1 — Classified system: {system}")
        return system

    except Exception as e:
        print(f"Stage 1 classifier failed: {e}")
        return "none"


# =============================================================================
# STAGE 2 — EMERGENCY AGENT
# Focused call with system-specific knowledge
# Receives BOTH raw extracted AND normalized symptoms
# =============================================================================
def _run_emergency_agent(
    user_text:            str,
    raw_symptoms:         list,   # from LLM extraction — natural language
    normalized_symptoms:  list,   # from embedding normalization — dataset format
    body_system:          str
) -> dict:
    """
    Stage 2 agent.

    Why we pass BOTH symptom types:
    - raw_symptoms       : "crushing chest pain", "cannot breathe"
                           → LLM uses these to understand severity and context
                           → Severity words are preserved
    - normalized_symptoms: "chest_pain", "breathlessness"
                           → LLM uses these to match against dataset rules
                           → Ensures alignment with KB condition symptom lists

    The LLM is explicitly told what each list means and how to use them.
    Chain-of-thought reasoning forces LLM to justify before concluding.
    This prevents false positives like flagging "itching" as anaphylaxis.
    """

    # ── retrieve system-specific knowledge ───────────────────────────────────
    system_conditions = KB["by_system"].get(body_system, [])

    # if system is "none" or unknown → use all ESI 1 conditions as context
    if not system_conditions:
        system_conditions = KB["flat"]["esi_1"][:8]

    # ── build conditions block from knowledge base ────────────────────────────
    conditions_block = ""
    for entry in system_conditions:
        syms    = ", ".join(entry["symptoms"][:6])
        actions = " | ".join(entry["immediate_actions"][:2])
        conditions_block += (
            f"\n  Condition : {entry['condition']} (ESI {entry['esi_level']})"
            f"\n  Symptoms  : {syms}"
            f"\n  Actions   : {actions}\n"
        )

    # ── get system-specific red flags ─────────────────────────────────────────
    system_flags = RED_FLAGS["by_system"].get(body_system, set())
    if not system_flags:
        system_flags = RED_FLAGS["level_1"]
    flags_str = ", ".join(sorted(list(system_flags))[:25])

    # ── format both symptom lists clearly ────────────────────────────────────
    raw_str        = ", ".join(raw_symptoms) if raw_symptoms else "none"
    normalized_str = ", ".join(normalized_symptoms) if normalized_symptoms else "none"

    # ── build prompt ──────────────────────────────────────────────────────────
    prompt = f"""You are a medical emergency detection agent.
Your job is to decide if this patient needs emergency services RIGHT NOW.

Focus area: {body_system.upper()} system

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RELEVANT CONDITIONS FROM KNOWLEDGE BASE:
{conditions_block}

RED FLAG PHRASES FOR THIS SYSTEM:
{flags_str}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PATIENT DATA:

Original message:
  "{user_text}"

Raw extracted symptoms (USE THESE for severity and context):
  {raw_str}
  → These preserve severity words like "crushing", "sudden", "cannot"
  → Use these to understand HOW BAD the symptoms are

Normalized dataset symptoms (USE THESE for rule matching):
  {normalized_str}
  → These are mapped to medical terminology
  → Use these to match against the condition symptom lists above

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION RULES — FOLLOW THESE STRICTLY:

1. BASE YOUR DECISION ONLY ON WHAT THE PATIENT EXPLICITLY SAID.
   Do NOT infer, assume, or imagine what could be wrong.
   Do NOT think "this could lead to X" — judge only what IS described.

   WRONG: "itching and rashes COULD be anaphylaxis" → emergency
   RIGHT: "patient said only itching and rashes, no breathing difficulty,
           no throat swelling, no collapse" → NOT emergency

2. EMERGENCY requires at least ONE of these EXPLICITLY mentioned:
   - Cannot breathe / not breathing / choking / airway blocked
   - No pulse / heart stopped / collapsed and unresponsive
   - Unconscious / not waking up
   - Seizure not stopping / repeated seizures
   - Uncontrolled bleeding / spurting blood
   - Throat swelling WITH difficulty breathing
   - Crushing chest pain WITH sweating or arm pain
   - Face drooping WITH arm weakness AND slurred speech (stroke)
   - High fever WITH stiff neck AND confusion (meningitis)

3. A symptom that CAN appear in an emergency is NOT the same
   as the emergency being present.
   - "rash" can appear in anaphylaxis → rash ALONE is NOT anaphylaxis
   - "headache" can appear in meningitis → headache ALONE is NOT meningitis
   - "chest pain" can appear in heart attack → chest pain ALONE needs
     other cardiac symptoms to confirm emergency

4. SEVERITY WORDS matter. Read what the patient actually wrote.
   "a bit of itching"                              → mild, NOT emergency
   "itching and rashes"                            → mild, NOT emergency
   "severe rash, throat swelling, cannot breathe" → IS emergency

5. COMBINATION matters. Multiple severe symptoms together = more serious.
   Single mild symptom → almost never an emergency.

6. ESI levels:
   ESI 1 → call 911 immediately (life-threatening, explicit evidence required)
   ESI 2 → go to ER now (high risk, explicit evidence required)
   ESI 3 → urgent care today (not an emergency, do not set is_emergency true)
   No match → not an emergency

7. WHEN IN DOUBT → is_emergency: false
   Only flag emergency when the patient's own words make it CLEAR.
   Do not flag based on what you imagine might be happening.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINK STEP BY STEP before answering.
Answer these four questions inside the "reasoning" field:

Q1: What did the patient EXPLICITLY say? List only stated symptoms.
Q2: Are any hard emergency indicators present from rule 2 above?
     Answer yes or no and state which ones if yes.
Q3: What severity is indicated by the patient's OWN words?
Q4: Am I judging evidence or making assumptions?
     If assuming → is_emergency must be false.

Then give your final JSON answer.

Respond ONLY with valid JSON. No text outside the JSON.

{{
  "reasoning": "answer Q1 Q2 Q3 Q4 here step by step",
  "is_emergency": true or false,
  "esi_level": 1 or 2 or 3 or null,
  "suspected_condition": "condition name or null",
  "confidence": "high" or "medium" or "low",
  "reason": "one sentence based only on what patient explicitly said",
  "matched_flags": ["only flags EXPLICITLY mentioned by patient"],
  "immediate_actions": ["action 1", "action 2", "action 3"]
}}
"""

    # ── call LLM ──────────────────────────────────────────────────────────────
    try:
        raw_output = call_gemini(prompt, timeout=30)

        # raw_output = response.json()["response"].strip()
        print(f"\nStage 2 — LLM raw output:\n{raw_output}")

        return _parse_llm_response(raw_output)

    except Exception as e:
        print(f"Stage 2 agent failed: {e}")
        return None
    

# =============================================================================
# MAIN ENTRY POINT
# Called from app.py
# =============================================================================

def detect_emergency(
    user_text:           str,
    raw_symptoms:        list,   # from extract_symptoms_llm()
    normalized_symptoms: list    # from map_symptom() / process_user_text()
) -> dict:
    """
    Two-stage emergency detection.

    Args:
        user_text           : original joined user input
        raw_symptoms        : LLM-extracted natural language symptoms
                              e.g. ["crushing chest pain", "cannot breathe"]
        normalized_symptoms : embedding-normalized dataset symptoms
                              e.g. ["chest_pain", "breathlessness"]

    Returns:
        Standardized result dict with is_emergency, message, actions, etc.
    """

    print("\n" + "="*55)
    print("EMERGENCY DETECTION — TWO STAGE AGENT")
    print(f"User text          : {user_text}")
    print(f"Raw symptoms       : {raw_symptoms}")
    print(f"Normalized symptoms: {normalized_symptoms}")
    print("="*55)

    # ── Stage 1: Classify body system ────────────────────────────────────────
    body_system = _classify_body_system(user_text, raw_symptoms)

    # ── Stage 2: Emergency agent with focused knowledge ───────────────────────
    result = _run_emergency_agent(
        user_text           = user_text,
        raw_symptoms        = raw_symptoms,
        normalized_symptoms = normalized_symptoms,
        body_system         = body_system
    )

    # ── Fallback if Stage 2 LLM failed ───────────────────────────────────────
    if result is None:
        print("Both LLM stages failed — running rule-based fallback")
        result = _fallback_detection(normalized_symptoms)
        result["detection_method"] = "fallback"
    else:
        result["detection_method"] = "llm_two_stage"

    result["body_system"] = body_system

    if result["is_emergency"]:
        result["message"] = _build_emergency_message(result)
    else:
        result["message"] = None

    print(f"\nFinal decision: is_emergency={result['is_emergency']}")
    print(f"ESI level      : {result.get('esi_level')}")
    print(f"Condition      : {result.get('suspected_condition')}")
    print(f"Reason         : {result.get('reason')}")

    return result


# =============================================================================
# RESPONSE PARSER
# =============================================================================
def _parse_llm_response(raw: str) -> dict:
    raw = re.sub(r"```json|```", "", raw).strip()
    match = re.search(r"\{.*?\}", raw, re.DOTALL)

    if not match:
        print("WARNING: No JSON found in LLM output")
        return _safe_default()

    try:
        parsed = json.loads(match.group())

        # log reasoning so you can see exactly how LLM decided
        if parsed.get("reasoning"):
            print(f"\nLLM reasoning:\n{parsed['reasoning']}")

        return {
            "is_emergency":        bool(parsed.get("is_emergency", False)),
            "esi_level":           parsed.get("esi_level", None),
            "suspected_condition": parsed.get("suspected_condition", None),
            "confidence":          str(parsed.get("confidence", "low")),
            "reason":              str(parsed.get("reason", "")),
            "matched_flags":       list(parsed.get("matched_flags", [])),
            "immediate_actions":   list(parsed.get("immediate_actions", [])),
            "reasoning":           str(parsed.get("reasoning", "")),
        }

    except json.JSONDecodeError as e:
        print(f"WARNING: JSON parse error: {e}")
        return _safe_default()
    
def _safe_default() -> dict:
    return {
        "is_emergency":        False,
        "esi_level":           None,
        "suspected_condition": None,
        "confidence":          "low",
        "reason":              "Could not parse LLM response",
        "matched_flags":       [],
        "immediate_actions":   [],
    }


# =============================================================================
# FALLBACK — Rule based, runs if both LLM stages fail
# =============================================================================

def _fallback_detection(normalized_symptoms: list) -> dict:
    print("Running rule-based fallback...")

    symptom_set  = set(normalized_symptoms)
    symptom_text = " ".join(normalized_symptoms).lower()

    # check ESI 1 KB conditions
    for entry in KB["flat"]["esi_1"]:
        matched = [s for s in entry["symptoms"] if s in symptom_text]
        if len(matched) >= 2:
            return {
                "is_emergency":        True,
                "esi_level":           1,
                "suspected_condition": entry["condition"],
                "confidence":          "medium",
                "reason":              f"Possible {entry['condition']}",
                "matched_flags":       matched,
                "immediate_actions":   entry["immediate_actions"][:3],
            }

    # check ESI 2 KB conditions
    for entry in KB["flat"]["esi_2"]:
        matched = [s for s in entry["symptoms"] if s in symptom_text]
        if len(matched) >= 2:
            return {
                "is_emergency":        True,
                "esi_level":           2,
                "suspected_condition": entry["condition"],
                "confidence":          "medium",
                "reason":              f"Possible {entry['condition']}",
                "matched_flags":       matched,
                "immediate_actions":   entry["immediate_actions"][:3],
            }

    # hardcoded high-confidence combos
    COMBOS = [
        ({"chest_pain", "breathlessness"},          1, "Possible cardiac emergency"),
        ({"chest_pain", "sweating"},                2, "Possible cardiac emergency"),
        ({"slurred_speech", "weakness"},            2, "Possible stroke"),
        ({"seizures", "high_fever"},                2, "Possible meningitis"),
        ({"vomiting_blood", "abdominal_pain"},      2, "Possible GI emergency"),
        ({"skin_rash", "difficulty_breathing"},     2, "Possible anaphylaxis"),
        ({"cyanosis", "breathlessness"},            1, "Possible respiratory failure"),
        ({"loss_of_consciousness", "chest_pain"},   1, "Possible cardiac arrest"),
    ]

    for rule_set, esi, reason in COMBOS:
        if rule_set.issubset(symptom_set):
            return {
                "is_emergency":        True,
                "esi_level":           esi,
                "suspected_condition": None,
                "confidence":          "medium",
                "reason":              reason,
                "matched_flags":       list(rule_set),
                "immediate_actions":   ["Call 911 immediately" if esi == 1 else "Go to ER now"],
            }

    return {
        "is_emergency":        False,
        "esi_level":           None,
        "suspected_condition": None,
        "confidence":          "high",
        "reason":              "No emergency indicators detected",
        "matched_flags":       [],
        "immediate_actions":   [],
    }


# =============================================================================
# MESSAGE BUILDER
# =============================================================================

def _build_emergency_message(result: dict) -> str:
    esi       = result.get("esi_level", 2)
    reason    = result.get("reason", "")
    condition = result.get("suspected_condition")
    actions   = result.get("immediate_actions", [])

    header = (
        "🚨 CALL 911 IMMEDIATELY — LIFE-THREATENING EMERGENCY"
        if esi == 1 else
        "⚠️ GO TO THE EMERGENCY ROOM NOW — DO NOT WAIT"
    )

    condition_line = f"\nSuspected: {condition}" if condition else ""
    actions_text   = ""

    if actions:
        lines        = "\n".join(f"  → {a}" for a in actions[:3])
        actions_text = f"\n\nWhat to do now:\n{lines}"

    return (
        f"{header}\n\n"
        f"{reason}"
        f"{condition_line}"
        f"{actions_text}\n\n"
        f"Call 911 / 112 / 999 or go to the nearest emergency room immediately.\n"
        f"Do not drive yourself. Do not wait to see if it improves."
    )