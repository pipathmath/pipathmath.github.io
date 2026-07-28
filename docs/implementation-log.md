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
- Kept `PUBLIC_ENROLLMENT_ENABLED` off by default. This original disabled presentation was superseded by the July 27 refinement: the family form is now fillable and reachable from every enrollment action, while only its payment button remains gated until the environment is intentionally enabled.
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

## 2026-07-27 - Lead-first enrollment flow

Status: implemented locally; real Stripe sandbox payment remains pending test credentials.

- Replaced the direct-to-Stripe enrollment control with a short family form before checkout.
- Made parent name, student name, parent email, and parent phone required; SAT/PSAT Math score and additional notes are optional.
- Persisted the lead atomically with the 30-minute capacity hold before creating a Stripe Checkout Session.
- Prefilled the saved parent email in Stripe and removed duplicate name/phone collection from Checkout.
- Restored the form draft after a canceled checkout and added clear two-step progress, inline validation, loading, and failure states.
- Updated webhook fulfillment to promote the saved lead into one parent, student, payment, and active enrollment without a second family-information form.
- Preserved the legacy onboarding endpoint for earlier paid records that do not yet have a student attached.
- Updated confirmation and owner emails to use the saved family/student details.
- Added validation and migration coverage for lead persistence and verified the form handoff with a mocked Checkout response on desktop and mobile.
- Applied migration `0002_precheckout_leads.sql` to the private local D1 database only. No remote database, Stripe account, deployment, or production system was changed.
- Refined the public enrollment presentation after owner review: the cohort action now always leads to the form, fields remain fillable in the safe review build, only the payment action is gated, and internal step/setup language was replaced with concise program facts and client-facing copy.

## 2026-07-27 - Payment Link hybrid simplification

Status: implemented locally with the supplied July live-mode link for visual handoff testing only.

- Replaced per-parent Stripe Checkout Session creation with a reusable Stripe Payment Link handoff.
- Kept the lead-first D1 insert, request rate limit, and atomic 15-seat website capacity check before returning the payment destination.
- Added the checkout-attempt ID as Stripe's `client_reference_id`, locked the validated parent email, and preserved available UTM attribution on the Payment Link.
- Updated webhook fulfillment to recover the cohort from the saved checkout attempt because a static Payment Link does not carry the previous dynamic cohort metadata.
- Removed the Stripe API secret key and Price ID from the checkout configuration; automatic fulfillment still requires the Stripe webhook signing secret.
- Added immediate accessible email validation on blur while retaining native browser and server-side email validation.
- Added Payment Link URL-construction tests. The clean live August Payment Link must be configured in Stripe with its own 15-completed-payment limit because a copied reusable link bypasses the website's D1 gate.

## 2026-07-27 - Google Sheets operations architecture

Status: implemented and verified locally; awaiting owner-run Apps Script setup and real lead-to-Sheet test.

### Owner decisions recorded

- Replaced D1 as the active short-term operational store with the private Google Sheet created by the owner.
- Confirmed that form submission does not reserve a seat. Payment accepted by the owner-configured Stripe Payment Link confirms the seat.
- Kept Stripe Payment Link creation, enabled payment methods, and completed-payment limits as Stripe/account-owner responsibilities; the website accepts a supplied per-cohort link.
- Kept the previous D1 schema and modules as future/reference infrastructure, but removed the D1 binding and migration step from the active local/Cloudflare configuration so the system does not dual-write.

### Active backend changes

- Changed `POST /api/checkout` to validate the family form, generate a UUID lead ID, write the lead to Google Sheets through Apps Script, and only then return the Payment Link.
- Added the server-owned cohort name, expected amount, and currency to the lead write so payment fulfillment does not trust browser values.
- Added a server-only Google Apps Script adapter with a restricted `script.google.com` destination, 10-second timeout, shared-secret request, response validation, and retryable parent-facing failures.
- Reworked `POST /api/stripe-webhook` to update Sheets for completed, delayed-success, delayed-failure, expired, and refund events after Stripe signature verification.
- Ignored unrelated Checkout events that do not carry PiPath's UUID-shaped `client_reference_id`.
- Removed the active D1-backed enrollment-status and onboarding Functions. Replaced the confirmation page's D1 polling/onboarding form with a client-facing payment-submitted and follow-up explanation that does not repeat family intake.

### Google Apps Script

