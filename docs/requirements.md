# Koemerle — Menu Plan App: Requirements

> Status: Draft — updated with PO decisions
> Authors: Joro (dev), Girlfriend (PO)

---

## 1. Overview

A weekly menu planning app for two adult users managing meals for a household of **two adults and two small children**.

The app should:

1. take the ingredients from the weekly vegetable basket delivery,
2. check which recipes from the stored recipe selection can be cooked based on those ingredients,
3. auto-fill lunches and dinners throughout the current week where suitable recipes are available,
4. generate the missing shopping ingredients for the selected meals, and
5. add those missing ingredients to the shared Bring! shopping list.

A recipe does **not** need to be fully covered by the basket. It only needs to use **at least one basket ingredient**.

The goal is to make weekly meal planning and shopping list creation require almost no manual effort.

---

## 2. Core Features

### 2.1 Meal Planning

* Plan meals on a **weekly basis**
* Fixed weekly structure:

  * **Monday to Sunday**
  * Each day has **Lunch** and **Dinner**
  * **Exception:** **Thursday lunch is not required**
* Planning horizon for MVP:

  * **Current week only**
  * Week starts on **Monday**
* A meal **cannot appear multiple times within the same week**
* The app should **auto-fill the week** based on suitable recipes
* If there are not enough suitable recipes to fill all meal slots, the remaining slots should stay empty

### 2.2 Vegetable Basket Integration

* The weekly basket is delivered by a local box service
* The basket contents are the starting point for weekly meal planning
* The app should use the basket ingredients to determine which recipes from the existing recipe selection are possible or suitable
* A recipe is considered suitable if it uses **at least one ingredient from the basket**
* The basket contents are visible on the service's website
* No delivery email with upcoming basket contents — only a confirmation email after delivery
* **To investigate:** Does the service offer a public API?
* **Fallback option:** Parse the basket contents from their website (web scraping)
* **Alternative fallback if API and scraping do not work:** Upload of a screenshot of the basket contents
* **Final fallback:** Manual input form for basket contents
* Basket contents should influence recipe matching and meal planning

### 2.3 Shopping List

* Generate a shopping list from the planned meals
* The shopping list should contain only ingredients that are still missing after considering:

  * basket ingredients
  * excluded pantry staples
* **Merge duplicate ingredients automatically**
* One-click push to Bring! shopping list app
* Uses the unofficial Bring! API (Node.js library: `bring-api`)
* No manual re-entry required
* Send behavior:

  * **Append missing items only**
  * Do **not** overwrite the existing list
* MVP:

  * Shopping list is **not editable before sending**

### 2.4 Meals & Recipes

* The app contains a selection of recipes/meals that can be used for planning
* For MVP, each meal contains:

  * **Meal name**
  * **Ingredients** as free text
  * **Link to recipe** (if available)
* The app should check which recipes can be used based on the available basket ingredients
* No favourites in MVP
* No categories/tags in MVP
* No recipe steps/instructions stored in the app in MVP
* Ingredient handling for MVP:

  * **Free text only**
  * Quantities included where relevant
  * Duplicate ingredients should be merged in the shopping list
* Ingredient matching in MVP may be approximate because ingredient data is stored as free text

### 2.5 Ingredient Matching Logic

* Ingredient matching should use a simplified internal comparison value for each ingredient
* Each ingredient should keep:

  * a **display text** (for example: `2 large carrots`)
  * a **normalized match key** (for example: `carrot`)
* Ingredients are entered and stored in **German**
* Matching should normalize ingredient values where possible, including:

  * lowercase conversion
  * removal of punctuation
  * singular/plural normalization where feasible (German rules)
  * simplification of quantity-based phrasing where feasible
* A recipe is considered suitable if **at least one recipe ingredient match key** matches a basket ingredient match key
* For auto-fill, recipes with **more basket ingredient matches** should be preferred over recipes with fewer matches
* MVP matching may use a small synonym/alias list for common German ingredient variants where useful
* MVP matching should stay simple and deterministic, not AI-based

### 2.6 Weekly Planning Flow

* The weekly flow should work as follows:

  1. Import basket contents
  2. Compare basket contents with stored recipes
  3. Select suitable recipes that use at least one basket ingredient
  4. Auto-fill the fixed weekly meal plan
  5. Leave remaining slots empty if there are not enough suitable recipes
  6. Allow the user to complete empty slots manually by either:

     * typing a meal name directly into the empty slot (free-text, no ingredients — not saved as a recipe in MVP), or
     * selecting a recipe from the stored recipe set

     **Future:** The free-text path should be easy to extend so the app can prompt the user to save the meal as a recipe (with optional ingredients and link). This is out of scope for MVP but the code should make this upgrade straightforward.
  7. Generate a shopping list for the remaining required ingredients
  8. Append missing items to the shared Bring! list

