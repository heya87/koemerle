import { generateMatchKeys, mergeBasketItems, stripAccents, type KeyNormalizer } from './ingredients';

// Suffix-based matching so "Meersalz", "Olivenöl", "Mineralwasser" etc. are also excluded.
const PANTRY_SUFFIXES = ['salz', 'pfeffer', 'öl', 'wasser', 'balsamico', 'essig'];

function isPantryStaple(matchKey: string): boolean {
	return PANTRY_SUFFIXES.some((s) => matchKey === s || matchKey.endsWith(s));
}

/**
 * Derives the canonical lookup key for a recipe name.
 * Strips parenthetical parts like "(Betty Bossi)", then returns the first meaningful word.
 * e.g. "Kuchenteig (Betty Bossi)" → "kuchenteig"
 */
function recipeCanonicalKey(name: string): string {
	const base = name.replace(/\(.*?\)/g, '').trim();
	const keys = generateMatchKeys(base);
	return stripAccents(keys[0]?.toLowerCase() ?? '');
}

export type ShoppingItem = { displayText: string; matchKey: string };

/**
 * Computes what still needs to be bought:
 * planned recipe ingredients minus basket items minus pantry staples.
 *
 * If an ingredient line matches the name of another recipe (e.g. "Kuchenteig"),
 * that recipe's own ingredients are expanded in place (one level deep).
 */
const defaultNormalize: KeyNormalizer = (k) => stripAccents(k.toLowerCase().trim());

export function computeShoppingList(
	recipeIngredientsList: string[],
	basketMatchKeys: string[],
	expansionRecipes: { name: string; ingredients: string }[] = [],
	normalize: KeyNormalizer = defaultNormalize
): ShoppingItem[] {
	const basketKeys = new Set(basketMatchKeys.map((k) => normalize(k)));

	// Build expansion map: canonical recipe name key → ingredients text
	const expansionMap = new Map<string, string>();
	for (const r of expansionRecipes) {
		const key = recipeCanonicalKey(r.name);
		if (key) expansionMap.set(key, r.ingredients);
	}

	const result = new Map<string, ShoppingItem>();

	function processLine(line: string, allowExpansion: boolean) {
		const trimmed = line.trim();
		if (!trimmed) return;

		const keys = generateMatchKeys(trimmed);
		if (keys.length === 0) return;
		const rawKey = stripAccents(keys.at(-1)!.toLowerCase());
		const matchKey = normalize(keys.at(-1)!);

		if (basketKeys.has(matchKey)) return;
		if (isPantryStaple(matchKey)) return;

		// Expand sub-recipe one level deep (e.g. "Kuchenteig" → Betty Bossi ingredients).
		// Use rawKey so alias normalization doesn't accidentally match unrelated recipe names.
		if (allowExpansion && expansionMap.has(rawKey)) {
			const subIngredients = expansionMap.get(rawKey)!;
			for (const subLine of subIngredients.split('\n')) {
				processLine(subLine, false);
			}
			return;
		}

		if (result.has(matchKey)) {
			const existing = result.get(matchKey)!;
			const merged = mergeBasketItems(existing.displayText, trimmed);
			if (merged) {
				result.set(matchKey, { displayText: merged, matchKey });
			}
			// if amounts can't be merged (different units), keep first occurrence
		} else {
			result.set(matchKey, { displayText: trimmed, matchKey });
		}
	}

	for (const ingredients of recipeIngredientsList) {
		for (const line of ingredients.split('\n')) {
			processLine(line, true);
		}
	}

	return [...result.values()];
}
