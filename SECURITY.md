# Shakkho Security Policy and Engineering Standard

**Applies to:** `feat/backend-foundation` and all branches derived from it

**Owner:** Shahriar

**Status:** Prototype security baseline; not approved for real legal-aid or personal data

**Version:** 1.0

**Last updated:** 20 September 2026

## 1. Security decision

Shakkho handles the shape of high-impact justice data: identity, contact information, case
references, disputed service claims, officer decisions, supporting records, and payment evidence.
Even though the prototype uses synthetic data, its architecture must assume that unauthorised
disclosure or alteration could harm a citizen, lawyer, or legal-aid process.

The default security posture is therefore:

- deny access unless a server-side rule grants it;
- minimise the data collected and returned;
- preserve evidence and decisions instead of silently overwriting them;
- separate authentication, authorisation, evidence authority, and delivery status;
- make every consequential action attributable and reviewable; and
- fail closed without making the system unusable during an external-provider failure.

This document adapts the supplied OWASP-aligned website security template to Shakkho's actual
FastAPI/PostgreSQL architecture and evidence-reconciliation threat model. It is a build standard,
not a claim of certification or legal compliance.

## 2. Immediate deployment warning

The current Phase 1 API has **no authentication or authorisation**. Observation creation, case
timeline reads, and the officer queue are reachable by any caller that can reach the process.
Security headers, rate limiting, audit events, production secret handling, and case/office scope
are also not implemented.

Until the Phase 2 release gate in this document passes:

- use synthetic names, phone numbers, case references, documents, and evidence only;
- bind the API to localhost or an access-controlled development network;
- do not expose it to the public internet;
- do not connect a real court, NLASO/DBLA, identity, SMS, AI, or finance service;
- do not represent the branch as production-ready; and
- do not upload real legal-aid records, even temporarily.

## 3. Standards and assurance target

Engineering decisions should be checked against:

