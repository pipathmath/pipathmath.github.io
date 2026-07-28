# Math Tutoring and Contact launch

## Scope

This launch intentionally keeps both pages short and focused on inquiries rather than creating a complete tutoring content library.

### Math Tutoring

- Approved positioning: “Each student has their own unique path to learning math.”
- Primary action: book the existing free 15-minute consultation.
- Secondary action: open Contact with the appropriate inquiry topic preselected.
- The family-needs panel is static. It helps visitors recognize fit without generating separate recommendations or requiring JavaScript.
- One-on-one tutoring is one flexible offer covering current coursework, homework, exams, ongoing support, and advanced learning.
- Small-group tutoring remains a separate `$50 / hour per student` offer.
- Admissions Coaching remains a third service block with its own preselected contact inquiry path.
- Subject coverage includes school and college math, SAT/ACT Math, and AMC/competition math.
- Teaching proof stays on Home; the credential strip links to `/#instructor`.
- Testimonials, FAQs, and a session walkthrough are deferred.

### Contact

- Visitors can book the consultation, email `pipathmath@gmail.com`, or submit the inquiry form.
- Contact uses the direct headline “Speak with us directly” and a concise “Free 15-Minute Zoom Consultation” action labeled “Book now.”
- `?topic=math-tutoring`, `?topic=small-group`, `?topic=admissions-coaching`, and `?topic=sat-bootcamp` preselect the relevant form option.
- The form asks for contact details and inquiry type. Student grade/course and a message are optional.
- No response-time promise is displayed.

## Inquiry storage and notification

The browser sends inquiry data to the same-origin `/api/inquiry` Cloudflare Pages Function. The Function validates and sanitizes the request, rejects cross-origin submissions, ignores a hidden spam honeypot, generates the inquiry ID on the server, and forwards the inquiry to the authenticated Google Apps Script receiver.

Apps Script:

1. archives the record in the private spreadsheet's separate `Inquiries` tab;
2. sets `follow_up_status` to `New`;
3. sends an email notification to `PIPATH_INQUIRY_EMAIL`, or to `pipathmath@gmail.com` when that optional property is absent;
4. records whether the email notification was sent without deleting or rolling back the archived inquiry if email fails.

New enrollment leads also send an alert to the same destination. An email-delivery failure never removes a saved lead or inquiry and never prevents a successfully saved family lead from continuing to Stripe.

Names, email addresses, phone numbers, student details, and message text are not sent to Google Analytics. A successful browser submission records only the generic `generate_lead` event and inquiry type.

## Required owner launch step

The inquiry form will not work against the older deployed Apps Script version.

1. Copy the current `integrations/google-apps-script/Code.gs` into the existing Apps Script project.
2. Save the project.
3. Open **Deploy > Manage deployments**.
4. Edit the active web app, choose **New version**, and deploy it.
5. Approve the email-sending permission if Google requests it.
6. Keep the existing `/exec` deployment URL.
7. Submit one labeled test inquiry from the Cloudflare preview or production candidate.
8. Confirm the private `Inquiries` row and notification email before launch.

Do not submit the test through a static Astro preview: `/api/inquiry` requires the Cloudflare Pages Functions review server (`npm run dev:review`) or a Cloudflare deployment.

## Routing and release checks

- New routes: `/tutoring` and `/contact`.
- `/tutoring.html` and `/contact.html` redirect permanently to the new routes.
- Shared Home and navigation links point to the clean routes.
- Local service language uses the Research Triangle / RTP, North Carolina area by request.
- Confirm desktop and mobile layout, keyboard navigation, required-field validation, failure recovery, email fallback, redirect behavior, and Google Sheet/email delivery before production cutover.
