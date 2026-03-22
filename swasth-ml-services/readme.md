Frontend (Angular)
→ UI, Chat Page, Display Results

Backend (Node)
→ Authentication
→ JWT verification
→ PostgreSQL
→ Store chat history
→ Call ML API

ML Service (Flask)
→ Only ML prediction
→ Only health logic
→ No authentication
→ No UI rendering



***
1) made al= list of all the symptoms our model is trained on
2) embedded the symptoms list using sentence tranformer
3) if any user type " I have fever and cannot sleep" 
4) using oollama to extract the symptoms "fever","cannot sleep"
5) the extracted symptoms are then mapped to embedded symptoms using cosine similarity
6) fever->fever, cannot sleep->insomia(as present in dataset)
7) converted to input feature vector and passed on trained catbost model
8) top 3 prediction along with confidence returned 

User types symptoms
      ↓
Angular sends message to Node (with JWT)
      ↓
Node verifies token
      ↓
Node sends symptoms to Flask ML API
      ↓
Flask predicts + returns JSON
      ↓
Node stores result in DB
      ↓
Node sends final formatted response to Angular
      ↓
Angular displays message in chat UI



# AI Medical Symptom Chatbot – LLM Setup (Phase 1)

## Project Overview

This project is an **AI-powered medical symptom chatbot** that predicts possible diseases based on symptoms described by the user in natural language.

The system combines:

* A **Large Language Model (LLM)** for understanding user input
* **Machine Learning (CatBoost)** for disease prediction
* A **backend API** that connects the chatbot interface to the AI services

Currently, the project has completed the **LLM environment setup and testing phase** using **Llama 3.2 running locally with Ollama**.

---

# Architecture (Current Stage)

User Input
↓
LLM Symptom Extraction (Llama 3.2)
↓
Backend Processing
↓
Disease Prediction Model (CatBoost) *(next phase)*

Future complete architecture:

User Chat Interface
↓
Backend API
↓
LLM Symptom Extraction
↓
Symptom Normalization
↓
Disease Prediction Model
↓
Response to User

---

# Technologies Used

| Technology           | Purpose                        |
| -------------------- | ------------------------------ |
| Python               | Backend services               |
| Ollama               | Local LLM runtime              |
| Llama 3.2 (3B)       | Natural language understanding |
| Requests Library     | API communication with LLM     |
| Flask *(planned)*    | Backend API server             |
| CatBoost *(planned)* | Disease prediction model       |

---

# Installing the LLM Environment

## 1. Install Ollama

Ollama is used to run large language models locally.

### macOS Installation (Homebrew)

```bash
brew install ollama
```

Or download directly from:

https://ollama.com

---

# 2. Start the Ollama Server

Run the Ollama service:

```bash
ollama serve
```

The server will run on:

```
http://localhost:11434
```

This endpoint will later be used by the backend to communicate with the LLM.

---

# 3. Download the Model

Download **Llama 3.2 (3B)**:

```bash
ollama pull llama3.2:3b
```

Model details:

| Model     | Parameters | Size    |
| --------- | ---------- | ------- |
| Llama 3.2 | 3 Billion  | ~2–3 GB |

This lightweight model works well on laptops such as **MacBook Air M1**.

---

# 4. Verify Model Installation

Run:

```bash
ollama list
```

Expected output example:

```
NAME            SIZE
llama3.2:3b     2.0GB
```

---

# 5. Run the Model

Start interactive mode:

```bash
ollama run llama3.2:3b
```

Example interaction:

```
>>> Hello
Hi! How can I help you today?
```

Exit interactive mode:

```
/bye
```

---

# 6. Test the Model for Symptom Extraction

Example prompt:

```
Extract symptoms from: I have fever and cannot sleep
```

Expected response:

```
fever, insomnia
```

This confirms that the model is able to **understand natural language symptom descriptions**.

---

# 7. Test the API Endpoint

The Ollama server exposes an API that can be used by backend services.

Example test using curl:

```bash
curl http://localhost:11434/api/generate -d '{
"model": "llama3.2:3b",
"prompt": "Say hello",
"stream": false
}'
```

Expected output:

```json
{
 "response": "Hello!"
}
```

---

# 8. Python Integration Test

Example Python script to call the model:

```python
import requests

response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "llama3.2:3b",
        "prompt": "Extract symptoms from: I have headache and fever",
        "stream": False
    }
)

print(response.json()["response"])
```

Run:

```bash
python test_llm.py
```

Example output:

```
headache, fever
```

---
