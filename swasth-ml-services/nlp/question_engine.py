# nlp/question_engine.py
# =============================================================================
# QUESTION ENGINE — Two-phase symptom question generator
#
# PHASE 1 — COLLECT
#   Ask high IG symptoms broadly
#   Do NOT run CatBoost
#   Stop when: confirmed >= 4 OR questions_asked >= 10
#
# PHASE 2 — DISCRIMINATE
#   Run CatBoost on confirmed symptoms
#   Get top 4 candidate diseases
#   Ask symptoms that best separate those 4 diseases
#   Stop when: confident OR max questions reached
# =============================================================================

import pandas as pd
import numpy as np
import os
import json
import pickle
from math import log2
from nlp.openai_client import call_openai

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_FILE = os.path.join(BASE_DIR, "data", "question_cache.json")

# =============================================================================
# THRESHOLDS
# =============================================================================

MIN_CONFIRMED_FOR_PHASE_2 = 4   # need 4+ confirmed to enter Phase 2
MIN_QUESTIONS_FOR_PHASE_2 = 10  # OR 10+ questions asked
MAX_QUESTIONS             = 20  # hard cap
CONFIDENCE_THRESHOLD      = 0.60
TOP_N_DISEASES            = 4   # look at top 4 diseases when discriminating


# =============================================================================
# LOAD DATASET
# =============================================================================

def _load_dataset() -> pd.DataFrame:
    csv_path = os.path.join(BASE_DIR, "Datasets", "data.csv")
    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

    for name in ["diseases", "disease", "prognosis"]:
        if name in df.columns:
            df = df.rename(columns={name: "disease"})
            break
    else:
        raise ValueError("Could not find disease column.")

    print(f"Dataset loaded: {len(df)} rows, {len(df.columns)-1} symptoms")
    return df


def _entropy(labels: np.ndarray) -> float:
    total = len(labels)
    if total == 0:
        return 0.0
    counts = {}
    for l in labels:
        counts[l] = counts.get(l, 0) + 1
    h = 0.0
    for count in counts.values():
        p = count / total
        if p > 0:
            h -= p * log2(p)
    return h


def _build_information_gain(df: pd.DataFrame) -> dict:
    symptom_cols = [c for c in df.columns if c != "disease"]
    diseases     = df["disease"].values
    ig_scores    = {}
    total        = len(diseases)

    disease_counts = {}
    for d in diseases:
        disease_counts[d] = disease_counts.get(d, 0) + 1

    base_entropy = 0.0
    for count in disease_counts.values():
        p = count / total
        if p > 0:
            base_entropy -= p * log2(p)

    for sym in symptom_cols:
        sym_values   = df[sym].values
        present_mask = sym_values == 1
        absent_mask  = sym_values == 0
        n_present    = present_mask.sum()
        n_absent     = absent_mask.sum()

        if n_present == 0 or n_absent == 0:
            ig_scores[sym] = 0.0
            continue

        h_present    = _entropy(diseases[present_mask])
        h_absent     = _entropy(diseases[absent_mask])
        p_present    = n_present / total
        p_absent     = n_absent  / total
        cond_entropy = (p_present * h_present) + (p_absent * h_absent)
        ig_scores[sym] = base_entropy - cond_entropy

    print(f"Information gain computed for {len(ig_scores)} symptoms")
    return ig_scores


def _build_disease_symptom_profile(df: pd.DataFrame) -> dict:
    """
    Computes P(symptom | disease) for every disease-symptom pair.

    P(symptom | disease) =
        rows where this disease AND symptom = 1
        ─────────────────────────────────────────
        total rows for this disease

    Used in Phase 2 to compute discrimination score between
    top candidate diseases.

    Example:
      panic_disorder rows: 100
      shortness_of_breath appears in 95 of them
      → P(shortness_of_breath | panic_disorder) = 0.95

      ataxia rows: 80
      shortness_of_breath appears in 4 of them
      → P(shortness_of_breath | ataxia) = 0.05

      discrimination score = |0.95 - 0.05| = 0.90
      → asking about shortness_of_breath will clearly
        separate panic from ataxia
    """
    symptom_cols = [c for c in df.columns if c != "disease"]
    profile      = {}

    for disease in df["disease"].unique():
        disease_rows = df[df["disease"] == disease]
        total        = len(disease_rows)
        if total == 0:
            continue
        profile[disease] = {}
        for sym in symptom_cols:
            count = disease_rows[sym].sum()
            profile[disease][sym] = float(count / total)

    print(f"Disease symptom profile built: {len(profile)} diseases")
    return profile


