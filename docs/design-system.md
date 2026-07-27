# PiPath Academy design system

Status: Adopted for the SAT experience and Home. Math Tutoring and Contact remain on the legacy system until their approved migration gates.

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
- Anchor targets reserve clearance for the sticky announcement bar.
- Interactive disclosure controls expose `aria-expanded` and `aria-controls`.
- Confirmation and private pages must be excluded from indexing.
- Respect `prefers-reduced-motion` when meaningful animation is introduced.

## Home redesign direction

The Home implementation:

- removes the Duke campus banner and uses Orlando's genuine existing portrait;
- uses a dark editorial hero so Home is visually distinct from the SAT course page;
- leads with the family's need for clearer, personalized math instruction;
- makes a free consultation the primary conversion;
- provides a three-way needs guide for course support, SAT preparation, or an unsure family;
- presents Math Tutoring and the Digital SAT Math Bootcamp as two distinct paths;
- gives the SAT pathway concrete dates, live hours, and targeted practice;
- explains the PiPath learning progression before presenting instructor credentials;
- pairs Orlando's Duke credential with genuine PiPath YouTube teaching content rather than a campus image;
- avoids fabricated testimonials, guarantees, or unsupported monetary-value claims;
- uses Organization, Person, and FAQ structured data plus Home-specific social metadata;
- uses the shared header/footer, relative internal navigation, responsive two-by-two mobile navigation, and a consultation bar that appears only after the hero action leaves view.

The content order is:

1. family-centered promise and consultation action;
2. needs-based starting-point guide;
3. Math Tutoring and SAT pathways;
4. learning progression;
5. instructor credibility and genuine teaching content;
6. family decision FAQs;
7. consultation close and email alternative.

The current portrait is suitable for local review. Genuine classroom/tutoring imagery may supplement or replace it later when owner-approved assets exist.
