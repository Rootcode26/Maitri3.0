# Python backend

This is the internal FastAPI decision and pre-validation service. It is stateless and is called by
the Node.js backend, not directly by the browser.

## Responsibilities

- Evaluate deterministic, versioned regulatory rules
- Recommend applicable approvals with rule IDs and explanations
- Check required fields and document metadata
- Compare declared and extracted document information
- Calculate application readiness and list blocking issues
- Calculate transparent risk factors
- Build the approval dependency map

This service does not own users, authentication, applications, PostgreSQL, S3, notifications,
timelines, certificates or permanent audit records. It returns an evaluation; the Node.js backend
decides when to request it and persists the result.

## Local setup (PowerShell)

Run these commands from `python-backend`:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If `.venv` already exists, skip the first command. Activation is optional because
these commands use the environment's Python directly.

The initial app provides `GET /health` and API documentation at `/docs`.
Decision and pre-validation endpoints are not implemented yet.
Commit Python source and `requirements.txt`; `.venv` stays local and is ignored by Git.
