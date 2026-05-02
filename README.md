# 🏥 Swasth — AI-Powered Health Assessment Platform

> **Final Year Project** · Full-Stack Healthcare Web Application  
> Angular · Node.js · Flask · PostgreSQL · CatBoost · GPT-4o-mini

[![Angular](https://img.shields.io/badge/Angular-21-red?logo=angular)](https://angular.io)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue?logo=postgresql)](https://postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📚 Table of Contents

1. [Project Overview](#-project-overview)
2. [Features](#-features)
3. [Tech Stack](#-tech-stack)
4. [System Architecture](#-system-architecture)
5. [Folder Structure](#-folder-structure)
6. [Installation Guide](#-installation-guide)
7. [Environment Variables](#-environment-variables)
8. [How to Run Locally](#-how-to-run-locally)
9. [API Endpoints](#-api-endpoints)
10. [ML Pipeline Overview](#-ml-pipeline-overview)
11. [GenAI Workflow](#-genai-workflow)
12. [Screenshots](#-screenshots)
13. [Deployment Guide](#-deployment-guide)
14. [Future Improvements](#-future-improvements)
15. [Troubleshooting](#-troubleshooting)
16. [Contributors](#-contributors)
17. [License](#-license)

---

## 🧠 Project Overview

**Swasth** (Sanskrit: *healthy*) is a full-stack AI health assessment platform that guides users through a structured, conversational symptom collection process — then delivers machine-learning-powered disease predictions with GPT-generated explanations, personalized health recommendations, and a map of nearby medical facilities.

### Problem It Solves

Most people don't know how to interpret their own symptoms. They either panic unnecessarily or ignore serious warning signs. Swasth provides a fast, private, intelligent first-pass health assessment that:

- Detects medical **emergencies** before they become fatal
- **Predicts likely conditions** from symptoms using a trained CatBoost model
- **Explains** results in plain language using GPT-4o-mini
- Provides **personalized** diet, workout, and precaution recommendations
- Shows **nearby clinics and pharmacies** on an interactive map

### Who It Is For

- General public seeking health information
- Medical students learning about symptom-to-disease correlation
- Healthcare startups looking for an AI triage reference architecture
- Final year CS/AI students demonstrating full-stack GenAI systems

### Main Objectives

1. Implement a clinically-inspired two-phase symptom collection engine
2. Achieve accurate disease prediction using CatBoost on 130+ symptoms
3. Integrate GPT-4o-mini for intelligent question formatting, explanation, and recommendations
4. Build a production-quality Angular frontend with smooth animations and mobile-first design
5. Ensure safety by prioritizing emergency detection before any disease classification

---

## ✨ Features

### 🖥️ Frontend
- Animated landing page with feature showcase
- JWT-based authentication (register, login, logout)
- Symptom search with live typeahead from 130+ symptoms
- Conversational question flow (Yes / No / Not sure per symptom)
- Assessment result screen with confidence chart and explanations
- Personalized recommendations in expandable accordion cards (Diet, Workout, Precautions)
- Emergency detection screen with immediate action steps
- Assessment history page showing past 20 results
- Interactive Leaflet map showing nearby clinics, pharmacies, and hospitals
- IP-geolocation fallback when browser location fails
- Fully responsive, dark-mode ready design

### 🔧 Backend
- Express 5 REST API with modular routes and controller pattern
- JWT authentication with `bcrypt` password hashing
- PostgreSQL auto-schema creation on startup
- Secure auth middleware protecting all assessment routes
- Proxy layer to Flask ML service using `axios`
- Full assessment session persistence in `assessments` and `assessment_results` tables

### 🤖 ML Features
- Two-phase symptom assessment engine (COLLECT → DISCRIMINATE)
- CatBoost classifier trained on 6,900+ disease-symptom combinations
- Information-gain based symptom selection (Phase 1)
- Pairwise discrimination scoring between top-4 candidate diseases (Phase 2)
- Dynamic `should_predict` thresholds based on confidence and inter-disease gap
- In-process LLM question cache (zero-latency repeat questions)

### 🧬 GenAI Features
- GPT-4o-mini for all LLM tasks (low latency, cost-efficient)
- Two-stage emergency detection agent (body system classifier → emergency reasoner)
- Chain-of-thought emergency reasoning with explicit 4-question decision framework
- GPT-4o-mini question formatter converting dataset symptom names to natural language
- GPT-4o-mini explanation generator (plain-English condition explanation post-assessment)
- Personalized recommendations engine (diet / workout / precautions) per user age + gender
- Intensity-aware workout recommendations (rest / light / moderate based on condition severity)

### 🔐 Security & Auth
- Passwords hashed with `bcrypt` (10 salt rounds)
- JWT signed with a configurable secret (`JWT_SECRET` env var)
- 7-day token expiry with forced re-login
- `authGuard` and `noAuthGuard` on Angular routes
- Angular HTTP interceptor auto-attaches Bearer token to every request
- Environment variables for all secrets (never hardcoded in production)

### 📊 History & Analytics
- Last 20 assessments retrievable from `/api/history`
- Stores confirmed symptoms, predicted disease, confidence, feedback type, and timestamp
- Expandable history cards with symptom breakdowns

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| Angular 21 (Standalone Components) | SPA framework |
| TypeScript | Type-safe component logic |
| SCSS | Component-scoped styling |
| RxJS | Reactive streams for HTTP and state |
| Leaflet.js | Interactive map for nearby facilities |
| Angular Router | Client-side routing with lazy loading |
| Angular HttpClient + Interceptor | REST API calls with auto-auth headers |

### Backend
| Technology | Purpose |
|---|---|
| Node.js 18+ | JavaScript runtime |
| Express 5 | REST API framework |
| `jsonwebtoken` | JWT generation and verification |
| `bcrypt` | Password hashing |
| `pg` (node-postgres) | PostgreSQL connection pooling |
| `axios` | HTTP proxy to Flask ML service |
| `uuid` | Session ID generation |
| `dotenv` | Environment variable loading |

### Machine Learning
| Technology | Purpose |
|---|---|
| Python 3.11 | ML service runtime |
| Flask + Flask-CORS | ML REST API server |
| CatBoost | Disease classification model |
| scikit-learn | Cosine similarity for symptom matching |
| sentence-transformers (`all-MiniLM-L6-v2`) | Semantic symptom embeddings |
| pandas / numpy | Data processing |
| pickle | Model artifact serialization |

### Generative AI
| Technology | Purpose |
|---|---|
| OpenAI GPT-4o-mini | All LLM calls (emergency, formatting, explanation, recommendations) |
| `openai` Python SDK | GPT API client |
| `python-dotenv` | API key management |

### Database
| Technology | Purpose |
|---|---|
| PostgreSQL 14+ | Primary relational database |
| Auto-migrations via `server.js` | Table creation on startup |

### DevOps / Tooling
| Technology | Purpose |
|---|---|
| Angular CLI | Frontend build and dev server |
| npm | Package management (frontend + backend) |
| pip / venv | Python dependency management |
| `concurrent.futures` | Parallel LLM execution in ML service |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SWASTH SYSTEM ARCHITECTURE                       │
├──────────────────┬───────────────────────┬──────────────────────────────┤
│  swasth-app      │   swasth-backend      │   swasth-ml-services         │
│  Angular 21      │   Node.js / Express 5 │   Python / Flask             │
│  :4200           │   :3000               │   :5001                      │
│                  │                       │                              │
│  Landing         │  POST /register       │  GET  /symptoms/search       │
│  Login           │  POST /login          │  POST /assess/start          │
│  Register        │  GET  /me             │  POST /assess/answer         │
│  Symptom Search  │  GET  /api/history    │  POST /assess/explain        │
│  Questions       │  POST /api/assess/..  │  POST /assess/recommendations│
│  Result          │                       │  POST /assess/feedback       │
│  Recommendations │                       │                              │
│  History         │                       │  GPT-4o-mini (OpenAI API)    │
│  Nearby Map      │                       │  CatBoost Model              │
│                  │                       │  SentenceTransformer         │
└──────────────────┴───────────┬───────────┴──────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   PostgreSQL :5432   │
                    │   swasthdb           │
                    │   users              │
                    │   assessments        │
                    │   assessment_results │
                    │   chat_history       │
                    │   chat_sessions      │
                    │   predictions        │
                    └─────────────────────┘
```

### High-Level Request Flow

```
User answers a question (Yes/No/Not sure)
         │
         ▼
Angular  →  POST /api/assess/answer  (JWT in header)
         │
         ▼
Node.js authMiddleware verifies JWT
         │
         ▼
chatController  →  POST http://localhost:5001/assess/answer
         │
         ▼
Flask assess_answer():
  1. Update confirmed/absent symptom lists
  2. Determine phase (COLLECT or DISCRIMINATE)
  3. Emergency check:
     a. Deterministic guard (pure Python, instant)
     b. Fast-path: if new symptom not in red_flags → skip LLM (~0ms)
     c. If risky → GPT-4o-mini 2-stage emergency agent
  4. Phase 1 (COLLECT): pick highest info-gain unasked symptom
  5. Phase 2 (DISCRIMINATE): run CatBoost → pick best discriminating symptom
  6. Format question via GPT-4o-mini (cached after first call)
         │
         ▼
Node.js updates assessments table in PostgreSQL
         │
         ▼
Angular shows next question or prediction result
```

---

## 📁 Folder Structure

```
swasth/
│
├── README.md                          # This file
├── working.md                         # Deep internal working documentation
│
├── swasth-app/                        # ── ANGULAR FRONTEND ──────────────────
│   ├── angular.json                   # Angular workspace config
│   ├── package.json                   # Frontend dependencies
│   └── src/
│       └── app/
│           ├── app.routes.ts          # Top-level route definitions
│           ├── app.config.ts          # HTTP client + interceptor providers
│           │
│           ├── landing/               # Public homepage (hero, features, CTA)
│           ├── login/                 # Login form + JWT storage
│           ├── register/              # Registration form with validation
│           ├── chat-dashboard/        # Legacy chat UI (kept for reference)
│           ├── history/               # Assessment history page
│           │
│           ├── assessment/            # ── ASSESSMENT FLOW (lazy-loaded) ──────
│           │   ├── assessment.routes.ts          # /assess sub-routes
│           │   ├── symptom-search/               # Symptom typeahead search + select
│           │   ├── assessment-question/          # Per-question Yes/No/Not sure UI
│           │   ├── assessment-result/            # Result + explanation screen
│           │   ├── assessment-emergency/         # Emergency alert screen
│           │   ├── assessment-recommendations/   # Diet/Workout/Precautions cards
│           │   └── nearby-facilities/            # Leaflet map + Overpass API
│           │
│           ├── core/                  # ── CORE SERVICES ─────────────────────
│           │   ├── auth.ts            # Login / register / token management
│           │   ├── auth-guard.ts      # Redirects unauthenticated → /login
│           │   ├── no-auth-guard.ts   # Redirects logged-in → /assess
│           │   ├── auth-interceptor.ts# Attaches Bearer token to every request
│           │   └── user.service.ts    # Cached user profile (age, gender)
│           │
│           └── services/
│               └── chat.service.ts    # All API calls to backend
│
├── swasth-backend/                    # ── NODE.JS BACKEND ───────────────────
│   ├── server.js                      # Entry point, auth routes, table creation
│   ├── db.js                          # PostgreSQL connection pool
│   ├── package.json                   # Backend dependencies
│   ├── middleware/
│   │   └── authMiddleware.js          # JWT verification middleware
│   ├── routes/
│   │   └── chatRoutes.js              # All /api/* route registrations
│   └── controllers/
│       ├── chatController.js          # Assessment logic + ML proxy + DB writes
│       └── authController.js          # Auth helpers (reference)
│
└── swasth-ml-services/                # ── FLASK ML SERVICE ──────────────────
    ├── application.py                 # Flask entry point + all endpoints
    ├── requirements.txt               # Python dependencies
    ├── .env                           # OPENAI_API_KEY (not committed)
    │
    ├── nlp/                           # NLP + AI modules
    │   ├── openai_client.py           # Single GPT-4o-mini client
    │   ├── emergency_detection.py     # 2-stage emergency agent
    │   ├── question_engine.py         # 2-phase question selection + LLM formatting
    │   ├── recommendations_engine.py  # Personalized diet/workout/precaution generator
    │   └── build_symptom_embeddings.py# One-time embedding generation script
    │
    ├── models/                        # Trained artifacts (not in git — too large)
    │   ├── disease_prediction_model.cbm  # CatBoost classifier
    │   ├── symptom_columns.pkl           # Feature column names
    │   └── disease_classes.pkl           # Disease label list
    │
    ├── data/                          # Knowledge base + embeddings
    │   ├── symptom_list.json             # All 130+ symptoms
    │   ├── symptom_embeddings.pkl        # Pre-computed MiniLM embeddings
    │   ├── emergency_knowledge_base.json # Condition rules by ESI level + system
    │   └── red_flags.json                # Emergency trigger phrases
    │
    └── Datasets/                      # Training data (not in git — too large)
        ├── data.csv                      # Main training dataset (130 symptoms × diseases)
        └── Symptom-severity.csv          # Symptom severity weights
```

---

## 🚀 Installation Guide

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Bundled with Node.js |
| Angular CLI | 17+ | `npm install -g @angular/cli` |
| Python | 3.11+ | [python.org](https://python.org) |
| PostgreSQL | 14+ | [postgresql.org](https://postgresql.org) |
| Git | Any | [git-scm.com](https://git-scm.com) |

### Clone the Repository

```bash
git clone https://github.com/your-username/swasth.git
cd swasth
```

---

## 🔑 Environment Variables

### ML Service — `swasth-ml-services/.env`

```env
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
```

### Backend — `swasth-backend/.env` (create if not present)

```env
JWT_SECRET=your_strong_random_secret_here
DB_USER=admin
DB_HOST=localhost
DB_NAME=swasthdb
DB_PASSWORD=your_db_password
DB_PORT=5432
```

> **Never commit `.env` files to version control.**

---

## ▶️ How to Run Locally

### Step 1 — Set Up PostgreSQL

```bash
psql -U postgres
CREATE USER admin WITH PASSWORD 'your_password';
CREATE DATABASE swasthdb OWNER admin;
\q
```

> Tables (`users`, `assessments`, `assessment_results`, etc.) are **auto-created** by the backend on first start.

### Step 2 — Start the ML Service

```bash
cd swasth-ml-services

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Add your OpenAI key
echo "OPENAI_API_KEY=sk-your-key" > .env

# Start Flask
python application.py
# Listening on http://localhost:5001
```

> First start loads CatBoost model and SentenceTransformer — allow 30–60 s.

### Step 3 — Start the Backend

```bash
cd swasth-backend
npm install
node server.js
# Listening on http://localhost:3000
```

### Step 4 — Start the Frontend

```bash
cd swasth-app
npm install
ng serve
# Open http://localhost:4200
```

---

## 📡 API Endpoints

### Backend — `http://localhost:3000`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | None | Create account |
| POST | `/login` | None | Get JWT token |
| GET | `/me` | Bearer JWT | Get logged-in user profile |
| GET | `/api/history` | Bearer JWT | Last 20 assessment results |
| GET | `/api/symptoms/search?q=` | Bearer JWT | Search symptoms |
| POST | `/api/assess/start` | Bearer JWT | Start new assessment session |
| POST | `/api/assess/answer` | Bearer JWT | Submit answer to a symptom question |
| POST | `/api/assess/explain` | Bearer JWT | Generate GPT explanation for result |
| POST | `/api/assess/feedback` | Bearer JWT | Submit like/dislike feedback |
| POST | `/api/assess/recommendations` | Bearer JWT | Get diet/workout/precautions |

### ML Service — `http://localhost:5001`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/symptoms/search?q=` | Dataset symptom search |
| POST | `/assess/start` | Emergency check + first question |
| POST | `/assess/answer` | Process answer + emergency + next question |
| POST | `/assess/explain` | GPT explanation for predicted disease |
| POST | `/assess/feedback` | Evaluate user feedback via GPT |
| POST | `/assess/recommendations` | Generate personalized section recommendation |

---

## 🧬 ML Pipeline Overview

```
User selects symptoms (e.g. fever, headache, chills)
              │
              ▼
       /assess/start
  ┌────────────────────────────────────────────────────┐
  │ 1. Emergency Check (deterministic guard first)      │
  │    → if cardiac triad detected → return emergency   │
  │ 2. Phase 1: Pick highest info-gain unasked symptom  │
  │    → format with GPT (cached)                       │
  │ 3. Return first question                            │
  └────────────────────────────────────────────────────┘
              │  (user answers Yes/No/Not sure)
              ▼
       /assess/answer  [repeated per question]
  ┌────────────────────────────────────────────────────┐
  │ PHASE 1 — COLLECT (confirmed < 4 symptoms)         │
  │   Emergency fast-path (skip LLM if safe symptom)   │
  │   Next = highest global info-gain symptom           │
  │                                                    │
  │ PHASE 2 — DISCRIMINATE (confirmed ≥ 4 symptoms)    │
  │   Run CatBoost → get top-4 candidate diseases      │
  │   Check should_predict (confidence ≥ 60% OR gap)   │
  │   Next = symptom maximizing pairwise discrimination │
  │                                                    │
  │ Format question via GPT-4o-mini (cached)           │
  └────────────────────────────────────────────────────┘
              │  (prediction ready)
              ▼
       /assess/explain
  ┌────────────────────────────────────────────────────┐
  │ GPT-4o-mini generates warm 120-word explanation    │
  │ Save to assessment_results table                   │
  └────────────────────────────────────────────────────┘
```

### CatBoost Model

- **Input:** Binary vector of length 130 (1 = symptom confirmed, 0 = absent/unasked)
- **Output:** Probability distribution over all disease classes
- **Training data:** ~6,900 disease-symptom combinations
- **Threshold:** Only diseases with ≥ 3% probability returned
- **Top-N:** Up to 5 predictions returned, sorted by confidence

---

## 🤖 GenAI Workflow

GPT-4o-mini is used in 5 distinct roles:

| Role | Endpoint | Prompt Style |
|---|---|---|
| Emergency Classifier | `/assess/start`, `/assess/answer` | Stage 1: one-word body system |
| Emergency Reasoner | `/assess/answer` | Stage 2: chain-of-thought JSON |
| Question Formatter | All question steps | Convert symptom name → natural question |
| Result Explainer | `/assess/explain` | Warm 120-word plain-English explanation |
| Recommendation Generator | `/assess/recommendations` | Section-specific JSON (diet/workout/precautions) |

All calls go through `nlp/openai_client.py` — a single entry point with:
- `temperature=0.1` (deterministic, medically consistent outputs)
- `max_tokens=500` (cost-controlled)
- Configurable per-call `timeout`

---

## 📸 Screenshots

> _Add screenshots here when available_

| Screen | Description |
|---|---|
| Landing Page | Hero, features, CTA |
| Symptom Search | Live typeahead search |
| Question Flow | Yes / No / Not sure cards |
| Assessment Result | Disease predictions + GPT explanation |
| Recommendations | Diet / Workout / Precautions accordion |
| History | Timeline of past assessments |
| Nearby Map | Leaflet map with clinic/pharmacy pins |

---

## 🚢 Deployment Guide

### Frontend — Vercel / Netlify

```bash
cd swasth-app
ng build --configuration production
# dist/swasth-app/ → deploy to Vercel/Netlify
```

Update `apiUrl` in `chat.service.ts` to your backend's production URL.

### Backend — Railway / Render / Fly.io

```bash
# Set environment variables in your platform's dashboard:
# JWT_SECRET, DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT

# Deploy swasth-backend/ as a Node.js service
```

### ML Service — AWS EC2 / GCP / Fly.io (GPU optional)

```bash
# The CatBoost model is CPU-friendly — no GPU required
# Deploy swasth-ml-services/ as a Python/Flask service
# Set OPENAI_API_KEY as environment variable
```

### Database — Supabase / Railway / Neon

- Create a PostgreSQL instance
- Update `DB_*` environment variables in the backend
- Tables auto-create on first backend start

---

## 🔮 Future Improvements

- [ ] Multilingual support (Hindi, Tamil, Marathi)
- [ ] Voice input for symptom description
- [ ] Doctor appointment booking integration
- [ ] Mobile app (Flutter/React Native)
- [ ] FHIR-compliant health record export
- [ ] Federated learning for privacy-preserving model improvement
- [ ] Differential diagnosis confidence calibration
- [ ] Telemedicine video consultation integration
- [ ] Admin dashboard with aggregate analytics
- [ ] Redis caching for session state (replace stateless answer passing)

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| `GET /api/history 404` | Restart backend — route added in latest version |
| Assessment answer slow (~3–4 s) | Restart ML service — fast-path cache activates on first run |
| `kCLErrorLocationUnknown` on Mac | Expected — IP geolocation fallback activates automatically |
| `OPENAI_API_KEY not found` | Add `.env` file in `swasth-ml-services/` |
| PostgreSQL connection refused | Ensure PostgreSQL is running on port 5432 |
| CatBoost model not found | Ensure `models/` directory contains `.cbm`, `.pkl` files |
| Angular build fails | Run `npm install` then `ng serve` again |
| Port already in use | Kill existing processes: `lsof -ti:3000 \| xargs kill` |

---

## 👥 Contributors

| Name | Role |
|---|---|
| Paras Chandra Mola | Full-Stack Developer, ML Engineer, Project Lead |

---

## 📄 License

This project is licensed under the **MIT License**.  
See [LICENSE](LICENSE) for details.

---

> © 2026 Swasth — AI Health Assessment Platform | Final Year Project