- Added `integrations/google-apps-script/Code.gs` for owner copy/paste into the private Sheet.
- The script reads spreadsheet ID and shared secret only from Script Properties, creates `Leads` and `Stripe Events` tabs, locks concurrent changes, rejects schema drift, neutralizes formula-leading cell content, validates payment amount/currency, and deduplicates Stripe event IDs.
- Staff-owned `follow_up_status` and `internal_notes` columns are not overwritten by automated payment updates.
- Added `docs/google-sheets-setup.md` with exact owner clicks, secret creation/storage, deployment, local setup, update, and recovery steps. The private spreadsheet URL/ID and all credentials remain outside the public repository.

### Documentation and architecture

- Added `docs/decisions/0001-google-sheets-enrollment.md` to preserve the reasoning, cost/scale choice, trust boundaries, capacity tradeoff, failure behavior, and future D1 trigger conditions.
- Rewrote the current `docs/enrollment-backend.md`, `docs/local-review.md`, and `docs/project-plan.md` so historical D1 behavior is not presented as the active system.
- Earlier D1 entries remain in this append-only log as implementation history.

### Configuration

- Added server-only `GOOGLE_SHEETS_WEB_APP_URL` and `GOOGLE_SHEETS_SHARED_SECRET` environment values.
- Removed the active D1 binding from Wrangler configuration and removed local migration from `npm run dev:review`.
- Retained `PUBLIC_ENROLLMENT_ENABLED` as the deliberate build-time gate; it should remain false until the Apps Script receiver is configured.
- No Google, Stripe, Cloudflare, or production secret was added to source or documentation.

### Verification

- Added Google adapter tests for complete lead payloads, payment updates, destination restriction, and Apps Script rejection.
- Added checkout Function tests proving the Sheet write precedes the Stripe response, failed writes return no payment URL, and cross-origin requests never contact Google.
- `npm run verify` passed: 6 test files and 24 tests, 0 Astro errors/warnings/hints, 3 static routes, and a successful Cloudflare Functions Worker build.
- Google Apps Script source passed JavaScript syntax checking, `git diff --check` passed, and the built Worker contains Google Sheets configuration without active `env.DB`/checkout-attempt code.
- A real external lead/write and signed Stripe webhook test remain pending owner setup.

### External actions not performed

- The private Sheet was not opened or mutated by the development environment.
- Apps Script was not deployed.
- Cloudflare variables, deployments, and DNS were not changed.
- Stripe webhook settings and Payment Links were not changed.
- No commit or push was performed.

### Setup-guide correction

- Replaced the newer static `.NET RandomNumberGenerator.Fill(...)` example with the backward-compatible `RandomNumberGenerator.Create().GetBytes(...)` form after Windows PowerShell reported that `Fill` was unavailable.
- This documentation-only correction does not change the generated secret format or application behavior.

### Owner Apps Script deployment checkpoint

- The owner supplied the deployed Apps Script web-app URL.
- Stored the URL only in the ignored local `.dev.vars` file; it was not added to committed configuration or documentation.
- A read-only request returned `{ "ok": true, "service": "pipath-enrollment-receiver" }`, confirming that the expected script version is publicly reachable.
- No Sheet write was attempted. The matching shared secret still needs to be placed privately in local `.dev.vars` before the lead-flow test can run.

### First external lead-write check

- The owner configured the matching shared secret locally; its presence and 44-character encoded length were checked without printing the value.
- The first controlled checkout Function request authenticated successfully with Apps Script but was rejected before any Sheet write because `PIPATH_SPREADSHEET_ID` contained the complete Google Sheets URL rather than only its ID.
- The Function correctly returned no Stripe destination after the failed lead write, preserving the lead-first invariant.
- Added the specific `Illegal spreadsheet ID or key` correction to the owner setup and recovery guide. A retry remains pending the corrected Script Property.

### Corrected-property retry checkpoint

- Retried after the owner corrected `PIPATH_SPREADSHEET_ID`.
- The opt-in test reached the external request but its initial five-second test timeout elapsed before Apps Script returned, so the result was intentionally treated as unknown rather than as a failed Sheet write.
- Increased only the opt-in integration-test timeout to 20 seconds. Before another write, the owner must check whether the clearly labeled test row already exists so a duplicate is not created unnecessarily.

### Lead-to-Sheet integration confirmed

- The owner confirmed that the `PiPath Integration Test` / `Test Student - Delete Me` row exists in the private `Leads` tab.
- This proves the real checkout Function authenticated to Apps Script and completed the lead write. The test runner's five-second limit expired while waiting for the HTTP response; it was not a Sheet-record expiration, enrollment timeout, seat hold, or payment timeout.
- No second lead test was submitted and no Stripe page or payment was opened.