---

## 3. Non-Functional Requirements

### 3.1 Users

* Exactly **two users** (couple)
* The meal planning output is for a household of **two adults and two small children**
* Simple email/password authentication
* No public registration
* Both users have **the same rights**

### 3.2 Platforms

* Desktop web browser (primary)
* **Mobile web browser**
* No native app needed

### 3.3 Constraints

* No Google services
* No Amazon services
* No Microsoft services
* Deployment must be manageable by a **non-developer**

### 3.4 Collaboration / Sync

* Both users work on the same shared plan
* **Sync on refresh is enough** for MVP
* No real-time collaboration required
* Activity visibility is desired, scoped to the **current week**:

  * Example: “Joro changed Tuesday dinner”
  * No history beyond the current week required for MVP

---

## 4. Tech Stack

**Decision: Variant A (SvelteKit full-stack)** — chosen by the PO.

The deciding criterion was ease of maintenance and deployment for a non-developer.

### Variant A: SvelteKit Full-Stack

Everything in one project. Frontend and backend API routes live together.

| Layer      | Technology              | Notes                                                      |
| ---------- | ----------------------- | ---------------------------------------------------------- |
| Framework  | SvelteKit (TypeScript)  | Full-stack, file-based routing, HTML-like component syntax |
| Database   | PostgreSQL              | Hosted on Railway                                          |
| ORM        | Drizzle                 | SQL-like, easy to read                                     |
| Auth       | better-auth             | Simple email/password for 2 users                          |
| Deployment | Railway                 | One platform for app + DB, auto-deploy from GitHub         |
| Mobile     | Responsive web app      | Works in mobile browser                                    |
| Bring!     | `bring-api` npm package | Push shopping list with one click                          |

**Pros:**

* Single codebase, single deployment platform
* No context switching between languages
* Simpler operational setup for a non-developer
* SvelteKit component syntax is close to plain HTML — readable for beginners

**Cons:**

* TypeScript/JavaScript only — less familiar for someone with a Python background
* Requires learning SvelteKit conventions (file naming: `+page.svelte`, `+page.server.ts`)

**Railway note:** ~$5/month after free trial. Everything (app + DB) in one place, no cold starts.

### Variant B: SvelteKit Frontend + Python (FastAPI) Backend

Frontend and backend are separate projects/services.

| Layer                 | Technology                            | Notes                               |
| --------------------- | ------------------------------------- | ----------------------------------- |
| Frontend              | SvelteKit (TypeScript)                | UI only, talks to FastAPI via REST  |
| Backend               | FastAPI (Python)                      | REST API, business logic, DB access |
| Database              | PostgreSQL                            | Hosted on Supabase (free tier)      |
| ORM                   | SQLAlchemy or SQLModel                | Python-native, SQL-familiar         |
| Auth                  | Supabase Auth                         | Shared between frontend and backend |
| Deployment (frontend) | Vercel                                | Free tier, auto-deploy from GitHub  |
| Deployment (backend)  | Railway or Render                     | Python container, free/cheap        |
| Mobile                | Responsive web app                    | Works in mobile browser             |
| Bring!                | Python `bring-api` port or HTTP calls | Handled in FastAPI                  |

**Pros:**

* Backend in Python — more familiar for the PO
* FastAPI is beginner-friendly, self-documenting (auto-generates API docs)
* Clear separation of concerns

**Cons:**

* Two codebases to manage and deploy
* Two platforms to maintain
* More moving parts = more things that can break
* Less suitable given the priority of non-developer maintainability

---

## 5. Deployment Comparison

|                     | Railway (Variant A)        | Vercel + Supabase (Variant B)           |
| ------------------- | -------------------------- | --------------------------------------- |
| DB hosting          | Built-in PostgreSQL        | Supabase (separate platform)            |
| Cost                | ~$5/month hobby plan       | Both free tiers, $0 for 2 users         |
| Cold starts         | No (persistent containers) | Vercel functions have minor cold starts |
| Simplicity          | One platform, one login    | Two platforms, two dashboards           |
| Non-techie friendly | Yes                        | Yes, but more fragmented                |
| DB visual UI        | Basic                      | Supabase has an excellent table editor  |

**PO preference driver:** Simplicity for a non-developer matters more than Python familiarity.

---

## 6. Integrations

### 6.1 Bring! Shopping List App

* Library: `bring-api` (npm, unofficial but maintained)
* Capability: add items to a shared list programmatically
* Trigger: user clicks "Send to Bring" after finalizing the meal plan
* Auth: Both users already have a Bring! account. Credentials stored server-side as env variables.
* Behavior:

  * **Append missing items only**
  * One shared Bring! list

