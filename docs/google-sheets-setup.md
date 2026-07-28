# Google Sheets enrollment setup

This is the owner-run setup for connecting PiPath's private enrollment Sheet to the website. It does not make the Sheet public. The Apps Script web app runs as the Sheet owner and accepts only requests carrying a strong shared secret.

Use the private PiPath enrollment spreadsheet created by the owner. Keep it restricted to the owner's personal account and the PiPath account. Do not change it to “anyone with the link,” and do not commit its URL or ID to this public repository.

The spreadsheet ID is the value between `/d/` and `/edit` in its Google Sheets URL. Copy it directly from the private Sheet when completing the Script Property below.

## What the setup creates

The script automatically creates and formats two tabs the first time it receives a valid request:

- `Leads` is the staff-facing enrollment list.
- `Stripe Events` is a small audit/idempotency ledger used to avoid processing the same Stripe event twice.

The original empty `Sheet1` tab can be left alone or removed after the two operational tabs appear.

## Step 1: open Apps Script

1. Open the private enrollment spreadsheet while signed into the Google account that should own the automation.
2. Choose **Extensions > Apps Script**.
3. Rename the Apps Script project to `PiPath Enrollment Receiver`.
4. Open the default `Code.gs` file and remove its sample `myFunction` content.
5. Copy the complete contents of `integrations/google-apps-script/Code.gs` from this repository into the Apps Script editor.
6. Click **Save project**.

The owner does not need to write or edit the script. Copy it exactly so its header schema continues matching the website code and documentation.

## Step 2: create the shared secret

Generate one strong random value locally. In PowerShell, run these three lines:

```powershell
$secretBytes = New-Object byte[] 32
$randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$randomGenerator.GetBytes($secretBytes)
$randomGenerator.Dispose()
[Convert]::ToBase64String($secretBytes)
```

This form works with Windows PowerShell's older .NET runtime as well as newer PowerShell versions. The newer static `RandomNumberGenerator.Fill(...)` method is not available in every Windows PowerShell installation.

Copy the resulting value temporarily into a password manager. Do not put it in email, chat, screenshots, source code, or a project document.

The same value will be stored in two private places:

- Google Apps Script property `PIPATH_SHARED_SECRET`;
- local/Cloudflare server secret `GOOGLE_SHEETS_SHARED_SECRET`.

## Step 3: add Apps Script properties

1. In the Apps Script editor, open **Project Settings** using the gear icon.
2. Scroll to **Script Properties**.
3. Click **Add script property**.
4. Add:
   - Property: `PIPATH_SPREADSHEET_ID`
   - Value: the ID copied from the private Sheet URL
5. Add another property:
   - Property: `PIPATH_SHARED_SECRET`
   - Value: the generated random value
6. Save the properties.

Do not add quotation marks around either value. For `PIPATH_SPREADSHEET_ID`, paste only the ID between `/d/` and `/edit`; do not paste the complete `https://docs.google.com/spreadsheets/...` URL.

## Step 4: deploy the web app

1. In Apps Script, click **Deploy > New deployment**.
2. Next to **Select type**, click the gear and choose **Web app**.
3. Set the description to `PiPath enrollment receiver v1`.
4. Set **Execute as** to **Me**. “Me” must be the account that can edit the spreadsheet.
5. Set **Who has access** to **Anyone**.
6. Click **Deploy**.
7. Google will ask the owner to authorize the script to access the spreadsheet. Confirm the project name and Google account before approving.
8. Copy the **Web app URL** ending in `/exec`. Do not use a test URL ending in `/dev`.

“Anyone” applies to the web-app URL, not to the spreadsheet itself. Cloudflare is a server process and cannot interactively sign into a Google account, so a deployment restricted to the owner or signed-in Google users would redirect Cloudflare to a Google login page instead of accepting the lead. The Sheet stays private and the script still runs as its authorized owner.

