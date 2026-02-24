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