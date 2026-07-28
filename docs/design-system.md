# PiPath Academy design system

Status: Adopted for the SAT experience, Home, Math Tutoring, and Contact.

## Design goals

- Client-facing: lead with the family's problem, the student outcome, and the next action.
- Credible: present Dr. Orlando Ferrer's Duke Math Ph.D. as evidence, not as the entire brand story.
- Focused: keep one primary action per decision point and put schedule and price near the top.
- Academic but warm: use workbook-like rules, paper tones, and precise typography rather than gradients, glass effects, or decorative blobs.
- Consistent: reuse the same header, footer, colors, typography, spacing, buttons, form patterns, and responsive behavior across every page.
- Accessible: preserve semantic headings, keyboard focus, skip links, readable contrast, and reduced friction on mobile.

## Core tokens

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#211f17` | Primary text and strong borders |
| Body text | `#3f403c` | Paragraphs |
| Muted text | `#696a65` | Supporting details |
| PiPath blue | `#00539b` | Primary actions and brand emphasis |
| Dark blue | `#003366` | Hover states and credibility sections |
| Sky blue | `#72ccfe` | Accent rules and focus states |
| Soft sky | `#e8f7ff` | Announcement and supportive callouts |
| Paper | `#f3f1ec` | Section backgrounds |
| Deep paper | `#e8e3dc` | Offset shadows and secondary surfaces |
| White | `#ffffff` | Primary page surface |
| Typeface | Inter | All customer-facing text |
| Content width | `1120px` | Shared maximum page width |

Source of truth in code: `src/styles/global.css`.

## Navigation

Approved shared labels:

1. Home
2. Math Tutoring
3. SAT Math Bootcamp
4. Contact Me

"Math Tutoring" replaces "Tutoring Services." "SAT Math Bootcamp" retains "Math" so families do not mistake it for full-SAT instruction.

The header action is contextual:

- SAT page: Enroll now, leading directly to the family enrollment form.
- Home and Math Tutoring: Book a consultation.
- Contact: Send an inquiry.

A later navigation review may shorten "Contact Me" to "Contact," but that label has not been approved yet.

The announcement and navigation are one sticky header unit. The approved cohort promotion is shared across Home, Math Tutoring, SAT Math Bootcamp, and Contact: "August SAT cohort" with "August 18–September 10 · Live online" and a "View the program" link.

## Information order

The default marketing-page order is:

1. Clear outcome-oriented promise.
2. Audience, format, credibility, and primary action.
3. Fast proof or value summary.
4. Offer details, dates, pricing, or services.
5. How the instruction works.
6. Instructor credibility.
7. Genuine family proof.
8. FAQ and expectation setting.
9. Final primary action with a lower-pressure secondary route.

## CTA hierarchy

- Primary buttons use PiPath blue and state the immediate action.
- Secondary buttons use a white surface and border.
- Consultation is secondary on the SAT page so it does not compete with enrollment.
- Disabled actions must explain why they are unavailable.
- Mobile may use a persistent bottom action when the page has a single high-value conversion.

## Imagery

- Use genuine PiPath/Orlando teaching imagery when available.
- Do not reuse the Duke campus hero image on the redesigned Home page.
- The Duke credential remains prominent in copy.
- Instructor portraits and testimonials must be approved before public launch.
- Visible placeholders are acceptable in private review builds only.

## Content and claims

- Put specific course facts close to the relevant action.
- Explain personalization through diagnostics, targeted practice, and feedback.
- Do not present internal editorial notes as customer copy.
- Khan Academy and DeltaMath may be described as included practice tools, but do not claim a "$145 value" without a supportable, family-relevant basis.
- Approved future wording direction: "Targeted Khan Academy and DeltaMath practice is included at no additional course fee."
- Refund, cancellation, privacy, recording, and attendance language requires owner-approved policy text before launch.

## Responsive and interaction rules

