# Multi-Family Support — Spec / Plan

Status: Draft, awaiting go-ahead. Nothing except this doc and a draft migration file
(`drizzle/0017_families.sql`, not yet applied anywhere) has been touched so far.

## Decisions made (from your answers)

1. **Account model:** multiple logins per family, not one shared login. Each user row
   gets a `family_id`. Keeps the activity log attributable ("Joro changed Tuesday
   dinner") and reuses the existing better-auth user/session tables almost as-is.
2. **Login setup / recovery, no email service:** admin (you) creates a family + first
   member in a new `/admin` screen. The app generates a one-time link
   (`/set-password/<token>`, random token, ~7 day expiry) — no email is sent, you copy
   the link and send it via WhatsApp/Signal yourself. They open it once and set their
   own password. You never see or choose their password. Forgotten password → you
   generate a fresh link the same way.
3. **Per-family integrations:** both Bring! and the Biogmüsabo veggie-box login move
   from env vars into the database, editable per family in Settings. All secrets
   (Bring password, Biogmüsabo password) are stored **encrypted at rest**
   (AES via better-auth's built-in `symmetricEncrypt`, keyed with the existing
   `BETTER_AUTH_SECRET` — no new secret to manage), decrypted only server-side when
   actually calling Bring!/Biogmüsabo.

## What's scoped per family vs. kept global

Per family (private, isolated): recipes, basket, meal plan, activity log,
Vorratskammer (lager), shopping sessions/items, Bring! list prefs, Bring! + Biogmüsabo
credentials, cron sync history.

Kept global/shared across all families (my assumption — flag if you disagree):
ingredient-matching synonym groups, the 30-plants tracking list, the Claude prompt
template, and the hardcoded pantry-staples list. These are generic German
ingredient-matching config, not private household data — duplicating them per family
would make every new family start with empty matching data and degrade auto-fill
quality. Any family can still tune them via Settings; the change is visible to
everyone. Easy to split later if that turns out to be wrong.

## Migration strategy (zero data loss for prod)

One migration (`0017_families.sql`, drafted, not applied):
- New `families` table (id, name, + nullable Bring!/Biogmüsabo credential columns).
- New `signup_tokens` table (the one-time-link mechanism).
- Insert one row into `families` ("Unsere Familie", renamable in Settings) — this
  becomes family 1.
- Add `family_id` to `user` and to every per-family domain table, **backfilled to
  family 1 for all existing rows**, then set `NOT NULL` + FK. Standard
  add-nullable → backfill → constrain pattern, so it's safe against prod's existing
  data.
- Both existing user accounts get `is_admin = true` (so at least one login can reach
  `/admin` after migrating — I don't have your prod emails to target just one of you
  safely). You can demote one with a single `UPDATE user SET is_admin = false WHERE
  email = '...'` afterwards if you want only yourself as admin.
- Existing family's Bring!/Biogmüsabo credential columns stay `NULL` after migration —
  the code falls back to the current env vars whenever a family's DB-stored
  credentials are empty, so **prod keeps working unchanged** until/unless you fill
  them in via the new Settings tab.

## New pieces to build

- `families` + `signup_tokens` tables, `family_id`/`is_admin` on `user`.
- `src/lib/server/crypto.ts` — encrypt/decrypt helper for stored credentials.
- `src/lib/server/families.ts` — create family/member, issue/validate setup tokens.
- `/admin` (isAdmin-only): create family + first member, add member to existing
  family, generate a fresh setup/reset link for any user.
- `/set-password/[token]`: public route, sets the account's password once.
- Settings → new "Familie" tab: rename family, edit Bring! + Biogmüsabo credentials.
- `bring.ts` / `bioabo.ts`: read credentials from the family row (env-var fallback for
  the legacy family), and the basket-sync cron loops over every family that has
  Biogmüsabo credentials configured instead of running once globally.
- Every existing route/query that touches a per-family table gets a
  `family_id = locals.user.familyId` filter added — mechanical but touches most of
  `src/routes/**/+page.server.ts` and `src/lib/server/{bring,bioabo}.ts`. No clever
  abstraction — plain explicit `and(eq(table.familyId, familyId), ...)` on each query,
  matching how the codebase already works.
- `seed.ts` updated so local `npm run db:clean` still bootstraps a family +
  admin user for dev.

## Gaps found on a closer pass

**IDOR-style holes to close (real security gap, not just data listing):** several
actions currently look up a row by bare numeric ID with no ownership check — trivial
to add `family_id` to the `WHERE` today, but easy to forget, so listing them
explicitly:
- `recipes/[id]/edit` load + save, `recipes/+page.server.ts` delete, `recipes/export`
- `basket` updateKey/updateDisplay/remove (currently id + weekStart only)
- `lager` delete
- `shopping` excludeItem/discardSession/updateDates/sendToBring (by sessionId/itemId)
- `settings` deleteListPref
- `plan` moveSlot's from/to entry lookups
- **`plan`'s transient-recipe cleanup** (in `confirmPlan` and `getClaudeSuggestion`) is
  the scariest one: today it scans *all* recipes/plan entries with no scoping at all
  and deletes orphaned transient ones. Once other families exist, an unscoped version
  of this could delete another family's transient recipe. Must be family-filtered.

Every one of these gets a `family_id = locals.user.familyId` condition added, same as
the plain listing queries — just calling out that it's a correctness/security fix on
mutations, not only a "don't show other families' data" filter.

**Two scope assumptions, stated explicitly so you can veto:**
- The Claude-suggestion feature (`ANTHROPIC_API_KEY`) and Fooby recipe search stay on
  your single global API key/config — not per-family. Meal-plan *data* stays isolated
  either way; only the API credential is shared. **Per your instruction:** every
  family gets a `claude_enabled` flag on their `families` row, default **false**, and
  only you can flip it (`/admin` only — not exposed in the family's own Settings). The
  existing family (family 1) is migrated with it set to `true` so today's prod
  behavior doesn't change. The "Claude vorschlagen" button on the plan page is hidden
  entirely for families where it's off, and the server action rejects the call too
  (not just a hidden button).
- No self-service "invite a member to my family" for regular users — adding a member
  to any family (including your own) goes through `/admin`, i.e. only you can do it.
  Matches what you described (you provision accounts); flag if a family should be able
  to add their own second member without going through you.

**Intentionally not building:** promote/demote-admin UI (DB-only for now — there's no
second admin who'd need to grant a third), remove-member/delete-family actions. Small
friend-group scale doesn't need it yet; easy to add later.

## What I need from you before I continue

Nothing blocking — the 3 answers above cover the open forks. I paused because I
jumped into writing the migration before showing you this. If the plan above looks
right, say go and I'll implement it end-to-end (schema, admin/invite flow, encrypted
credentials, and re-scoping every route), then tell you exactly what to run locally
(`npm run db:migrate`, `npm run check`, `npm run test`) and what to check before
deploying to prod — I won't run npm commands myself per your standing preference.
