# The Swasth Engine: A Deep Technical Breakdown

This document provides a highly detailed, step-by-step breakdown of exactly what happens under the hood of the Swasth application. We will follow the data flow from the moment the user types a symptom to the final diagnosis.

---

## Step 1: The Symptom Search Dropdown (Autocomplete)

**What happens:** The user types "stomach" in the search bar, and a dropdown appears with options like "stomach pain", "stomach bleeding".

**How it works under the hood:**
1. **Frontend (Angular):** As the user types, the `SymptomSearchComponent` listens to the keystrokes. After a short delay (debounce) to prevent spamming the server, it sends an HTTP GET request with the search query `q=stomach` to the Node.js backend.
2. **Backend (Node.js):** The backend verifies the user's login token and forwards the request to the Python ML Service (`/symptoms/search`).
3. **ML Service (Flask):** 
   - The Python server has a hardcoded list of the 132 specific symptoms that the CatBoost ML model understands (e.g., `stomach_pain`, `vomiting`).
   - It loops through this list and does a simple text match: *"Does 'stomach' appear anywhere in this symptom name?"*
   - It replaces underscores with spaces (so `stomach_pain` looks like "stomach pain") and sends the top 10 matching results back to the user's screen.

---

## Step 2: The "Start Assessment" Trigger

**What happens:** The user selects a few symptoms (e.g., "stomach pain", "fever") and clicks "Start Assessment".

**How it works under the hood:**
1. **Frontend:** Angular sends a POST request (`/api/assess/start`) containing an array of the selected symptoms.
2. **Database:** Node.js creates a brand new row in the PostgreSQL `assessments` table. It generates a unique `session_id` and saves the starting symptoms.
3. **Routing:** Node.js then forwards these symptoms to the Python ML Service to begin the AI pipeline.

---

## Step 3: Symptom Normalisation (The Embedding Process)

**Why this is needed:** The user might type "my tummy hurts", but the Machine Learning model only understands the exact string `stomach_pain`. We need to translate user-speak into model-speak.

**How the translation works:**
1. **Symptom Extraction (LLM):** If the user typed a free-text sentence, it is sent to GPT-4o-mini. The prompt asks GPT to extract just the medical symptoms and return them as a comma-separated list.
2. **Embedding (Sentence-Transformers):**
   - The Python server uses an AI model called `all-MiniLM-L6-v2`. This is a "Sentence Transformer".
   - **What is an embedding?** An embedding converts a word or phrase into a list of 384 numbers (a vector). These numbers represent the *meaning* of the phrase. Phrases with similar meanings will have vectors that point in the same direction in a 384-dimensional mathematical space.
   - The system takes the extracted symptom (e.g., "tummy hurts") and converts it into a 384-number vector.
   - *Note: When the server first booted up, it already converted all 132 valid model symptoms (like `stomach_pain`) into vectors and saved them.*
3. **Cosine Similarity (The Matching Math):**
   - The system compares the user's vector ("tummy hurts") against all 132 saved vectors.
   - It calculates the **Cosine Similarity**. This is a math formula that measures the angle between two vectors. If the angle is 0 (the vectors point exactly the same way), the similarity is 1.0 (a perfect match).
   - It grabs the Top 5 closest matches (e.g., `stomach_pain`, `abdominal_pain`, `belly_ache`).
4. **LLM Disambiguation (The Final Pick):**
   - The Top 5 matches are sent back to GPT-4o-mini: *"The user said 'tummy hurts'. Which of these 5 medical terms is the absolute best match?"*
   - GPT picks `stomach_pain`. Now, the system has successfully translated the user's input into a format the CatBoost model understands!

---

## Step 4: Emergency Detection (Two-Stage Agent)

**What happens:** Before generating the first question, the system checks if the initial symptoms are life-threatening.

**How it works under the hood:**
1. **Stage 1 (Body System Classification):** 
   - The raw symptoms are sent to GPT. It is asked to classify which body system is affected (e.g., "Cardiac", "Neurology", "Gastrointestinal").
2. **Stage 2 (Chain-of-Thought Reasoning):**
   - The Python server loads a JSON file (`emergency_knowledge_base.json`). If Stage 1 said "Cardiac", it pulls out the specific red flags for heart issues (e.g., "crushing chest pain").
   - It sends the symptoms AND the Cardiac red flags to GPT, asking it to answer 4 specific questions step-by-step:
     1. *What did the patient explicitly state?*
     2. *Are hard emergency indicators present?*
     3. *What severity do the patient's own words indicate?*
     4. *Is the decision based on evidence or assumption?*
   - By forcing GPT to "think out loud" (Chain-of-Thought), it prevents GPT from jumping to conclusions. If the user says "mild chest itch", GPT is forced to realize there is no explicit evidence of a heart attack.