### Local enrollment configuration restart

- Diagnosed the client-facing “Online enrollment is being configured” response as a Wrangler process that had started before the Google URL/shared secret were added to `.dev.vars`.
- Stopped only the stale PiPath review-server process tree and started the current `npm run dev:review` build with `PUBLIC_ENROLLMENT_ENABLED=true`.
- Confirmed `/sat-math-bootcamp/` returns HTTP 200.
- Sent a non-writing `{}` probe to `/api/checkout`; it returned HTTP 400 `invalid_checkout` rather than HTTP 503 `enrollment_not_configured`, proving the restarted Function loaded all required enrollment configuration.
- Added the `.dev.vars` restart requirement to the local review guide. No additional Sheet row or Stripe request was created by the probe.

### Checkout back-button recovery

- Fixed the family form remaining greyed out when a parent opened Stripe and used the browser Back button.
- The browser can preserve the React tree in its back-forward cache with `isStarting=true`; the form now resets only that transient navigation/loading state on `pageshow` while retaining the saved family draft.
- This change allows the parent to submit checkout again without refreshing or re-entering family information.
- Verification passed with a headless browser and mocked checkout destination: after navigation and browser Back, the payment button was enabled and the form draft remained populated. The browser test made zero Google Sheet writes and did not open Stripe.
- The site rebuilt with 0 Astro errors/warnings/hints; 24 automated tests passed and the opt-in external integration test remained skipped during the normal suite.

## July 27, 2026 — Math Tutoring and Contact launch migration

- Replaced the legacy Math Tutoring and Contact presentation with concise Astro pages using the shared PiPath layout, header, footer, metadata, responsive navigation, design tokens, and accessibility behavior.
- Used the owner-approved tutoring positioning, “Each student has their own unique path to learning math,” and corrected local service language from Apex to the Research Triangle / RTP, North Carolina area by request across the shared site.
- Kept the tutoring funnel compact: one static family-needs panel, one unified one-on-one offer, small-group tutoring, an organized subject list including SAT/ACT and competition math, and consultation/inquiry actions.
- Linked the tutoring credential strip to the existing Home instructor/lesson section instead of duplicating teaching proof. Deferred testimonials, FAQs, detailed recommendations, and a session walkthrough.
- Rebuilt Contact around the existing Calendly consultation, direct email, and a short contextual inquiry form. Added topic preselection for tutoring and small-group links without adding SAT cross-selling logic.
- Added a same-origin `/api/inquiry` Function with server-side validation, sanitization, attribution capture, hidden honeypot handling, and client-safe errors.
- Extended the authenticated Apps Script receiver with a separate private `Inquiries` tab and email notification. Inquiry data does not enter the enrollment `Leads` tab, and an email failure does not remove the archived row.
- Added clean `/tutoring` and `/contact` routes, permanent redirects from the two legacy `.html` URLs, and updated sitemap and internal navigation entries.
- Added `docs/tutoring-contact-launch.md` and updated the owner Google Sheets setup instructions. The new Apps Script version still requires owner deployment and one labeled end-to-end inquiry check before public launch.
- Verification passed with 31 automated tests, 0 Astro diagnostics, a successful five-route static build, a successful Cloudflare Worker build, valid Apps Script JavaScript syntax, and clean diff whitespace checks.
- Browser review covered 1440px desktop and 390px mobile layouts, active navigation, horizontal-overflow checks, clean-route redirects, contact-topic preselection, and a mocked successful inquiry submission. External Google Fonts/Analytics requests were blocked only by the local browser sandbox.
- Temporary browser screenshots used for local review were removed after inspection and were not added to the repository.
- Simplified the Contact review copy to one direct headline, one Zoom consultation action, and the inquiry form. Removed redundant kickers, commitment/location/storage explanations, and the split-background divider that could visually collide with the consultation card at intermediate widths. Updated the shared footer location to “Based in North Carolina.”
- Simplified the Math Tutoring review page and reordered it as curriculum, three service blocks, the SAT Bootcamp pathway, family needs, and final consultation/inquiry actions. Removed the slogan-led hero, format/location/credential strip, duplicate availability language, mobile sticky action, and filler marketing headings. Restored Admissions Coaching as a distinct service and contact-form inquiry type.

## July 27, 2026 — Home hierarchy and shared navigation refinement

