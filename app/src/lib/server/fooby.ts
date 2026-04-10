const CACHE_TTL_MS = parseInt(process.env.FOOBY_CACHE_TTL_MINUTES ?? '1440') * 60 * 1000;

type CacheEntry = { recipe: FoobyRecipe; expiresAt: number };
const recipeCache = new Map<string, CacheEntry>();

export type FoobySearchResult = {
	id: string;
	name: string;
	url: string;
};

export type FoobyRecipe = {
	name: string;
	url: string;
	imageUrl: string | null;
	ingredients: string; // newline-separated display text, ready for the recipe form
	kcal: number | null;
	fatG: number | null;
	carbsG: number | null;
	proteinG: number | null;
};

/**
 * Searches fooby.ch for recipes matching the query.
 */
export async function searchFooby(query: string): Promise<FoobySearchResult[]> {
	const url = new URL('https://fooby.ch/hawaii_search.sri');
	url.searchParams.set('query', query);
	url.searchParams.set('lang', 'de');
	url.searchParams.set('treffertyp', 'rezepte');
	url.searchParams.set('num', '10');

	const res = await fetch(url.toString());
	if (!res.ok) throw new Error(`Fooby search failed: ${res.status}`);

	const data = await res.json();
	const results: FoobySearchResult[] = [];

	for (const item of data.results ?? []) {
		if (!item.recipe_id || !item.title || !item.url) continue;
		results.push({
			id: String(item.recipe_id),
			name: item.title.trim(),
			url: item.url.startsWith('http') ? item.url : `https://fooby.ch${item.url}`
		});
	}

	return results;
}

function parseNutrientStr(val: unknown): number | null {
	if (typeof val !== 'string') return null;
	const n = parseFloat(val.replace(/[^\d.]/g, ''));
	return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/**
 * Fetches a fooby recipe page and extracts name + ingredients.
 */
export async function fetchFoobyRecipe(recipeUrl: string): Promise<FoobyRecipe> {
	const cached = recipeCache.get(recipeUrl);
	if (cached && cached.expiresAt > Date.now()) return cached.recipe;

	const res = await fetch(recipeUrl, {
		headers: { 'Accept-Language': 'de-CH,de;q=0.9' }
	});
	if (!res.ok) throw new Error(`Fooby fetch failed: ${res.status}`);

	const html = await res.text();

	// Extract recipe name from og:title meta tag
	const nameMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
	const name = nameMatch ? nameMatch[1].trim() : '';

	// Extract Recipe JSON-LD block
	let imageUrl: string | null = null;
	let kcal: number | null = null;
	let fatG: number | null = null;
	let carbsG: number | null = null;
	let proteinG: number | null = null;

	const ldBlockMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
	if (ldBlockMatch) {
		for (const block of ldBlockMatch) {
			const jsonStr = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
			try {
				const ld = JSON.parse(jsonStr);
				if (ld['@type'] === 'Recipe') {
					imageUrl = typeof ld.image === 'string' ? ld.image : null;
					const n = ld.nutrition;
					if (n) {
						kcal = parseNutrientStr(n.calories);
						fatG = parseNutrientStr(n.fatContent);
						carbsG = parseNutrientStr(n.carbohydrateContent);
						proteinG = parseNutrientStr(n.proteinContent);
					}
					break;
				}
			} catch {
				// ignore malformed blocks
			}
		}
	}

	// Extract structured ingredient data from portion calculator attribute
	const dataMatch = html.match(/data-portion-calculator-initial-all-ingredients="([^"]+)"/);
	if (!dataMatch) throw new Error('Zutaten nicht gefunden auf dieser Fooby-Seite');

	const json = dataMatch[1].replaceAll('&#34;', '"').replaceAll('&quot;', '"');
	const parsed = JSON.parse(json) as {
		ingredients: { quantity: number; measure: string; desc: string }[];
	};

	const lines = parsed.ingredients.map(({ quantity, measure, desc }) => {
		const qty = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
		return measure ? `${qty} ${measure} ${desc}` : `${qty} ${desc}`;
	});

	const recipe: FoobyRecipe = { name, url: recipeUrl, imageUrl, ingredients: lines.join('\n'), kcal, fatG, carbsG, proteinG };
	recipeCache.set(recipeUrl, { recipe, expiresAt: Date.now() + CACHE_TTL_MS });
	return recipe;
}
