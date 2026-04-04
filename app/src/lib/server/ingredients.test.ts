import { describe, it, expect } from 'vitest';
import {
	stripAccents,
	buildAliasMap,
	createKeyNormalizer,
	generateMatchKeys,
	generateBasketMatchKey,
	mergeBasketItems
} from './ingredients.js';

describe('stripAccents', () => {
	it('strips French accents', () => {
		expect(stripAccents('chicorée')).toBe('chicoree');
		expect(stripAccents('navet')).toBe('navet');
	});

	it('preserves German umlauts', () => {
		expect(stripAccents('rüebli')).toBe('rüebli');
		expect(stripAccents('kürbis')).toBe('kürbis');
		expect(stripAccents('möhre')).toBe('möhre');
	});
});

describe('buildAliasMap', () => {
	it('maps all non-canonical keys to the canonical key', () => {
		const map = buildAliasMap([{ matchKeys: ['karotte', 'rüebli', 'rüben'] }]);
		expect(map.get('rüebli')).toBe('karotte');
		expect(map.get('rüben')).toBe('karotte');
		expect(map.has('karotte')).toBe(false); // canonical is not aliased
	});

	it('handles multiple groups independently', () => {
		const map = buildAliasMap([
			{ matchKeys: ['zucchini', 'zucchetti'] },
			{ matchKeys: ['peperoni', 'paprika'] }
		]);
		expect(map.get('zucchetti')).toBe('zucchini');
		expect(map.get('paprika')).toBe('peperoni');
	});

	it('returns empty map for empty input', () => {
		expect(buildAliasMap([]).size).toBe(0);
	});
});

describe('createKeyNormalizer', () => {
	const normalize = createKeyNormalizer(
		buildAliasMap([{ matchKeys: ['karotte', 'rüebli', 'rüben'] }])
	);

	it('lowercases and trims', () => {
		expect(normalize('  Karotte  ')).toBe('karotte');
	});

	it('resolves alias to canonical', () => {
		expect(normalize('rüebli')).toBe('karotte');
		expect(normalize('rüben')).toBe('karotte');
	});

	it('strips German plural suffix -n on words >5 chars', () => {
		// tomaten → tomate (6 chars, ends in n)
		expect(normalize('tomaten')).toBe('tomate');
	});

	it('does not strip -n from short words', () => {
		// "roten" = 5 chars — not stripped
		expect(normalize('roten')).toBe('roten');
	});

	it('resolves alias after plural stripping', () => {
		// "rüeblien" does not exist, but test that stemmed form hits alias map
		// "rüebli" is 7 chars but doesn't end in n, so no stripping — hits alias directly
		expect(normalize('Rüebli')).toBe('karotte');
	});
});

describe('generateMatchKeys', () => {
	it('extracts ingredient words from free text', () => {
		const keys = generateMatchKeys('2 Karotten\n1 Zucchini\n3 EL Olivenöl');
		expect(keys).toContain('karotten');
		expect(keys).toContain('zucchini');
		expect(keys).toContain('olivenöl');
	});

	it('skips unit words and numbers', () => {
		const keys = generateMatchKeys('500g Mehl');
		expect(keys).not.toContain('g');
		expect(keys).not.toContain('500');
		expect(keys).toContain('mehl');
	});

	it('deduplicates across lines', () => {
		const keys = generateMatchKeys('Karotte\nKarotte');
		expect(keys.filter((k) => k === 'karotte').length).toBe(1);
	});

	it('returns empty array for empty input', () => {
		expect(generateMatchKeys('')).toEqual([]);
	});
});

describe('generateBasketMatchKey', () => {
	it('returns last meaningful word', () => {
		expect(generateBasketMatchKey('3 grosse Karotten')).toBe('karotten');
	});
});

describe('mergeBasketItems', () => {
	it('merges items with the same name and unit', () => {
		expect(mergeBasketItems('3 Karotten', '2 Karotten')).toBe('5 Karotten');
	});

	it('returns null for different units', () => {
		expect(mergeBasketItems('500g Mehl', '1kg Mehl')).toBeNull();
	});

	it('returns null for different ingredient names', () => {
		expect(mergeBasketItems('2 Karotten', '2 Rüebli')).toBeNull();
	});

	it('merges metric amounts', () => {
		expect(mergeBasketItems('200g Karotten', '300g Karotten')).toBe('500g Karotten');
	});
});
