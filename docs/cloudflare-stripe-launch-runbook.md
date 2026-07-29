# PiPath Academy Cloudflare and Stripe launch runbook

Last updated: 2026-07-28

## Purpose

This is the ordered checklist for moving the redesigned PiPath Academy website from the current GitHub Pages production site to Cloudflare Pages and enabling real Stripe payments.

The customer policies are already configured in Stripe. Adding separate policy pages to the PiPath website is not a blocker for this launch.

## Current readiness

**Current position:** local development is complete enough to begin **Phase 1: prepare the repository for Cloudflare**. Stripe webhook setup still comes after the Cloudflare preview deployment, as ordered in this runbook.

The local application is technically healthy:

- [x] 32 automated tests pass; 1 external integration test is intentionally skipped.
- [x] Astro reports zero errors and zero warnings.
- [x] All five static website routes build successfully.
- [x] The three Cloudflare Pages Functions compile successfully:
  - `/api/checkout`
  - `/api/inquiry`
  - `/api/stripe-webhook`
- [x] The Google Apps Script receiver and private Sheet exist.
- [x] Lead-to-Sheet behavior has been tested.
- [x] The Contact form has created an inquiry row through the deployed Apps Script web app.
- [x] The Contact message is optional in the website and Apps Script validation.
- [x] Contact-form success handling has been fixed so the completed form and disabled submit button do not remain visible.
- [x] The website code includes email-alert handling for both new enrollment leads and Contact inquiries, with `pipathmath@gmail.com` as the default destination.
- [ ] Re-publish or confirm the latest repository `integrations/google-apps-script/Code.gs`, run `testNotificationEmail`, and verify that both alert types arrive. The last reported inquiry row said `Email failed`, so email authorization has not yet been proven complete.
- [ ] Replace the local-review values in `wrangler.jsonc` with production-safe Cloudflare configuration.
- [ ] Create the Cloudflare Pages project and deploy the `croquette` preview.
- [ ] A Stripe sandbox Payment Link for exactly `$299 USD` has completed the full website-to-Stripe-to-Sheet webhook test.
- [ ] The real/live `$299 USD` Stripe Payment Link has been created.
- [ ] The live Stripe webhook endpoint has been created.
- [ ] The Cloudflare preview deployment has passed final review.
- [ ] The production domain has been switched from GitHub Pages to Cloudflare Pages.

## Terminology: `www` and the apex domain

The website has two common versions of its domain:

- `www.pipathacademy.com` is the **www hostname**.
- `pipathacademy.com` is the **apex domain**, also called the root or naked domain.

The apex domain is simply the address without `www`. It is not a second website.

PiPath already uses `https://www.pipathacademy.com` as its canonical address in page metadata, the sitemap, robots file, and structured data. Therefore:

- `www.pipathacademy.com` should display the Cloudflare Pages website.
- `pipathacademy.com/anything` should redirect to `www.pipathacademy.com/anything`.

Example:

```text
https://pipathacademy.com/tutoring
        redirects to
https://www.pipathacademy.com/tutoring
```

This gives search engines and users one consistent version of every page.

## Phase 1: prepare the repository for Cloudflare

Complete these before the first production deployment.

### 1. Keep `wrangler.jsonc` local-only

The repository uses `wrangler.jsonc` for local review. It contains:

- the project name `pipath-academy-local-review`;
- `SITE_URL=http://localhost:8788`;
- an existing Stripe Payment Link value.

Cloudflare treats a Pages Wrangler file containing `pages_build_output_dir` as the project's deployment configuration and source of truth. Because this project's values are intentionally local, the production-safe approach is to omit that key and manage Cloudflare preview and production variables in the dashboard.

Before launch:

- [x] Omit `pages_build_output_dir` from `wrangler.jsonc` so it remains local-only.
- [x] Keep the local project name, localhost URL, and local/test Stripe link isolated from Cloudflare deployment configuration.
- [ ] Keep local-only values in the ignored `.dev.vars` and `.env` files.
- [ ] Set the Cloudflare build output directory to `dist` in the dashboard.
- [ ] Do not commit the Google shared secret or Stripe webhook signing secret.

