# Koemerle — Claude Code Project Instructions

## Project

A weekly meal planning app for two people. Users plan meals based on a weekly vegetable basket delivery and generate a shopping list that is pushed to the Bring! app.

Full requirements: @docs/requirements.md 
Read that file for general architectural tasks or to double-check the exact database structure, tech stack, functional requirements or application architecture.

Keep your replies extremely concise and focus on conveying the key information. No unnecessary fluff, no long code snippets.

## Shell Commands

The user always runs commands from `/Users/joro/workspace/edu/koemerle/app`. Never prefix commands with `cd app &&`.


## Team

- Joël — developer (Java, JavaScript, TypeScript, Angular, SQL)
- Girlfriend — product owner, basic Python and SQL knowledge

Claude Code is the primary development tool. Keep code readable for someone with basic programming skills.

## Tech Stack

**Variant A: SvelteKit full-stack** (decided)

- SvelteKit (TypeScript) — frontend + backend API routes
- PostgreSQL on Railway
- Drizzle ORM
- Auth: Lucia or Supabase Auth
- Deployment: Railway (~$5/month)
- Responsive web app (desktop + mobile browser)
- Bring! API integration via `bring-api` npm package
- Simple email/password auth for 2 users
- No Google / Amazon / Microsoft services

## Key Files

- `docs/requirements.md` — full requirements, open questions, integration notes
- `docs/setup-guide.md` — onboarding guide for the PO

## Coding Conventions

- Keep code simple and readable — avoid clever abstractions
- Prefer explicit over magic where possible
- SQL stays SQL — no query builder chains that obscure what's happening
- Component files should do one thing
- No unnecessary comments — code should be self-explanatory

## Multi-Family

The app is multi-tenant: every login belongs to a `family` (`user.family_id`), and every
per-family table (recipes, basket, meal plan, activity log, lager, shopping, Bring!/
Biogmüsabo credentials) has a `family_id` column. **Any query or mutation on those
tables must filter by `locals.user.familyId`** — including lookups by a single row id
(edit/delete/exclude actions), not just listing queries. `ingredient_groups`,
`plant_foods`, and `site_settings` are the exception — shared across all families on
purpose (see `docs/multi-family-plan.md`).

No public registration. Accounts are created by a platform admin (`user.is_admin`) in
`/admin` and activated via a one-time `/set-password/<token>` link — see
`src/lib/server/families.ts`. Full design: `docs/multi-family-plan.md`.

## Database Migrations

Migrations are plain SQL files in `app/drizzle/`. No `db:generate` — files are written by hand.

**Adding a migration:**
1. Create `app/drizzle/NNNN_description.sql` with the SQL (e.g. `ALTER TABLE ...`)
2. Append an entry to `app/drizzle/meta/_journal.json`:
   ```json
   { "idx": N, "version": "7", "when": 1234567890000, "tag": "NNNN_description", "breakpoints": true }
   ```
   `when` is a Unix timestamp in milliseconds. **Must be strictly greater than the previous entry's `when`** — Drizzle uses this to determine which migrations are newer than the last applied one. Use `Date.now()` or increment the previous value by 1000.
3. Run `npm run db:migrate` (prod) or `npm run db:clean` (local full reset).

**Critical rule — never edit a migration file that has been applied to prod.**
Once a migration runs on prod, it is permanent. If you made a mistake, create a new migration to fix it. Editing an existing migration file after it has been deployed will cause the migration chain to diverge between environments and break future deploys. If unsure whether a migration has been applied to prod, check the `drizzle.__drizzle_migrations` table on the prod DB.

## Open Decisions

- Vegetable basket integration (biogmuesabo.ch) — re-check API when next delivery is active
