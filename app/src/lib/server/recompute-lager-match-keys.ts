/**
 * One-off fix: recomputes match_key for all existing lager_items using the current
 * generateBasketMatchKey logic (picks a specific word over a generic one, e.g.
 * "Miso-Paste" → "miso" instead of "paste"). Safe to re-run.
 * Usage: npx tsx src/lib/server/recompute-lager-match-keys.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './db/schema';
import { lagerItems } from './db/schema';
import { generateBasketMatchKey } from './ingredients';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const items = await db.select().from(lagerItems);
let changed = 0;

for (const item of items) {
	const newKey = generateBasketMatchKey(item.displayText);
	if (newKey !== item.matchKey) {
		console.log(`${item.displayText}: ${item.matchKey} → ${newKey}`);
		await db.update(lagerItems).set({ matchKey: newKey }).where(eq(lagerItems.id, item.id));
		changed++;
	}
}

console.log(`Done. ${changed}/${items.length} updated.`);
await client.end();
