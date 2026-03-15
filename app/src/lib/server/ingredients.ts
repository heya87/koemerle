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
	'ca', 'etwa', 'nach', 'geschmack', 'belieben', 'bedarf'
]);

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
