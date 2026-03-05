# Koemerle — Claude Code Project Instructions

## Project

A weekly meal planning app for two people. Users plan meals based on a weekly vegetable basket delivery and generate a shopping list that is pushed to the Bring! app.

Full requirements: `docs/requirements.md`

## Team

- Joël — developer (Java, JavaScript, TypeScript, Angular, SQL)
- Girlfriend — product owner, basic Python and SQL knowledge

Claude Code is the primary development tool. Keep code readable for someone with basic programming skills.

## Tech Stack

**Decision pending** — two variants under consideration. Update this section once decided.

### Variant A: SvelteKit full-stack
- SvelteKit (TypeScript) — frontend + backend API routes
- PostgreSQL on Railway
- Drizzle ORM

### Variant B: SvelteKit + Python backend
- SvelteKit (TypeScript) — frontend only
- FastAPI (Python) — REST API
- PostgreSQL on Supabase
- SQLAlchemy / SQLModel

### Common to both
- PWA for iPhone (Safari, add-to-homescreen)
- Bring! API integration for shopping list
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

## Open Decisions

- Tech stack variant (A or B) — PO to decide
- Vegetable basket integration (biogmuesabo.ch) — re-check API when next delivery is active
