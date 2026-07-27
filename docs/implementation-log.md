# PiPath Academy implementation log

This log records what changed, why it changed, how it was verified, and what remains deferred. Append new entries; do not rewrite historical decisions without noting the revision.

## 2026-07-25 - Batch 1 initial SAT rebuild

Commits: `f89ba8d`, `b03c82a`

### Implemented

- Added Astro, TypeScript, and React while leaving the legacy Home, Tutoring, Contact, and Resume pages intact.
- Created the canonical SAT route at `/sat-math-bootcamp`.
- Built a shared SAT-era layout, header, footer, design tokens, schedule card, curriculum, approach, instructor, testimonial, FAQ, and final enrollment sections.
- Added one August 2026 cohort: August 18 through September 10, Tuesdays and Thursdays, 7:00-8:15 PM ET, eight sessions, ten live hours, and $299.
- Added a schedule-date disclosure using React.
- Added a sticky enrollment announcement and mobile action.
- Added placeholders for Orlando's course video, instructor portrait, and genuine testimonials.
- Left checkout disabled until Batch 2.

### Why

The SAT offer is the launch-critical paid product and establishes the visual and technical system that the rest of the site will later adopt. Astro keeps marketing pages fast and indexable; React is reserved for useful interaction.

### Decisions

- Keep one cohort in the interface for now.
- Market the cohort as 10-15 students; enforce a technical maximum of 15 in Batch 2.
- Use "A path to math is never standardized." as the SAT headline.
- Keep PiPath Academy above Dr. Orlando Ferrer in the brand lockup.
- Keep consultation secondary to enrollment.
- Stripe, D1, email delivery, and onboarding are deferred to Batch 2.
- Multiple-cohort browsing and owner-editable cohorts are deferred.

## 2026-07-26 - Batch 1 approved closeout

Status: complete and locally verified.

### Implemented

- Restored GA4 measurement ID `G-EXV4N60WP8` through the shared Astro layout.
- Added Course, CourseInstance, Offer, instructor, and FAQ JSON-LD to the canonical SAT page.
- Added canonical metadata, favicon, robots rules, and a sitemap baseline.
- Changed the shared navigation label from "Tutoring Services" to "Math Tutoring."
- Replaced internal/editorial curriculum language with parent-facing progression copy.
- Added `scroll-margin-top` to anchored content so the sticky announcement does not cover headings after an anchor jump.
- Removed the duplicate `/sat_math_bootcamp_page` Astro page.
- Replaced the legacy `sat_math_bootcamp_page.html` content with a no-index fallback redirect.
- Added Cloudflare 301 rules from both old SAT aliases to `/sat-math-bootcamp`.
- Preserved and migrated the existing untracked `design_doc.md` into the C-drive working copy.
- Added this implementation log and the shared design-system document.

### Why

The closeout eliminates duplicate SAT content, preserves old inbound links, restores measurement, improves search semantics, makes navigation more client-facing, and records the implementation before backend work begins.

### Replacement safety

- Work exists only in the local C-drive `croquette` clone.
- Nothing has been committed, pushed, merged to `main`, or wired to Cloudflare.
- The removed legacy page remains recoverable from Git history.
- The root HTML fallback protects non-Cloudflare hosting; `public/_redirects` provides the real 301 after Cloudflare cutover.

### Verification

- Ran `npm run build` from the C-drive clone.
- Astro check result: 0 errors, 0 warnings, and 0 hints.
- Static build result: one canonical SAT content route at `/sat-math-bootcamp/index.html`.
- Confirmed the working branch remains `croquette` and tracks `origin/croquette`.
- No commit, push, Cloudflare deployment, or production wiring occurred.

### Deliberately deferred

- Khan Academy and DeltaMath selling-point copy.
- Live Stripe keys and Stripe product/price configuration.
- D1 production creation and binding.
- Final email-delivery provider activation.
- Approved portrait, video, and testimonials.
- Owner-approved privacy, refund/cancellation, attendance, and recording language.
- Home, Math Tutoring, Contact, and Resume redesigns.

## Log rules for Batch 2

Every Batch 2 entry must record:

- the user-visible behavior;
- the server and database behavior;
- security and privacy decisions;
- environment variables or Cloudflare bindings;
- schema migrations;
- analytics events and attribution fields;
- tests run and their result;
- any external setup still required;
- whether a change is local-only, pushed to `croquette`, or deployed.

## 2026-07-26 - Batch 2 local enrollment implementation