- Combined the shared cohort announcement and primary navigation into one sticky unit so both remain available while families scroll, including when the mobile announcement wraps to two lines.
- Standardized the August SAT cohort promotion across Home, Math Tutoring, SAT Math Bootcamp, and Contact as “August SAT cohort,” “August 18–September 10 · Live online,” and “View the program.”
- Simplified the Home hero by removing the generic instruction kicker and availability line and reducing the headline scale, while preserving Orlando's full teaching philosophy and the “What PiPath believes” positioning statement.
- Moved the PiPath teaching video into the lower-left of the hero and paired it directly with “Want to see his teaching style in action?”
- Added Orlando's Ph.D., M.A., and B.S. education beneath his portrait and removed the separate learning-progression and instructor/video sections.
- Added a direct SAT Math Bootcamp link to the bootcamp FAQ and a Contact link to the online/in-person FAQ; updated local wording to the RTP, North Carolina area.
- Preserved the concise needs guide, service pathways, FAQ, and final consultation routes while reducing the Home page's overall scroll length.
- Compacted the sticky header from a two-row mobile tab grid to a single-row four-tab layout and reduced desktop header spacing; browser checks confirmed no horizontal overflow down to 320px.
- Restored the hero portrait's staggered badge hierarchy: the Lead Educator badge leads, while the PiPath belief card steps lower and left. Removed the duplicate Orlando name beneath the portrait, retained the educator descriptor, and kept “Dr. Orlando Ferrer.” together as one typographic unit in the headline.

## July 28, 2026 — Shared sticky navigation guardrail

- Confirmed the announcement and primary tabs remain one sticky header unit across Home, Math Tutoring, SAT Math Bootcamp, and Contact.
- Removed page-level cohort-banner wording overrides. The August SAT cohort label, dates, format, link text, and destination now have one shared definition in `SiteHeader.astro`, preventing copy drift between tabs.

## July 27, 2026 — SAT Bootcamp copy and information hierarchy refinement

- Replaced the SAT hero promise and supporting copy with the owner-approved standardized-test/personal-learning-path positioning, practical Desmos emphasis, and Duke Mathematics credential wording.
- Removed the repetitive three-item hero list and consolidated the essential program facts into four columns: 10 live hours across eight sessions with recordings, 10–15 students in an interactive classroom setting, $299 total, and personalized DeltaMath/Khan Academy homework.
- Increased the separation between the course video and its two next-step buttons so the media and actions read as distinct elements.
- Renamed the curriculum introduction “Bootcamp Overview,” added the approved non-comprehensive-list description, and replaced all four weekly topic summaries with the expanded owner-provided syllabus details.
- Updated the Home SAT pathway and SAT page metadata to use “10 live hours” consistently instead of leading with eight sessions.
- Changed the fact strip to a 2×2 tablet layout and stacked the enrollment panel at 1040px, eliminating a 900px horizontal overflow while keeping the four-column desktop and single-column phone presentations.
- Reduced the long SAT hero headline's responsive type scale so the message remains prominent without overwhelming the video or pushing practical course information unnecessarily far below the fold.
- Top-aligned the SAT hero copy and video columns, then separated the instructor credential into a quieter supporting line. This preserves the approved wording while clarifying the promise, program description, and credibility hierarchy.
- Matched the separated instructor line to the program-description typography and raised both supporting text and headline scale slightly, reducing the empty lower-left area while preserving the three-level reading order.
- Lowered the Home hero's PiPath belief card so it again steps beyond the portrait's lower edge, closer to the deliberate overlap in the earlier approved composition.

## July 28, 2026 — SAT Bootcamp launch-content reduction

- Removed the “Live online · Summer 2026” hero kicker and top-aligned the headline directly with the course video.
- Changed the personalized-homework fact to “Customized to student's needs” and removed redundant pre-payment form instructions from both the cohort card and enrollment introduction.
- Replaced all four PiPath methodology descriptions with the owner-approved diagnostic, conceptual-understanding, timed-strategy/Desmos, and targeted-homework copy.
- Renamed the methodology section “How we prepare students” and removed its supporting paragraph and “Included in the program” callout.
- Removed the separate SAT instructor section. Orlando's credential remains in the hero, with fuller teaching proof on Home.
- Hid the placeholder testimonial section behind the local `showTestimonials` flag while retaining its markup and CSS for future approved family stories.
- Reduced the visible and structured FAQ set to three synchronized entries, shortened the diagnostic answer, removed the calculator-shortcuts question, and renamed the personalization question.
- Added a subtle divider between the methodology and FAQ sections after removing the intervening instructor/testimonial bands.
- Reworked “How we prepare students” into a full-width heading and two independent method columns, with 01/02 on the left and 03/04 on the right. Independent columns avoid height coupling and eliminate the large blank area beneath the heading.
- Restored section-color alternation by using the paper background for FAQs after the white methodology section.
- Updated the shared footer across all pages: the PiPath identity now says “Based in North Carolina.” and the previous location slot now links `@PiPathMath` to the official YouTube channel while retaining the contact email.