### 6.2 Vegetable Basket Service

* Provider: [biogmuesabo.ch](https://biogmuesabo.ch/)
* Status: **Partially investigated**

**Findings:**

* Custom-built AngularJS platform — not Shopify/WooCommerce, no standard integration
* Has an internal `ACM` API (proprietary), not publicly documented
* All content requires an authenticated session — no public basket page

**Next step:** Re-check browser network tab (DevTools) during a week with an active delivery — the basket page was empty during initial investigation so no basket-related API calls were visible. Check what calls appear when the basket actually has content.

**Integration options (in order of preference):**

1. **ACM API with session auth** — if network inspection reveals a clean JSON endpoint, call it with a stored session cookie (to be investigated)
2. **Web scraping with login** — log in programmatically, parse the basket page HTML. Doable but fragile if the site changes.
3. **Screenshot upload** — if API and scraping do not work, user uploads a screenshot of the basket contents and the app extracts the relevant items and quantities
4. **Manual input form** — user enters basket contents in the app once per week

**MVP:** Manual entry is acceptable. Screenshot upload is a fallback option if API and scraping do not work.

---

## 7. Pantry / Basket Logic

### 7.1 Pantry Staples

The shopping list should exclude a fixed list of pantry staples. For MVP, this list is hardcoded and not user-editable:

* salt (Salz)
* pepper (Pfeffer)
* oil (Öl)
* balsamico

### 7.2 Basket Quantities

* Basket contents should support **quantities**

### 7.3 Basket Visibility

* The app should show whether basket ingredients are still unused
* Example:

  * “You still have carrots and leeks unused”

---

## 8. Open Questions

| # | Question                                                                                                       | Owner    | Status  |
| - | -------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 1 | Which tech stack variant should be chosen? (A or B)                                                            | PO       | Closed — Variant A |
| 2 | Does the veggie basket service have a usable API?                                                              | Dev      | Open    |
| 3 | How should screenshot upload work exactly? Manual confirmation after parsing, or fully automatic?              | PO / Dev | Open    |
| 4 | Should pantry ingredients beyond the defined staples be tracked in the app, or ignored in MVP?                 | PO       | Closed — fixed hardcoded list for MVP |
| 5 | What exactly should appear in the activity log/history?                                                        | PO       | Closed — current week only, e.g. "Joro changed Tuesday dinner" |
| 6 | Does biogmuesabo.ch expose basket contents via API? Re-check network calls during active delivery week.        | Dev      | Pending |
| 7 | Should recipe import from URL be included in MVP or postponed?                                                 | PO       | Open    |
| 8 | Should matching support a small synonym/alias list for common ingredient variants in MVP?                      | PO       | Open    |
| 9 | Should matching be multilingual (for example German/English ingredient variants), or just one language in MVP? | PO       | Closed — German only |

## 9. MVP Scope

The following is the suggested minimal first version based on the clarified requirements:

1. Store meals with:

   * name
   * free-text ingredients
   * optional recipe link
   * Expected scale: dozens of recipes
2. Import basket contents manually, with quantities
3. Support later fallback options for:

   * web scraping
   * API integration
   * screenshot upload
4. Compare basket ingredients against stored meals/recipes using normalized ingredient match keys
5. Select meals that use at least one basket ingredient
6. Prefer meals with more basket ingredient matches when auto-filling
7. Auto-fill meals for the **current week only**
8. Leave meal slots empty if there are not enough suitable recipes
9. Allow empty meal slots to be completed manually by:

   * typing a meal name directly into the slot (free-text, stored on the plan entry only — not saved as a new recipe), or
   * selecting a recipe from the stored recipe set
   * Code should make it easy to later add a "save as recipe" flow for free-text entries
10. Fixed weekly structure:

* Monday to Sunday
* lunch and dinner
* no Thursday lunch

11. Prevent the same meal from being used twice in the same week
12. Generate a shopping list only for still-missing ingredients
13. Merge duplicate ingredients automatically
14. Exclude pantry staples from the generated shopping list
15. Push shopping list to one shared Bring! list
16. Append missing items only
17. Login for exactly two users with equal rights
18. Shared plan with sync on refresh
19. Basic activity visibility

### Explicitly out of scope for MVP

* automatic basket scraping
* basket API integration
* favourites
* meal categories/tags
* nutrition tracking
* AI meal suggestions
* real-time collaboration

### Potential exception still to decide

* recipe import from URLs

---

## 10. Recommendation Based on Current Answers

Given your priorities, the requirements currently lean slightly toward **Variant A (SvelteKit full-stack)** because:

* you are **undecided**
* **non-developer maintainability** is your top priority
* the app is small, private, and has only two users
* one codebase and one deployment platform reduce friction