Status: implementation complete and locally verified; awaiting owner review.

### User-visible behavior

- Replaced placeholder checkout URLs with one server-created checkout action used by the cohort card, final enrollment section, and mobile enrollment bar.
- Kept `PUBLIC_ENROLLMENT_ENABLED` off by default. The review build therefore shows "Enrollment setup in progress" and the mobile "View dates" fallback until the environment is intentionally enabled.
- Preserved the approved no-registration-before-payment flow. Stripe Checkout collects the parent or guardian name, email, phone, and payment details.
- Added `/sat-math-bootcamp/enrollment-confirmed` with a payment-finalizing state, a clear "You're enrolled" state, and post-payment onboarding.
- Added onboarding fields for student first and last name, grade, recent SAT/PSAT Math score range, and target score/challenging topics. Parent contact fields are not asked twice.
- Supports completing onboarding immediately or returning through the secure link in the confirmation email.
- Added accessible loading, disabled, success, validation, and error states for checkout and onboarding controls.

### Server and Stripe behavior

- Added Cloudflare Pages Functions endpoints:
  - `POST /api/checkout` for same-origin, server-priced Stripe Checkout creation;
  - `POST /api/stripe-webhook` for signed Stripe event processing;
  - `GET /api/enrollment-status` for confirmation-page polling and secure-link lookup;
  - `POST /api/onboarding` for post-payment student details.
- Checkout validates the cohort and server-side Stripe Price ID, creates a 30-minute seat hold, limits payment methods to cards/wallets, and never trusts a browser-supplied price.
- Enforces a technical maximum of 15 using a single conditional SQLite insert that counts paid/active enrollments plus unexpired checkout holds.
- Adds a D1-backed checkout-start rate limit of three attempts per request fingerprint in 15 minutes.
- Verifies Stripe webhook signatures from the raw request body using the official Stripe SDK.
- Re-validates checkout metadata, Checkout Session ID, amount, and currency before creating an enrollment.
- Uses unique Stripe event, Checkout Session, and Payment Intent identifiers so retries cannot create duplicate enrollments or payments.
- Handles completed checkout, expired checkout, asynchronous payment success/failure, and full/partial refund events. A full refund marks the enrollment refunded; a partial refund preserves enrollment status while marking the payment partially refunded.

### D1 schema and data behavior

- Added `migrations/0001_enrollment.sql` with versioned tables for cohorts, checkout attempts, parents, students, enrollments, payments, access tokens, Stripe events, email deliveries, inquiries, and audit events.
- Seeded one August 2026 cohort at $299, status `enrolling`, and capacity 15. No multi-cohort interface or owner cohort editor was added.
- Parent records are deduplicated by normalized, case-insensitive email.
- Student academic information is created or updated only after verified payment and valid onboarding-token submission.
- Checkout attribution is retained on the checkout attempt and linked to the resulting enrollment through the unique attempt ID.

### Security and privacy decisions

- Added strict JSON size, content-type, origin, enum, required-field, and string-length validation.
- Request rate-limit fingerprints are HMACs of IP address plus user agent; raw IP addresses are not stored.
- Stripe event payloads are not stored. The event ledger records only event ID, type, processing status, and a short error code when needed.
- Onboarding tokens are deterministic HMAC values, while D1 stores only their SHA-256 hashes.
- Enrollment-status responses mask the parent email and return only the minimum confirmation data.
- The confirmation route is `noindex, nofollow`, uses a `no-referrer` policy, and disables GA so session IDs and onboarding tokens are not sent to analytics.
- No real Stripe, Cloudflare, Resend, or GA4 API secrets were added to the repository.

### Email, analytics, and attribution

