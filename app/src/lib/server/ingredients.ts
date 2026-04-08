const UNITS = new Set([
	'g', 'kg', 'mg', 'ml', 'cl', 'dl', 'l',
	'el', 'tl', 'stk', 'stück', 'stücke',
	'prise', 'prisen', 'bund', 'bünde',
	'scheibe', 'scheiben', 'dose', 'dosen',
	'glas', 'gläser', 'becher', 'packung', 'packungen', 'pkg',
	'zehe', 'zehen', 'blatt', 'blätter',
	'zweig', 'zweige', 'stange', 'stangen',
	'tropfen', 'handvoll'
]);

const STOP_WORDS = new Set([
	'die', 'der', 'das', 'ein', 'eine', 'einen', 'einem', 'einer',
	'und', 'oder', 'mit', 'ohne', 'nach', 'aus', 'von', 'für',
	'ca', 'etwa', 'nach', 'geschmack', 'belieben', 'bedarf',
	// Quality/format descriptors that appear after the ingredient name
	'klasse', 'ganz', 'ganze', 'ganzen', 'frisch', 'frische', 'frischen'
]);

/**
 * Strips accents from a match key for comparison purposes.
 * Handles French accents while preserving German umlauts.
 */
export function stripAccents(key: string): string {
	return key
		.replace(/[éèêë]/g, 'e')
		.replace(/[àâ]/g, 'a')
		.replace(/[îï]/g, 'i')
		.replace(/[ôœ]/g, 'o')
		.replace(/[ûùú]/g, 'u')
		.replace(/[ç]/g, 'c');
}

/**
 * Strips the most common German plural suffix (-n) from a word.
 * Conservative: only applies to words longer than 5 chars to avoid mangling short words.
 * Covers: Karotten→Karotte, Randen→Rande, Tomaten→Tomate, Zwiebeln→Zwiebel.
 */
function stripGermanPlural(word: string): string {
	if (word.length > 5 && word.endsWith('n')) return word.slice(0, -1);
	return word;
}

/**
 * The matching contract. A KeyNormalizer maps a raw ingredient key to a
 * canonical comparison form. Swap the implementation in createKeyNormalizer
 * to change the matching strategy without touching any call sites.
 */
export type KeyNormalizer = (key: string) => string;

/**
 * Builds an alias map from ingredient groups.
 * First key in each group is canonical; all others map to it.
 */
export function buildAliasMap(groups: { matchKeys: string[] }[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const group of groups) {
		const [canonical, ...aliases] = group.matchKeys;
		for (const alias of aliases) map.set(alias, canonical);
	}
	return map;
}

/**
 * Creates a KeyNormalizer from a synonym alias map (alias → canonical).
 * Normalization pipeline: lowercase → strip accents → strip German plural suffix → synonym lookup.
 */
export function createKeyNormalizer(aliasMap: Map<string, string>): KeyNormalizer {
	return (key: string): string => {
		const base = stripAccents(key.toLowerCase().trim());
		const stemmed = stripGermanPlural(base);
		return aliasMap.get(stemmed) ?? aliasMap.get(base) ?? stemmed;
	};
}

/**
 * Returns the Monday of the week containing the given date, as YYYY-MM-DD.
 */
export function getWeekStart(date: Date = new Date()): string {
	const d = new Date(date);
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return d.toISOString().split('T')[0];
}

/**
 * Generates normalized match keys from a free-text ingredients string.
 * Each line is one ingredient. Numbers, units and stop words are stripped.
 * Returns deduplicated lowercase keys.
 */
export function generateMatchKeys(ingredients: string): string[] {
	const keys = new Set<string>();

	for (const line of ingredients.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const normalized = trimmed
			.toLowerCase()
			// Normalize French/Italian accented vowels (keep German ä/ö/ü intact)
			.replace(/[éèêë]/g, 'e')
			.replace(/[àâ]/g, 'a')
			.replace(/[îï]/g, 'i')
			.replace(/[ôœ]/g, 'o')
			.replace(/[ûùú]/g, 'u')
			.replace(/[ç]/g, 'c')
			.replace(/[\d.,½¼¾⅓⅔]+/g, ' ')
			.replace(/[^\p{L}\s]/gu, ' ');

		for (const word of normalized.split(/\s+/)) {
			if (!word || word.length < 3) continue;
			if (UNITS.has(word) || STOP_WORDS.has(word)) continue;
			keys.add(word);
		}
	}

	return [...keys];
}

/**
 * Generates a single match key for one basket item line.
 * Takes the last meaningful word (typically the main ingredient noun in German).
 */
export function generateBasketMatchKey(line: string): string {
	const keys = generateMatchKeys(line);
	return keys.at(-1) ?? line.toLowerCase().trim();
}

// Units that are written attached to the number (e.g. "500g"), no space before ingredient name.
const METRIC_UNITS = new Set(['g', 'kg', 'mg', 'ml', 'cl', 'dl', 'l']);

type ParsedItem = { amount: number; unit: string; name: string };

function parseItem(text: string): ParsedItem | null {
	const t = text.trim();

	// "500g Karotten" or "2dl Rahm"
	let m = t.match(/^(\d+(?:[.,]\d+)?)(g|kg|mg|ml|cl|dl|l)\s+(.+)$/i);
	if (m) return { amount: parseFloat(m[1].replace(',', '.')), unit: m[2].toLowerCase(), name: m[3] };

	// "2 EL Öl" or "1 Bund Petersilie"
	m = t.match(/^(\d+(?:[.,]\d+)?)\s+(el|tl|bund|prise|stk|stück|zehe|zweig|scheibe|dose|glas|becher|packung)\s+(.+)$/i);
	if (m) return { amount: parseFloat(m[1].replace(',', '.')), unit: m[2].toLowerCase(), name: m[3] };

	// "3 Karotten" or "2 Eier"
	m = t.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
	if (m) return { amount: parseFloat(m[1].replace(',', '.')), unit: '', name: m[2] };

	return null;
}

function formatItem({ amount, unit, name }: ParsedItem): string {
	const num = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
	if (!unit) return `${num} ${name}`;
	if (METRIC_UNITS.has(unit)) return `${num}${unit} ${name}`;
	return `${num} ${unit.toUpperCase()} ${name}`;
}

/**
 * Tries to merge two basket item display texts by adding their amounts.
 * Returns the merged string, or null if merging is not possible
 * (e.g. different units or incompatible formats).
 */
export function mergeBasketItems(existing: string, added: string): string | null {
	const a = parseItem(existing);
	const b = parseItem(added);
	if (!a || !b) return null;
	if (a.unit !== b.unit) return null;
	if (a.name.toLowerCase() !== b.name.toLowerCase()) return null;
	return formatItem({ amount: a.amount + b.amount, unit: a.unit, name: a.name });
}
