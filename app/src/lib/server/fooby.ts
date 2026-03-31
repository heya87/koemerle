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

	// Extract image from JSON-LD
	const ldMatch = html.match(/"@type"\s*:\s*"Recipe"[\s\S]*?"image"\s*:\s*"([^"]+)"/);
	const imageUrl = ldMatch ? ldMatch[1] : null;

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

	const recipe: FoobyRecipe = { name, url: recipeUrl, imageUrl, ingredients: lines.join('\n') };
	recipeCache.set(recipeUrl, { recipe, expiresAt: Date.now() + CACHE_TTL_MS });
	return recipe;
}