- [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/);
- [OWASP ASVS 5.0](https://owasp.org/projects/asvs), using Level 2 as the prototype and pilot
  verification baseline;
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html);
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html);
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html);
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html);
- [FastAPI security guidance](https://fastapi.tiangolo.com/tutorial/security/); and
- [FastAPI CORS guidance](https://fastapi.tiangolo.com/tutorial/cors/).

A production pilot additionally requires applicable Bangladeshi legal, government security,
records, procurement, safeguarding, and data-governance review. The team must not infer legal
compliance from this checklist.

## 4. Assets, data classes, and threat model

### 4.1 Protected assets

| Asset | Examples | Required protection |
|---|---|---|
| Identity and contact data | Names, phones, organisation, role, office | Restricted, masked, encrypted, and excluded from routine logs |
| Sensitive case metadata | Case type, sensitivity label, assignment, deadlines | Case-, office-, role-, and sensitivity-scoped access |
| Evidence observations | Lawyer report, citizen response, controlled court signal, evidence reference | Append-only integrity, provenance, authorised visibility |
| Resolutions and interventions | Selected value, cited observations, reason, authority basis | Strong authorisation, concurrency safety, immutable audit trail |
| Documents and media | Orders, receipts, audio, attachments | Private storage, content validation, malware scanning, expiring access |
| Claim packets | Service evidence, policy requirements, review state | Least privilege and separation from payment approval/disbursement |
| Credentials and keys | Password hashes, token keys, database and provider secrets | Secret manager/environment, rotation, never logged or committed |
| Audit and security logs | Login, denial, export, resolution, policy change | Append-only or tamper-evident storage and restricted access |

### 4.2 Likely threat actors and failures

- An unauthenticated external caller enumerating case UUIDs or reading the officer queue.
- An authenticated user accessing another case, office, district, or sensitivity class.
- A lawyer attributing an observation to another actor or organisation.
- An officer resolving a conflict outside their authority or against a stale evidence set.
- A privileged insider exporting excessive data or altering history.
- A compromised browser, shared phone, or cached page exposing sensitive information.
- A forged court import, SMS callback, or external webhook.
- Replay, duplicate submission, race condition, or retry causing inconsistent evidence.
- Injection, XSS, malicious upload, vulnerable dependency, or leaked secret.
- AI output being treated as evidence, authority, or legal advice.
- Operational error: debug mode, broad CORS, default credentials, verbose exceptions, or an
  accidentally public test deployment.

### 4.3 Trust boundaries

Every boundary validates identity, authorisation, schema, replay protection, and data minimisation:

1. browser or mobile client to API;
2. API to PostgreSQL;
3. API to an official-system adapter or controlled import;
4. database transaction to notification outbox and delivery worker;
5. delivery worker to SMS/IVR provider and provider webhook back to Shakkho;
6. API to any AI provider; and
7. offline device queue to synchronisation endpoint.

## 5. Current implementation assessment

This table distinguishes implemented controls from planned controls so documentation never creates
a false sense of security.

| Control | Current Phase 1 state | Required action |
|---|---|---|
| Synthetic fixtures | Implemented | Keep real data prohibited until pilot approval |
| Server-side schema validation | Partially implemented with Pydantic | Add strict field allow-lists, size limits, pagination, and structured values |
| SQL injection resistance | ORM/parameterised query paths implemented | Prohibit user-built SQL and add review tests for any raw query |
| Idempotent observation write | Implemented with scoped key and request hash | Scope to authenticated principal and address concurrent-key races |
| Append-only observation API | No update/delete route exists | Add database permissions/guards and append-only audit events |
| Deterministic reconciliation | Implemented and unit-tested | Keep confidence and AI outside truth decisions |
| Authentication | Not implemented | Phase 2 blocker |
| Role/case/office/sensitivity authorisation | Not implemented | Phase 2 blocker on every protected endpoint |
| Authorised resolution write | Deferred with `501` | Phase 2 signature mutation |
| Security audit log | Not implemented | Add before enabling consequential mutations |
| Rate limiting/abuse control | Not implemented | Add for login, writes, imports, exports, and webhooks |
| CORS policy and security headers | Not configured | Configure explicit environments and test responses |
| Production secrets | Only `.env` pattern is ignored; local default DB credentials exist | Refuse production startup with defaults; use managed secrets |
| Dependency lock | `uv.lock` and `package-lock.json` are committed | Add audit and update workflow |
| Notification delivery security | Outbox table only | Add signed webhooks, worker identity, retry controls, and safe templates |
| File upload security | No upload feature | Keep disabled until the controls in Section 13 are implemented |
| Backup, restore, monitoring, incident response | Not implemented | Required before any controlled pilot |

## 6. Authentication and session requirements

### 6.1 Prototype

- Use a maintained standards-based library and a replaceable identity boundary. Do not invent a
  cryptographic or token format.
- Seed only fictional demonstration users. Store no plaintext passwords. If local passwords are
  necessary, hash them with Argon2id using a maintained library.
- Issue short-lived, signed access tokens with an allow-listed algorithm. Validate signature,
  issuer, audience, subject, expiry, not-before time where used, and token identifier.
- The token subject maps to one active actor/principal; role and office access are loaded or
  validated server-side rather than trusted from a client-supplied body.
- For a separate browser frontend, send the access token in the `Authorization` header and keep it
  in memory, not `localStorage`. Do not simultaneously add cookie authentication without the CSRF
  controls below.
- Rate-limit login by IP and account identifier, use generic failure messages, and log failure and
  lockout events without logging credentials.
- Seeded credentials and signing keys are development-only, sourced from environment variables,
  and excluded from Git.

### 6.2 Pilot and production

- Integrate with an institution-approved OpenID Connect/OAuth2 identity provider where available.
- Require MFA for officers, reviewers, administrators, auditors, and other privileged roles.
- Support immediate deactivation, token/session revocation, short inactivity and absolute timeouts,
  and reauthentication for privilege changes or sensitive exports.
- If authentication uses cookies, set `HttpOnly`, `Secure`, and `SameSite=Lax` or stricter, rotate
  the session identifier after login/privilege change, and require a session-bound CSRF token for
  state-changing requests.

## 7. Authorisation policy

Authentication proves identity. It never proves permission or evidence authority.

### 7.1 Mandatory rules

- Deny by default in one central policy/dependency layer. A route without an explicit policy is not
  accessible.
- Re-check access on every request and every resource, including nested resources referenced in a
  body.
- Scope by role, office/district membership, case assignment or duty, case sensitivity, operation,
  and record state.
- Derive `officer_id`, `source_actor_id`, and similar identity fields from the authenticated
  principal where possible. Never trust a caller to nominate itself as an authorised officer.
- Assisted entry on behalf of a citizen or lawyer requires a separate permission and records both
  the authenticated recorder and the represented source.
- Return a non-enumerating `404` for protected resources outside the caller's scope where revealing
  existence would create risk; use `403` where policy and operational clarity require it.
- Apply the same policy to reads, exports, generated documents, attachment links, OpenAPI/docs in
  production, background jobs, and admin endpoints.
- The frontend may hide controls for usability, but it is never the enforcement boundary.

### 7.2 Minimum role matrix

| Capability | Citizen | Panel lawyer | Officer | Manager | Finance reviewer | Auditor | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Read own safe next-action view | Own case | Assigned case | Scoped cases | Aggregated/scoped | No | Scoped/read-only | No by default |
| Submit an attributed observation | Limited/self | Assigned commitments | Assisted/scoped | No | No | No | No |
| Read full evidence timeline | No | Restricted assigned view | Scoped cases | Restricted/scoped | Claim evidence only | Approved audit scope | No by default |
| Resolve a disputed milestone | No | No | Authorised scoped officer | Only if separately granted | No | No | No |
| Review/submit claim readiness | No | Own items/read | Scoped preparation | Oversight | Authorised claim scope | Read-only | No |
| Export sensitive data | No | No | Explicit permission | Explicit permission | Explicit permission | Explicit approved scope | No by default |
| Change users/policy | No | No | No | No | No | No | Explicit, separately audited |

Final production roles and separation of duties require DBLA authority. An `ADMIN` role must not
automatically grant access to case content.

### 7.3 Endpoint-specific requirements

| Endpoint | Security requirement |
|---|---|
| `POST /cases/{case_id}/observations` | Authenticated source or authorised assisted-entry role; case/commitment scope; actor binding; rate limit; principal-scoped idempotency |
| `GET /cases/{case_id}/timeline` | Role, office, case, and sensitivity check; field-level response filtering; access audit |
| `GET /officer/queue` | Officer/manager role; office and sensitivity filters applied in the database query; pagination and bounded filters |
| `POST /milestones/{id}/resolutions` | Authorised officer; case scope; active-conflict validation; cited evidence; reason; authority basis; fresh transaction snapshot |
| `POST /claim-packets/{id}/submit` | Claim role and case scope; completeness, policy version, state transition, separation of duties, and audit event |
| Imports/webhooks | Dedicated service identity, signature or mutual trust mechanism, replay window, idempotency, schema and source allow-list |

## 8. Evidence integrity and consequential transactions

Shakkho's core security property is not only confidentiality; it is the integrity and
contestability of the evidence chain.

- Observations, resolutions, and audit events are append-only. Corrections create a linked new
  record; they do not update or delete the prior claim.
- Application service accounts must not receive broad table-delete permission in pilot/production.
- A resolution must match the milestone field, cite all active conflicting observations, choose an
  active normalised value, include non-empty authority basis and reason, and be performed by an
  authorised scoped officer.
- The API must not accept an `authorised: true` flag or officer identity from the body as proof of
  authority.
- Resolution uses a database transaction with row locking or optimistic version checking so a new
  conflicting observation cannot arrive between review and commit unnoticed.
- Resolution, milestone recomputation, next commitment, audit event, and outbox row commit
  atomically. External delivery happens after commit.
- Every projection remains recomputable from observations, resolutions, and the versioned rule.
- Database constraints protect uniqueness, foreign-key integrity, state transitions, and one
  current projection per commitment/field. The service still validates business rules before the
  write.
- Hashes, signatures, or tamper-evident exports may strengthen audit evidence, but must not be
  described as blockchain or immutable proof unless the complete trust model is implemented and
  independently reviewed.

## 9. Input, output, injection, and error handling

### 9.1 Input

- Validate all request bodies, path/query parameters, headers, imports, and webhooks server-side.
- Use strict controlled enums for source type, channel, sensitivity, evidence state, status, and
  supported fields. Reject unknown fields where forward compatibility does not require them.
- Set maximum request/body size, string and collection lengths, JSON depth, date ranges, pagination
  limits, and upload limits before public exposure.
- Values for a reconciliation field use a field-specific schema; unrestricted `Any` payloads must
  not remain the production boundary.
- Require timezone-aware timestamps, normalise for comparison, retain original source time, and use
  UTC internally with Asia/Dhaka presentation.
- Continue to use SQLAlchemy bound parameters. Never concatenate user input into SQL, shell
  commands, file paths, templates, or dynamic Python evaluation.
- An evidence reference is an identifier, not permission for unrestricted server-side URL fetching.
  Any future fetcher uses an allow-list and blocks internal/private destinations to prevent SSRF.

### 9.2 Output and browser safety

- Return only fields required by the caller's role and operation; do not serialize database models
  indiscriminately.
- Escape user-controlled text through the frontend framework. Do not use raw HTML rendering for
  observations, reasons, messages, or AI output without a maintained sanitiser and a clear need.
- Mark sensitive API responses `Cache-Control: no-store`.
- Use generic production errors; do not expose stack traces, SQL, filesystem paths, secrets,
  security policy details, or another user's identifiers.
- Stable public reason codes may explain reconciliation; internal exception details remain in
  protected logs.

## 10. Transport, headers, CORS, and API exposure

- Enforce HTTPS for every non-local environment. Terminate only at an approved proxy/platform and
  preserve trustworthy scheme/client metadata.
- In production enable HSTS, `X-Content-Type-Options: nosniff`, an appropriate
  `Content-Security-Policy` including `frame-ancestors`, `Referrer-Policy`, and a restrictive
  `Permissions-Policy`. Apply frontend and reverse-proxy headers consistently.
- Allow-list exact frontend origins by environment. Never reflect arbitrary origins and never use
  wildcard origins with credentials.
- Allow only required methods and headers. Expose no internal header unnecessarily.
- Disable or protect interactive API documentation and schema endpoints in production.
- Return JSON with the correct content type and reject unsupported content types.
- Add request identifiers and security-safe correlation without accepting an unvalidated client
  value as authoritative.

## 11. Secrets, configuration, and dependencies

- `.env`, private keys, tokens, dumps, local databases, and credentials stay out of Git. If a
  secret is committed, rotate it; deleting the file is not sufficient.
- Local example credentials are non-sensitive and clearly labelled. Production startup must fail
  when the example database password, development signing key, debug mode, or unsafe origin is
  detected.
- Use distinct development, test, staging, and production credentials with least-privileged
  database/service accounts and documented rotation.
- Keep lockfiles committed and builds reproducible. Verify any AI-suggested package against its
  official project before installation.
- Run dependency and secret scanning in CI before merge. Triage vulnerabilities for exploitability
  and record any time-bounded exception with an owner.
- Pin CI actions and deployment images to reviewed versions or digests where practical; protect the
  release branch and require review.

Recommended prototype checks include `pip-audit` for Python, `npm audit` for Node dependencies, a
secret scanner, static analysis, tests, and an OpenAPI-aware API scan. Passing automated tools does
not replace review.

## 12. Logging, audit, monitoring, and privacy

### 12.1 Security logging

Log with an explicit timezone or UTC and include request/correlation ID, actor ID, office, action,
resource type/ID where appropriate, outcome, and policy/rule version. Log at minimum:

- login success/failure, lockout, logout, token rejection, and privileged reauthentication;
- authorisation denial and attempted cross-office/cross-case access;
- observation ingestion and idempotency conflict;
- resolution, correction, policy change, role change, claim submission, export, and document access;
- webhook signature/replay failure and unusual delivery activity; and
- application startup security configuration and integrity failures.

Never log passwords, raw access/refresh tokens, signing keys, full citizen phone numbers, full
notification bodies, uploaded documents, voice/audio content, or unrestricted request bodies.
Mask or pseudonymise identifiers when full values are unnecessary.

### 12.2 Audit properties

- Audit events are separate from application debug logs and are append-only for application users.
- Each consequential event records who, what, when, where, result, case scope, cited evidence,
  reason, and applicable policy/rule version.
- Audit access is itself logged and restricted. Routine administrators do not silently alter audit
  history.
- System clocks are synchronised; time-zone assumptions are explicit.

### 12.3 Monitoring and privacy

- Alert on repeated login failures, bursts of denials, bulk timeline access, unusual exports,
  privileged-role changes, repeated webhook failures, and outbox failure spikes.
- Separate citizen contact details from case/evidence content where practical.
- Mask sensitive fields in lists and manager analytics. Aggregate or suppress small groups when
  re-identification is plausible.
- Define purpose, lawful authority/consent, retention, deletion, archival, and legal hold for every
  record class before real data enters the service.
- Notifications use neutral sender and lock-screen text because devices may be shared or monitored.
- Domestic violence, child, trafficking, detention, and mediation data require stricter
  sensitivity labels and explicit access policy.

## 13. Documents and file uploads

File upload remains disabled until all controls below are implemented and tested:

- allow-list required formats and inspect content signatures rather than trusting filename or MIME;
- set small server-side size/page limits and defend against decompression bombs;
- generate storage names; ignore user path information; prevent overwrite and traversal;
- store privately outside the web root or in private object storage with encryption and restricted
  service identity;
- scan for malware and quarantine until the result is clean;
- prevent script execution and unsafe active content;
- serve through short-lived authorised downloads with `Content-Disposition` and safe content type;
- log upload, scan, view, download, expiry, and deletion;
- redact or remove metadata where policy requires it; and
- never send a raw document to an AI provider without documented authority and minimisation.

## 14. Notifications, external services, and AI

### 14.1 Notification outbox and webhooks

- Commit only a minimal, template-driven payload; do not place unnecessary allegation or case
  narrative in the outbox.
- Use a unique idempotency key and bounded exponential retry. `QUEUED`, `SENT`, `DELIVERED`, and
  `FAILED` are delivery states, not evidence states.
- Authenticate the worker separately from users and grant only required outbox access.
- Verify provider webhooks with an allow-listed signature algorithm, timestamp/replay window,
  constant-time comparison, schema validation, and provider event idempotency.
- A provider callback cannot change a legal-aid milestone except through an attributed observation
  and the normal reconciliation rules.
- Failed delivery creates a safe retry, alternate-channel, or callback task; it never proves lawyer
  non-service.

### 14.2 Official-system adapters

- Each adapter has an approved source, authority scope, schema version, service identity, timeout,
  circuit breaker, audit record, and failure mode.
- Imported "official" data remains attributed to its exact source and assertion. It is not
  universally authoritative.
- Controlled demo CSVs/images are visibly simulated and cannot be confused with a live API.

### 14.3 AI

- AI output is an untrusted candidate, never evidence authority.
- No model may set evidence state, resolve a conflict, prioritise adverse action, determine
  eligibility, deny payment, discipline a lawyer, assess citizen credibility, or give autonomous
  legal advice.
- A human confirms extracted fields before they become an observation.
- Prompts and model responses are minimised, source-linked where applicable, protected from prompt
  injection, and excluded from provider training/retention where contractually and technically
  possible.
- The system works with AI disabled and falls back to fixed approved templates.

## 15. Availability, backup, and incident response

- External SMS, AI, and official-source failures fail soft and cannot corrupt committed case state.
- Use bounded timeouts, retries with jitter, dead-letter handling, and idempotent workers.
- Back up encrypted transactional and audit data on an approved schedule; separate credentials and
  test restoration. A backup that has never been restored is not a verified control.
- Document manual fallback for officer work during outage and reconciliation after recovery.
- Maintain an incident runbook covering triage, containment, credential rotation, evidence
  preservation, notification decision, recovery, and post-incident review.
- Preserve forensic logs without unnecessarily expanding access to case content.

## 16. Required security tests

Every line below becomes an automated test where technically possible and a recorded manual check
otherwise.

### Authentication and authorisation

- [ ] Every protected endpoint rejects an unauthenticated request.
- [ ] Each role is denied every operation outside its matrix; default-deny is tested.
- [ ] User A cannot read or mutate User B's unauthorised case by changing a UUID.
- [ ] An officer cannot access another office or restricted sensitivity without an explicit grant.
- [ ] The queue applies scope in the database query, not after returning all rows.
- [ ] A client cannot forge `source_actor_id`, `officer_id`, role, office, or authority.
- [ ] Deactivated principals and expired/revoked tokens are rejected.

### Evidence integrity

- [ ] Observation retry with the same principal/key/payload returns the original result.
- [ ] Key reuse with a different payload or principal does not disclose or mutate the first record.
- [ ] Concurrent duplicate writes produce one observation and one idempotency record.
- [ ] No API path updates or deletes an observation, resolution, or audit event.
- [ ] A resolution outside case scope, without all active conflicting observations, without reason,
  or without authority basis is rejected.
- [ ] A new conflicting observation arriving during resolution causes retry or conflict rather than
  a stale resolution.
- [ ] The resolution transaction rolls back completely on audit, next-commitment, projection, or
  outbox failure.

### Input, output, and abuse

- [ ] Oversized, deeply nested, unknown-field, wrong-content-type, and invalid-date requests fail
  safely.
- [ ] Query filters and pagination are bounded; repeated requests receive the configured `429`.
- [ ] Stored user text renders as text, not executable HTML/script.
- [ ] Out-of-scope and production errors reveal no stack, SQL, path, secret, or protected record.
- [ ] Sensitive responses use `no-store`; required security headers and exact CORS origins pass.
- [ ] Secrets and synthetic credentials are absent from repository history and build artifacts.

### External boundaries

- [ ] Invalid, expired, replayed, or duplicate provider webhook events are rejected safely.
- [ ] Notification failure leaves the resolved milestone committed and marks delivery separately.
- [ ] AI-disabled tests pass the complete signature workflow.
- [ ] If uploads are enabled, malicious type, oversized file, traversal filename, and failed scan are
  rejected and never served.

## 17. Phase 2 security gate

The next branch is complete only when all applicable checks below pass:

1. A central authenticated principal and default-deny authorisation dependency protect every
   non-health endpoint.
2. Role, office, case, and sensitivity scopes have positive and negative tests.
3. `source_actor_id` and `officer_id` cannot be self-asserted by an untrusted client.
4. The authorised resolution endpoint validates active evidence and handles concurrency.
5. Resolution, projection, next commitment, audit event, and outbox row are atomic.
6. Audit logs exclude secrets and unnecessary personal/case content.
7. Request limits, rate limits, generic errors, explicit CORS, and security headers are configured
   and tested for the demo environment.
8. Production mode refuses default credentials, unsafe signing keys, debug mode, or broad origins.
9. Dependency, secret, lint, unit, API, contract, and migration checks pass.
10. The signature scenario passes end to end with synthetic data and AI disabled.
11. A short threat-model review records accepted risks and owners; no critical/high finding is
    silently waived.
12. README and OpenAPI state the authentication method and never imply production readiness.

Passing this gate permits team integration and a controlled synthetic-data demonstration. It does
not permit real data or a production pilot; those require the additional governance, identity,
retention, hosting, monitoring, backup/restore, safeguarding, and independent security decisions in
this document.

## 18. Secure development and change review

- Keep branches small, require review, and protect `main` from direct unreviewed changes.
- Treat generated code as untrusted until read, tested, and checked against this policy.
- A security-sensitive pull request describes assets, abuse cases, policy decisions, tests, and any
  residual risk.
- Do not weaken a test or control merely to make a demo pass. Record the constraint and choose a
  safe stub.
- Changes to authentication, authorisation, cryptography, evidence integrity, sensitive exports,
  uploads, webhooks, or AI data handling require Shahriar and one additional reviewer.
- Before each demonstration or deployment, run the quick review: dependencies, secrets, authn,
  cross-user/cross-office authz, headers/CORS, production config, logs, backups where applicable,
  and exposed endpoints.

## 19. Reporting a vulnerability

Do not place suspected vulnerabilities, secrets, real case data, or exploit details in a public
issue. Use GitHub's private vulnerability-reporting or Security Advisory function for this
repository when enabled, or contact the project owner through a private team channel. Include:

- affected commit and environment;
- reproduction steps with synthetic data;
- expected and observed impact;
- relevant logs with tokens and personal data removed; and
- any known workaround.

The maintainer should acknowledge, triage severity, contain exposure, preserve evidence, rotate any
affected credential, coordinate a fix and disclosure, and document the post-incident action. No
response-time guarantee is published until the project has an operational security team.