- Design mobile-first for a 320px minimum viewport.
- Avoid horizontally clipped navigation.
- Keep tap targets at least 44px high when practical.
- Anchor targets reserve clearance for the full sticky announcement and navigation unit.
- Interactive disclosure controls expose `aria-expanded` and `aria-controls`.
- Confirmation and private pages must be excluded from indexing.
- Respect `prefers-reduced-motion` when meaningful animation is introduced.

## Home redesign direction

The Home implementation:

- removes the Duke campus banner and uses Orlando's genuine existing portrait;
- uses a dark editorial hero so Home is visually distinct from the SAT course page;
- introduces Orlando directly while preserving his full teaching philosophy and Duke Mathematics Ph.D. context;
- makes a free consultation the primary conversion;
- keeps the “What PiPath believes” positioning statement beside Orlando's portrait;
- places Orlando's education immediately beneath his portrait;
- places genuine PiPath YouTube teaching content in the lower-left of the hero with the teaching-style prompt;
- provides a three-way needs guide for course support, SAT preparation, or an unsure family;
- presents Math Tutoring and the Digital SAT Math Bootcamp as two distinct paths;
- gives the SAT pathway concrete dates, live hours, and targeted practice;
- removes the separate learning-progression and instructor/video sections to shorten the page;
- avoids fabricated testimonials, guarantees, or unsupported monetary-value claims;
- uses Organization, Person, and FAQ structured data plus Home-specific social metadata;
- uses the shared header/footer, relative internal navigation, a compact single-row mobile tab bar, and a consultation bar that appears only after the hero action leaves view.

The content order is:

1. Orlando introduction, portrait, education, genuine teaching video, and consultation action;
2. needs-based starting-point guide;
3. Math Tutoring and SAT pathways;
4. family decision FAQs;
5. consultation close and email alternative.

The current portrait is suitable for local review. Genuine classroom/tutoring imagery may supplement or replace it later when owner-approved assets exist.

## SAT Bootcamp launch direction

The launch version keeps the paid-program page focused on concrete family decisions:

1. Personal-learning-path promise, concise supporting copy, genuine course video, and schedule/consultation actions.
2. Four program facts covering live hours and recordings, group size, tuition, and customized homework.
3. Current cohort dates, schedule, format, and enrollment action.
4. Four-week curriculum overview.
5. “How we prepare students” methodology in two independent columns: 01/02 on the left and 03/04 on the right.
6. Three launch-relevant FAQs.
7. Family enrollment form and lower-pressure consultation route.

The separate instructor section is removed because Orlando's qualification is already established in the hero and Home page. Testimonial markup and styling remain available behind a disabled feature flag until approved family stories are ready; placeholders must not render publicly.

The shared footer identifies PiPath as “Based in North Carolina.” and places the clickable `@PiPathMath` YouTube identity beside the contact email.

## Math Tutoring and Contact launch direction

The July 2026 launch migration keeps these pages deliberately concise:

- Math Tutoring leads with the approved positioning line, “Each student has their own unique path to learning math.”
- A static family-needs panel replaces a more complex interactive recommendation selector.
- One-on-one tutoring remains a single flexible offer for course support, tests, ongoing help, and advanced learning.
- Small-group tutoring remains a secondary offer at `$50 / hour per student`.
- Subjects are organized into foundations, advanced high school, college, and tests/competitions, including SAT, ACT, and AMC-style competition math.
- Teaching proof is not duplicated; Tutoring links to Orlando's instructor and lesson section on Home.
- Testimonials, FAQs, and a detailed session walkthrough are deferred to keep the launch pages short and conversion-focused.
- Contact gives families two immediate paths: book the existing free consultation or send a short inquiry.
- Contact inquiries are submitted to a first-party Cloudflare Function, stored in a separate private Google Sheet `Inquiries` tab, and emailed to PiPath by the existing Apps Script receiver.
- Online service is nationwide. Local in-person availability is described as the Research Triangle / RTP, North Carolina area by request.