# =============================================================================
# LOAD EVERYTHING ONCE AT STARTUP
# =============================================================================

print("Loading dataset and building question engine matrices...")
DF                      = _load_dataset()
IG_SCORES               = _build_information_gain(DF)
DISEASE_SYMPTOM_PROFILE = _build_disease_symptom_profile(DF)
ALL_SYMPTOMS            = [c for c in DF.columns if c != "disease"]

# pre-rank all symptoms by global IG — used in Phase 1
GLOBAL_IG_RANKED = [
    sym for sym, _ in
    sorted(IG_SCORES.items(), key=lambda x: x[1], reverse=True)
]

print(f"Top 5 high-IG symptoms: {GLOBAL_IG_RANKED[:5]}")
print("Question engine ready.")


# =============================================================================
# PHASE DECISION
# =============================================================================

def get_current_phase(
    confirmed_symptoms: list,
    questions_asked:    int
) -> str:
    """
    Returns "collect" or "discriminate"

    collect:
      Phase 1 — ask broad high-IG questions
      Model not reliable yet with few symptoms
      Keep collecting until we have enough context

    discriminate:
      Phase 2 — model has been run
      Ask questions that separate top 4 candidate diseases
    """
    if (len(confirmed_symptoms) >= MIN_CONFIRMED_FOR_PHASE_2 or
            questions_asked >= MIN_QUESTIONS_FOR_PHASE_2):
        return "discriminate"
    return "collect"


# =============================================================================
# PHASE 1 — HIGH IG SYMPTOM SELECTION
# Ask broadly, do not run model
# =============================================================================

def get_high_ig_symptom(
    confirmed_symptoms: list,
    absent_symptoms:    list,
    asked_symptoms:     list
) -> str | None:
    """
    Phase 1 symptom selection.

    Picks the highest global IG symptom not yet asked.

    High IG symptoms are ones that most broadly separate
    all diseases — asking about them eliminates large
    portions of the disease space quickly.

    Examples: fever, fatigue, chest_pain, shortness_of_breath
    These are useful regardless of what disease the patient has.
    """

    exclude = set(confirmed_symptoms) | set(absent_symptoms) | set(asked_symptoms)

    for sym in GLOBAL_IG_RANKED:
        if sym not in exclude:
            print(f"Phase 1 — selected high-IG symptom: {sym} (IG: {IG_SCORES[sym]:.3f})")
            return sym

    return None


# =============================================================================
# PHASE 2 — DISCRIMINATING SYMPTOM SELECTION
# Ask questions that separate top candidate diseases
# =============================================================================