3. **Outcome:** If GPT decides it IS an emergency, it assigns an ESI Level (Emergency Severity Index). Level 1 is "Call 911 immediately". Level 2 is "Go to the ER now". It stops the assessment and alerts the user.

---

## Step 5: Phase 1 Questioning (Information Gain)

**What happens:** The system asks broad questions to eliminate as many diseases as possible quickly.

**What is Information Gain?**
- **Information Gain** is a concept from Information Theory. It measures how much "uncertainty" (Entropy) is reduced when you find out the answer to a question.
- **Entropy:** Imagine you have 133 possible diseases, and they are all equally likely. That is a state of High Entropy (maximum confusion).
- If you ask: *"Do you have a third arm?"* the answer is "No". Did that help you figure out the disease? No, because *no* diseases have that symptom. The Information Gain is 0.
- If you ask: *"Do you have a fever?"* the answer could split the 133 diseases right down the middle. If Yes, 60 diseases are possible. If No, 73 diseases are possible. Because it drastically reduced your confusion, "Fever" has a **High Information Gain**.

**How we do it:**
1. Before the app even runs, a script looked at the training data (4,900 patient records). It calculated the Information Gain score for all 132 symptoms.
2. The Python server loads this pre-calculated list, sorted from highest score to lowest score.
3. In Phase 1, the system simply looks at the list, finds the highest-scoring symptom that hasn't been asked yet, and asks it.
4. It sends the symptom to GPT-4o-mini to phrase it nicely: *"Are you experiencing a fever?"*

---

## Step 6: Phase 2 Questioning (CatBoost & Discriminative Questioning)

**What happens:** After 4 confirmed symptoms (or 10 questions), the system switches tactics. It stops asking broad questions and starts asking laser-focused "tie-breaker" questions.

**How it works under the hood:**
1. **The CatBoost Model Wakes Up:**
   - CatBoost is a Gradient Boosted Decision Tree machine learning model.
   - It takes an array of 132 binary numbers (1 if you have the symptom, 0 if you don't).
   - The server creates this array based on the chat history and feeds it to CatBoost.
   - CatBoost outputs a probability for all 133 diseases (e.g., Dengue: 45%, Malaria: 40%, Common Cold: 2%, etc.).
2. **Finding the Tie-Breaker (Variance Scoring):**
   - The system looks at the Top 4 most likely diseases.
   - It loops through every unasked symptom. For each symptom, it does a simulation:
     - *Simulation A:* "If I pretend the user says YES to 'joint pain', how much do the probabilities of Dengue and Malaria change?"
     - *Simulation B:* "If I pretend the user says NO to 'joint pain', how much do the probabilities change?"
   - The symptom that causes the biggest massive shift in probabilities (the biggest variance) is the ultimate tie-breaker.
3. The system selects this tie-breaker symptom, has GPT format the question, and sends it to the user.

---

## Step 7: Stopping Criteria & Final Prediction

**What happens:** The system eventually stops asking questions and shows the final results.

**How it works under the hood:**
1. Every time the user answers a question in Phase 2, CatBoost recalculates the probabilities.
2. The `should_predict()` function checks three rules:
   - **Rule 1 (Top Confidence):** Is the #1 disease above 60% probability? If yes, stop.
   - **Rule 2 (The Gap):** Is the #1 disease more than 30% ahead of the #2 disease? (e.g., Disease A is 45%, Disease B is 10%). If yes, stop.
   - **Rule 3 (Max Limits):** Has the system asked 20 questions? If yes, stop (to prevent annoying the user forever).
3. Once a rule is met, it packages the Top 5 diseases and sends them to the frontend.

---

## Step 8: AI Explanation Generation

**What happens:** The user sees the result, along with a paragraph explaining why the system chose it.

**How it works under the hood:**
1. The Angular frontend takes the #1 predicted disease (e.g., "Dengue") and the list of symptoms the user said "Yes" to.
2. It sends this to the Python `/assess/explain` endpoint.
3. Python asks GPT-4o-mini: *"The user has these symptoms. The system predicted Dengue. Write a 120-word explanation of what this disease is, why these symptoms match it, and what the user should do next. Add a disclaimer."*
4. GPT streams the text back, which Angular displays on the final results card.
5. Node.js takes this entire session—the symptoms, the questions asked, the CatBoost probabilities, and the explanation—and saves it to the `assessment_results` and `chat_history` database tables so the user can view it later in their dashboard.
