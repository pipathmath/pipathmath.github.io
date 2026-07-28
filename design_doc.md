# PiPath Academy platform design document

This original planning document has been preserved from the OneDrive working copy. Current implementation status and revised sequencing are tracked separately:

- [Project plan](docs/project-plan.md)
- [Implementation log](docs/implementation-log.md)
- [Design system](docs/design-system.md)
- [Current enrollment architecture](docs/enrollment-backend.md)
- [Google Sheets architecture decision](docs/decisions/0001-google-sheets-enrollment.md)

Revision notice (2026-07-27): the original D1-first P3/Batch 2 plan below is historical and has been superseded for the current launch scale. The active system captures the family lead first, stores operations in a private Google Sheet through Cloudflare and Apps Script, then redirects to an owner-supplied Stripe Payment Link. A form submission does not reserve a seat; accepted payment under Stripe's configured cap confirms the seat. D1 and an owner dashboard remain future options rather than launch dependencies.

---

The right strategy is to launch a complete paid SAT enrollment system first, while building the framework so it can later support other bootcamps and the parent portal.
The portal should not delay the August bootcamp launch.
Priority Overview
Priority
Deliverable
Launch Required?
P0
Requirements, policies, and content
Yes
P1
Astro/React framework foundation
Yes
P2
New SAT bootcamp experience
Yes
P3
Stripe checkout and D1 enrollment
Yes
P4
Syllabus access and Orlando admin tools
Yes
P5
Remaining page migration
Yes
P6
SEO, advertising, testing, and security
Yes
P7
Cloudflare hosting cutover
Final launch step
P8
Full parent portal
Post-launch