Cloudflare documentation: [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

### 2. Pin the build version of Node

The complete application was verified locally with Node `24.14.0`. Use the same version in Cloudflare by setting:

```text
NODE_VERSION=24.14.0
```

Cloudflare documentation: [Pages build image](https://developers.cloudflare.com/pages/configuration/build-image/)

### 3. Decide the production branch

Recommended branch arrangement:

- `croquette`: Cloudflare preview deployments
- `main`: Cloudflare production deployment

If the GitHub repository does not yet contain `main`, create it from the final approved `croquette` commit. Cloudflare can use `croquette` as production, but keeping preview and production separate is safer for later updates.

## Phase 2: configure the Cloudflare Pages project

In Cloudflare, open:

**Workers & Pages -> Create or select the Pages project -> Connect to Git**

Use:

| Setting | Value |
| --- | --- |
| GitHub repository | `pipathmath/pipathmath.github.io` |
| Framework | Astro |
| Root directory | Repository root |
| Production branch | `main` recommended |
| Preview branch | `croquette` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Build system | V3 |
| Node version | `24.14.0` |

Cloudflare documentation: [Astro on Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/) and [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)

### Initial project-creation variables

The first Pages setup screen labels its environment-variable section as **build-time** variables for Production and Preview. Add only these ordinary, non-secret bootstrap values there:

| Name | Initial value | Why it is needed now |
| --- | --- | --- |
| `NODE_VERSION` | `24.14.0` | Tells Cloudflare which Node.js version to use while installing dependencies and building the site. |
| `PUBLIC_ENROLLMENT_ENABLED` | `false` | Keeps the payment button closed until the Function runtime variables and secrets are configured. |

Do not paste Google or Stripe secrets into this initial build-variable form. Complete the first deployment, then use the project's **Settings -> Variables and Secrets** controls in Phase 3, where preview and production values can be managed separately and sensitive values can be encrypted.

The first deployment is only a build/deployment check. After the required preview runtime values are saved, change the Preview value of `PUBLIC_ENROLLMENT_ENABLED` to `true` and redeploy the preview.

Pushing `croquette` should produce a preview address similar to:

```text
https://croquette.<cloudflare-project-name>.pages.dev
```

Do not change the public PiPath domain yet.

## Phase 3: configure Cloudflare preview variables

This list is longer because these values configure the deployed Pages Functions at runtime, not only the initial site build. At this point:

- the Cloudflare project exists;
- its stable `pages.dev` hostname is known for `SITE_URL`;
- encrypted secrets can be added through the project settings;
- the sandbox Payment Link is available;
- the Stripe webhook signing secret can be added after Phase 4 creates the sandbox webhook destination.

Open:

**Workers & Pages -> PiPath project -> Settings -> Variables and Secrets -> Preview**

Add:

| Name | Preview value | Type |
| --- | --- | --- |
| `NODE_VERSION` | `24.14.0` | Variable |
| `PUBLIC_ENROLLMENT_ENABLED` | `true` | Variable |
| `SITE_URL` | Stable `croquette.<project>.pages.dev` URL | Variable |
| `STRIPE_PAYMENT_LINK_URL_AUGUST_2026` | Sandbox Payment Link for exactly `$299 USD` | Variable |
| `GOOGLE_SHEETS_WEB_APP_URL` | Apps Script `/exec` URL | Encrypted secret |
| `GOOGLE_SHEETS_SHARED_SECRET` | Matching Apps Script shared secret | Encrypted secret |
| `STRIPE_WEBHOOK_SECRET` | Test endpoint's `whsec_...`; add it after creating the Phase 4 webhook destination | Encrypted secret |

`PUBLIC_ENROLLMENT_ENABLED` is read while Astro builds the page. Trigger a new deployment after changing it.

Cloudflare documentation: [Pages variables and secrets](https://developers.cloudflare.com/pages/functions/bindings/)

## Phase 3A: verify the deployed Google Apps Script and email authorization

The deployed Apps Script has already accepted a Contact inquiry and written its row to the private Sheet. However, that row reported `notification_status = Email failed`. Since then, the repository version has been updated to:

- make the Contact message optional;
- notify `pipathmath@gmail.com` for both enrollment leads and Contact inquiries;
- preserve saved rows and checkout access even if an alert email fails;
- record a safer email-failure reason in the row and execution log;
- provide `testNotificationEmail` so the script owner can explicitly authorize Google email sending.

Before preview acceptance testing, confirm that this latest repository version—not an earlier deployed version—is active.

Update it as follows:

1. Open the Apps Script project connected to the private PiPath spreadsheet.
2. Open `integrations/google-apps-script/Code.gs` in this repository.
3. Replace the complete contents of the Apps Script editor's `Code.gs` with that current repository file.
4. Save the Apps Script project.
5. Open **Deploy -> Manage deployments**.
6. Select the active web-app deployment and click **Edit**.
7. Choose **New version**.
8. Add a description such as `Optional inquiry message and lead/inquiry email alerts`.
9. Deploy the new version.
10. Approve the email-sending permission if Google requests it.
11. Keep using the existing web-app `/exec` URL unless Google explicitly changes it.

Before testing the forms, select `testNotificationEmail` in the Apps Script editor and click **Run**. Approve Google's send-mail permission, then confirm the test message reaches `pipathmath@gmail.com`. This manual run is important because a web-app request cannot display an authorization prompt to the script owner.

The current code sends inquiry notifications to:

```text
pipathmath@gmail.com
```

No `PIPATH_INQUIRY_EMAIL` Script Property is required for that destination. The code uses `pipathmath@gmail.com` as its built-in default. `PIPATH_INQUIRY_EMAIL` is only an optional override if PiPath later wants notifications sent somewhere else.

After deployment, submit one clearly labeled Contact test and one clearly labeled enrollment test. Confirm:

- [ ] The website reports success.
- [ ] An `Inquiries` tab is created if it does not already exist.
- [ ] The inquiry appears in that tab.
- [ ] `notification_status` says `Sent`.
- [ ] The Contact alert reaches `pipathmath@gmail.com`.
- [ ] The enrollment appears in `Leads`.
- [ ] The new-lead alert reaches `pipathmath@gmail.com`.

New SAT enrollment leads also send an alert to `pipathmath@gmail.com`. A notification failure is logged but does not discard the saved lead or prevent the family from continuing to Stripe.

## Phase 4: finish the Stripe sandbox webhook test

The prior `$10` Stripe sandbox payment did not test this website's complete reconciliation path. The website expects exactly `$299 USD`; the Google receiver intentionally rejects a paid update whose amount or currency does not match.

### 1. Create the sandbox Payment Link

In a Stripe sandbox, create:

- one-time product: August Digital SAT Math Bootcamp;
- price: exactly `$299 USD`;
- fixed quantity: 1;
- the same payment methods intended for production;
- after-payment redirect to the preview confirmation page.

### 2. Create the test webhook destination

In Stripe's test/sandbox environment, open:

**Workbench -> Webhooks -> Create new destination**

Endpoint:

```text
https://croquette.<cloudflare-project-name>.pages.dev/api/stripe-webhook
```

Subscribe only to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
```

Copy its `whsec_...` value to the Cloudflare **Preview** secret `STRIPE_WEBHOOK_SECRET`, then redeploy the preview.

Stripe documentation: [Manage event destinations](https://docs.stripe.com/workbench/event-destinations)

### 3. Test the complete preview flow

- [ ] Open the Cloudflare preview SAT Bootcamp page.
- [ ] Submit a clearly labeled test family.
- [ ] Confirm a `Leads` row exists before Stripe opens.
- [ ] Confirm Stripe receives the lead UUID as `client_reference_id`.
- [ ] Confirm the parent email is locked in Stripe.
- [ ] Complete the `$299 USD` sandbox payment.
- [ ] Confirm Stripe reports a successful webhook delivery.
- [ ] Confirm the Sheet row changes to `Paid`.
- [ ] Confirm amount, currency, Checkout Session ID, Payment Intent ID, Stripe event ID, and paid timestamp are recorded.
- [ ] Resend the same event and confirm no duplicate business update occurs.
- [ ] Refund the sandbox payment and confirm the Sheet records the refund.
- [ ] Submit a Contact inquiry and confirm both the Sheet row and the notification at `pipathmath@gmail.com`.

The current Apps Script receiver sends inquiry notifications to the Script Property `PIPATH_INQUIRY_EMAIL` when that optional property exists. If the property is absent, it defaults to `pipathmath@gmail.com`. Therefore, no new property is necessary for PiPath's intended destination. Verify one of the following in **Apps Script -> Project Settings -> Script Properties**:

- `PIPATH_INQUIRY_EMAIL` is set to `pipathmath@gmail.com`; or
- `PIPATH_INQUIRY_EMAIL` is absent, allowing the built-in `pipathmath@gmail.com` default to apply.

Do not use Stripe test-card numbers with a live Payment Link.

## Phase 5: create the live Stripe Payment Link

Make sure the Stripe account is activated for live payments before continuing.

Create a new Payment Link in **live mode** with:

- [ ] Product: August Digital SAT Math Bootcamp
- [ ] One-time price: `$299 USD`
- [ ] Quantity: 1
- [ ] Completed-payment limit: 15
- [ ] A useful message for families if the link reaches its limit
- [ ] Stripe email receipts enabled
- [ ] Correct PiPath business name, support email, branding, and statement descriptor
- [ ] The Stripe-hosted policies/terms already prepared by PiPath
- [ ] After-payment redirect:

```text
https://www.pipathacademy.com/sat-math-bootcamp/enrollment-confirmed
```

Copy the new live link. Do not reuse a sandbox object or an old cohort link.

Stripe documentation: [Limit Payment Link payments](https://docs.stripe.com/payment-links/customize) and [post-payment redirects](https://docs.stripe.com/payment-links/post-payment)

The Payment Link's completed-payment limit is the capacity control. Submitting the PiPath family form does not reserve a seat; an accepted payment confirms the seat.

## Phase 6: create the live Stripe webhook

The easiest URL to configure before changing DNS is Cloudflare's stable production hostname:

```text
https://<cloudflare-project-name>.pages.dev/api/stripe-webhook
```

In Stripe **live mode**:

1. Open **Workbench -> Webhooks**.
2. Create a new destination.
3. Select events on the PiPath account.
4. Enter the production `pages.dev` endpoint above.
5. Select the same five supported event types.
6. Create the destination.
7. Copy its live `whsec_...` signing secret.

The live signing secret is different from the sandbox secret. It is also not a Stripe API key.

Stripe documentation: [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)

## Phase 7: configure Cloudflare production variables

Open:

**Workers & Pages -> PiPath project -> Settings -> Variables and Secrets -> Production**

Add:

| Name | Production value | Type |
| --- | --- | --- |
| `NODE_VERSION` | `24.14.0` | Variable |
| `PUBLIC_ENROLLMENT_ENABLED` | `true` | Variable |
| `SITE_URL` | `https://www.pipathacademy.com` | Variable |
| `STRIPE_PAYMENT_LINK_URL_AUGUST_2026` | New live `$299 USD` link | Variable |
| `GOOGLE_SHEETS_WEB_APP_URL` | Production Apps Script `/exec` URL | Encrypted secret |
| `GOOGLE_SHEETS_SHARED_SECRET` | Matching production shared secret | Encrypted secret |
| `STRIPE_WEBHOOK_SECRET` | Live endpoint's `whsec_...` | Encrypted secret |

Do not configure D1, Resend, onboarding, or the retained rate-limit variables for this launch. They are not part of the active Google Sheets workflow.

Trigger a new production deployment and test the site at its production `pages.dev` address before changing DNS.

## Phase 8: switch the domain from GitHub Pages to Cloudflare Pages

Cloudflare already manages the domain's nameservers, so no registrar or nameserver change is needed.

The current public website records point to GitHub Pages:

- `www.pipathacademy.com` is a CNAME to `pipathmath.github.io`.
- `pipathacademy.com` has GitHub Pages A records.

Before the change:

- [ ] Export or screenshot every Cloudflare DNS record.
- [ ] Preserve Google email and verification records.
- [ ] Keep the GitHub Pages deployment available temporarily as a rollback target.

In the Cloudflare Pages project:

1. Open **Custom domains**.
2. Add `www.pipathacademy.com`.
3. Add `pipathacademy.com`.
4. Let the Pages setup replace the old GitHub website records.
5. Wait until both domains show `Active` and HTTPS certificates are ready.

Use the Pages **Custom domains** workflow; do not only create a manual DNS CNAME. Cloudflare documentation: [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

Create a Cloudflare Single Redirect:

- If hostname equals `pipathacademy.com`
- Redirect to the same path on `https://www.pipathacademy.com`
- Preserve the query string
- Use status `301`

Example result:

```text
pipathacademy.com/contact?topic=sat-bootcamp
    ->
www.pipathacademy.com/contact?topic=sat-bootcamp
```

## Phase 9: production acceptance test

Immediately after the domain becomes active:

### Website

- [ ] Home loads at `https://www.pipathacademy.com`.
- [ ] Apex URLs redirect once to `www` without a loop.
- [ ] `/tutoring`, `/sat-math-bootcamp`, and `/contact` load correctly.
- [ ] Old `.html` URLs redirect to their new clean URLs.
- [ ] Mobile and desktop layouts have no horizontal scrolling.
- [ ] Browser console shows no serious errors or mixed content.
- [ ] `robots.txt` and `sitemap.xml` are publicly accessible.

### Contact and enrollment

- [ ] A real Contact inquiry reaches the Sheet and sends its notification to `pipathmath@gmail.com`.
- [ ] A live enrollment creates the Sheet lead before Stripe opens.
- [ ] Stripe shows exactly `$299 USD`.
- [ ] The Payment Link has the 15-payment cap.
- [ ] Parent email is locked.
- [ ] Payment redirects to the confirmation page.

### Payment reconciliation

- [ ] Complete one controlled live payment with a real card.
- [ ] Confirm Stripe reports a successful webhook delivery.
- [ ] Confirm the matching Sheet row changes to `Paid`.
- [ ] Confirm all Stripe identifiers and amount fields are recorded.
- [ ] Refund the controlled transaction.
- [ ] Confirm the refund reaches the Sheet.

## Phase 10: monitoring and rollback

For the first week, check daily:

- Cloudflare deployment and Function errors;
- Stripe failed or pending webhook deliveries;
- Google Apps Script Executions;
- payments visible in Stripe but not marked `Paid` in the Sheet;
- inquiry notification failures;
- Payment Link capacity;
- refunds and disputes.

If something goes wrong:

- Payment problem: deactivate the Stripe Payment Link immediately.
- Enrollment form problem: set `PUBLIC_ENROLLMENT_ENABLED=false` and redeploy.
- Bad release: roll back to the prior Cloudflare Pages deployment.
- Domain problem: restore the recorded GitHub Pages DNS records.
- Sheet disagreement: use Stripe as the financial source of truth and reconcile the Sheet manually.

## SEO and AEO status

### What is already optimized

The redesigned site has a strong SEO and answer-engine foundation:

- [x] Every public page has a unique title and meta description.
- [x] Canonical URLs consistently use `https://www.pipathacademy.com`.
- [x] Pages have one clear `h1` and a semantic heading structure.
- [x] Public content is rendered as static HTML, so crawlers do not need JavaScript to read it.
- [x] Clean, descriptive URLs are used.
- [x] Old `.html` pages redirect to the clean URLs.
- [x] Internal links connect Home, Tutoring, SAT Bootcamp, and Contact.
- [x] The shared layout provides Open Graph and Twitter social metadata.
- [x] Images and videos have descriptive alternative text or titles.
- [x] `robots.txt` and an XML sitemap exist.
- [x] The payment-confirmation page has a `noindex, nofollow` meta directive.
- [x] Home includes `EducationalOrganization`, `Person`, and visible `FAQPage` structured data.
- [x] Tutoring includes `Service` structured data.
- [x] SAT Bootcamp includes `Course`, `CourseInstance`, `Offer`, instructor, provider, and visible `FAQPage` structured data.
- [x] Content gives direct answers about subjects, format, location, missed sessions, personalization, schedule, price, and instructor credentials.
- [x] Organization identity is reinforced with Dr. Ferrer's education, YouTube, LinkedIn, PiPath name, email, and geographic service area.

These features help traditional search engines understand the pages and give answer engines explicit facts and concise question/answer passages to quote or summarize.

Google documentation: [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview), and [structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)

### Two worthwhile technical improvements

These are recommended but do not need to block the Cloudflare/Stripe launch.

1. **Adjust confirmation-page indexing control.** The confirmation page has a correct `noindex` meta tag, but `robots.txt` also disallows crawling it. A crawler must be allowed to load the page to see its `noindex` instruction. Remove the confirmation path from `robots.txt` and keep the page-level `noindex, nofollow`, or add an `X-Robots-Tag` header.

2. **Validate structured data after deployment.** Test Home, Tutoring, and SAT Bootcamp using Google's Rich Results Test and Schema.org Validator. The single `Course` object is useful semantic markup, but Google's Course-list rich result normally requires at least three courses plus carousel markup. Do not expect a Course rich result from the current one-course site.

Google documentation: [robots meta directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) and [Course structured data](https://developers.google.com/search/docs/appearance/structured-data/course)

### Post-launch SEO/AEO work

The site is technically prepared, but rankings and answer-engine citations also depend on off-site authority and continued content work. After launch:

- [ ] Submit `https://www.pipathacademy.com/sitemap.xml` in Google Search Console.
- [ ] Inspect the four main public URLs in Search Console and request indexing.
- [ ] Confirm `www` is Google's selected canonical hostname.
- [ ] Monitor queries, impressions, click-through rate, indexing, and Core Web Vitals.
- [ ] Keep cohort dates, price, availability, and structured data synchronized.
- [ ] Build genuine reviews, educational references, and relevant backlinks.
- [ ] Maintain the PiPath YouTube channel and link videos to the relevant website pages.
- [ ] Consider a verified Google Business Profile if PiPath wants stronger Research Triangle local visibility and meets Google's eligibility requirements.
- [ ] Add useful question-led pages only when PiPath has genuinely helpful answers, such as SAT Math diagnostics, Desmos strategies, choosing tutoring versus a bootcamp, and preparation timelines.

SEO/AEO does not guarantee rankings or inclusion in an AI-generated answer. The new design has the right technical and content foundation; authority, freshness, external references, and actual search demand determine much of the remaining growth.

## Final go/no-go checklist

Launch only when every item below is checked:

- [ ] Production-safe Cloudflare configuration is committed.
- [ ] Cloudflare preview is owner-approved.
- [ ] Contact and enrollment email alerts both reach `pipathmath@gmail.com`.
- [ ] The complete `$299 USD` sandbox webhook and refund test passes.
- [ ] Stripe account is activated for live payments.
- [ ] Live `$299 USD` Payment Link has the 15-payment cap and correct redirect.
- [ ] Live Stripe webhook destination exists and has a successful delivery.
- [ ] Cloudflare production variables and secrets are complete.
- [ ] The production `pages.dev` deployment works before DNS changes.
- [ ] All DNS records have been backed up.
- [ ] An owner is available for cutover and the controlled live transaction.
