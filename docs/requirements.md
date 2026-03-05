# Koemerle — Menu Plan App: Requirements

> Status: Draft — work in progress
> Authors: Joro (dev), Girlfriend (PO)

---

## 1. Overview

A weekly menu planning app for two people. The user selects meals for the week based on a weekly vegetable basket delivery and automatically generates a shopping list that is pushed to the Bring! shopping list app.

---

## 2. Core Features

### 2.1 Meal Planning
- Plan meals on a weekly basis
- [ ] Define: what counts as a "meal"? (lunch, dinner, both?)
- [ ] Define: can a meal appear multiple times in a week?
- [ ] Define: how far in advance can you plan? (current week only, or multiple weeks?)

### 2.2 Vegetable Basket Integration
- The weekly basket is delivered by a local box service
- The basket contents are visible on the service's website
- No delivery email with upcoming basket contents — only a confirmation email after delivery
- **To investigate:** Does the service offer a public API?
- **Fallback option:** Parse the basket contents from their website (web scraping)
- **Fallback fallback:** Manual input form for basket contents
- Basket contents should influence meal suggestions or filter available meals

### 2.3 Shopping List
- Generate a shopping list from the planned meals
- One-click push to Bring! shopping list app
- Uses the unofficial Bring! API (Node.js library: `bring-api`)
- No manual re-entry required

### 2.4 Meals & Recipes
- [ ] To be defined by the PO: meal database, favourites, categories, tags, etc.
- [ ] To be defined: ingredient management
- [ ] To be defined: recipe steps / instructions needed, or just ingredient lists?

---

## 3. Non-Functional Requirements

### 3.1 Users
- Exactly two users (couple)
- Simple email/password authentication
- No public registration

### 3.2 Platforms
- Desktop web browser (primary)
- iPhone via Safari — Progressive Web App (PWA), add-to-homescreen
- No native app needed

### 3.3 Constraints
- No Google services
- No Amazon services
- No Microsoft services
- Deployment must be manageable by a non-developer

---

## 4. Tech Stack Options

Two variants are on the table. The PO chooses.

---

### Variant A: SvelteKit Full-Stack

Everything in one project. Frontend and backend API routes live together.

| Layer | Technology | Notes |
|---|---|---|
| Framework | SvelteKit (TypeScript) | Full-stack, file-based routing, HTML-like component syntax |
| Database | PostgreSQL | Hosted on Railway |
| ORM | Drizzle | SQL-like, easy to read |
| Auth | Lucia or Supabase Auth | Simple email/password for 2 users |
| Deployment | Railway | One platform for app + DB, auto-deploy from GitHub |
| Mobile | PWA via `@vite-pwa/sveltekit` | Works as homescreen app on iPhone |
| Bring! | `bring-api` npm package | Push shopping list with one click |

**Pros:**
- Single codebase, single deployment platform
- No context switching between languages
- SvelteKit component syntax is close to plain HTML — readable for beginners

**Cons:**
- TypeScript/JavaScript only — less familiar for someone with a Python background
- Requires learning SvelteKit conventions (file naming: `+page.svelte`, `+page.server.ts`)

**Railway note:** ~$5/month after free trial. Everything (app + DB) in one place, no cold starts.

---

### Variant B: SvelteKit Frontend + Python (FastAPI) Backend

Frontend and backend are separate projects/services.

| Layer | Technology | Notes |
|---|---|---|
| Frontend | SvelteKit (TypeScript) | UI only, talks to FastAPI via REST |
| Backend | FastAPI (Python) | REST API, business logic, DB access |
| Database | PostgreSQL | Hosted on Supabase (free tier) |
| ORM | SQLAlchemy or SQLModel | Python-native, SQL-familiar |
| Auth | Supabase Auth | Shared between frontend and backend |
| Deployment (frontend) | Vercel | Free tier, auto-deploy from GitHub |
| Deployment (backend) | Railway or Render | Python container, free/cheap |
| Mobile | PWA via `@vite-pwa/sveltekit` | Same as Variant A |
| Bring! | Python `bring-api` port or HTTP calls | Handled in FastAPI |

**Pros:**
- Backend in Python — more familiar for the PO
- FastAPI is beginner-friendly, self-documenting (auto-generates API docs)
- Clear separation of concerns

**Cons:**
- Two codebases to manage and deploy
- Two platforms to maintain
- More moving parts = more things that can break

---

## 5. Deployment Comparison

| | Railway (Variant A) | Vercel + Supabase (Variant B) |
|---|---|---|
| DB hosting | Built-in PostgreSQL | Supabase (separate platform) |
| Cost | ~$5/month hobby plan | Both free tiers, $0 for 2 users |
| Cold starts | No (persistent containers) | Vercel functions have minor cold starts |
| Simplicity | One platform, one login | Two platforms, two dashboards |
| Non-techie friendly | Yes | Yes (Vercel especially) |
| DB visual UI | Basic | Supabase has an excellent table editor |

---

## 6. Integrations

### 6.1 Bring! Shopping List App
- Library: `bring-api` (npm, unofficial but maintained)
- Capability: add items to a shared list programmatically
- Trigger: user clicks "Send to Bring" after finalizing the meal plan
- Auth: Bring account credentials stored server-side (env variable)

### 6.2 Vegetable Basket Service
- Provider: [biogmuesabo.ch](https://biogmuesabo.ch/)
- Status: **Partially investigated**

**Findings:**
- Custom-built AngularJS platform — not Shopify/WooCommerce, no standard integration
- Has an internal `ACM` API (proprietary), not publicly documented
- All content requires an authenticated session — no public basket page

**Next step:** Re-check browser network tab (DevTools) during a week with an active delivery — the basket page was empty during initial investigation so no basket-related API calls were visible. Check what calls appear when the basket actually has content.

**Integration options (in order of preference):**
1. **ACM API with session auth** — if network inspection reveals a clean JSON endpoint, call it with a stored session cookie (to be investigated)
2. **Web scraping with login** — log in programmatically, parse the basket page HTML. Doable but fragile if the site changes.
3. **Manual input form** — user enters basket contents in the app once per week. Simple and reliable.

**MVP:** Manual input (option 3). API/scraping as post-MVP enhancement once investigated.

---

## 7. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Which tech stack variant? (A or B) | PO | Open |
| 2 | Does the veggie basket service have an API? | Dev | Open |
| 3 | What counts as a "meal"? Lunch, dinner, both? | PO | Open |
| 4 | Ingredient management: how detailed? | PO | Open |
| 5 | Do we need recipe steps or just ingredient lists? | PO | Open |
| 6 | Can meals repeat within a week? | PO | Open |
| 7 | How many weeks ahead should planning go? | PO | Open |
| 8 | Does biogmuesabo.ch expose basket contents via API? Re-check network calls during active delivery week. | Dev | Pending |

---

## 8. MVP Scope (Suggestion)

The following is a suggested minimal first version to get something working quickly:

1. Create/edit meals with ingredients
2. Plan meals for the current week
3. Generate shopping list from the week's meals
4. Push shopping list to Bring! with one click
5. Manual input for the vegetable basket (skip integration for MVP)
6. Login for two users

Everything else (basket integration, favourites, meal suggestions, history) comes after.