def get_discriminating_symptom(
    confirmed_symptoms:  list,
    absent_symptoms:     list,
    asked_symptoms:      list,
    top_predictions:     list   # from CatBoost — [{disease, confidence}, ...]
) -> str | None:
    """
    Phase 2 symptom selection.

    Finds the symptom that best separates the top 4 candidate diseases.

    For each unasked symptom, calculates discrimination score:
      score = average pairwise |P(sym|disease_i) - P(sym|disease_j)|
              across all pairs of top diseases

    High score = asking this symptom will most change the disease ranking.
    Low score  = asking this symptom won't help narrow things down.

    Example:
      Top diseases: Ataxia, Panic Disorder, Vertigo, Anxiety

      shortness_of_breath:
        P(sob | ataxia)         = 0.05
        P(sob | panic)          = 0.95
        P(sob | vertigo)        = 0.20
        P(sob | anxiety)        = 0.60
        avg pairwise difference = 0.42  ← useful

      problems_with_movement:
        P(pwm | ataxia)         = 0.90
        P(pwm | panic)          = 0.02
        P(pwm | vertigo)        = 0.15
        P(pwm | anxiety)        = 0.05
        avg pairwise difference = 0.45  ← more useful

      → ask about problems_with_movement first
    """

    exclude = (
        set(confirmed_symptoms) |
        set(absent_symptoms)    |
        set(asked_symptoms)
    )

    # get top 4 disease names from predictions
    top_diseases = [p["disease"] for p in top_predictions[:TOP_N_DISEASES]]

    print(f"\nPhase 2 — discriminating between: {top_diseases}")

    # only keep diseases that exist in our profile
    top_diseases = [d for d in top_diseases if d in DISEASE_SYMPTOM_PROFILE]

    if len(top_diseases) < 2:
        print("Not enough diseases in profile — falling back to high IG")
        return get_high_ig_symptom(confirmed_symptoms, absent_symptoms, asked_symptoms)

    # compute discrimination score for every unasked symptom
    discrimination_scores = {}

    for sym in ALL_SYMPTOMS:
        if sym in exclude:
            continue

        # get P(symptom | disease) for each top disease
        p_values = []
        for disease in top_diseases:
            p = DISEASE_SYMPTOM_PROFILE[disease].get(sym, 0.01)
            p_values.append(p)

        # compute average pairwise absolute difference
        # high variance = symptom appears in some diseases but not others
        # = very useful for discrimination
        pairwise_diffs = []
        for i in range(len(p_values)):
            for j in range(i + 1, len(p_values)):
                pairwise_diffs.append(abs(p_values[i] - p_values[j]))

        if not pairwise_diffs:
            continue

        avg_diff = sum(pairwise_diffs) / len(pairwise_diffs)

        # also weight by global IG to prefer broadly useful symptoms
        global_ig = IG_SCORES.get(sym, 0)

        # combined score: 70% discrimination + 30% global IG
        discrimination_scores[sym] = (0.7 * avg_diff) + (0.3 * global_ig)

    if not discrimination_scores:
        print("No discrimination scores — falling back to high IG")
        return get_high_ig_symptom(confirmed_symptoms, absent_symptoms, asked_symptoms)

    # pick highest scoring symptom
    best_sym   = max(discrimination_scores, key=discrimination_scores.get)
    best_score = discrimination_scores[best_sym]

    print(f"Phase 2 — best discriminating symptom: {best_sym} (score: {best_score:.3f})")

    # show top 3 for debugging
    top3 = sorted(discrimination_scores.items(), key=lambda x: x[1], reverse=True)[:3]
    print(f"Top 3 candidates: {top3}")

    return best_sym


# =============================================================================
# MAIN ENTRY POINT — get next symptom to ask
# =============================================================================

def get_next_symptom_to_ask(
    confirmed_symptoms:  list,
    absent_symptoms:     list,
    asked_symptoms:      list,
    current_predictions: list = None   # only provided in Phase 2
) -> str | None:
    """
    Decides which symptom to ask about next.

    Phase 1 (collect):
      Uses global IG ranking
      Asks broadly regardless of disease direction
      Builds enough context for model to be reliable

    Phase 2 (discriminate):
      Uses top 4 model predictions
      Asks symptoms that best separate candidate diseases
      Each question is chosen to maximally change the ranking
    """

    phase = get_current_phase(confirmed_symptoms, len(asked_symptoms))

    print(f"\nCurrent phase: {phase.upper()}")
    print(f"Confirmed: {len(confirmed_symptoms)} | Asked: {len(asked_symptoms)}")

    if phase == "collect":
        return get_high_ig_symptom(
            confirmed_symptoms,
            absent_symptoms,
            asked_symptoms
        )

    else:
        # Phase 2 — need predictions to discriminate
        if current_predictions and len(current_predictions) >= 2:
            return get_discriminating_symptom(
                confirmed_symptoms  = confirmed_symptoms,
                absent_symptoms     = absent_symptoms,
                asked_symptoms      = asked_symptoms,
                top_predictions     = current_predictions
            )
        else:
            # predictions not provided or only one disease
            # fall back to high IG
            print("No predictions available — using high IG fallback")
            return get_high_ig_symptom(
                confirmed_symptoms,
                absent_symptoms,
                asked_symptoms
            )


# =============================================================================
# SHOULD WE PREDICT NOW?
# =============================================================================

