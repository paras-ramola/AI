# 🏥 Swasth — AI Medical Symptom Chatbot

> **Final Year Project** — A full-stack **web application** (Angular website + Node.js API + Python/Flask ML service) that takes natural language symptom descriptions, detects medical emergencies, and predicts possible diseases. Data is persisted in a **PostgreSQL** relational database.

---

## 📚 Table of Contents

1. [Project Overview](#project-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Full Data Flow](#full-data-flow)
4. [Frontend — `swasth-app` (Angular)](#frontend--swasth-app-angular)
5. [Backend — `swasth-backend` (Node.js / Express)](#backend--swasth-backend-nodejs--express)
6. [ML Services — `swasth-ml-services` (Python / Flask)](#ml-services--swasth-ml-services-python--flask)
7. [Database Schema](#database-schema)
8. [ML Model & NLP Pipeline](#ml-model--nlp-pipeline)
9. [Emergency Detection System](#emergency-detection-system)
10. [Data Files & Model Artifacts](#data-files--model-artifacts)
11. [Setup & Running the Project](#setup--running-the-project)
12. [API Reference](#api-reference)
13. [Technology Stack](#technology-stack)
14. [Directory Structure](#directory-structure)

---

## Project Overview

**Swasth** (meaning "healthy" in Hindi) is a full-stack **healthcare web application** — not a mobile app. It runs in the browser and is built with Angular 21 on the frontend. A user visits the website, creates an account, and types a natural language description of their symptoms (e.g., *"I have a crushing chest pain and cannot breathe"*). The system then:

1. Extracts and understands the symptoms using a locally running **Large Language Model** (Llama 3.2 via Ollama).
2. Runs a **two-stage emergency detection** agent. If a life-threatening emergency is detected, the user is immediately alerted with actionable steps.
3. If no emergency, it **maps the symptoms** to a known medical vocabulary using sentence embeddings (cosine similarity).
4. Passes the normalised symptom vector to a trained **CatBoost Classifier** and returns the top 3 predicted diseases with confidence scores.
5. Everything is stored per-user in a **PostgreSQL** database, behind **JWT authentication**.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      SWASTH — System Architecture                    │
├─────────────────┬──────────────────────┬─────────────────────────────┤
│  swasth-app     │   swasth-backend     │   swasth-ml-services        │
│  Angular 21     │   Node.js / Express  │   Python / Flask            │
│  Port: 4200     │   Port: 3000         │   Port: 5001                │
├─────────────────┴──────────────────────┴─────────────────────────────┤
│              PostgreSQL Database (swasthdb) — Port 5432              │
│              Ollama Local LLM Server — Port: 11434                   │
│              Model: Llama 3.2 (3B)                                   │
└──────────────────────────────────────────────────────────────────────┘
```

| Layer | Tech | Role |
|---|---|---|
| Frontend | Angular 21 | UI, routing, auth state, chat display |
| Backend | Node.js + Express | Auth, JWT guard, DB, ML proxy |
| ML Service | Python + Flask | NLP, emergency detection, disease prediction |
| Database | PostgreSQL | Users and chat history storage |
| LLM Runtime | Ollama (Llama 3.2:3b) | Symptom extraction & emergency reasoning |

---

## Full Data Flow

```
User types symptoms in Angular chat UI
         ↓
Angular (ChatService) → POST /api/chat  (with JWT in Authorization header)
         ↓
Node.js verifies JWT via authMiddleware
         ↓
chatController → POST http://localhost:5001/predict  (Flask ML service)
         ↓
Flask NLP Pipeline:
  Step 1 — extract_symptoms_llm()         → Llama 3.2 extracts raw symptoms
  Step 2 — clean_llm_output()             → Removes noise / punctuation
  Step 3 — normalize_symptoms()           → Maps to dataset vocabulary via SentenceTransformer + cosine similarity + Llama 3.2
  Step 4 — detect_emergency()             → 2-stage LLM emergency agent
         ↓ (if emergency)
  Returns emergency JSON immediately (skips CatBoost)
         ↓ (if NOT emergency)
  Step 5 — predict_disease()              → CatBoost Classifier → top 3 predictions
         ↓
Flask returns JSON to Node.js chatController
         ↓
Node.js stores result in PostgreSQL (chat_history table)
         ↓
Node.js returns final formatted response to Angular
         ↓
Angular displays predictions or emergency alert in chat UI
```

---

## Frontend — `swasth-app` (Angular Web Application)

**Type:** Browser-based web application (not a mobile app)
**Framework:** Angular 21 (Standalone Components)
**Port:** `http://localhost:4200`
**Directory:** `swasth-app/src/app/`

### Pages / Components

| Component | Route | File | Description |
|---|---|---|---|
| `Landing` | `/` | `landing/landing.ts` | Public homepage — hero section, features, CTA |
| `Login` | `/login` | `login/login.ts` | Login form (email + password, show/hide password toggle) |
| `Register` | `/register` | `register/register.ts` | Sign-up form (full name, age, gender, address, email, password) |
| `ChatDashboard` | `/chat` | `chat-dashboard/chat-dashboard.ts` | Main chat interface, sends symptoms, displays predictions |

---

### Routing (`app.routes.ts`)

```
/            → Landing         (public)
/login       → Login           (noAuthGuard: logged-in users redirected to /chat)
/register    → Register        (public)
/chat        → ChatDashboard   (authGuard: unauthenticated users redirected to /login)
```

- **`authGuard`** (`core/auth-guard.ts`): Checks `localStorage` for a JWT token. If missing → redirect to `/login`.
- **`noAuthGuard`** (`core/no-auth-guard.ts`): If already logged in → redirect to `/chat` (prevents logged-in users from seeing login again).

---

### Core Services

#### `Auth` Service (`core/auth.ts`)
Handles all HTTP calls to the Node.js backend for authentication.

| Method | Endpoint | Description |
|---|---|---|
| `login(data)` | `POST /login` | Sends credentials, receives JWT |
| `register(data)` | `POST /register` | Registers new user |
| `saveToken(token)` | — | Saves JWT to `localStorage` |
| `getToken()` | — | Reads JWT from `localStorage` |
| `logout()` | — | Removes JWT from `localStorage` |
| `isLoggedIn()` | — | Returns `true` if JWT exists |

#### `ChatService` (`services/chat.service.ts`)
Sends symptoms to the backend chat endpoint, attaching the JWT automatically.

```typescript
sendSymptoms(symptoms: string[])
// POST http://localhost:3000/api/chat
// Header: Authorization: Bearer <token>
// Body: { symptoms: [...] }
```

#### `authInterceptor` (`core/auth-interceptor.ts`)
An Angular HTTP interceptor that automatically attaches the JWT from `localStorage` as a `Bearer` token to every outgoing HTTP request.

---

### Chat Dashboard — Detailed Behaviour (`chat-dashboard/`)

- **Message Array:** Maintains an in-memory array of `{ sender, text, predictions }` objects.
- **User message:** Pushed immediately to the array when the user sends.
- **Bot response:** On API success, the top 3 predicted diseases with percentage confidence scores are displayed as a formatted list inside a chat bubble.
- **Error:** On failure, a plain "Prediction failed. Please try again." message is shown.
- **Logout:** Clears the JWT from localStorage and navigates to `/`.

---

### Landing Page (`landing/`)

A marketing-style landing page with:
- **Navbar** with links to Home, Features, About, Contact
- **Hero Section** with CTA button ("Start Chatting") → navigates to `/login` (or `/chat` if logged in)
- **Features Section** — four feature cards: Symptom Checker, 24/7 Availability, Appointment Booking, Personalized Health Tips
- **CTA Section** — repeated call to action
- **Footer** — copyright notice

---

### Login Page (`login/`)

- Fields: **Email**, **Password** (with show/hide toggle)
- Calls `Auth.login()`, saves the received JWT with `Auth.saveToken()`, and navigates to `/chat`.
- Displays inline error messages for failed login.
- "Don't have an account? Register" navigates to `/register`.

---

### Register Page (`register/`)

- Fields: **Full Name**, **Age**, **Gender** (radio buttons: Male/Female/Other), **Address**, **Email**, **Password**, **Confirm Password** (both with show/hide toggles)
- Validates all fields are filled and passwords match before calling `Auth.register()`.
- On success → navigates to `/login`.

---

## Backend — `swasth-backend` (Node.js / Express)

**Framework:** Express 5
**Port:** `http://localhost:3000`
**Directory:** `swasth-backend/`

### File Map

| File | Role |
|---|---|
| `server.js` | Entry point: sets up Express, middleware, registers /login and /register routes, starts server, auto-creates DB tables |
| `db.js` | PostgreSQL connection pool (connects to `swasthdb` on localhost:5432) |
| `routes/chatRoutes.js` | Defines `POST /api/chat` route, applies `verifyToken` middleware before `chatPredict` |
| `middleware/authMiddleware.js` | Validates the `Authorization: Bearer <token>` header using `jsonwebtoken` |
| `controllers/chatController.js` | Orchestrates: validates input → calls Flask → saves to DB → returns response to Angular |
| `controllers/authController.js` | (Refactored — logic moved directly to `server.js`; file kept as reference/commented code) |

---

### Authentication Endpoints (in `server.js`)

#### `POST /register`

| Field | Type | Notes |
|---|---|---|
| `email` | String | Must be unique |
| `password` | String | Hashed with `bcrypt` (10 salt rounds) |
| `age` | Int | Optional demographic info |
| `gender` | String | e.g. "Male", "Female", "Other" |
| `address` | Text | Free text |

Returns: `{ message: "User registered successfully" }` or `{ error: "User already exists" }`

#### `POST /login`

| Field | Type |
|---|---|
| `email` | String |
| `password` | String |

- Looks up user by email.
- Compares plain password with bcrypt hash using `bcrypt.compare()`.
- If match: signs a JWT with `{ userId }` payload (secret: `MY_SECRET_KEY`, expires: `1h`).
- Returns: `{ token: "<JWT>" }`

---

### Auth Middleware (`middleware/authMiddleware.js`)

```
Request → Check Authorization header for "Bearer <token>"
        → jwt.verify(token, "MY_SECRET_KEY")
        → If valid: attach decoded payload to req.user, call next()
        → If missing or invalid: return 401/403 JSON error
```

---

### Chat Route & Controller

**Route:** `POST /api/chat` (protected — requires valid JWT)

**Controller flow (`chatController.js`):**

1. Reads `symptoms` from request body (handles both string and array input).
2. Gets `userId` from the decoded JWT (`req.user.userId`).
3. POSTs the symptoms array to `http://localhost:5001/predict` (Flask service).
4. **Emergency path**: If `data.is_emergency === true` → saves to `chat_history` with `is_emergency: true` and `emergency_message` → returns emergency JSON to frontend.
5. **Normal path**: Takes `data.predictions[0].disease` as the primary prediction → saves to `chat_history` → returns all predictions with confidence scores.

---

### Database Connection (`db.js`)

The backend connects to a **PostgreSQL** database using the `pg` (node-postgres) library's **connection pool**, which reuses existing connections rather than opening a new one per request.

```js
// db.js — PostgreSQL connection config
{
  user: "admin",
  host: "localhost",
  database: "swasthdb",   // PostgreSQL database name
  password: "paras_admin123",
  port: 5432              // default PostgreSQL port
}
```

---

## ML Services — `swasth-ml-services` (Python / Flask)

**Framework:** Flask
**Port:** `http://localhost:5001`
**Directory:** `swasth-ml-services/`

### File Map

| File | Role |
|---|---|
| `application.py` | Flask entry point — defines `/predict` and `/health` endpoints; orchestrates the full NLP + ML pipeline |
| `nlp/emergency_detection.py` | Two-stage LLM emergency detection agent |
| `nlp/build_symptom_embeddings.py` | One-time script to generate and save symptom embeddings from the training dataset |
| `models/disease_prediction_model.cbm` | Trained CatBoost classifier (~1.5 GB) |
| `models/symptom_columns.pkl` | List of all symptom feature column names the model was trained on |
| `models/disease_classes.pkl` | List of all disease class labels the model can predict |
| `data/symptom_list.json` | JSON array of all known symptoms (used for embedding lookup) |
| `data/symptom_embeddings.pkl` | Pre-computed sentence embeddings for every symptom in `symptom_list.json` |
| `data/emergency_knowledge_base.json` | Structured medical knowledge base (life-threatening & critical conditions, organised by body system with ESI levels and immediate actions) |
| `data/red_flags.json` | Emergency red-flag phrases organised by severity level (ESI 1/2/3) and body system |
| `Datasets/data.csv` | Large training dataset (~190 MB) of symptoms vs. diseases |
| `Datasets/Symptom-severity.csv` | Symptom severity weighting table |
| `Medicine Recommendation System.ipynb` | Jupyter notebook used during ML training and experimentation |

---

## Database Schema

Auto-created by `server.js` on startup via `createTables()`:

### `users` table

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PRIMARY KEY | Auto-increment |
| `email` | VARCHAR(255) UNIQUE | Must be unique |
| `password` | VARCHAR(255) | bcrypt-hashed |
| `age` | INT | User's age |
| `gender` | VARCHAR(20) | e.g. "Male" |
| `address` | TEXT | Free-form address |
| `created_at` | TIMESTAMP | Defaults to `NOW()` |

### `chat_history` table

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PRIMARY KEY | Auto-increment |
| `user_id` | INTEGER | FK → `users(id)` ON DELETE CASCADE |
| `symptoms` | TEXT | Comma-joined symptom string |
| `predicted_disease` | TEXT | Top predicted disease (or suspected emergency condition) |
| `is_emergency` | BOOLEAN | `true` if emergency was triggered |
| `emergency_message` | TEXT | Full emergency alert message (if applicable) |
| `created_at` | TIMESTAMP | Defaults to `NOW()` |

---

## ML Model & NLP Pipeline

### Overview

The NLP pipeline in `application.py` has 5 steps when a `/predict` request arrives:

```
Step 1: extract_symptoms_llm(text)
   → Sends user text to Llama 3.2 via Ollama
   → Prompt: "Extract ONLY symptoms from the sentence, return comma separated"
   → Output example: ["cannot breathe", "crushing chest pain", "sweating"]

Step 2: clean_llm_output(symptoms)
   → Lowercase, strip punctuation/numbers, remove very short tokens
   → Preserves full semantic meaning

Step 3: normalize_symptoms(raw_symptoms)
   → For each raw symptom:
      a. Encode with SentenceTransformer ("all-MiniLM-L6-v2")
      b. Compute cosine similarity against pre-embedded symptom_list
      c. Select top-5 candidate matches
      d. Ask Llama 3.2 to pick the best medical match from candidates
   → Output example: ["breathlessness", "chest_pain", "sweating"]

Step 4: detect_emergency(user_text, raw_symptoms, normalized_symptoms)
   → Two-stage LLM agent (see Emergency Detection section)
   → If emergency → return immediately, skip CatBoost

Step 5: predict_disease(normalized_symptoms)
   → Convert symptom list to binary feature vector (length = len(symptom_columns))
   → Run CatBoost model.predict_proba()
   → Return top 3 predictions sorted by confidence
```

### Building Symptom Embeddings (`nlp/build_symptom_embeddings.py`)

This is a **one-time setup script**. It:
1. Reads the training dataset (`Datasets/data.csv`) and extracts all column names (skipping the `disease` column) as the symptom list.
2. Saves the symptom list to `data/symptom_list.json`.
3. Encodes the entire list using `all-MiniLM-L6-v2` SentenceTransformer.
4. Saves the resulting embeddings matrix to `data/symptom_embeddings.pkl`.

---

## Emergency Detection System

Located in `nlp/emergency_detection.py`. This is the most sophisticated part of the system.

### Two-Stage Agent

#### Stage 1 — System Classifier (`_classify_body_system`)

A fast Llama 3.2 call that reads the user's raw text and extracted symptoms and identifies which body system is involved.

**Possible systems:** `cardiac`, `respiratory`, `neurology`, `trauma`, `allergy`, `infectious`, `obstetrics`, `pediatric`, `psychiatry`, `endocrine`, `vascular`, `none`

This dramatically narrows the rules the agent needs to consider in Stage 2.

#### Stage 2 — Emergency Agent (`_run_emergency_agent`)

A focused, detailed Llama 3.2 call using:
- **System-specific knowledge** fetched from `emergency_knowledge_base.json`
- **System-specific red flags** fetched from `red_flags.json`
- **Both raw AND normalised symptoms**:
  - Raw symptoms (e.g., `"crushing chest pain"`) → for understanding **severity and context**
  - Normalised symptoms (e.g., `"chest_pain"`) → for **rule matching** against the knowledge base

The LLM is instructed to reason step-by-step (chain-of-thought) through 4 questions before deciding:
- Q1: What did the patient **explicitly** say?
- Q2: Are any hard emergency indicators present?
- Q3: What severity is indicated by the patient's own words?
- Q4: Am I judging evidence or making assumptions? (If assuming → must return `is_emergency: false`)

**The LLM returns a structured JSON:**
```json
{
  "is_emergency": true | false,
  "esi_level": 1 | 2 | 3 | null,
  "suspected_condition": "Condition name",
  "confidence": "high" | "medium" | "low",
  "reason": "One sentence justification",
  "matched_flags": ["flag1", "flag2"],
  "immediate_actions": ["action1", "action2"]
}
```

**ESI (Emergency Severity Index) Levels:**
| ESI | Meaning |
|---|---|
| 1 | 🚨 Call 911 immediately — Life-threatening |
| 2 | ⚠️ Go to ER now — High risk |
| 3 | Urgent care today — Not an emergency |

#### Fallback (`_fallback_detection`)

If both LLM stages fail (e.g., Ollama is unavailable), a **rule-based fallback** runs. It:
1. Checks `emergency_knowledge_base.json` for ESI-1 and ESI-2 conditions where ≥2 symptoms match.
2. Checks hardcoded high-confidence symptom-combination rules (e.g., `{chest_pain, breathlessness}` → ESI 1).
3. Returns `is_emergency: false` if nothing matches.

#### Emergency Message Builder (`_build_emergency_message`)

Formats a human-readable emergency alert including:
- Header: 🚨 "CALL 911 IMMEDIATELY" (ESI 1) or ⚠️ "GO TO THE EMERGENCY ROOM NOW" (ESI 2)
- Reason and suspected condition
- Up to 3 immediate actions (e.g., "Do not eat or drink", "Lie flat")
- Closing instruction to call emergency services

---

## Data Files & Model Artifacts

### Training Dataset (`Datasets/data.csv`)
- ~190 MB CSV
- Columns: `disease` + one column per symptom (binary: 1 = present, 0 = absent)
- Used to train the CatBoost classifier and generate the symptom list / embeddings

### Symptom Severity (`Datasets/Symptom-severity.csv`)
- Maps symptoms to a numerical severity weight (used during experimentation)

### `data/emergency_knowledge_base.json`
- Structured JSON with categories: `life_threatening`, `critical`, `pediatric_specific`, `mental_health_emergencies`
- Each entry contains: `condition`, body `system`, `symptoms`, `immediate_actions`, `esi_level`, `time_critical`

### `data/red_flags.json`
- Lists high-risk symptom phrases organised by ESI severity level (`level_1`, `level_2`, `level_3`) and body system

### `models/disease_prediction_model.cbm`
- Trained CatBoost binary classifier
- Input: Binary symptom feature vector
- Output: Probability distribution over all disease classes
- File size: ~1.5 GB

---

## Setup & Running the Project

### Prerequisites

| Tool | Purpose | Version |
|---|---|---|
| Node.js + npm | Frontend & backend runtime | Node 18+ recommended |
| Angular CLI | Frontend build tool | `npm install -g @angular/cli` |
| Python 3 | ML service runtime | 3.9+ recommended |
| PostgreSQL | Database | 14+ |
| Ollama | Local LLM runtime | Latest |
| Llama 3.2 (3B) model | NLP processing | `ollama pull llama3.2:3b` |

---

### Step 1 — Start Ollama & Download the Model

```bash
# Install Ollama (macOS)
brew install ollama

# Start the Ollama server
ollama serve
# Runs on http://localhost:11434

# Pull the Llama 3.2 3B model (~2 GB)
ollama pull llama3.2:3b

# Verify
ollama list
```

### Step 2 — Set Up PostgreSQL

Create the database. The tables (`users`, `chat_history`) are **auto-created** by the backend on first run.

```bash
psql -U postgres
CREATE USER admin WITH PASSWORD 'paras_admin123';
CREATE DATABASE swasthdb OWNER admin;
\q
```

### Step 3 — Run the ML Service

```bash
cd swasth-ml-services

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install catboost        # Install separately if needed

# Start the Flask server
python application.py
# Runs on http://localhost:5001
```

> **Note:** The first time you run `application.py`, it loads the CatBoost model (~1.5 GB) and the SentenceTransformer model. This may take 30–60 seconds.

### Step 4 — Run the Backend

```bash
cd swasth-backend

npm install

node server.js
# Runs on http://localhost:3000
```

### Step 5 — Run the Frontend

```bash
cd swasth-app

npm install

ng serve
# Runs on http://localhost:4200
```

Open your browser at **[http://localhost:4200](http://localhost:4200)**.

---

## API Reference

### Backend (`http://localhost:3000`)

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/register` | None | `{ email, password, age, gender, address }` | `{ message }` or `{ error }` |
| POST | `/login` | None | `{ email, password }` | `{ token }` |
| POST | `/api/chat` | Bearer JWT | `{ symptoms: string[] }` | Prediction or emergency JSON |

### ML Service (`http://localhost:5001`)

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/predict` | `{ symptoms: string[] }` | Prediction JSON (see below) |
| GET | `/health` | — | `{ status: "ok", service, port }` |

**Normal prediction response:**
```json
{
  "is_emergency": false,
  "raw_symptoms": ["fever", "cannot sleep"],
  "normalized_symptoms": ["fever", "insomnia"],
  "predictions": [
    { "disease": "Common Cold", "confidence": 0.72 },
    { "disease": "Influenza", "confidence": 0.18 },
    { "disease": "Dengue", "confidence": 0.05 }
  ]
}
```

**Emergency response:**
```json
{
  "is_emergency": true,
  "esi_level": 1,
  "suspected_condition": "Cardiac Arrest",
  "body_system": "cardiac",
  "confidence": "high",
  "reason": "Patient described chest pain with inability to breathe",
  "matched_flags": ["chest_pain", "breathlessness"],
  "immediate_actions": ["Call 911 immediately", "Begin CPR if trained"],
  "message": "🚨 CALL 911 IMMEDIATELY — LIFE-THREATENING EMERGENCY\n\n...",
  "detection_method": "llm_two_stage",
  "raw_symptoms": ["crushing chest pain", "cannot breathe"],
  "normalized_symptoms": ["chest_pain", "breathlessness"],
  "predictions": []
}
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Angular 21 (Standalone) | SPA web interface |
| Frontend Auth | JWT + `localStorage` | Session management |
| HTTP Interceptor | Angular `HttpInterceptorFn` | Auto-attach Bearer token |
| HTTP Client | Angular `HttpClient` | REST API calls |
| Backend | Node.js + Express 5 | API server |
| Password Hashing | `bcrypt` | Secure password storage |
| Tokens | `jsonwebtoken` | Stateless authentication |
| DB Driver | `pg` (node-postgres) | PostgreSQL connection pool |
| HTTP Proxy | `axios` | Backend → ML service calls |
| Database | PostgreSQL | Persistent data storage |
| ML Service | Python + Flask | AI prediction service |
| LLM Runtime | Ollama | Local model inference |
| LLM Model | Llama 3.2 (3B) | Symptom extraction + emergency reasoning |
| Embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`) | Semantic symptom mapping |
| Similarity | `scikit-learn` cosine similarity | Symptom matching |
| Disease Model | CatBoost Classifier | Disease prediction |
| Data Science | pandas, numpy | Data processing |
| CORS | `flask-cors`, `cors` | Cross-origin requests |

---

## Directory Structure

```
swasth/
├── swasth-app/                      # Angular Frontend
│   └── src/
│       └── app/
│           ├── landing/             # Public homepage
│           ├── login/               # Login page
│           ├── register/            # Register page
│           ├── chat-dashboard/      # Main chat UI
│           ├── services/
│           │   └── chat.service.ts  # Chat API calls
│           ├── core/
│           │   ├── auth.ts          # Auth service (login/register/token)
│           │   ├── auth-guard.ts    # Route guard (redirect to /login)
│           │   ├── no-auth-guard.ts # Route guard (redirect to /chat)
│           │   └── auth-interceptor.ts # HTTP interceptor (JWT header)
│           ├── app.routes.ts        # Route definitions
│           └── app.config.ts        # App configuration
│
├── swasth-backend/                  # Node.js Backend
│   ├── server.js                    # Entry point, auth routes, table creation
│   ├── db.js                        # PostgreSQL connection pool
│   ├── routes/
│   │   └── chatRoutes.js            # POST /api/chat
│   ├── middleware/
│   │   └── authMiddleware.js        # JWT verification
│   └── controllers/
│       ├── chatController.js        # ML proxy + DB save
│       └── authController.js        # (Reference/commented out)
│
└── swasth-ml-services/              # Python Flask ML Service
    ├── application.py               # Flask entry point + NLP pipeline
    ├── requirements.txt             # Python dependencies
    ├── nlp/
    │   ├── emergency_detection.py   # Two-stage emergency LLM agent
    │   └── build_symptom_embeddings.py # One-time embedding generation script
    ├── models/
    │   ├── disease_prediction_model.cbm  # Trained CatBoost model
    │   ├── symptom_columns.pkl           # Feature column names
    │   └── disease_classes.pkl           # Disease label names
    ├── data/
    │   ├── symptom_list.json             # All known symptoms
    │   ├── symptom_embeddings.pkl        # Pre-computed embeddings
    │   ├── emergency_knowledge_base.json # Medical emergency rules
    │   └── red_flags.json                # Emergency red flag phrases
    └── Datasets/
        ├── data.csv                      # Training dataset (~190 MB)
        └── Symptom-severity.csv          # Symptom severity weights
```

---

> © 2026 Swasth — Final Year Project | AI Medical Symptom Chatbot
