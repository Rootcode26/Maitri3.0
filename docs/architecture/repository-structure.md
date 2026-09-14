# Repository structure

```text
UdyogSetu/
├── .github/
│   └── workflows/                  CI/CD workflows
├── apps/
│   └── web/                        Next.js frontend
│       ├── public/                 Static frontend assets
│       ├── src/
│       │   ├── app/                Routes, layouts and page composition
│       │   ├── components/
│       │   │   ├── forms/          Shared form controls
│       │   │   ├── layout/         Navigation and page shells
│       │   │   └── ui/             Design-system primitives
│       │   ├── features/
│       │   │   ├── applications/   Application UI and data hooks
│       │   │   ├── auth/           Login and OTP UI
│       │   │   ├── businesses/     Business profile UI
│       │   │   ├── certificates/   Certificate display and verification UI
│       │   │   ├── documents/      Upload and document repository UI
│       │   │   ├── inspections/    Inspector workflow UI
│       │   │   └── notifications/  Notification UI
│       │   ├── hooks/              Cross-feature React hooks
│       │   ├── lib/                API client and frontend utilities
│       │   └── types/              Frontend-only types
│       └── tests/
│           ├── e2e/                Browser workflow tests
│           └── unit/               Component and utility tests
├── services/
│   ├── nodejs-backend/             Express TypeScript main backend
│   │   ├── src/
│   │   │   ├── config/             Validated runtime configuration
│   │   │   ├── db/
│   │   │   │   ├── migrations/     Versioned database changes
│   │   │   │   └── queries/        Typed database access
│   │   │   ├── integrations/
│   │   │   │   ├── rules-engine/   Private FastAPI client
│   │   │   │   ├── s3/             Private document storage client
│   │   │   │   └── sms/            OTP and alert provider abstraction
│   │   │   ├── jobs/               Deadline, expiry and cleanup jobs
│   │   │   ├── middleware/         Auth, authorization, security and errors
│   │   │   ├── modules/
│   │   │   │   ├── applications/   Application workflow and state
│   │   │   │   ├── audit/          Append-only audit events
│   │   │   │   ├── auth/           Password, OTP and sessions
│   │   │   │   ├── businesses/     Business records
│   │   │   │   ├── certificates/   Issuance and public verification
│   │   │   │   ├── documents/      Metadata, versions and S3 coordination
│   │   │   │   ├── inspections/    Inspection records
│   │   │   │   ├── notifications/  Alerts and delivery records
│   │   │   │   └── users/          Users and role assignments
│   │   │   └── shared/              Common TypeScript utilities
│   │   └── tests/
│   │       ├── integration/         API and database tests
│   │       └── unit/                Domain unit tests
│   └── python-backend/             Internal FastAPI service
│       ├── app/
│       │   ├── api/routes/          Internal HTTP endpoints
│       │   ├── core/                Configuration, errors and observability
│       │   ├── domain/              Pydantic request and response models
│       │   ├── rules/               Versioned rule definitions and loader
│       │   └── services/            Evaluation and scoring logic
│       └── tests/
│           ├── fixtures/            Example application snapshots
│           ├── integration/         FastAPI endpoint tests
│           └── unit/                Rule and validation tests
├── packages/
│   └── contracts/
│       ├── examples/                Valid request and response examples
│       ├── generated/typescript/    Types generated from OpenAPI
│       └── openapi/                 Versioned service contracts
├── infra/
│   ├── aws/                         Deployment definitions and documentation
│   ├── docker/                      Local multi-service environment
│   └── nginx/                       HTTPS and reverse-proxy configuration
├── docs/
│   ├── api/                         Integration documentation
│   ├── architecture/                System and repository architecture
│   ├── decisions/                   Architecture decision records
│   └── security/                    Threat model and security requirements
├── scripts/                         Repository automation
└── dist/                            Existing static presentation prototype
```

## Ownership boundary

The Express API owns authentication, persistence and workflow. The FastAPI service receives an
application snapshot, evaluates deterministic rules, and returns recommendations, validation
findings, readiness, risk factors and approval dependencies. It does not write directly to the main
database or object storage.

The OpenAPI files under `packages/contracts` are the boundary between the two teams. Contract
changes should be reviewed by both the TypeScript and Python owners before implementation.