def should_predict(
    confirmed_symptoms:  list,
    questions_asked:     int,
    current_predictions: list = None
) -> tuple:
    """
    Decides if we have enough to make a final prediction.

    Returns (should_predict: bool, reason: str)
    """

    # hard cap — always predict at max questions
    if questions_asked >= MAX_QUESTIONS:
        return True, f"max questions ({MAX_QUESTIONS}) reached"

    # must be in Phase 2 before predicting
    phase = get_current_phase(confirmed_symptoms, questions_asked)
    if phase == "collect":
        return False, f"still in Phase 1 — collecting symptoms ({len(confirmed_symptoms)} confirmed)"

    # in Phase 2 — check if model is confident enough
    if current_predictions:
        top_conf = current_predictions[0]["confidence"]

        if top_conf >= CONFIDENCE_THRESHOLD:
            return True, f"confident: {current_predictions[0]['disease']} ({top_conf:.0%})"

        # check if gap between top 2 is large enough
        if len(current_predictions) >= 2:
            gap = top_conf - current_predictions[1]["confidence"]
            if top_conf >= 0.50 and gap >= 0.25:
                return True, f"clear leader: {current_predictions[0]['disease']} with {gap:.0%} gap"

    return False, "need more information"


# =============================================================================
# LLM QUESTION FORMATTER
# LLM only formats the question — never chooses the symptom
# =============================================================================

def _load_question_cache() -> dict:
    """Load pre-built question cache from disk (survives restarts)."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                cache = json.load(f)
            print(f"Question cache loaded: {len(cache)} pre-built questions")
            return cache
        except Exception as e:
            print(f"Could not load question cache: {e}")
    return {}


def _save_question_cache(cache: dict) -> None:
    """Persist updated cache to disk."""
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        print(f"Could not save question cache: {e}")


# Load cache once at module startup
_QUESTION_CACHE: dict = _load_question_cache()


def format_question_with_llm(
    symptom:            str,
    confirmed_symptoms: list,
    phase:              str = "collect"
) -> dict:
    """
    Converts a dataset symptom into a natural question.

    CACHE-FIRST: checks _QUESTION_CACHE before calling the LLM.
    Cache key = symptom name (context-independent phrasing).
    On cache miss: calls GPT with max_tokens=60 and saves result.

    This eliminates ~500ms latency for all previously seen symptoms.
    """

    # ── 1. Cache hit — return immediately, no LLM call ──────────────────────
    if symptom in _QUESTION_CACHE:
        cached_q = _QUESTION_CACHE[symptom]
        print(f"Cache hit for '{symptom}' → '{cached_q}'")
        return {
            "symptom":  symptom,
            "question": cached_q,
            "options":  ["Yes", "No", "Not sure"],
            "phase":    phase
        }

    # ── 2. Cache miss — call LLM with tight token limit ─────────────────────
    symptom_readable = symptom.replace("_", " ")

    prompt = f"""Convert this medical symptom into ONE simple yes/no question (max 10 words):
Symptom: {symptom_readable}
Rules: everyday language, no jargon, answerable with Yes/No/Not sure.
Examples: fever→"Do you have a fever?" shortness_of_breath→"Are you having trouble breathing?"
Return ONLY the question."""

    try:
        question = call_openai(prompt, timeout=15, max_tokens=60).strip()
        question = question.strip('"').strip("'")

        # ── 3. Save to cache so next time is instant ─────────────────────────
        _QUESTION_CACHE[symptom] = question
        _save_question_cache(_QUESTION_CACHE)

        print(f"Cache miss for '{symptom}' → LLM returned '{question}' (now cached)")

    except Exception as e:
        print(f"OpenAI question formatting failed: {e}")
        question = f"Are you experiencing {symptom_readable}?"

    return {
        "symptom":  symptom,
        "question": question,
        "options":  ["Yes", "No", "Not sure"],
        "phase":    phase
    }


# =============================================================================
# SYMPTOM SEARCH — for the search-and-select UI
# =============================================================================

def search_symptoms_by_text(query: str, top_k: int = 10) -> list:

    query_clean = query.lower().strip().replace(" ", "_")
    query_words = query.lower().strip().split()
    scored      = []

    for sym in ALL_SYMPTOMS:
        score     = 0
        sym_words = sym.replace("_", " ").split()

        if query_clean == sym:
            score += 100
        elif query_clean in sym:
            score += 50

        overlap = len(set(query_words) & set(sym_words))
        score  += overlap * 20

        for qw in query_words:
            for sw in sym_words:
                if qw in sw or sw in qw:
                    score += 10

        if score > 0:
            scored.append((sym, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    return [
        {"symptom": sym, "display": sym.replace("_", " ").title()}
        for sym, _ in scored[:top_k]
    ]