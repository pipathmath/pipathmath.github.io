# PiPath Google Apps Script

`Code.gs` is the server-side receiver that writes validated website leads and verified Stripe payment updates into the private PiPath enrollment spreadsheet.

Do not edit the script to insert a spreadsheet ID or secret. Both values belong in Apps Script **Project Settings > Script Properties**:

- `PIPATH_SPREADSHEET_ID`
- `PIPATH_SHARED_SECRET`

The matching Cloudflare secrets are documented in `docs/google-sheets-setup.md`. Deploy the script as a Web app that executes as the spreadsheet owner. The Sheet stays private; only the web-app endpoint accepts server-to-server requests carrying the shared secret.