P0 — Lock Requirements
Before coding, we define exactly what the enrollment system must do.
Decisions
Confirm cohort capacity: exactly 8, 10, or another number.
Confirm cancellation and refund policy.
Decide what materials parents receive immediately after payment.
Confirm the student onboarding fields:
First and last name
Grade
School, if needed
Current SAT/PSAT Math score
Target score
Areas of difficulty
Decide whether recordings remain available after the program.
Decide how long parent/student records should be retained.
Confirm the email address receiving new-enrollment notifications.
Confirm Orlando’s Google email for protected admin access.
Content
Collect:
Current syllabus Google Doc
Orlando biography and credentials
Instructor photos
Genuine testimonials
Refund and attendance policies
Zoom/recording language
Privacy policy information
Stripe account and existing products/payment links
Deliverable
A short launch specification describing the page, checkout, required fields, database records, emails, syllabus access, and policies.
P1 — Framework Foundation
We rebuild the site with Astro + TypeScript, using React where interactivity is valuable.
Work
Create the Astro project inside croquette.
Establish the project structure for:
Pages
Shared layouts
Navigation and footer
UI components
Styles and design tokens
Content
Server endpoints
Database access
Create responsive typography, colors, spacing, buttons, cards, forms, and alerts.
Add React components for:
Cohort selection
Checkout interactions
Post-payment onboarding
Admin tools
Future portal interfaces
Configure separate development and production environment variables.
Configure Cloudflare preview deployments.
Keep the current GitHub Pages website fully live.
Preserve analytics during the migration.
Establish clean URLs and redirects from existing .html paths.
Definition of Done
The new application builds successfully, deploys to a private/preview Cloudflare URL, and does not affect the public domain.
P2 — SAT Bootcamp Redesign
This is the first and most important customer-facing feature.
Page Structure
Announcement bar promoting the next cohort.
Modern header with View Schedule and Enroll — $299.
Hero section emphasizing:
Digital SAT Math
Dr. Orlando Ferrer
Small group size
Personalized instruction
Live online format
Quick-value row:
8 live classes
10 instructional hours
Personalized homework
Recordings available
Schedule cards near the top.
Curriculum timeline.
Explanation of diagnostics and personalization.
Desmos and test-strategy section.
Instructor credibility.
Testimonials.
FAQ.
Refund/attendance summary.
Final enrollment CTA.
Sticky mobile enrollment button.
First Cohort
August Digital SAT Math Bootcamp
August 18–September 10, 2026
Tuesdays and Thursdays
7:00–8:15 PM ET
Eight sessions
Ten total hours
Live online
$299
Session dates:
August 18, 20, 25, and 27
September 1, 3, 8, and 10
Cohort URLs
Create a permanent general page:
/sat-math-bootcamp
And a cohort-specific page:
/sat-math-bootcamp/august-2026
Advertising can point directly to the cohort page, while the general page remains useful after the cohort ends.
Definition of Done
A parent can understand the course, compare available dates, and reach Stripe Checkout from any major section of the page—especially on mobile.
P3 — Stripe and D1 Enrollment
Payment becomes the enrollment event. There is no registration form before checkout.
Checkout
Parent selects a cohort.
Enroll — $299 calls a secure checkout endpoint.
The server verifies that the cohort is open.
It creates a Stripe Checkout Session.
The cohort ID and marketing attribution are attached to the session.
Parent is redirected immediately to Stripe.
Stripe collects parent name, email, phone, and payment.
Stripe handles the card information; PiPath never stores it.
Database
Create D1 tables for:
parents
students
cohorts
enrollments
payments
inquiries
access_tokens
audit_events
The first release only needs the essential columns, but the relationships will support the future portal.
Stripe Webhook
After payment:
Verify Stripe’s signature.
Prevent duplicate processing.
Create or update the parent.
Record the payment.
Create the paid enrollment.
Reduce available capacity.
Generate syllabus access.
Send Orlando an enrollment notification.
Send the parent confirmation and next steps.
Refunds and failed/delayed payments will update the enrollment status appropriately.
Post-Payment Onboarding
The confirmation page says “You’re enrolled” before asking for anything else.
A short optional-but-prominent form then collects the student’s academic information. Parents can complete it immediately or through the confirmation email later.
Definition of Done
A complete Stripe test payment reliably creates exactly one enrollment record, sends the correct communications, and displays the correct confirmation.
P4 — Syllabus and Orlando Admin Tools
Syllabus Migration
Archive the original Google Doc.
Convert it into structured website content.
Preserve headings, links, tables, and downloadable materials.
Add mobile-friendly and printable layouts.
Associate each syllabus with a cohort.
Store private documents outside the public GitHub repository.
Parents receive syllabus access through:
The payment confirmation page
A confirmation email
A secure reusable access link
Later, the parent portal
Orlando Admin
Create a protected /admin area where Orlando can:
Add a new cohort
Duplicate a previous cohort
Enter start/end dates
Add individual session dates
Set time and timezone
Set capacity and price
Mark a cohort open, full, waitlisted, or closed
Edit syllabus sections
Upload documents
View paid enrollments
Export enrollment records
Review incomplete student onboarding
The first editor should use structured fields, not an overly complicated word processor.
Definition of Done
Orlando can create the next bootcamp and update its syllabus without touching source code or SQL.
P5 — Complete the Framework Migration
After the SAT flow works, migrate the remaining existing pages:
Homepage
Tutoring services
Contact
Resume/about
Other program pages
Legal and privacy pages
Each page will use the same navigation, footer, visual system, analytics, metadata, and responsive behavior.
Old URLs will redirect to their new equivalents so existing links and search rankings are not lost.
P6 — SEO, Advertising, and QA
SEO
Unique page titles and descriptions.
Canonical URLs.
XML sitemap and robots configuration.
Open Graph and social-preview images.
Organization, instructor, course, event, and FAQ structured data where eligible.
Clean heading structure.
Internal links between SAT, tutoring, instructor, and contact pages.
Accessible image descriptions.
Search Console verification.
Redirect testing.
No indexing for admin, confirmation, or private pages.
Marketing Measurement
Track:
Bootcamp page views
Schedule views
Cohort selections
Checkout starts
Successful purchases
Onboarding completion
Contact inquiries
Capture:
UTM source, medium, campaign, and content
Google click identifiers
Landing page
Referring page
Cohort purchased
Purchase value
The successful Stripe payment—not a button click—will count as the primary conversion.
QA
Test:
Desktop, tablet, and mobile
Safari, Chrome, Edge, and Firefox
Stripe test payments
Duplicate webhook delivery
Refund behavior
Full/waitlist behavior
Emails and secure links
Admin permissions
Database exports
Keyboard navigation
Screen-reader labels
Page speed
Analytics and ad conversion events
Privacy and consent behavior
Orlando completes a final acceptance test before launch.
P7 — Cloudflare Cutover
Only after everything passes review:
Merge the approved work into main.
Complete the final Cloudflare production build.
Configure the custom domain.
Verify SSL and redirects.
Change DNS from GitHub Pages to Cloudflare.
Submit the updated sitemap.
Test live Stripe enrollment.
Monitor errors, payments, analytics, and search indexing.
Keep GitHub Pages available temporarily as a rollback option.
Retire the old hosting after the new site is stable.
P8 — Parent Portal
This becomes the next major release after enrollment is operating successfully.
Portal Features
Passwordless email login
View enrolled bootcamps
Open syllabus and resources
Complete student profile
View schedule and Zoom information
Download documents
Review payment history
Update parent contact information
Later Enhancements
Attendance
Homework links
Instructor notes
Progress summaries
Recordings
Multiple children under one parent
Returning-family enrollment
Discounts and promotional codes
The database will be designed now so these features do not require rebuilding the enrollment system later.
We should implement in grouped vertical slices, not strictly one task at a time and not everything simultaneously. Each group produces something testable before moving forward.

