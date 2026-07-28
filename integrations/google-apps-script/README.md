# PiPath Google Apps Script

`Code.gs` is the server-side receiver that writes validated website leads, contact inquiries, and verified Stripe payment updates into the private PiPath spreadsheet. Contact inquiries are stored in a separate `Inquiries` tab and trigger an email notification.

Do not edit the script to insert a spreadsheet ID or secret. Both values belong in Apps Script **Project Settings > Script Properties**:

- `PIPATH_SPREADSHEET_ID`
- `PIPATH_SHARED_SECRET`

Optional:

- `PIPATH_INQUIRY_EMAIL` — notification destination for website inquiries. If omitted, the script uses `pipathmath@gmail.com`.

The matching Cloudflare secrets are documented in `docs/google-sheets-setup.md`. Deploy the script as a Web app that executes as the spreadsheet owner. The Sheet stays private; only the web-app endpoint accepts server-to-server requests carrying the shared secret.

After adding inquiry support, create a new deployment version or edit the existing deployment to use the new version. Google may ask the spreadsheet owner to authorize email sending. The `Inquiries` tab is created automatically on the first request after deployment.