## July 28, 2026 — Stripe sandbox workflow preflight

- Pointed only the ignored local `.dev.vars` cohort setting at the owner-supplied Stripe test Payment Link; committed configuration, Cloudflare, Stripe settings, and production were unchanged.
- Rebuilt and started the local Pages/Functions review environment successfully with zero Astro diagnostics.
- Submitted two clearly labeled browser test leads through the real family form. Both checkout requests returned HTTP 200 only after Apps Script accepted the Sheet write; neither test completed payment. The rows use parent name `PiPath Stripe Workflow Test` and student name `Stripe Test Student - Delete Me` so they can be removed after review.
- Confirmed the supplied link is a Stripe test-mode Payment Link for `PiPath Sandbox SAT Bootcamp - Test Registration`, but its displayed charge is `$10.00` while the PiPath August cohort and saved lead validation require `$299.00`. No dummy card was submitted because the signed webhook update would correctly reject the amount mismatch.
- Confirmed the local `STRIPE_WEBHOOK_SECRET` is not configured and no Stripe CLI listener is installed. A complete Stripe-to-Sheet test therefore still requires either a test-mode webhook registered against a deployed preview endpoint or a Stripe CLI listener forwarding test events to the local endpoint, plus the matching test endpoint signing secret.
- Stopped the temporary review server and removed the temporary browser scripts/logs. The ignored local Payment Link remains set to the test link for the next sandbox run.

## July 28, 2026 — Checkout handoff latency refinement

- The owner confirmed a successful separate $10 Stripe-hosted sandbox payment. No test webhook was configured, so the payment was not treated as proof of Stripe-to-Sheet reconciliation or a paid enrollment update.
- Changed Apps Script action routing so `create_lead` validates only `Leads`, `create_inquiry` validates only `Inquiries`, and payment/refund updates continue validating both `Leads` and `Stripe Events`. Authentication, the script lock, schema validation, lead append, explicit flush, and lead-before-Stripe response ordering remain unchanged.
- Started GA client-ID collection when the enrollment form hydrates. Checkout now includes the ID only when the callback has already completed and never waits up to 700 milliseconds for analytics; missing GA attribution remains an accepted optional value.
- Added Apps Script routing tests covering every active action. Focused verification passed with 3 test files and 12 tests, including the existing guarantees that Google acceptance precedes the Stripe response and Google rejection returns no payment destination.
- Full verification passed with 8 test files and 35 tests, with the opt-in external Sheet test skipped; Astro reported 0 errors, warnings, or hints; all five static routes built; the Pages Functions Worker compiled; Apps Script passed JavaScript syntax validation; and `git diff --check` passed.
- Changes are local on `croquette`. No commit, push, Cloudflare deployment, Stripe setting, Google Sheet schema, secret, or production environment changed. The owner must publish the current `Code.gs` as a new Apps Script deployment version before measuring the Sheet-side latency improvement.

## July 28, 2026 — Pre-launch latency optimization rollback

- Reverted the local action-specific Apps Script validation and non-blocking GA client-ID experiment before either change was committed or deployed. `Code.gs` and the checkout attribution sequence now match the previously tested implementation, so no Apps Script deployment update is required for this rollback.
- Removed the experiment-specific Apps Script routing test and restored the current architecture/setup references.
- Kept the existing lead-before-Stripe behavior unchanged and replaced only the checkout button's transient label with “Opening secure checkout… Please don’t refresh.” so families understand the short wait.
- The owner-confirmed $10 Stripe sandbox payment remains an external test fact; test-webhook setup and Stripe-to-Sheet reconciliation remain pending.
- Rollback verification passed with 31 tests, the opt-in external test skipped, 0 Astro/TypeScript diagnostics, five built routes, successful Apps Script syntax validation and Pages Functions compilation, and a clean `git diff --check` result.