Implementation Batches
Batch 1 — Foundation + SAT UI
Build together:
Astro/React framework and Cloudflare preview
Shared design system, navigation, and footer
Redesigned SAT landing page
Four visual “What We Cover” blocks
August cohort schedule card
Placeholder testimonials, photos, and policy components
Responsive desktop/mobile design
Checkpoint: You and Orlando review the complete visual experience before backend work.
Batch 2 — Payment + Enrollment Database
Build together because they form one transaction:
D1 development database
Stripe test checkout
Parent name, email, and phone collection
Stripe webhook
Paid enrollment record
Student onboarding using the current Google Form questions
Confirmation page
Email notifications to pipathmath@gmail.com
Marketing attribution and purchase tracking
Checkpoint: We complete a test purchase and confirm that Stripe, D1, emails, and onboarding all agree.
Batch 3 — Owner Tools + Private Syllabus
Build together:
Protected Orlando admin area
Add/edit cohorts and session dates
Adjustable capacity and status
Enrollment list and CSV export
Private syllabus storage and secure access links
Syllabus upload/editing workflow
Placeholder private syllabus until the final document is uploaded
Checkpoint: Orlando creates a sample second cohort without editing code.
Batch 4 — Full-Site Migration + Marketing
Migrate homepage, tutoring, contact, resume, and remaining pages
Redirect old URLs
Titles, descriptions, canonical URLs, sitemap
Course and cohort structured data
GA4 and Google Ads purchase conversions
UTM attribution
Consent/privacy implementation
Performance and accessibility testing
Batch 5 — Launch
Final Stripe live-mode test
Final content and policy approval
Remove or replace all visible placeholders
Merge to main
Connect the custom domain to Cloudflare
Change DNS
Monitor payments, analytics, errors, and indexing
Capacity Handling
We’ll make capacity editable per cohort because it may vary between 10 and 15. For the August cohort, Stripe needs one hard maximum to prevent overselling. I recommend setting the technical cap to 15 and marketing it as:
Small-group instruction, limited to 15 students.
SEO, accessibility, mobile behavior, and analytics will be built throughout—not postponed until the end. The first actual development batch will therefore be the framework and SAT page together.