- Added a Resend HTTP adapter with a D1 delivery ledger, per-enrollment delivery uniqueness, provider idempotency keys, and separate parent-confirmation and owner-notification messages.
- Email delivery remains inactive when sender/API configuration is absent; a paid enrollment is still safely recorded. Provider failures are retryable through Stripe without duplicate sends.
- Added browser `begin_checkout` tracking when a secure Checkout URL is returned.
- Added server-side GA4 Measurement Protocol `purchase` tracking only after a verified paid webhook. Analytics failure never reverses or blocks enrollment.
- Captures first-touch `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, landing page, referrer, and GA client ID when available.

### Build and dependency changes

- Added Stripe `22.3.2`, Wrangler `4.114.0`, Cloudflare Workers types `5.20260726.1`, Vitest `4.1.10`, and Node types `26.1.1`.
- Added explicit site, Functions, check, test, and verification scripts.
- Limited Cloudflare Function invocation to `/api/*` through `public/_routes.json`.
- Added `wrangler.example.jsonc`, `.dev.vars.example`, and `.env.example`; none is an active Cloudflare binding or secret file.
- Added an explicit post-Astro copy step so the current Home, Tutoring, Contact, and Resume pages and their required assets remain unchanged and present in `dist` until each route is redesigned and migrated.

### Verification

- `npm run test`: 3 test files and 12 tests passed.
- Tests cover request sanitization, onboarding enums/required fields, opaque onboarding tokens, token hashing, request fingerprint privacy, email masking, migration seeding, the 15-seat cap, expired-hold release, and paid-seat counting.
- The initial capacity test exposed an extra SQL placeholder that would have blocked checkout. The SQL was corrected and the unchanged tests then passed.
- `npm run check`: Astro and Functions TypeScript checks passed with 0 errors, 0 warnings, and 0 hints.
- `npm run build`: two Astro routes built and the Cloudflare Worker compiled successfully.
- Verified the output preserves all eight listed legacy pages/assets, includes API-only routing, leaves public checkout disabled, and keeps GA off the no-index confirmation page.
- Local Playwright smoke checks passed at 1200x833 and 390x844: shared navigation, desktop hero, cohort card, mobile action bar, and the confirmation recovery state rendered without clipping or route errors.
- `git diff --check`: passed.

### Configuration still required for a real end-to-end preview

- Create a preview D1 database, apply migration `0001`, and replace the placeholder binding ID outside the example file.
- Add Stripe test secret key, $299 test Price ID, and webhook signing secret; register the preview webhook endpoint.
- Add strong onboarding-token and rate-limit secrets.
- Approve and configure the Resend account, verified sender/domain, sender address, and API key, or approve a replacement mail provider.
- Add the GA4 Measurement Protocol API secret if server-side purchase tracking is wanted in preview.
- Enable `PUBLIC_ENROLLMENT_ENABLED=true` only after the preview database, Stripe test configuration, webhook, and confirmation flow are ready.
- Run a real test-mode checkout, webhook retry/idempotency test, email-delivery test, refund test, enabled-flow mobile/desktop browser QA, and accessibility review.
- Approve privacy, refund/cancellation, attendance, recording, and launch-support language before accepting live payments.

### Repository and deployment state

- Work remains only in the C-drive `croquette` clone.
- Nothing in this Batch 2 entry has been committed, pushed, merged to `main`, deployed, or wired to Cloudflare, Stripe, Resend, or production analytics secrets.
- The next gate is owner review of Batch 2. After approval, the reviewed changes may be committed and pushed to `croquette` only; Home redesign begins after that push.

## 2026-07-26 - Private local review environment and owner-dashboard planning

Status: local Pages/Functions server and private local D1 available; Stripe sandbox payment remains intentionally disabled.

### Implemented

- Added `wrangler.jsonc` as the standard Pages local-development configuration.
- Bound `env.DB` to a local-only D1 database named `pipath-enrollment-local`.
- Used a non-deployable placeholder D1 ID so this local configuration cannot accidentally identify a real Cloudflare database.
- Added `npm run dev:review` to apply local migrations, rebuild the site, and run the static pages and `/api/*` Functions together through Wrangler.
- Added `npm run d1:local:migrate` and `npm run d1:local:tables` for repeatable database setup and inspection.
- Applied migration `0001_enrollment.sql` to the ignored `.wrangler` local state directory.
- Added `docs/local-review.md` with page-flow, D1 inspection, and Stripe sandbox review instructions.
- Added a protected owner dashboard to the pre-launch roadmap.

### Owner dashboard scope recorded

- Version 1 is owner-only, no-index, primarily read-only, and privacy-conscious.
- It will show cohort capacity, paid/active/hold counts, enrollment/payment/onboarding/refund status, and email/webhook failures.
- It will provide search, enrollment detail, CSV export, and links to Stripe for financial actions.
- Later owner mutations must be narrowly controlled, validated, and added to `audit_events`.

### Implementation note

- A first attempt used a separately named `wrangler.local.jsonc` file. Wrangler Pages rejected a custom configuration path, so the configuration was moved to the required root `wrangler.jsonc` filename. No Cloudflare resource was created or changed during that correction.

### Verification

- Local migration applied successfully: 21 SQL commands.
- Confirmed the expected enrollment, payment, parent, student, access-token, email, Stripe-event, inquiry, and audit tables exist.
- Confirmed the seeded `august-2026` cohort is enrolling, has capacity 15, and is priced at 29,900 cents.
- Wrangler compiled the Worker and reported `env.DB (pipath-enrollment-local)` in local mode.
- Confirmed the Home, SAT Bootcamp, and enrollment-confirmation routes respond from `http://localhost:8788`.
- Confirmed `/api/checkout` is routed through the local Function and returns the expected forbidden response while public enrollment is disabled.
- The enrollment-status Function correctly remains unavailable until a local onboarding-token secret is supplied; this secret and all Stripe sandbox values stay outside Git.

### Environment boundary

- The local SQLite-backed D1 state is private to this working copy and ignored by Git under `.wrangler/`.
- No real Stripe keys, webhook secrets, Cloudflare IDs, email credentials, or production data were added.
- No commit, push, Cloudflare deployment, remote D1 creation, or production wiring occurred.
- A complete test payment requires a Stripe sandbox secret key, a $299 test Price ID, a local Stripe CLI webhook signing secret, strong local token/rate-limit secrets, and an explicit `PUBLIC_ENROLLMENT_ENABLED=true` build.

## 2026-07-26 - Project backend operations skill

Status: implemented locally; no external systems changed.

### Implemented

- Added the project-scoped `$manage-pipath-backend` skill under `.agents/skills/` so later PiPath work can reuse the actual backend architecture and operational rules.
- Added a concise `SKILL.md` workflow covering environment classification, source-of-truth checks, schema-change discipline, lifecycle diagnosis, privacy/security invariants, owner-dashboard rules, verification, and handoff requirements.
- Added progressive references for:
  - the Astro/React, Pages Functions, D1, Stripe, Resend, and GA4 stack and request flows;
  - the exact `0001_enrollment.sql` tables, relationships, status transitions, writers, inspection queries, migrations, corrections, and owner-dashboard data layer;
  - environment variables, local Stripe testing, webhook outcomes, troubleshooting, preview/production gates, and operational verification.
- Kept all credentials and environment-specific secret values out of the skill.

### Documentation correction

- Compared `docs/local-review.md` against migration `0001_enrollment.sql` while authoring the skill.
- Corrected four D1 inspection examples that referenced non-existent proposed columns. The payment, student, Stripe-event, and email-delivery examples now use the implemented schema names.

### Scope and safety

- The skill directs future work to use verified Stripe webhooks as the only paid-enrollment creator, preserve idempotency and atomic capacity holds, protect PII/token material, and audit future owner mutations.
- Local, preview, and production actions are explicitly separated. Remote D1, Cloudflare, Stripe, email, or production operations still require their existing approval gates.
- No commit, push, deployment, database mutation beyond the existing local migration, or external integration occurred.

### Verification

- Skill Creator `quick_validate.py`: passed (`Skill is valid!`).
- Executed the corrected payment, student, Stripe-event, and email-delivery inspection queries against local D1: all four commands succeeded.
- Confirmed there are no generated `TODO` placeholders in the skill.
- `git diff --check`: passed; existing Windows line-ending notices remain informational.
- Runtime application code did not change during skill authoring, so the previously passing 12 tests and zero-error TypeScript/Astro checks remain the current runtime verification.

## 2026-07-26 - Batch 2 commit and push authorization

Status: owner approved committing and pushing the reviewed Batch 1 closeout and Batch 2 work to `croquette` only.

- The authorized commit includes the SAT closeout, enrollment backend, D1 migration/local review environment, tests, documentation, and project backend skill.
- Pre-commit `npm run verify` passed: 3 test files and 12 tests, zero Astro errors/warnings/hints, two static routes, and a successful Pages Functions Worker build.
- Local `.wrangler`, `dist`, `node_modules`, and secret files remain excluded.
- This authorization does not include `main`, production, Cloudflare deployment/bindings, a remote D1 database, Stripe activation, Resend activation, or live analytics secrets.

## 2026-07-26 - Home marketing redesign

Status: implemented, visually reviewed, and approved for commit and push to `croquette`.

### Marketing and information architecture

- Replaced the résumé-first Home experience with a family-facing promise: clearer math instruction built around the student.
- Made the free 15-minute consultation the primary Home conversion and kept service exploration secondary.
- Ordered the page as promise, needs-based wayfinder, service paths, learning progression, instructor credibility, FAQs, and consultation close.
- Added three direct starting points for families: current-class support, SAT preparation, and a free consultation when the right path is unclear.
- Presented Math Tutoring and the Digital SAT Math Bootcamp as two clear choices instead of asking families to infer services from Orlando's biography.
- Added concrete SAT value on Home: eight sessions, 10 live hours, August dates, and targeted practice.
- Kept the Duke Math Ph.D. credential prominent while making PiPath's teaching approach and student fit the primary story.
- Did not add testimonials, score guarantees, or a claimed monetary value because approved evidence is not yet available.

### Imagery and credibility

- Removed the Duke campus image from the built Home route.
- Used the existing genuine Orlando portrait in the hero and optimized it through Astro from approximately 596 KB to 35 KB WebP output.
- Added the existing PiPath Math YouTube lesson as genuine teaching content using the privacy-enhanced YouTube embed domain and lazy loading.
- Kept the current portrait source file unchanged; later approved tutoring/classroom photography can supplement or replace it.

### Navigation and interaction

- Updated the shared header to use relative internal routes so Home, Math Tutoring, Contact, and SAT interactions remain inside localhost/preview instead of jumping to production.
- Made the announcement content/link configurable so Home can promote the August SAT program while keeping consultation as its header action.
- Changed shared mobile navigation from a horizontally clipped row to a complete two-by-two layout with 44-pixel targets; the SAT page inherits the same improvement.
- Added a mobile consultation bar that remains hidden and unfocusable while the hero consultation button is visible, then appears through `IntersectionObserver` after that action leaves view.
- Retained semantic native `<details>` FAQ interactions and visible keyboard focus behavior.

### Technical migration

- Added `src/pages/index.astro` and `src/components/home/HomePage.astro`; Astro now owns the built `/` route.
- Added `src/styles/home.css` using the SAT-era color, type, spacing, card, border, shadow, button, and responsive tokens.
- Removed `index.html` from `scripts/copy-legacy-static.mjs` so the legacy Home can no longer overwrite Astro's built Home. The legacy source file remains in Git and production remains unchanged.
- Extended `SiteLayout.astro` with a per-page social image so Home uses Orlando's image instead of the SAT course graphic.
- Added canonical Home metadata and EducationalOrganization, Person, and FAQ structured data.
- Preserved the seven required legacy pages/assets for Math Tutoring, Contact, Resume, SAT fallback, and existing images.

### Verification

- `npm run verify`: 3 test files and 12 tests passed.
- Astro check: 35 files, 0 errors, 0 warnings, and 0 hints.
- Static build: Home, SAT Bootcamp, and enrollment-confirmation routes built; Pages Functions Worker compiled successfully.
- Local Chromium review passed at 1200/1440 desktop widths and 390 mobile width with no page errors, console errors, or horizontal overflow.
- Confirmed one H1, complete image alt text, iframe title, non-empty link text, canonical metadata, Home social image, and Organization/Person/FAQ structured data.
- Confirmed the FAQ opens, the mobile consultation bar changes its ARIA/focus state correctly, and all four navigation items remain within the mobile viewport.
- Confirmed Home, SAT, Math Tutoring, Contact, and Resume local routes return 200.
- Confirmed the SAT route has no mobile navigation regression.
- Confirmed the built Home has no Duke-image reference and is not the legacy résumé page.
- `git diff --check`: passed.

### Repository and deployment state

- The Home redesign and reviewed SAT refinements are approved for commit and push to `croquette`.
- Nothing is merged to `main`, deployed, or connected to Cloudflare during this gate.
- Stripe, D1 preview/production, Resend, and analytics-secret state did not change.
- Next gate: configure Stripe test resources and review the real sandbox checkout before any public enrollment activation.

## 2026-07-27 - Home approval and SAT hero refinement

Status: owner approved the reviewed Home page and requested a `croquette` commit/push.

- Kept the approved Home design without further implementation changes.
- Replaced the SAT hero's video placeholder with the supplied PiPath YouTube overview using a responsive privacy-enhanced embed.
- Kept the explanatory caption inside the video card and placed the schedule and consultation actions below, outside the card.
- Added a clear canceled-checkout return notice above the schedule.
- Added a plain-language backend architecture document and expanded local review with responsive and Stripe test matrices.
- Confirmed the legacy SAT page contained a Google interest form rather than a reusable Stripe Payment Link.
- Verified 12 automated tests, zero Astro/TypeScript diagnostics, a successful Cloudflare Functions build, and desktop/mobile layouts without horizontal overflow.