Because the endpoint itself is anonymously reachable, the application supplies its own authentication: every write must include the strong `PIPATH_SHARED_SECRET`. The script rejects requests without an exact match. Both the deployment URL and secret remain server-only and HTTPS protects them in transit. The remaining lightweight-design risk is that someone who discovers the URL could send rejected requests and consume some Apps Script quota; use the Google Sheets API with a service account instead if PiPath later requires Google-managed OAuth authentication or encounters endpoint abuse.

If the Google Workspace administrator removes the **Anyone** option, stop here. The fallback is a Google service account using the Sheets API; do not loosen the spreadsheet's sharing permissions.

## Step 5: configure local review

In the ignored `.dev.vars` file, set:

```dotenv
GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/your-deployment-id/exec
GOOGLE_SHEETS_SHARED_SECRET=the-same-random-secret
```

Keep the existing cohort Payment Link setting. A webhook secret is needed only when testing Stripe-to-Sheet payment updates:

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_from_stripe_or_the_stripe_cli
```

The form's build-time switch remains in the ignored `.env` file:

```dotenv
PUBLIC_ENROLLMENT_ENABLED=true
```

Start the complete local Pages/Functions review server:

```powershell
npm run dev:review
```

Open `http://localhost:8788/sat-math-bootcamp/`, submit a clearly labeled test family, and stop when the Stripe page opens. The test lead should appear in the `Leads` tab immediately. The existing July URL is a live Payment Link, so do not use Stripe test-card numbers on it.

## Step 6: configure Cloudflare later

Deployment is a separate gate. When the `croquette` preview is ready, add these as encrypted environment secrets in the Cloudflare Pages project:

- `GOOGLE_SHEETS_WEB_APP_URL`
- `GOOGLE_SHEETS_SHARED_SECRET`
- `STRIPE_WEBHOOK_SECRET`

Add the cohort Payment Link as the server-side variable:

- `STRIPE_PAYMENT_LINK_URL_AUGUST_2026`

Do not prefix any of these names with `PUBLIC_`. Astro exposes `PUBLIC_` variables to browser code.

The Stripe webhook endpoint will later be registered as:

`https://<preview-or-production-host>/api/stripe-webhook`

Subscribe only to the supported event types listed in `docs/enrollment-backend.md`.

## Updating the Apps Script later

Saving edited code does not automatically update an existing versioned deployment.

1. Open **Deploy > Manage deployments**.
2. Select the active web app and click **Edit**.
3. Choose **New version**.
4. Add a concise description and deploy.
5. Keep the existing deployment URL unless Google explicitly replaces it.

Record every production script version in `docs/implementation-log.md`.

## Recovery checks

- If the website reports that it could not save the enrollment, check Apps Script **Executions** for the matching time.
- If no `Leads` tab appears, verify both Script Properties and confirm the deployment executes as the Sheet owner.
- If Apps Script reports `Illegal spreadsheet ID or key`, `PIPATH_SPREADSHEET_ID` probably contains the complete Google Sheets URL. Replace it with only the segment between `/d/` and `/edit`.
- If Apps Script reports `unauthorized`, the Google and Cloudflare/local shared-secret values differ.
- If Apps Script reports a header mismatch, do not reorder automated columns manually. Compare the Sheet header row with `LEAD_HEADERS` in `Code.gs`.
- If a payment is visible in Stripe but not marked paid in the Sheet, inspect Stripe's webhook delivery and the `Stripe Events` tab. Stripe remains the financial source of truth.

## Official references

- Google Apps Script web apps: https://developers.google.com/apps-script/guides/web
- Google Sheets Apps Script service: https://developers.google.com/apps-script/reference/spreadsheet
- Google Apps Script Lock Service: https://developers.google.com/apps-script/reference/lock
- Stripe webhooks: https://docs.stripe.com/webhooks
- Stripe Payment Link tracking and `client_reference_id`: https://docs.stripe.com/payment-links/url-parameters
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Cloudflare Pages Functions pricing: https://developers.cloudflare.com/pages/functions/pricing/
