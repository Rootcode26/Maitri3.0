# Repository structure

```text
UdyogSetu/
├── .github/
│   └── workflows/                  CI/CD workflows
├── .env.example                    Shared local infrastructure variables
├── docker-compose.yml              Local PostgreSQL and Redis services
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
├── node-backend/                   Express TypeScript main backend
│   ├── .env.example                Backend environment-variable template
│   ├── .gitignore                  Backend-specific ignored files
│   ├── .npmrc                      pnpm and package-management settings
│   ├── .prettierignore             Prettier exclusions
│   ├── .prettierrc.json            Code-formatting rules
│   ├── eslint.config.js            ESLint configuration
│   ├── migrations/                 Versioned PostgreSQL schema changes
│   ├── package.json                Dependencies and backend scripts
│   ├── pnpm-lock.yaml              Exact dependency lockfile
│   ├── pnpm-workspace.yaml         pnpm workspace and build policy
│   ├── src/
│   │   ├── app.ts                  Express middleware and route composition
│   │   ├── cache/                  Redis client, health checks and lifecycle
│   │   ├── config/                 Validated runtime configuration
│   │   ├── controllers/            HTTP request and response handling
│   │   ├── database/               PostgreSQL pool and typed queries
│   │   ├── errors/                 Application error types
│   │   ├── integrations/
│   │   │   ├── rules-engine/       Private FastAPI client
│   │   │   ├── s3/                 Private document storage client
│   │   │   └── sms/                OTP and alert provider abstraction
│   │   ├── jobs/                   Deadline, expiry and cleanup jobs
│   │   ├── messaging/              Queue-provider-neutral messaging boundary
│   │   │   ├── adapters/           BullMQ or RabbitMQ implementation
│   │   │   ├── consumers/          Background message handlers
│   │   │   └── producers/          Typed message publishers
│   │   ├── middleware/             Auth, authorization, security and errors
│   │   ├── modules/
│   │   │   ├── applications/       Application workflow and state
│   │   │   ├── audit/              Append-only audit events
│   │   │   ├── auth/               Password, OTP and sessions
│   │   │   ├── businesses/         Business records
│   │   │   ├── certificates/       Issuance and public verification
│   │   │   ├── documents/          Metadata, versions and S3 coordination
│   │   │   ├── inspections/        Inspection records
│   │   │   ├── notifications/      Alerts and delivery records
│   │   │   └── users/              Users and role assignments
│   │   ├── repositories/           Persistence and dependency access
│   │   ├── routes/                 Versioned Express route registration
│   │   ├── services/               Application and orchestration logic
│   │   ├── shared/                 Common TypeScript utilities and types
│   │   └── server.ts               Startup and graceful shutdown lifecycle
│   ├── tests/
│   │   ├── *.test.ts               Current automated test suites
│   │   ├── fixtures/               Reusable test data and builders
│   │   ├── integration/            API and database tests
│   │   └── unit/                   Controller, service and repository tests
│   ├── tsconfig.build.json         Production TypeScript build settings
│   ├── tsconfig.json               TypeScript project settings
│   └── vitest.config.ts            Test-runner configuration
├── services/
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
