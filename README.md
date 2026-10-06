# Website Assistant API (LangGraph + Gemini)

A secure Python backend that a React website can call to answer questions about its own content.
It uses **LangGraph** for the assistant flow and Gemini through Google AI Studio. The chatbot only
answers using rendered content crawled from the configured portfolio website. It does not answer
unrelated questions or invent live availability.

## 1. Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
```

Open `.env` and set `GEMINI_API_KEY` to your Google AI Studio key. `WEBSITE_URL` defaults to the
local demo portfolio at `http://localhost:5173`; change it to your deployed portfolio URL when
needed. Do not put the key in React or commit `.env`. Set `ALLOWED_ORIGINS` to your deployed React domain (for example
`https://yourdomain.com`), and set a long `APP_API_KEY` for production.

The scraper renders React pages in Chromium, follows up to 8 links on the same domain, and caches
the extracted text for 30 minutes. The configured website must be reachable by the backend.
Start the backend in one terminal:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Start the demo portfolio in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`) and use the chat button to test questions
about the fictional profile. Set `GEMINI_API_KEY` in `.env` before testing chat responses.

Open `http://localhost:8000/docs` to test it. Health endpoint: `GET /health`.

## 2. React integration

Keep the API key out of a public frontend when possible: call this API through your React
app's server/proxy. For a simple local example:

```js
const response = await fetch("http://localhost:8000/api/v1/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // Only if APP_API_KEY is configured. Never expose a production key in a public SPA.
    // "X-API-Key": import.meta.env.VITE_ASSISTANT_API_KEY,
  },
  body: JSON.stringify({
    message: userText,
    history: messages.slice(-10).map(({ role, content }) => ({ role, content })),
    page_url: window.location.href,
  }),
});

if (!response.ok) throw new Error("Chatbot unavailable");
const { answer } = await response.json();
```

## 3. Included test React frontend

An independent test UI is in `frontend/`; it is useful for trying questions before handing the
project over. Keep the FastAPI server running, then open another terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`). It already calls the local FastAPI
server and uses no Gemini key in the browser. Edit `frontend/.env` only when your API has a new
deployed URL.

Request body:

```json
{"message":"Is delivery available?","history":[],"page_url":"https://yourdomain.com/products"}
```

## Security included

- Gemini key stays server-side in `.env` and `.gitignore` excludes it.
- Exact CORS allowlist; replace localhost origins before deploying.
- Optional server-to-server `X-API-Key` authentication with constant-time comparison.
- Per-IP rate limiting, request/history size limits, bounded knowledge/model output.
- Prompt-injection-resistant policy: visitor text is treated as data; no tools, browsing, or
  internal prompt/key disclosure is available.
- Generic provider errors so system details are not exposed.

For production, place the API behind HTTPS and a reverse proxy, store secrets in your host's
secret manager, and preferably have React call a server-side proxy rather than embedding an
`APP_API_KEY` in a browser bundle.
