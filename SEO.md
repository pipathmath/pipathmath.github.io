# PiPath Academy — SEO / AEO Round 1

**Branch:** `seo-aeo-round1`
**Scope:** Technical SEO + AEO foundation. **Additive metadata only** — no visible layout, text, color, or image changes.
**Status:** Complete, pending commit. Live site (served from `main`) is unaffected.

---

## TL;DR for the owner

Every change in this round is **invisible to a human visitor** and aimed at the machines that read the site: Google's crawler and AI answer engines (ChatGPT, Claude, Perplexity, Google AI Overviews). The work lives in the `<head>` of each page plus a few new behind-the-scenes files. The site looks identical on purpose — we changed the *label on the box*, not the contents, so search and AI engines can finally tell **who this site is**, **what it offers**, and **how to describe it**.

To confirm nothing visible changed: open any page and view source (Ctrl+U) — the new tags are in the `<head>`; the visible page is untouched.

---

## The brand-search problem we found and fixed

**Symptom:** searching `pipath academy` (two words) did **not** surface the site, but `pipathacademy` (one word) did.

**Cause:** before this round, the exact phrase "PiPath Academy" appeared **nowhere** on the site — not in a title, heading, or paragraph. The only brand text was "PiPath", "PiPath's Digital SAT Math Bootcamp", and the YouTube handle "@PiPathMath". So:

- `pipathacademy` → matches the domain token in `pipathacademy.com` → site appears. ✅
- `pipath academy` → no page contained the phrase and no data declared the site *is* that entity → Google had no basis to connect the query. ❌

**Fix:** "PiPath Academy" is now the declared official business name in every page title and in the structured data, with `PiPath` and `PiPath Math` registered as official aliases. This is the most important correction in this round.

> **Honest expectation:** this is necessary but not instant. Google must re-crawl and re-index before the two-word brand query starts resolving — typically days to a few weeks. The fastest accelerant is verifying the site in **Google Search Console** and submitting the new sitemap (see Roadmap).

---

## Exactly what changed

### Files edited (additive only — no deletions, no layout edits)

| File | What was added |
|---|---|
| `index.html` | Keyword-shaped `<title>` + meta description; canonical tag; Open Graph / Twitter social-share tags; favicon links; **JSON-LD identity block** declaring the organization (*PiPath Academy*, aliases `["PiPath","PiPath Math"]`), the person (*Dr. Orlando Ferrer*, linked to LinkedIn & YouTube), and the website. |
| `tutoring.html` | Title, description, canonical, social tags, favicon; JSON-LD `Service` + `OfferCatalog` describing the rate tiers (one-on-one, admissions coaching, small group, bootcamp). |
| `sat_math_bootcamp_page.html` | Title, description, canonical, social tags, favicon; JSON-LD `Course` + `CourseInstance` (dates, online format, ~10-hour workload, instructor, $299 price). |
| `contact.html` | Title, description, canonical, social tags, favicon; JSON-LD `ContactPage`. |
| `resume.html` | Title fix + `noindex, follow` (keeps the personal résumé out of search results); favicon. |

### New files

| File | Purpose |
|---|---|
| `robots.txt` | Allows standard crawlers and **explicitly welcomes AI crawlers** (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended); points to the sitemap. |
| `sitemap.xml` | Map of the four public pages (home, tutoring, bootcamp, contact) so engines discover and prioritize them. |
| `favicon.ico` | Multi-size (16/32/48) browser-tab icon, generated from the PiPath π logo (`favicon.jpg`). |
| `favicon.png` | 32×32 PNG icon. |
| `apple-touch-icon.png` | 180×180 icon for iOS home-screen / link previews. |

All structured data was validated as well-formed JSON before sign-off. All changes are additive and fully reversible.

---

## The strategy, in plain terms

Two audiences, one foundation.

### SEO — being found and described correctly in Google
- **Identity:** one consistent business name (PiPath Academy) with declared aliases, so every brand query resolves here.
- **Relevance:** titles and descriptions written around real searches (*math tutor, SAT math, Apex NC, online calculus*) instead of generic labels.
- **Crawlability:** a sitemap and robots file so engines find every page and re-index after changes.

### AEO — being quoted accurately by AI answer engines
When someone asks an AI "who's a good SAT math tutor near Apex?", these systems prefer sources whose facts are **structured and unambiguous**. The JSON-LD we added states, in a format AI reads directly: who runs the business, the credentials (Duke Math PhD), the services, the bootcamp dates/price, and the service area. That is what gets a business named in an AI answer instead of skipped.

### Entity model adopted
**PiPath Academy** = the organization. **Dr. Orlando Ferrer** = founder/instructor, linked to it and to LinkedIn + YouTube. Every page reinforces the same two-part identity. Consistency is what builds trust with Google and AI engines over time.

---

## What's still missing — roadmap (rough priority order)

| Item | Owner | Why it matters |
|---|---|---|
| **Google Search Console** — verify domain + submit sitemap | Owner action (~15 min) | Highest impact. Requests re-crawl and lets us watch the brand query start resolving. |
| **FAQ content** (Round 2) on tutoring + bootcamp pages | Needs approved copy | Highest-value *visible* change for AEO — FAQs are what AI engines quote most. |
| **Keyword-targeted copy** (Round 2) | Needs approved copy | Light expansion for local + subject searches (e.g. "online calculus tutor", "Apex NC SAT prep"). |
| **Off-site name consistency** | Owner action | Use "PiPath Academy" on YouTube, LinkedIn, and directories so the identity is corroborated across the web. |
| **Image performance** | Quick technical fix | `Duke_img.jpeg` is ~4.8 MB. Compressing large images improves page speed (a ranking + mobile factor). |
| **Minor cleanup** | Quick fix | Stray `}` in `contact.html` CSS (harmless, browsers ignore it). |

---

## Notes for whoever picks this up next

- **Push target:** remote is `github.com/pipathmath/pipathmath.github.io`. Push only to a **non-`main`** branch (`seo-aeo-round1`); GitHub Pages publishes from `main`, so the live site changes only on merge.
- **Local preview:** `python -m http.server 8000` from the repo root, then open `http://localhost:8000`.
- **Validate structured data:** paste a page's URL into Google's Rich Results Test (`search.google.com/test/rich-results`) after the branch is live.
