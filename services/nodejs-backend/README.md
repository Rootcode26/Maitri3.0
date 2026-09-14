# Node.js backend

This is the main UdyogSetu backend, built with Express and TypeScript. It is the system of record.

## Responsibilities

- Users, roles, passwords, OTP and sessions
- Business profiles and applications
- PostgreSQL reads, writes and migrations
- Document metadata, versions and private S3 access
- Inspector reviews and inspections
- Application status, timeline and SLA tracking
- Notifications and scheduled jobs
- Certificates and public certificate verification
- Permanent audit records
- Calling the private Python backend and saving its evaluation results

The web frontend communicates with this backend through `/api/v1`. The Node.js backend is the only
service that should write to the main PostgreSQL database or coordinate S3 access.

