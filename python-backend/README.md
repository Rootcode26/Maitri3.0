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

